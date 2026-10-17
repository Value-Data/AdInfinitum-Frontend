/* Única puerta de las pantallas restauradas a la API.

   Las pantallas de la versión anterior pedían `GET /executions/{id}`; ahora esas
   ejecuciones viven en `/legacy-executions` (solo lectura). Este módulo expone las
   funciones con los nombres de antes (`getExecution`, `listExecutionFiles`, …) para
   no tocar los componentes, y por debajo habla solo con los endpoints nuevos. */

import api from '../services/api';
import { getAqsolCatalogV2 } from '../services/apiV2';
import type { AqsolCatalog, ExecutionFile, ExecutionResult } from './types';
import type { LegacyExecutionDetail, LegacyExecutionSummary, LegacyFile } from './apiTypes';

// El detalle pesa hasta ~8 MB y la página, la cadena y los paneles lo piden varias
// veces: se guarda la promesa de los últimos pedidos (los resultados no cambian).
const CACHE_MAX = 6;
const cache = new Map<string, Promise<LegacyExecutionDetail>>();

export function getLegacyExecution(id: string): Promise<LegacyExecutionDetail> {
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id);
    cache.set(id, hit);
    return hit;
  }
  const p = api
    .get<LegacyExecutionDetail>(`/legacy-executions/${encodeURIComponent(id)}`)
    .then((r) => r.data);
  p.catch(() => cache.delete(id));
  cache.set(id, p);
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value as string;
    cache.delete(first);
  }
  return p;
}

/** Solo para tests: vacía la caché del detalle. */
export function clearLegacyCache(): void {
  cache.clear();
}

export async function getLegacyExecutions(
  projectId: string,
  includeDeleted = false,
): Promise<LegacyExecutionSummary[]> {
  const { data } = await api.get<LegacyExecutionSummary[]>(
    `/projects/${encodeURIComponent(projectId)}/legacy-executions`,
    { params: { include_deleted: includeDeleted } },
  );
  return data;
}

/** El detalle con la forma que leían las pantallas de antes. */
export async function getExecution(id: string): Promise<ExecutionResult> {
  const d = await getLegacyExecution(id);
  return {
    id: d.id,
    project_id: d.project_id,
    execution_type: d.execution_type as ExecutionResult['execution_type'],
    status: d.status as ExecutionResult['status'],
    parameters_snapshot: d.parameters_snapshot,
    results: d.results as ExecutionResult['results'],
    error_message: d.error_message,
    source_execution_id: d.source_execution_id,
    started_at: d.started_at,
    completed_at: d.completed_at,
    created_by: d.created_by ?? '',
    created_at: d.created_at,
  };
}

export async function listExecutionFiles(id: string): Promise<ExecutionFile[]> {
  const { data } = await api.get<LegacyFile[]>(
    `/legacy-executions/${encodeURIComponent(id)}/files`,
  );
  return data;
}

export async function downloadExecutionFile(id: string, name: string): Promise<Blob> {
  const { data } = await api.get(
    `/legacy-executions/${encodeURIComponent(id)}/files/${encodeURIComponent(name)}`,
    { responseType: 'blob' },
  );
  return data;
}

/** Catálogo de AQSOL con la forma de antes, armado desde `/catalogs/aqsol/{version}`. */
export async function getAqsolCatalog(version: string): Promise<AqsolCatalog> {
  const c = await getAqsolCatalogV2(version);
  const species = c.species.map((s) => s.name);
  const salts = c.phases.map((p) => ({ dll_index: p.dll_index, name: p.name }));
  return {
    version: c.version,
    species,
    salts,
    n_aqueous: species.length,
    n_salts: salts.length,
    faktor_length: species.length + salts.length,
  };
}
