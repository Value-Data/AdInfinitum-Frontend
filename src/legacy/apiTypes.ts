/* Tipos de la API de ejecuciones de la versión anterior (`/legacy-executions`).

   Salen de `src/types/api.d.ts`, generado del OpenAPI del backend. El detalle trae
   `results` y `parameters_snapshot` tal como los guardó la versión anterior, que son
   los que leen las pantallas restauradas en `src/legacy/`. El estado es
   completed | failed | interrupted (una que quedó `running` se importa como
   interrupted, con `original_status`). */
import type { components } from '../types/api';

type Schemas = components['schemas'];

export type LegacyExecutionType =
  | 'preconcentracion'
  | 'proceso_completo'
  | 'modelo_dinamico_cascade'
  | 'modelo_dinamico_encalado'
  | 'modelo_dinamico_postliming';

export type LegacyExecutionSummary = Schemas['LegacyExecutionSummary'];
// El generador escribe un `dict` libre como `Record<string, never>`.
export type LegacyExecutionDetail = Omit<
  Schemas['LegacyExecutionDetail'],
  'parameters_snapshot' | 'results'
> & {
  parameters_snapshot: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
};
export type LegacyFile = Schemas['LegacyExecutionFile'];
