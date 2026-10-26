/**
 * Lo que el editor de secciones sabe de una sección, leído del diccionario del backend
 * (`GET /dictionary?kind=<sección>`): qué campos hay, en qué orden, de qué tipo, con qué
 * rango y cuándo se muestran. Funciones puras, sin React.
 */
import type { DictionaryEntry, ValidationIssue } from '../services/apiV2';

export interface EnumChoice {
  value: string;
  label: string;
}

export const SCALAR_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'enum', 'date']);

export interface SectionSchema {
  byKey: Map<string, DictionaryEntry>;
  /** Campos hijos directos de `prefix` ('' = la sección), en orden de pantalla. */
  children: (prefix: string) => DictionaryEntry[];
  /** Valores de un enumerado, con su etiqueta del diccionario (nunca el código a la vista). */
  enumValues: (key: string) => EnumChoice[];
}

export function buildSchema(entries: DictionaryEntry[]): SectionSchema {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const campos = entries.filter((e) => e.category !== 'enum');
  return {
    byKey,
    children: (prefix) => campos
      .filter((e) => (prefix === '' ? !e.key.includes('.') : e.key.startsWith(`${prefix}.`)
        && !e.key.slice(prefix.length + 1).includes('.')))
      .sort((a, b) => (a.ui_order ?? 0) - (b.ui_order ?? 0)),
    enumValues: (key) => entries.filter((e) => e.category === 'enum' && e.parent_key === key)
      .map((e) => ({ value: e.field, label: e.label || e.field })),
  };
}

export function isScalar(e: DictionaryEntry): boolean {
  return SCALAR_TYPES.has(e.data_type);
}

/**
 * `visible_if` del schema: `campo == 'valor'`, `campo != 'valor'` o `campo` (booleano),
 * sobre la misma fila u objeto. Una condición que no se entiende se toma como visible.
 */
export function isVisible(expr: string | null | undefined, row: Record<string, unknown>): boolean {
  if (!expr) return true;
  const m = expr.match(/^\s*([A-Za-z_]\w*)\s*(==|!=)\s*'([^']*)'\s*$/);
  if (m) return m[2] === '==' ? row[m[1]] === m[3] : row[m[1]] !== m[3];
  const b = expr.match(/^\s*(not\s+)?([A-Za-z_]\w*)\s*$/);
  if (b) return b[1] ? !row[b[2]] : Boolean(row[b[2]]);
  return true;
}

/**
 * Por qué un campo con `visible_if` no aplica a una fila (null = aplica). Una condición
 * `campo == / != 'valor'` sobre un campo todavía vacío no aplica hasta elegirlo
 * ('pending'): con el tipo de poza sin elegir no se sabe qué pide la poza.
 */
export type NotApplicable =
  | { kind: 'pending' | 'pond_type' | 'value' | 'flag_on' | 'flag_off'; field: string };

export function notApplicable(expr: string | null | undefined, row: Record<string, unknown>): NotApplicable | null {
  if (!expr) return null;
  const m = expr.match(/^\s*([A-Za-z_]\w*)\s*(==|!=)\s*'([^']*)'\s*$/);
  if (m) {
    const v = row[m[1]];
    if (v === null || v === undefined || v === '') return { kind: 'pending', field: m[1] };
    if (isVisible(expr, row)) return null;
    return { kind: m[1] === 'pond_type' ? 'pond_type' : 'value', field: m[1] };
  }
  const b = expr.match(/^\s*(not\s+)?([A-Za-z_]\w*)\s*$/);
  if (b) return isVisible(expr, row) ? null : { kind: b[1] ? 'flag_off' : 'flag_on', field: b[2] };
  return null;
}

/** Las filas sin los valores de los campos que no les aplican: no se piden ni se mandan. */
export function dropNotApplicable(rows: Record<string, unknown>[], entries: DictionaryEntry[]): Record<string, unknown>[] {
  const condicionados = entries.filter((e) => e.visible_if);
  if (condicionados.length === 0) return rows;
  return rows.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };
    for (const e of condicionados) if (notApplicable(e.visible_if, r)) delete out[e.field];
    return out;
  });
}

/**
 * Qué partes de la sección no aplican según sus elecciones (alimentación, composición,
 * parámetros por fecha): no se muestran, y al guardar no se mandan.
 */
export function hiddenTopLevel(payload: Record<string, unknown>): Set<string> {
  const ocultos = new Set<string>();
  const kind = String(payload.kind ?? '');
  const deEjecucion = payload.feed_source === 'execution';
  if (deEjecucion) {
    ocultos.add('composition_mode');
    ocultos.add('brine_composition_pct');
    ocultos.add('scenarios');
    if (kind === 'liming_dynamic') ocultos.add('series');
  } else if (payload.composition_mode === 'per_row') {
    ocultos.add('brine_composition_pct');
  }
  if (payload.pond_params_mode !== 'by_date') ocultos.add('pond_param_changes');
  return ocultos;
}

/** Columnas de una serie diaria que aplican a la sección. */
export function seriesColumns(payload: Record<string, unknown>): string[] {
  const kind = String(payload.kind ?? '');
  const deEjecucion = payload.feed_source === 'execution';
  if (kind === 'liming_dynamic') return ['brine_flow_t_d'];
  const clima = ['evaporation_mm_d', 'temperature_C'];
  return kind === 'postliming_dynamic' && deEjecucion ? clima : [...clima, 'brine_flow_t_d'];
}

/** Un número escrito a mano o pegado de Excel: admite coma decimal y separador de miles. */
export function parseNumber(text: string): number | null {
  const s = text.trim().replace(/\s/g, '');
  if (s === '') return null;
  let n = s;
  if (n.includes(',') && n.includes('.')) {
    // 1.234,5 (coma decimal) o 1,234.5 (punto decimal): manda el último separador.
    n = n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.')
      : n.replace(/,/g, '');
  } else if (n.includes(',')) {
    n = n.replace(',', '.');
  }
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/** Filas pegadas desde Excel (tabulador) o un CSV con `;`. */
export function parsePaste(text: string): string[][] {
  return text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
    .map((l) => l.split(l.includes('\t') ? '\t' : ';'));
}

/** El valor de una celda según el tipo del campo. Vacío = null. */
export function coerce(e: DictionaryEntry, text: string): unknown {
  const t = text.trim();
  if (t === '') return null;
  switch (e.data_type) {
    case 'number': return parseNumber(t);
    case 'integer': { const v = parseNumber(t); return v == null ? null : Math.round(v); }
    case 'boolean': return ['1', 'true', 'si', 'sí', 'yes', 'x', 'verdadero'].includes(t.toLowerCase());
    default: return t;
  }
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Problemas de validación de un campo (y fila, 1-based) de la sección. */
export function issuesAt<T extends ValidationIssue>(issues: T[], field: string, row?: number): T[] {
  return issues.filter((i) => i.field === field && (row === undefined || i.row == null || i.row === row));
}

// ---------------------------------------------------------------------------
// Errores y avisos
// ---------------------------------------------------------------------------
/**
 * Un problema del informe de validación con su gravedad. El informe trae dos listas
 * (`errors` y `warnings`) y el editor las junta para ubicar cada problema en su campo y
 * fila; la gravedad dice cómo se pinta: un error en rojo (no se guarda), un aviso en ámbar
 * (se guarda igual: p. ej. `default_applied`). Sin gravedad, se toma como error.
 */
export type Severity = 'error' | 'warning';
export type EditorIssue = ValidationIssue & { severity?: Severity };

export function tagIssues(report: { errors?: ValidationIssue[]; warnings?: ValidationIssue[] } | null | undefined): EditorIssue[] {
  return [
    ...(report?.errors ?? []).map((i): EditorIssue => ({ ...i, severity: 'error' })),
    ...(report?.warnings ?? []).map((i): EditorIssue => ({ ...i, severity: 'warning' })),
  ];
}

export function isWarning(i: EditorIssue): boolean {
  return i.severity === 'warning';
}

export function splitIssues<T extends EditorIssue>(issues: T[]): { errors: T[]; warnings: T[] } {
  return { errors: issues.filter((i) => !isWarning(i)), warnings: issues.filter(isWarning) };
}

/** Los mensajes juntos para la ayuda de una celda; undefined si no hay. */
export function joinMessages(issues: ValidationIssue[]): string | undefined {
  return issues.map((p) => p.message).join(' · ') || undefined;
}

// ---------------------------------------------------------------------------
// Valores por defecto documentados (cambios finales, punto 21)
// ---------------------------------------------------------------------------
/**
 * El valor por defecto de un campo con su tipo, o undefined si no tiene. El diccionario
 * lo trae como texto ('15.0', '0.01', 'true', 'fixed'): se lee con el tipo del campo.
 */
export function defaultOf(e: DictionaryEntry): unknown {
  const d = e.default_value;
  if (d === null || d === undefined || d.trim() === '' || !isScalar(e)) return undefined;
  if (e.data_type === 'boolean') {
    const s = d.trim().toLowerCase();
    return s === 'true' ? true : s === 'false' ? false : undefined;
  }
  const v = coerce(e, d);
  return v === null ? undefined : v;
}

/** Un default que es "nada" (0, falso, texto vacío): vacío ya significa eso. Es la misma
 * regla del backend para no avisar (`section_defaults.is_nothing`). */
export function isNothing(v: unknown): boolean {
  return v === undefined || v === null || v === false || v === '' || v === 0;
}

/** El valor es el por defecto documentado del campo (y ese default dice algo). */
export function isDefaultValue(e: DictionaryEntry, value: unknown): boolean {
  const d = defaultOf(e);
  return !isNothing(d) && value === d;
}

/** El campo está vacío y tiene un default documentado: el backend lo aplica con aviso. */
export function takesDefaultWhenEmpty(e: DictionaryEntry, value: unknown): boolean {
  return (value === null || value === undefined || value === '') && !isNothing(defaultOf(e));
}

// ---------------------------------------------------------------------------
// Fichas de reactivos (cambios finales, punto 8)
// ---------------------------------------------------------------------------
/** La línea de lo no identificado de un reactivo ("Inertes / otros"): solo va a la torta. */
export const INERTS = 'inertes';

export function isInerts(species: unknown): boolean {
  return typeof species === 'string' && species.trim().toLowerCase() === INERTS;
}

/** Suma de las fracciones de las impurezas de una ficha. */
export function impuritiesSum(impurities: Record<string, unknown>[] | null | undefined): number {
  return (impurities ?? []).reduce((a, i) => a + (typeof i?.frac === 'number' ? i.frac : 0), 0);
}

/** Pureza de un reactivo: 1 − Σ impurezas (sin impurezas, 1). La misma cuenta que el
 * backend; solo se muestra, no se manda. */
export function computedPurity(impurities: Record<string, unknown>[] | null | undefined): number {
  return 1 - impuritiesSum(impurities);
}

/**
 * Las fichas como se mandan: sin `purity_frac` (la calcula el backend; una pureza vieja
 * que quedara en el formulario después de borrar una impureza le agregaría inertes) y con
 * la línea de inertes siempre a la torta, como se ve en pantalla.
 */
export function reagentsForSave(reagents: unknown): unknown {
  if (!reagents || typeof reagents !== 'object' || Array.isArray(reagents)) return reagents;
  return Object.fromEntries(Object.entries(reagents as Record<string, unknown>).map(([r, ficha]) => {
    if (!ficha || typeof ficha !== 'object') return [r, ficha];
    const { purity_frac: _p, ...resto } = ficha as Record<string, unknown>;
    const imps = resto.impurities;
    if (Array.isArray(imps)) {
      resto.impurities = imps.map((i) => (i && typeof i === 'object' && isInerts((i as Row).species)
        ? { ...(i as Row), destination: 'cake' } : i));
    }
    return [r, resto];
  }));
}

// ---------------------------------------------------------------------------
// Medio de lavado de la torta (cambios finales, punto 22)
// ---------------------------------------------------------------------------
/** Una composición sin ninguna especie con valor (vacía, o todo en 0). */
export function isEmptyComposition(comp: unknown): boolean {
  if (!comp || typeof comp !== 'object') return true;
  return !Object.values(comp as Record<string, unknown>).some((v) => typeof v === 'number' && v !== 0);
}

/** El medio de lavado es el por defecto: agua 100 %. */
export function isWaterOnly(comp: unknown): boolean {
  if (isEmptyComposition(comp)) return false;
  const con = Object.entries(comp as Record<string, unknown>).filter(([, v]) => typeof v === 'number' && v !== 0);
  return con.length === 1 && con[0][0] === 'H2O' && Math.abs((con[0][1] as number) - 100) <= PCT_TOLERANCE;
}

/** La planta como se manda: fichas sin pureza y el medio de lavado vacío como `null`
 * (el backend usa agua 100 % y avisa; `{}` sería un error). */
function plantForSave(plant: unknown): unknown {
  if (!plant || typeof plant !== 'object' || Array.isArray(plant)) return plant;
  const out: Row = { ...(plant as Row) };
  if ('reagents' in out) out.reagents = reagentsForSave(out.reagents);
  if ('cake_wash_medium_pct' in out && isEmptyComposition(out.cake_wash_medium_pct)) {
    out.cake_wash_medium_pct = null;
  }
  return out;
}

/**
 * La sección lista para mandar: sin lo que no aplica (partes de la sección y, con el
 * esquema, los campos de cada fila que su `visible_if` deja fuera: el tipo de poza, el
 * marco de alturas), y las series con una columna entera vacía como serie no cargada.
 */
export function cleanPayload(payload: Record<string, unknown>, schema?: SectionSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  for (const k of hiddenTopLevel(payload)) delete out[k];
  if (schema) {
    for (const [k, v] of Object.entries(out)) {
      if (Array.isArray(v) && k !== 'initial_states') {
        out[k] = dropNotApplicable(v as Record<string, unknown>[], schema.children(k));
      }
    }
  }
  const serie = out.series as Record<string, unknown> | undefined;
  if (serie) {
    const s: Record<string, unknown> = { series_start_date: serie.series_start_date };
    for (const c of seriesColumns(payload)) {
      const v = serie[c] as (number | null)[] | undefined;
      if (v && v.some((x) => x !== null && x !== undefined)) s[c] = v;
    }
    const comps = serie.composition_pct_by_day as (Record<string, number> | null)[] | undefined;
    if (payload.composition_mode === 'per_row' && comps && comps.some(Boolean)) {
      s.composition_pct_by_day = comps;
    }
    out.series = s;
  }
  if (Array.isArray(out.initial_states)) {
    out.initial_states = initialStatesForSave(out.initial_states as Record<string, unknown>[],
      (out.ponds as Record<string, unknown>[] | undefined) ?? [], bufferCondition(schema));
  }
  if ('plant' in out) out.plant = plantForSave(out.plant);
  // Un campo vaciado queda en `null` y se manda así: con un default documentado el
  // backend lo aplica y avisa (`default_applied`); no se borra ni se omite.
  return out;
}

// ---------------------------------------------------------------------------
// Serie diaria como archivo CSV (importar y exportar)
// ---------------------------------------------------------------------------
export type SeriesCsvResult =
  | { ok: true; n: number; start: string | null; values: Record<string, (number | null)[]>;
      composition: (Record<string, number> | null)[] | null }
  | { ok: false; error: 'empty' | 'no_columns' };

/** Cómo se reconoce cada columna de la serie en un encabezado (también el CSV antiguo). */
const PREFIJOS: Record<string, string[]> = {
  evaporation_mm_d: ['evap'],
  temperature_C: ['temp'],
  brine_flow_t_d: ['brine_flow', 'flow', 'caudal'],
};

/** "2024-01-23", "23-01-2024" o "23/01/2024" → "2024-01-23"; otra cosa, null. */
export function toIsoDate(text: string): string | null {
  const s = text.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Filas de un CSV: separador tabulador, `;` o `,` (el que traiga la primera línea). Con
 * `,` como separador, el decimal tiene que ser punto; con `;` o tabulador, vale la coma. */
export function parseCsvRows(text: string): string[][] {
  const lineas = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lineas.length === 0) return [];
  const sep = lineas[0].includes('\t') ? '\t' : lineas[0].includes(';') ? ';' : ',';
  return lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
}

function normal(h: string): string {
  return h.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Un CSV de la serie diaria. Con encabezado, las columnas se reconocen por nombre (la
 * fecha, cada columna de la serie y cada especie); sin él, por posición: fecha
 * (opcional), las columnas de la serie y las especies, como al pegar. La fecha de la
 * primera fila, si viene, es el inicio de la serie.
 */
export function parseSeriesCsv(text: string, cols: string[], species: string[] = []): SeriesCsvResult {
  const filas = parseCsvRows(text);
  if (filas.length === 0) return { ok: false, error: 'empty' };
  const esEncabezado = filas[0].some((c) => c !== '' && parseNumber(c) === null && toIsoDate(c) === null);
  let idxFecha = -1;
  const idx: Record<string, number> = {};
  const idxEsp: Record<string, number> = {};
  let datos = filas;
  if (esEncabezado) {
    const h = filas[0].map(normal);
    idxFecha = h.findIndex((x) => x === 'date' || x === 'fecha');
    cols.forEach((c) => {
      const exacta = h.indexOf(c.toLowerCase());
      idx[c] = exacta >= 0 ? exacta : h.findIndex((x) => (PREFIJOS[c] ?? []).some((p) => x.startsWith(p)));
    });
    const crudos = filas[0].map((x) => x.replace(/\s*\([^)]*\)\s*$/, '').trim());
    species.forEach((sp) => { idxEsp[sp] = crudos.indexOf(sp); });
    datos = filas.slice(1);
    if (cols.every((c) => idx[c] < 0) && species.every((sp) => idxEsp[sp] < 0)) {
      return { ok: false, error: 'no_columns' };
    }
  } else {
    const conFecha = toIsoDate(filas[0][0]) !== null;
    idxFecha = conFecha ? 0 : -1;
    const base = conFecha ? 1 : 0;
    cols.forEach((c, j) => { idx[c] = base + j; });
    species.forEach((sp, j) => { idxEsp[sp] = base + cols.length + j; });
  }
  if (datos.length === 0) return { ok: false, error: 'empty' };
  const celda = (f: string[], i: number) => (i >= 0 ? parseNumber(f[i] ?? '') : null);
  const values: Record<string, (number | null)[]> = {};
  cols.filter((c) => idx[c] >= 0).forEach((c) => { values[c] = datos.map((f) => celda(f, idx[c])); });
  const conEspecies = species.some((sp) => idxEsp[sp] >= 0 && datos.some((f) => celda(f, idxEsp[sp]) !== null));
  const composition = conEspecies ? datos.map((f) => {
    const comp: Record<string, number> = {};
    species.forEach((sp) => { const v = celda(f, idxEsp[sp]); if (v !== null) comp[sp] = v; });
    return Object.keys(comp).length ? comp : null;
  }) : null;
  return {
    ok: true, n: datos.length, values, composition,
    start: idxFecha >= 0 ? toIsoDate(datos[0][idxFecha] ?? '') : null,
  };
}

/**
 * La serie como CSV para abrir en Excel y volver a importar: en español con `;` y coma
 * decimal, en inglés con `,` y punto. Una fila por día: día, fecha, columnas, especies.
 */
export function serializeSeriesCsv(
  start: string | null, cols: string[], values: Record<string, (number | null | undefined)[] | undefined>,
  lang: 'es' | 'en', species: string[] = [], composition: (Record<string, unknown> | null)[] | null = null,
): string {
  const sep = lang === 'es' ? ';' : ',';
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v)
    ? (lang === 'es' ? String(v).replace('.', ',') : String(v)) : '');
  const conComp = Boolean(composition && species.length);
  const n = Math.max(0, ...cols.map((c) => values[c]?.length ?? 0), composition?.length ?? 0);
  const lineas = [['day', 'date', ...cols, ...(conComp ? species : [])].join(sep)];
  for (let i = 0; i < n; i++) {
    lineas.push([
      String(i + 1), start ? addDays(start, i) : '',
      ...cols.map((c) => numero(values[c]?.[i])),
      ...(conComp ? species.map((sp) => numero(composition![i]?.[sp])) : []),
    ].join(sep));
  }
  return `﻿${lineas.join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------
// Estado inicial de las pozas (inventario)
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

/** Secciones cuyas pozas pueden arrancar cargadas. */
export const INITIAL_STATE_KINDS = new Set(['precon_dynamic', 'postliming_dynamic']);

const clave = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Una fila sin nada cargado: la poza arranca vacía y la fila no se manda. */
export function isEmptyInitialState(row: Row): boolean {
  return Object.entries(row).every(([k, v]) => {
    if (k === 'pond') return true;
    if (v === null || v === undefined || v === false || v === '') return true;
    if (typeof v === 'object') return Object.values(v as Row).every((x) => x === null || x === undefined);
    return false;
  });
}

/**
 * Una fila por poza de la sección, en su orden, con el estado cargado si lo hay. Los
 * estados de pozas que ya no están en la sección quedan al final para que no se pierdan
 * sin aviso (la validación los marca).
 */
export function initialStateRows(ponds: Row[], states: Row[]): Row[] {
  const porPoza = new Map(states.map((s) => [clave(s.pond), s]));
  const nombres = ponds.map((p) => String(p.name ?? '').trim()).filter(Boolean);
  const filas: Row[] = nombres.map((n) => ({ ...(porPoza.get(clave(n)) ?? {}), pond: n }));
  const usadas = new Set(nombres.map(clave));
  return [...filas, ...states.filter((s) => !usadas.has(clave(s.pond)))];
}

/**
 * Las dos formas del inventario de una poza (cambios finales, punto 4): toneladas por
 * especie (`species_mass_t`; la altura la calcula la app) o composición %p/p + altura
 * (`composition_pct` + `height_m`). La forma va en los datos mismos: una fila está en
 * composición si trae `composition_pct` (aunque esté vacío); si no, en toneladas. Así
 * no hace falta un campo propio que el backend no conoce.
 */
export type InitialForm = 'mass' | 'composition';

export function initialStateForm(row: Row): InitialForm {
  return row.composition_pct !== null && row.composition_pct !== undefined ? 'composition' : 'mass';
}

/** El campo de los valores por especie de la forma. */
export function speciesFieldOf(form: InitialForm): 'species_mass_t' | 'composition_pct' {
  return form === 'composition' ? 'composition_pct' : 'species_mass_t';
}

/** La fila en la otra forma: lo de la forma que se deja se borra (se manda una sola). */
export function switchInitialStateForm(row: Row, form: InitialForm): Row {
  const out = { ...row };
  if (form === 'composition') {
    delete out.species_mass_t;
    out.composition_pct = (row.composition_pct as Row | null | undefined) ?? {};
  } else {
    delete out.composition_pct;
    delete out.height_m;
  }
  return out;
}

/**
 * Cuándo una poza es un buffer (caudal fijo o estacional): la misma condición que la
 * altura de arranque en el diccionario (`ponds.startup_height_m`), que es como lo decide
 * el backend. `outflow_started` solo vale en los buffers.
 */
export const BUFFER_CONDITION = "pond_type != 'target_height'";

export function bufferCondition(schema?: SectionSchema): string {
  return schema?.byKey.get('ponds.startup_height_m')?.visible_if ?? BUFFER_CONDITION;
}

/** El tipo de cada poza de la sección, por nombre (sin mayúsculas ni espacios). */
export function pondsByName(ponds: Row[]): Map<string, Row> {
  return new Map(ponds.map((p) => [clave(p.name), p]));
}

/**
 * Lo que se guarda: solo las pozas con estado cargado y, de cada una, solo su forma (sin
 * la altura con toneladas) y `outflow_started` solo si la poza es un buffer.
 */
export function initialStatesForSave(rows: Row[], ponds: Row[] = [], buffer = BUFFER_CONDITION): Row[] {
  const pozas = pondsByName(ponds);
  return rows.map((r) => {
    const out = { ...r };
    if (initialStateForm(r) === 'composition') delete out.species_mass_t;
    else { delete out.composition_pct; delete out.height_m; }
    const poza = pozas.get(clave(r.pond));
    if (poza && notApplicable(buffer, poza)) delete out.outflow_started;
    return out;
  }).filter((r) => !isEmptyInitialState(r));
}

/**
 * Filas pegadas de Excel sobre la tabla del estado inicial. Columnas: los campos de la
 * tabla y después una por especie; la poza va primero si se quiere ubicar la fila por
 * nombre. Sin nombre de poza conocido, las filas se asignan en orden desde la primera.
 * Cada fila queda en la forma que tenía: los valores por especie van a esa forma, y la
 * altura solo se toma en composición (con toneladas la calcula la app).
 */
export function pasteInitialStates(rows: Row[], pasted: string[][], cols: DictionaryEntry[], species: string[]): Row[] {
  const out = rows.map((r) => ({ ...r }));
  const indice = new Map(out.map((r, i) => [clave(r.pond), i]));
  let siguiente = 0;
  for (const celdas of pasted) {
    let i = indice.get(clave(celdas[0]));
    let base = 1;
    if (i === undefined) { i = siguiente; base = 0; }
    siguiente = i + 1;
    if (i >= out.length) break;
    const forma = initialStateForm(out[i]);
    const fila: Row = forma === 'composition' ? { pond: out[i].pond, composition_pct: {} } : { pond: out[i].pond };
    cols.forEach((c, j) => {
      if (c.field === 'height_m' && forma === 'mass') return;
      const v = coerce(c, celdas[base + j] ?? '');
      if (v !== null) fila[c.field] = v;
    });
    const valores: Row = {};
    species.forEach((sp, j) => {
      const v = parseNumber(celdas[base + cols.length + j] ?? '');
      if (v !== null) valores[sp] = v;
    });
    if (Object.keys(valores).length) fila[speciesFieldOf(forma)] = valores;
    out[i] = fila;
  }
  return out;
}

/** Suma de los valores por especie de la fila en su forma (t o %p/p); null sin valores. */
export function speciesSum(row: Row): number | null {
  const v = row[speciesFieldOf(initialStateForm(row))] as Row | null | undefined;
  const n = Object.values(v ?? {}).filter((x): x is number => typeof x === 'number');
  return n.length ? n.reduce((a, b) => a + b, 0) : null;
}

/** Tolerancia de la suma de una composición (la del backend, `brine.PCT_TOLERANCE`). */
export const PCT_TOLERANCE = 0.01;

/** La poza de un problema del estado inicial: por su etiqueta o por su fila en lo guardado. */
export function issuePond(issue: ValidationIssue, saved: Row[]): string {
  if (issue.row_label) return clave(issue.row_label);
  return issue.row ? clave(saved[issue.row - 1]?.pond) : '';
}
