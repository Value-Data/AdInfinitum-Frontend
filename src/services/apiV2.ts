/**
 * Cliente de la API de F4/F5: secciones, Excel de carga, ejecuciones, reportes.
 *
 * Los tipos salen de `src/types/api.d.ts`, generado del OpenAPI del backend
 * (`npm run gen:api`); los del reporte, de `src/types/report.ts`. Usa la misma
 * instancia de axios que el resto (token, renovación con /auth/refresh).
 */
import api from './api';
import type { components, operations } from '../types/api';
import type { ChainSummary, DailySeries, LogTail, Report } from '../types/report';

export type Schemas = components['schemas'];
export type ProjectV2 = Schemas['ProjectResponse'];
export type SectionState = Schemas['SectionState'];
export type SectionResponse = Schemas['SectionResponse'];
export type SectionVersionSummary = Schemas['SectionVersionSummary'];
export type ValidationReport = Schemas['ValidationReport'];
export type ValidationIssue = Schemas['ValidationIssue'];
export type ReportParams = Schemas['ReportParams'];
export type ExecutionSummary = Schemas['ExecutionResponse'];
export type ExecutionDetail = Schemas['ExecutionResultResponse'];
export type ExecutionStatus = Schemas['ExecutionStatusResponse'];
export type DictionaryEntry = Schemas['DictionaryEntryOut'];
export type AqsolVersionInfo = Schemas['AqsolVersionOut'];
export type AqsolCatalogInfo = Schemas['AqsolCatalogOut'];

export type Language = 'es' | 'en';
export type EngineKind = 'static' | 'dynamic';
export type Process = 'precon' | 'liming' | 'postliming' | 'full';
export type SectionKind =
  | 'precon_static' | 'precon_dynamic'
  | 'liming_static' | 'liming_dynamic'
  | 'postliming_static' | 'postliming_dynamic';

export const SECTION_KINDS: SectionKind[] = [
  'precon_static', 'liming_static', 'postliming_static',
  'precon_dynamic', 'liming_dynamic', 'postliming_dynamic',
];

export type ExecutionTypeV2 =
  | 'static_full' | 'static_precon' | 'static_liming' | 'static_postliming'
  | 'dynamic_precon' | 'dynamic_liming' | 'dynamic_postliming';

export const EXECUTION_TYPES_V2: ExecutionTypeV2[] = [
  'static_full', 'static_precon', 'static_liming', 'static_postliming',
  'dynamic_precon', 'dynamic_liming', 'dynamic_postliming',
];

/** Etapa anterior de la que se alimenta cada tipo encadenado. */
export const SOURCE_OF: Partial<Record<ExecutionTypeV2, ExecutionTypeV2>> = {
  static_liming: 'static_precon',
  static_postliming: 'static_liming',
  dynamic_liming: 'dynamic_precon',
  dynamic_postliming: 'dynamic_liming',
};

export function isDynamicType(t: string): boolean {
  return t.startsWith('dynamic_');
}

export function isV2Type(t: string): t is ExecutionTypeV2 {
  return (EXECUTION_TYPES_V2 as string[]).includes(t);
}

/** Error de la API: `{detail, code, message, ...extra}`. */
export interface ApiError {
  status: number;
  code: string | null;
  message: string;
  extra: Record<string, unknown>;
}

export function apiError(err: unknown): ApiError {
  const r = (err as { response?: { status: number; data?: unknown } })?.response;
  const data = (r?.data ?? {}) as Record<string, unknown>;
  const detail = data.detail;
  let message = typeof data.message === 'string' ? data.message
    : typeof detail === 'string' ? detail
    : Array.isArray(detail) ? detail.map((d) => (d as { msg?: string }).msg ?? String(d)).join('; ')
    : (err as Error)?.message ?? 'Error';
  if (!message) message = 'Error';
  const { detail: _d, code, message: _m, ...extra } = data;
  return { status: r?.status ?? 0, code: typeof code === 'string' ? code : null, message, extra };
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------
export async function createProjectV2(body: Schemas['ProjectCreate']): Promise<ProjectV2> {
  const { data } = await api.post<ProjectV2>('/projects', body);
  return data;
}

/** Solo cambia lo enviado; `null` vacía descripción o cliente (F8). */
export async function updateProjectV2(id: string, body: Schemas['ProjectUpdate']): Promise<ProjectV2> {
  const { data } = await api.put<ProjectV2>(`/projects/${id}`, body);
  return data;
}

export async function deleteProjectV2(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function getProjectV2(id: string): Promise<ProjectV2> {
  const { data } = await api.get<ProjectV2>(`/projects/${id}`);
  return data;
}

export async function getReportParams(projectId: string): Promise<ReportParams> {
  const { data } = await api.get<ReportParams>(`/projects/${projectId}/report-params`);
  return data;
}

export async function updateReportParams(
  projectId: string, body: Schemas['ReportParamsUpdate'],
): Promise<ReportParams> {
  const { data } = await api.put<ReportParams>(`/projects/${projectId}/report-params`, body);
  return data;
}

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------
export async function getSectionStates(projectId: string): Promise<SectionState[]> {
  const { data } = await api.get<SectionState[]>(`/projects/${projectId}/sections`);
  return data;
}

/** La última versión, o null si la sección está vacía. */
export async function getSection(
  projectId: string, kind: SectionKind,
): Promise<SectionResponse | null> {
  try {
    const { data } = await api.get<SectionResponse>(`/projects/${projectId}/sections/${kind}`);
    return data;
  } catch (err) {
    if (apiError(err).status === 404) return null;
    throw err;
  }
}

/** Punto de partida de una sección vacía: los valores por defecto del schema (los de la
 * plantilla de Excel). La planta trae sus cuatro reactivos con su composición (punto 8). */
export async function getSectionDefaults(
  projectId: string, kind: SectionKind,
): Promise<Record<string, unknown>> {
  const { data } = await api.get<Record<string, unknown>>(
    `/projects/${projectId}/sections/${kind}/defaults`);
  return data;
}

export async function getSectionVersions(
  projectId: string, kind: SectionKind,
): Promise<SectionVersionSummary[]> {
  const { data } = await api.get<SectionVersionSummary[]>(
    `/projects/${projectId}/sections/${kind}/versions`);
  return data;
}

/** Una versión guardada de la sección (la que usó una ejecución). */
export async function getSectionVersion(
  projectId: string, kind: SectionKind, versionNo: number,
): Promise<SectionResponse> {
  const { data } = await api.get<SectionResponse>(
    `/projects/${projectId}/sections/${kind}/versions/${versionNo}`);
  return data;
}

export async function validateSection(
  projectId: string, kind: SectionKind, payload: Record<string, unknown>, language: Language,
): Promise<ValidationReport> {
  const { data } = await api.post<ValidationReport>(
    `/projects/${projectId}/sections/${kind}/validate`, payload, { params: { language } });
  return data;
}

export type SaveSectionResult =
  | { ok: true; version_no: number; validation: ValidationReport }
  | { ok: false; validation: ValidationReport; message: string };

/** Guarda una versión nueva. Con errores no se guarda y vuelve el informe completo. */
export async function saveSection(
  projectId: string, kind: SectionKind, payload: Record<string, unknown>, language: Language,
): Promise<SaveSectionResult> {
  try {
    const { data } = await api.put<Schemas['SectionSaveResponse']>(
      `/projects/${projectId}/sections/${kind}`, payload, { params: { language } });
    return { ok: true, version_no: data.version_no, validation: data.validation };
  } catch (err) {
    const e = apiError(err);
    if (e.code === 'section_invalid' && e.extra.validation) {
      return { ok: false, validation: e.extra.validation as ValidationReport, message: e.message };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Excel de carga
// ---------------------------------------------------------------------------
export interface ExcelSectionResult {
  validation: ValidationReport;
  payload: Record<string, unknown>;
  saved_version: number | null;
}

export interface ExcelImportResult {
  aqsol_version: string;
  language_detected: Language | null;
  ok: boolean;
  saved: boolean;
  sections: Partial<Record<SectionKind, ExcelSectionResult>>;
}

async function blob(url: string, params: Record<string, unknown>): Promise<Blob> {
  const { data } = await api.get(url, { params, responseType: 'blob' });
  return data as Blob;
}

/** Parámetros de las pozas de una cascada del dinámico: fijos o por fecha (la hoja
 * "Cambios de pozas" solo va con `by_date`; punto 25). */
export type PondParamsMode = NonNullable<
  NonNullable<operations['get_project_template_api_v1_projects__project_id__excel_template__process__get']['parameters']['query']>['pond_params_mode']>;

export function downloadTemplate(
  projectId: string, process: Process, engineKind: EngineKind, language: Language,
  opts: { feed_source?: 'data' | 'execution'; composition_mode?: 'fixed' | 'per_row';
    pond_params_mode?: PondParamsMode } = {},
): Promise<Blob> {
  return blob(`/projects/${projectId}/excel/template/${process}`,
    { engine_kind: engineKind, language, ...opts });
}

export function exportConfiguration(
  projectId: string, process: Process, engineKind: EngineKind, language: Language,
): Promise<Blob> {
  return blob(`/projects/${projectId}/excel/export`,
    { process, engine_kind: engineKind, language });
}

export async function importConfiguration(
  projectId: string, file: File, save: boolean, language: Language,
): Promise<ExcelImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ExcelImportResult>(
    `/projects/${projectId}/excel/import`, form,
    { params: { save, language }, headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}

// ---------------------------------------------------------------------------
// Ejecuciones
// ---------------------------------------------------------------------------
export interface LaunchRequest {
  execution_type: ExecutionTypeV2;
  run_tag?: string;
  source_execution_id?: string | null;
  initial_state_execution_id?: string | null;
  initial_state_day?: number | null;
  start_date?: string | null;
  n_days?: number | null;
  selected_scenarios?: number[] | null;
  temperature_retry?: boolean;
  dll_timeout_s?: number;
}

export async function listExecutions(projectId: string): Promise<ExecutionSummary[]> {
  const { data } = await api.get<ExecutionSummary[]>(`/projects/${projectId}/executions`);
  return data;
}

export async function launchExecution(
  projectId: string, body: LaunchRequest,
): Promise<ExecutionSummary> {
  const { data } = await api.post<ExecutionSummary>(`/projects/${projectId}/executions`, body);
  return data;
}

export async function getExecutionDetail(id: string): Promise<ExecutionDetail> {
  const { data } = await api.get<ExecutionDetail>(`/executions/${id}`);
  return data;
}

export async function getExecutionStatusV2(id: string): Promise<ExecutionStatus> {
  const { data } = await api.get<ExecutionStatus>(`/executions/${id}/status`);
  return data;
}

export async function cancelExecution(id: string): Promise<ExecutionStatus> {
  const { data } = await api.post<ExecutionStatus>(`/executions/${id}/cancel`);
  return data;
}

export async function deleteExecutionV2(id: string): Promise<void> {
  await api.delete(`/executions/${id}`);
}

export async function reuploadExecution(id: string): Promise<{ upload_status: string }> {
  const { data } = await api.post<{ upload_status: string }>(`/executions/${id}/reupload`);
  return data;
}

export async function getExecutionLog(id: string, tail = 200): Promise<LogTail> {
  const { data } = await api.get<LogTail>(`/executions/${id}/log`, { params: { tail } });
  return data;
}

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------
export interface ReportQuery {
  scale_factor?: number | null;
  period_start?: string | null;
  period_end?: string | null;
}

function clean(q: ReportQuery & { language?: Language }): Record<string, unknown> {
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== null && v !== undefined
    && v !== ''));
}

export async function getReport(id: string, q: ReportQuery = {}): Promise<Report> {
  const { data } = await api.get<Report>(`/executions/${id}/report`, { params: clean(q) });
  return data;
}

export function downloadReport(id: string, language: Language, q: ReportQuery = {}): Promise<Blob> {
  return blob(`/executions/${id}/report.xlsx`, clean({ ...q, language }));
}

/** El reporte en PDF armado en el servidor (mismos parámetros que el Excel). */
export function downloadReportPdf(id: string, language: Language, q: ReportQuery = {}): Promise<Blob> {
  return blob(`/executions/${id}/report.pdf`, clean({ ...q, language }));
}

/** Series diarias del dinámico en el período. `species`: `true` para la composición de
 * todas las especies de la versión de AQSOL, una lista para esas, o `false` para las 8
 * de siempre. */
export async function getExecutionSeries(
  id: string, q: { period_start?: string | null; period_end?: string | null }, species: boolean | string[] = false,
): Promise<DailySeries> {
  const params = clean({ period_start: q.period_start, period_end: q.period_end });
  if (species === true) params.species = 'all';
  else if (Array.isArray(species) && species.length > 0) params.species = species.join(',');
  const { data } = await api.get<DailySeries>(`/executions/${id}/series`, { params });
  return data;
}

export async function getChain(id: string): Promise<ChainSummary> {
  const { data } = await api.get<ChainSummary>(`/executions/${id}/chain`);
  return data;
}

export async function getChainReport(id: string, q: ReportQuery = {}): Promise<Report> {
  const { data } = await api.get<Report>(`/executions/${id}/chain/report`, { params: clean(q) });
  return data;
}

export function downloadChainReport(
  id: string, language: Language, q: ReportQuery = {},
): Promise<Blob> {
  return blob(`/executions/${id}/chain/report.xlsx`, clean({ ...q, language }));
}

export function downloadChainReportPdf(
  id: string, language: Language, q: ReportQuery = {},
): Promise<Blob> {
  return blob(`/executions/${id}/chain/report.pdf`, clean({ ...q, language }));
}

/** El error de una descarga: con `responseType: 'blob'` el cuerpo del error (JSON del
 * backend) llega como Blob; se lee para mostrar su mensaje y no el genérico de axios. */
export async function blobApiError(err: unknown): Promise<ApiError> {
  const r = (err as { response?: { data?: unknown } })?.response;
  if (r?.data instanceof Blob) {
    try {
      r.data = JSON.parse(await r.data.text());
    } catch {
      // No era JSON: queda el mensaje de axios.
    }
  }
  return apiError(err);
}

// ---------------------------------------------------------------------------
// Diccionario y catálogos
// ---------------------------------------------------------------------------
export async function getDictionaryLabels(language: Language): Promise<Record<string, string>> {
  const { data } = await api.get<Record<string, string>>('/dictionary/labels',
    { params: { language } });
  return data;
}

export async function getDictionary(
  language: Language, opts: { category?: string; kind?: SectionKind } = {},
): Promise<DictionaryEntry[]> {
  const { data } = await api.get<DictionaryEntry[]>('/dictionary', {
    params: { language, ...opts } });
  return data;
}

export async function getAqsolVersions(): Promise<AqsolVersionInfo[]> {
  const { data } = await api.get<AqsolVersionInfo[]>('/catalogs/aqsol');
  return data;
}

export async function getAqsolCatalogV2(version: string): Promise<AqsolCatalogInfo> {
  const { data } = await api.get<AqsolCatalogInfo>(`/catalogs/aqsol/${version}`);
  return data;
}

/** Baja un Blob como archivo. */
export function saveBlob(data: Blob, filename: string): void {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
