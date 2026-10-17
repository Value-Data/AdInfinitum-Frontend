import { describe, expect, it } from 'vitest';
import {
  comparisonColumns, heatVariables, liFlows, recoveries, seriesOnDates, unionDates,
} from '../../src/f6/chartData';
import { executionLegend, summaryHasResults } from '../../src/f6/CompareExecutions';
import type { DailySeries, ReportTable, StageReport } from '../../src/types/report';
import type { ExecutionSummary } from '../../src/services/apiV2';

const etapa = (stage: StageReport['stage'], kpis: StageReport['kpis']): StageReport => ({ stage, kpis, tables: [] });

describe('litio por etapa, tal cual los KPIs', () => {
  it('dinámico en t del período, estático en t/d; sin KPI queda vacío', () => {
    const din = [etapa('precon', { li_in_t: 100, li_out_t: 80 }), etapa('liming', { li_in_t: 80 })];
    expect(liFlows(din, true)).toEqual([
      { stage: 'precon', li_in: 100, li_out: 80 }, { stage: 'liming', li_in: 80, li_out: null }]);
    expect(liFlows([etapa('precon', { li_in_t_d: 1, li_out_t_d: 0.8, li_in_t: 9 })], false))
      .toEqual([{ stage: 'precon', li_in: 1, li_out: 0.8 }]);
  });

  it('recuperación de cada etapa y la del proceso solo si el reporte la trae', () => {
    const st = [etapa('precon', { li_recovery_pct: 80 }), etapa('postliming', { li_recovery_pct: null })];
    expect(recoveries(st, {})).toEqual([{ key: 'precon', value: 80 }, { key: 'postliming', value: null }]);
    expect(recoveries(st, { process_li_recovery_pct: 61 }).at(-1)).toEqual({ key: 'process', value: 61 });
  });
});

const serie = (dates: string[], extra: Partial<DailySeries> = {}): DailySeries => ({
  stage: 'precon', dates, product_pond: 'P2',
  groups: [
    { key: 'liquid_density', unit: 'kg/m3', series: [{ key: 'P1', pond: true, values: dates.map((_d, i) => 1200 + i) },
      { key: 'P2', pond: true, values: dates.map(() => 1250) }] },
    { key: 'liming_flows', unit: 't/d', series: [{ key: 'feed', values: dates.map(() => 1) }] },
    { key: 'height_m', unit: 'm', series: [{ key: 'P1', pond: true, values: dates.map(() => null) }] },
  ],
  composition: { species: ['Li+'], ponds: { P1: { 'Li+': dates.map(() => 0.2) } } },
  ...extra,
});

describe('mapa de calor', () => {
  it('variables por poza (sin las vacías ni las que no son por poza) y la composición de cada especie', () => {
    const v = heatVariables(serie(['2024-01-01', '2024-01-02']));
    expect(v.map((x) => x.key)).toEqual(['liquid_density', 'composition_Li+']);
    expect(v[0]).toMatchObject({ unit: 'kg/m3', ponds: ['P1', 'P2'], values: [[1200, 1201], [1250, 1250]] });
    expect(v[1]).toMatchObject({ unit: '%p/p', species: 'Li+', ponds: ['P1'] });
  });
});

describe('comparación de ejecuciones', () => {
  it('cada ejecución se alinea por fecha; los días que no tiene quedan vacíos', () => {
    const a = serie(['2024-01-01', '2024-01-02']);
    const b = serie(['2024-01-02', '2024-01-03']);
    const fechas = unionDates([a, b]);
    expect(fechas).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(seriesOnDates(b, { group: 'liquid_density', series: 'P1' }, fechas)).toEqual([null, 1200, 1201]);
    expect(seriesOnDates(a, { group: 'composition_Li+', series: 'P1' }, fechas)).toEqual([0.2, 0.2, null]);
    expect(seriesOnDates(a, { group: 'no_existe', series: 'P1' }, fechas)).toEqual([null, null, null]);
  });

  it('indicadores numéricos de la comparativa del estático', () => {
    const t: ReportTable = { key: 'scenario_comparison', row_kind: 'scenario', notes: [],
      columns: [{ key: 'temperature_C', unit: '°C', kind: 'label' }, { key: 'note', unit: '', kind: 'label' },
        { key: 'process_li_recovery_pct', unit: '%', kind: 'label' }],
      rows: [{ id: 'E1', temperature_C: 10, note: 'x', process_li_recovery_pct: 60 }] };
    expect(comparisonColumns(t)).toEqual([{ key: 'temperature_C', unit: '°C' }, { key: 'process_li_recovery_pct', unit: '%' }]);
  });

  it('leyenda "Ejecución <id8> <run_tag> <fecha>" y solo ejecuciones con resultados', () => {
    expect(executionLegend({ id: 'abcdef0123456789', run_tag: 'r7', start_date: '2024-03-05', started_at: null },
      'Ejecución')).toBe('Ejecución abcdef01 r7 05-03-2024');
    const e = (x: Partial<ExecutionSummary>) => ({ execution_type: 'dynamic_precon', status: 'completed',
      has_partial_results: false, ...x }) as ExecutionSummary;
    expect(summaryHasResults(e({ last_completed_day: 10, upload_status: 'uploaded' }))).toBe(true);
    expect(summaryHasResults(e({ last_completed_day: 10, upload_status: 'failed' }))).toBe(false);
    expect(summaryHasResults(e({ execution_type: 'static_full', status: 'failed', has_partial_results: true }))).toBe(true);
    expect(summaryHasResults(e({ execution_type: 'static_full', status: 'running' }))).toBe(false);
  });
});
