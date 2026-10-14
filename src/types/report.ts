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
}

export type ReportRow = { id: string } & Record<string, string | number | boolean | null>;

export interface ReportTable {
  key: string;
  row_kind: 'pond' | 'stream' | 'salt' | 'scenario' | 'kpi';
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

export interface DynamicReport {
  kind: 'dynamic' | 'chain';
  period: ReportPeriod;
  params: ReportParamsEcho;
  stages: StageReport[];
  process_kpis: Record<string, number | null>;
  global_balance: ReportTable | null;
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
