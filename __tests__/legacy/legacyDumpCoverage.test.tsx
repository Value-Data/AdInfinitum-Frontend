/* Cobertura con datos reales (opt-in): renderiza TODAS las ejecuciones de un volcado de
   la base anterior y deja un informe por id.

     LEGACY_DUMP=<ruta a db/executions.json> [LEGACY_REPORT=<salida.json>] npx vitest run legacyDumpCoverage

   Sin LEGACY_DUMP no corre: el volcado no está en el repo. El informe por defecto queda
   dos carpetas arriba del volcado (`<dir>/../../legacy_render_report.json`). */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api', async () => ({
  default: { get: (await import('./legacyHarness')).fakeGet },
}));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getAqsolCatalogV2: vi.fn(async () => {
    throw new Error('sin catálogo');
  }),
}));

import { renderAndWalk, store } from './legacyHarness';
import { clearLegacyCache } from '../../src/legacy/api';
import type { LegacyExecutionDetail } from '../../src/legacy/apiTypes';

const DUMP = process.env.LEGACY_DUMP;
type Row = Record<string, string | null>;
const rows: Row[] = DUMP && fs.existsSync(DUMP) ? JSON.parse(fs.readFileSync(DUMP, 'utf-8')) : [];

function detail(r: Row): LegacyExecutionDetail {
  const interrumpida = r.status === 'running' || r.status === 'pending';
  return {
    id: r.id!,
    project_id: r.project_id!,
    execution_type: r.execution_type!,
    status: interrumpida ? 'interrupted' : r.status!,
    original_status: interrumpida ? r.status : null,
    error_message: r.error_message,
    source_execution_id: r.source_execution_id,
    created_by: r.created_by,
    created_by_username: null,
    created_at: r.created_at!,
    started_at: r.started_at,
    completed_at: r.completed_at,
    deleted_at: r.deleted_at,
    aqsol_version: null,
    has_results: !!r.results,
    n_files: 0,
    imported_at: '2026-10-15T00:00:00',
    parameters_snapshot: r.parameters_snapshot ? JSON.parse(r.parameters_snapshot) : null,
    results: r.results ? JSON.parse(r.results) : null,
  };
}

interface Item {
  id: string;
  execution_type: string;
  status: string;
  deleted: boolean;
  has_results: boolean;
  ok: boolean;
  shows: 'results' | 'no_results' | 'error';
  /** Archivos Excel que generó el botón de descarga de la pantalla. */
  excel: number;
  excel_error?: string;
  error?: string;
}
const report: Item[] = [];

describe.skipIf(rows.length === 0)('volcado real: todas las ejecuciones de la versión anterior', () => {
  beforeAll(() => {
    localStorage.setItem('adinf_language', 'es');
    // La cadena necesita las etapas anteriores: el store tiene todo el volcado. El
    // detalle se parsea al pedirlo para no tener 1 GB de objetos en memoria.
    store.clear();
    const porId = new Map(rows.map((r) => [r.id!, r]));
    store.get = (id: string) => {
      const r = porId.get(id);
      return r ? detail(r) : undefined;
    };
  });

  afterAll(() => {
    const out = process.env.LEGACY_REPORT
      || path.resolve(path.dirname(DUMP!), '..', '..', 'legacy_render_report.json');
    const resumen: Record<string, { ok: number; failed: number }> = {};
    for (const it of report) {
      const k = it.execution_type;
      resumen[k] ??= { ok: 0, failed: 0 };
      resumen[k][it.ok ? 'ok' : 'failed'] += 1;
    }
    fs.writeFileSync(out, JSON.stringify({ total: report.length, by_type: resumen, items: report }, null, 1));
  });

  it.each(rows.map((r) => [r.id!, r] as const))('%s', async (id, r) => {
    clearLegacyCache();
    const { error, text, excel, excelError } = await renderAndWalk(id);
    const shows: Item['shows'] = error
      ? 'error'
      : text.includes('no guardó resultados')
        ? 'no_results'
        : 'results';
    report.push({
      id,
      execution_type: r.execution_type!,
      status: r.status!,
      deleted: !!r.deleted_at,
      has_results: !!r.results,
      ok: !error && !excelError,
      shows,
      excel,
      excel_error: excelError ? String((excelError as Error).message || excelError).slice(0, 300) : undefined,
      error: error
        ? String((error as Error).stack || error).split('\n').slice(0, 4).join(' | ').slice(0, 600)
        : undefined,
    });
    expect(error).toBeNull();
    expect(excelError).toBeNull();
  }, 120000);
});
