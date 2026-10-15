import { describe, expect, it } from 'vitest';
import {
  buildLaunchRequest, continuationCandidates, inventoryPonds, needsSource, sourceCandidates,
} from '../../src/f6/LaunchPanel';
import { apiError, type ExecutionSummary, type SectionState } from '../../src/services/apiV2';

function ej(id: string, tipo: string, extra: Partial<ExecutionSummary> = {}): ExecutionSummary {
  return { id, project_id: 'p', execution_type: tipo, status: 'completed', has_partial_results: false,
           created_by: 'u', created_at: '2026-10-14T10:00:00', upload_status: 'uploaded',
           last_completed_day: 30, ...extra } as ExecutionSummary;
}

const ejecuciones = [
  ej('pre-ok', 'dynamic_precon'),
  ej('pre-sin-subir', 'dynamic_precon', { upload_status: 'failed' }),
  ej('pre-cortada', 'dynamic_precon', { status: 'failed', last_completed_day: 12 }),
  ej('planta', 'dynamic_liming'),
  ej('est-err', 'static_precon', { status: 'completed_with_errors', upload_status: null }),
];

describe('qué se ofrece para elegir', () => {
  it('el origen es la etapa anterior, terminada y con sus archivos subidos', () => {
    expect(sourceCandidates('dynamic_liming', ejecuciones).map((e) => e.id)).toEqual(['pre-ok']);
    expect(sourceCandidates('dynamic_postliming', ejecuciones).map((e) => e.id)).toEqual(['planta']);
    // El estático con escenarios fallidos también alimenta a la etapa siguiente.
    expect(sourceCandidates('static_liming', ejecuciones).map((e) => e.id)).toEqual(['est-err']);
    expect(sourceCandidates('dynamic_precon', ejecuciones)).toEqual([]);
  });

  it('se continúa desde una del mismo tipo con días completos, aunque se haya cortado', () => {
    expect(continuationCandidates('dynamic_precon', ejecuciones).map((e) => e.id))
      .toEqual(['pre-ok', 'pre-cortada']);
    expect(continuationCandidates('dynamic_liming', ejecuciones)).toEqual([]);
  });

  it('las etapas del estático piden origen solo si su sección se alimenta de una ejecución', () => {
    const secciones = [{ kind: 'liming_static', section: 'liming', engine_kind: 'static',
                         feed_source: 'execution' }] as SectionState[];
    expect(needsSource('static_liming', secciones)).toBe(true);
    expect(needsSource('static_postliming', secciones)).toBe(false);
    expect(needsSource('dynamic_postliming', [])).toBe(true);
  });
});

describe('el pedido de lanzamiento', () => {
  const base = { runTag: 'r1', source: '', continuar: '', dia: '', inicio: '', dias: '',
                 reintento: false, timeout: '300' };
  it('la precon lleva fecha de inicio y días', () => {
    expect(buildLaunchRequest({ ...base, tipo: 'dynamic_precon', inicio: '2024-01-23', dias: '30' }, []))
      .toEqual({ execution_type: 'dynamic_precon', run_tag: 'r1', start_date: '2024-01-23', n_days: 30,
                 temperature_retry: false, dll_timeout_s: 300 });
  });
  it('una continuación no lleva fecha de inicio', () => {
    const r = buildLaunchRequest({ ...base, tipo: 'dynamic_precon', inicio: '2024-01-23',
                                   continuar: 'x', dia: '12' }, []);
    expect(r.start_date).toBeUndefined();
    expect([r.initial_state_execution_id, r.initial_state_day]).toEqual(['x', 12]);
  });
  it('el estático no lleva parámetros del dinámico', () => {
    expect(buildLaunchRequest({ ...base, tipo: 'static_full', dias: '5' }, []))
      .toEqual({ execution_type: 'static_full', run_tag: 'r1' });
  });
});

describe('errores de la API', () => {
  it('toma código y mensaje del cuerpo', () => {
    const e = apiError({ response: { status: 409, data: { detail: 'd', code: 'source_required',
                                                         message: 'falta el origen', x: 1 } } });
    expect(e).toEqual({ status: 409, code: 'source_required', message: 'falta el origen', extra: { x: 1 } });
  });
  it('un 422 de FastAPI junta los mensajes', () => {
    const e = apiError({ response: { status: 422, data: { detail: [{ msg: 'a' }, { msg: 'b' }] } } });
    expect([e.code, e.message]).toEqual([null, 'a; b']);
  });
});

describe('corrida con inventario', () => {
  const secciones = [
    { kind: 'precon_dynamic', n_initial_states: 10 },
    { kind: 'postliming_dynamic', n_initial_states: 0 },
  ] as SectionState[];

  it('una cascada del dinámico arranca cargada si su sección trae estado inicial', () => {
    expect(inventoryPonds('dynamic_precon', '', secciones)).toBe(10);
    expect(inventoryPonds('dynamic_postliming', '', secciones)).toBe(0);
    expect(inventoryPonds('dynamic_liming', '', secciones)).toBe(0);
    expect(inventoryPonds('static_precon', '', secciones)).toBe(0);
  });

  it('una continuación toma el estado de la otra ejecución, no el de la sección', () => {
    expect(inventoryPonds('dynamic_precon', 'pre-ok', secciones)).toBe(0);
  });
});
