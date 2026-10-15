/* Tipos de la API de ejecuciones de la versión anterior (`/legacy-executions`).

   Escritos a mano siguiendo el contrato del backend; el detalle trae `results` y
   `parameters_snapshot` tal como los guardó la versión anterior, que son los que
   leen las pantallas restauradas en `src/legacy/`. */

export type LegacyExecutionType =
  | 'preconcentracion'
  | 'proceso_completo'
  | 'modelo_dinamico_cascade'
  | 'modelo_dinamico_encalado'
  | 'modelo_dinamico_postliming';

export interface LegacyExecutionSummary {
  id: string;
  project_id: string;
  execution_type: LegacyExecutionType | string;
  /** completed | failed | interrupted (una que quedó `running` se importa como interrupted). */
  status: string;
  /** Estado original, solo si se reescribió al importar. */
  original_status: string | null;
  error_message: string | null;
  source_execution_id: string | null;
  created_by: string | null;
  created_by_username?: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  aqsol_version: string | null;
  has_results: boolean;
  n_files: number;
  imported_at: string;
}

export interface LegacyExecutionDetail extends LegacyExecutionSummary {
  parameters_snapshot: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
}

export interface LegacyFile {
  name: string;
  size_bytes: number;
}
