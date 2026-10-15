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
export function issuesAt(issues: ValidationIssue[], field: string, row?: number): ValidationIssue[] {
  return issues.filter((i) => i.field === field && (row === undefined || i.row == null || i.row === row));
}

/**
 * La sección lista para mandar: sin lo que no aplica, y las series con una columna
 * entera vacía como serie no cargada.
 */
export function cleanPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  for (const k of hiddenTopLevel(payload)) delete out[k];
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
    out.initial_states = initialStatesForSave(out.initial_states as Record<string, unknown>[]);
  }
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

/** Lo que se guarda: solo las pozas con estado cargado. */
export function initialStatesForSave(rows: Row[]): Row[] {
  return rows.filter((r) => !isEmptyInitialState(r));
}

/**
 * Filas pegadas de Excel sobre la tabla del estado inicial. Columnas: los campos de la
 * tabla y después una por especie; la poza va primero si se quiere ubicar la fila por
 * nombre. Sin nombre de poza conocido, las filas se asignan en orden desde la primera.
 */
export function pasteInitialStates(
  rows: Row[], pasted: string[][], cols: DictionaryEntry[], species: string[], speciesField = 'species_mass_t',
): Row[] {
  const out = rows.map((r) => ({ ...r }));
  const indice = new Map(out.map((r, i) => [clave(r.pond), i]));
  let siguiente = 0;
  for (const celdas of pasted) {
    let i = indice.get(clave(celdas[0]));
    let base = 1;
    if (i === undefined) { i = siguiente; base = 0; }
    siguiente = i + 1;
    if (i >= out.length) break;
    const fila: Row = { pond: out[i].pond };
    cols.forEach((c, j) => {
      const v = coerce(c, celdas[base + j] ?? '');
      if (v !== null) fila[c.field] = v;
    });
    const masas: Row = {};
    species.forEach((sp, j) => {
      const v = parseNumber(celdas[base + cols.length + j] ?? '');
      if (v !== null) masas[sp] = v;
    });
    if (Object.keys(masas).length) fila[speciesField] = masas;
    out[i] = fila;
  }
  return out;
}

/** La poza de un problema del estado inicial: por su etiqueta o por su fila en lo guardado. */
export function issuePond(issue: ValidationIssue, saved: Row[]): string {
  if (issue.row_label) return clave(issue.row_label);
  return issue.row ? clave(saved[issue.row - 1]?.pond) : '';
}
