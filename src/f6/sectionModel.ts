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
  return out;
}
