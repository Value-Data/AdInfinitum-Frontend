/**
 * Reporte de una ejecución, como lo devuelve `GET /executions/{id}/report`.
 *
 * Espejo de `app/reporting/model.py` del backend (las rutas de reporte devuelven un
 * dict, así que OpenAPI no lo describe). Los nombres son internos: las etiquetas salen
 * del diccionario (`result.<clave>`), salvo especies y sales, que se muestran tal cual.
 */

export type Stage = 'precon' | 'liming' | 'postliming';

export interface ReportColumn {
  /** Nombre interno; con kind "species"/"salt", el nombre de la especie o la sal. */
  key: string;
  unit: string;
  kind: 'label' | 'species' | 'salt';
  /** Columna derivada: cómo se calcula, con nombres internos (p. ej. "mass_t_d × 365"). */
  formula?: string | null;
}

/** Una fila; una fila derivada (total, diferencia, suma de corrientes) puede traer su
 * fórmula en `formula`, con nombres internos. */
export type ReportRow = { id: string; formula?: string | null } & Record<string, string | number | boolean | null | undefined>;

export interface ReportTable {
  key: string;
  row_kind: 'pond' | 'stream' | 'salt' | 'species' | 'scenario' | 'kpi' | 'step';
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Nombres internos de notas al pie. */
  notes: string[];
}

export interface StageReport {
  stage: Stage;
  kpis: Record<string, number | null>;
  tables: ReportTable[];
}

export interface ReportPeriod {
  start: string;
  end: string;
  n_days: number;
}

export interface ReportParamsEcho {
  period_start: string | null;
  period_end: string | null;
  scale_factor: number;
  days_year: Partial<Record<Stage, number>>;
}

/**
 * Un aviso del dinámico sobre una poza (cambios finales, puntos 6 y 14; espejo de
 * `ReportWarning` en `app/reporting/model.py`). Su título es la etiqueta
 * `result.warning_<code>`; `message` ya viene redactado con los números de `params`.
 */
export interface ReportWarning {
  code: 'rising_pond' | 'above_berm' | 'li_balance_residual' | (string & {});
  /** La etapa de la poza: los avisos van al inicio de esa etapa. */
  stage: Stage;
  pond: string | null;
  /** Nombres internos: "_t" masas en t (ya escaladas), "_m" alturas en m, "_day" día de la corrida. */
  params: Record<string, number | null>;
  message: Partial<Record<'es' | 'en', string>>;
}

export interface DynamicReport {
  kind: 'dynamic' | 'chain';
  period: ReportPeriod;
  params: ReportParamsEcho;
  stages: StageReport[];
  process_kpis: Record<string, number | null>;
  global_balance: ReportTable | null;
  /** Vacío si no hay avisos. Un backend anterior a los puntos 6 y 14 no lo manda: leerlo
   * con `?? []`. */
  warnings: ReportWarning[];
}

export interface ScenarioReport {
  index: number;
  label: string;
  status: 'ok' | 'failed';
  failed_stage: string | null;
  error_message: string | null;
  temperature_C: number | null;
  evaporation_mm_d: number | null;
  stages: StageReport[];
  process_kpis: Record<string, number | null>;
  global_balance: ReportTable | null;
}

export interface StaticReport {
  kind: 'static';
  params: ReportParamsEcho;
  scenarios: ScenarioReport[];
  comparison: ReportTable;
}

export type Report = DynamicReport | StaticReport;

export function isStaticReport(r: Report): r is StaticReport {
  return r.kind === 'static';
}

/** Una ejecución de la cadena del dinámico (`GET /executions/{id}/chain`). */
export interface ChainExecution {
  id: string;
  execution_type: string;
  stage: Stage;
  status: string;
  run_tag: string;
  start_date: string | null;
  n_days: number | null;
  last_completed_day: number | null;
  upload_status: string | null;
  has_results: boolean;
}

export interface ChainSummary {
  executions: ChainExecution[];
  stages: Stage[];
  complete: boolean;
}

export interface LogTail {
  name: string;
  source: 'worker' | 'storage' | null;
  lines: string[];
  truncated: boolean;
}

/** Una serie diaria: `pond` = la clave es el nombre de la poza; `species`/`salt` = el de
 * la especie o la sal; sin marca, un nombre interno (diccionario). */
export interface DailySeriesItem {
  key: string;
  pond?: boolean;
  species?: boolean;
  salt?: boolean;
  /** De dónde sale la serie (columnas y archivo de la corrida), con nombres internos. */
  formula?: string | null;
  values: (number | null)[];
}
export interface DailySeriesGroup { key: string; unit: string; series: DailySeriesItem[] }

/** Series diarias de una etapa del dinámico (`GET /executions/{id}/series`). */
export interface DailySeries {
  stage: string;
  dates: string[];
  /** Día de la corrida de cada fecha (1 = el primero de la corrida). */
  days?: number[];
  product_pond: string | null;
  groups: DailySeriesGroup[];
  /** Composición de la salmuera de cada poza (%p/p), por especie. */
  composition?: { species: string[]; ponds: Record<string, Record<string, (number | null)[]>> } | null;
  /** Sal precipitada de cada poza (t/d), por sal. Null en la planta. */
  salts?: { salts: string[]; ponds: Record<string, Record<string, (number | null)[]>> } | null;
}
