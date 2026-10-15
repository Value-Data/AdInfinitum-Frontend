import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EChartsOption } from 'echarts';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
}));
// jsdom no tiene lienzo: el gráfico se reemplaza por una caja que guarda sus opciones.
const dibujados: { option: EChartsOption; group?: string; print: boolean }[] = [];
vi.mock('../../src/f6/EChart', async (orig) => {
  const real = await orig<typeof import('../../src/f6/EChart')>();
  return {
    ...real,
    EChart: ({ option, group }: { option: EChartsOption; group?: string }) => {
      dibujados.push({ option, group, print: real.useChartPrint() });
      return <div data-testid="echart" />;
    },
  };
});

import {
  climateRows, hasPondCharts, liVsSpecies, pondRows, saltEvolution,
} from '../../src/f6/chartData';
import { ReportCharts } from '../../src/f6/Charts';
import { ChartPrintContext } from '../../src/f6/EChart';
import { __setLabelsCache } from '../../src/f6/labels';
import type { ReportTable, StageReport, StaticReport } from '../../src/types/report';

__setLabelsCache('es', {});

const L = (key: string, unit = '') => ({ key, unit, kind: 'label' as const });
const S = (key: string, unit: string) => ({ key, unit, kind: 'species' as const });
const tabla = (key: string, columns: ReportTable['columns'], rows: ReportTable['rows']): ReportTable =>
  ({ key, row_kind: 'pond', columns, rows, notes: [] });

// Las tablas vienen en otro orden de pozas a propósito: se unen por nombre, no por posición.
const etapa: StageReport = {
  stage: 'precon', kpis: {},
  tables: [
    tabla('pond_balance', [L('outflow_t_d', 't/d'), L('salt_precipitated_t_d', 't/d')],
      [{ id: 'P2', outflow_t_d: 50, salt_precipitated_t_d: 3 }, { id: 'P1', outflow_t_d: 80, salt_precipitated_t_d: 1 }]),
    tabla('pond_outflow_species', [L('brine_out_t_d', 't/d'), S('Li+', 't/d'), S('Na+', 't/d'), S('H2O', 't/d')],
      [{ id: 'P1', brine_out_t_d: 80, 'Li+': 0.1, 'Na+': 6, H2O: 70 },
       { id: 'P2', brine_out_t_d: 50, 'Li+': 0.09, 'Na+': 2, H2O: 40 }]),
    tabla('pond_outflow_composition', [S('Li+', '%w/w'), S('Na+', '%w/w')],
      [{ id: 'P1', 'Li+': 0.125, 'Na+': 7.5 }, { id: 'P2', 'Li+': null, 'Na+': null, no_outflow_in_period: true }]),
    { ...tabla('salts_by_pond', [{ key: 'Halite', unit: 't/d', kind: 'salt' }, { key: 'Gypsum', unit: 't/d', kind: 'salt' },
      { key: 'Carnallite', unit: 't/d', kind: 'salt' }, L('salt_precipitated_t_d', 't/d')],
      [{ id: 'P1', Halite: 0.5, Gypsum: 0.9, Carnallite: 0 }, { id: 'P2', Halite: 2.5, Gypsum: 0.1, Carnallite: 0 }]) },
    tabla('pond_properties', [L('liquid_density', 'kg/m3'), L('water_activity')],
      [{ id: 'P1', liquid_density: 1200, water_activity: 0.75 }, { id: 'P2', liquid_density: 1250, water_activity: 0.7 }]),
  ],
};

describe('gráficos por poza del estático', () => {
  it('Li+ vs especies de referencia, en t/d o en %p/p (sin especies fuera de la lista)', () => {
    const abs = liVsSpecies(etapa, 'abs');
    expect(abs.species).toEqual(['Na+']);
    expect(abs.rows).toEqual([{ id: 'P1', 'Li+': 0.1, 'Na+': 6 }, { id: 'P2', 'Li+': 0.09, 'Na+': 2 }]);
    // Una poza sin salida queda vacía, no en cero.
    expect(liVsSpecies(etapa, 'pct').rows[1]).toEqual({ id: 'P2', 'Li+': null, 'Na+': null });
  });

  it('caudal, sal, densidad y actividad de agua se unen por poza', () => {
    expect(pondRows(etapa, 'abs')).toEqual([
      { id: 'P1', liquid_density: 1200, water_activity: 0.75, outflow_t_d: 80, salt_precipitated_t_d: 1, 'Li+': 0.1 },
      { id: 'P2', liquid_density: 1250, water_activity: 0.7, outflow_t_d: 50, salt_precipitated_t_d: 3, 'Li+': 0.09 },
    ]);
    expect(pondRows(etapa, 'pct')[0]['Li+']).toBe(0.125);
  });

  it('solo las sales que precipitaron, de mayor a menor', () => {
    const s = saltEvolution(etapa);
    expect(s.salts).toEqual(['Halite', 'Gypsum']);
    expect(s.rows[1]).toEqual({ id: 'P2', Halite: 2.5, Gypsum: 0.1 });
  });

  it('la planta (sin pozas) no tiene gráficos por poza', () => {
    expect(hasPondCharts(etapa)).toBe(true);
    expect(hasPondCharts({ stage: 'liming', kpis: {}, tables: [] })).toBe(false);
  });

  it('clima de cada escenario desde la comparativa', () => {
    const comp: ReportTable = { key: 'scenario_comparison', row_kind: 'scenario', notes: [],
      columns: [L('temperature_C', '°C'), L('evaporation_mm_d', 'mm/d')],
      rows: [{ id: 'E1', temperature_C: 12, evaporation_mm_d: 5.5 }, { id: 'E2', temperature_C: null, evaporation_mm_d: 4 }] };
    expect(climateRows(comp)).toEqual([
      { id: 'E1', temperature_C: 12, evaporation_mm_d: 5.5 }, { id: 'E2', temperature_C: null, evaporation_mm_d: 4 }]);
  });
});

describe('ReportCharts del estático', () => {
  const sc = (index: number, label: string) => ({
    index, label, status: 'ok' as const, failed_stage: null, error_message: null, temperature_C: 10,
    evaporation_mm_d: 5, stages: [etapa], process_kpis: {}, global_balance: null });
  const rep: StaticReport = {
    kind: 'static', params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
    scenarios: [sc(0, 'E1'), sc(1, 'E2')],
    comparison: { key: 'scenario_comparison', row_kind: 'scenario', notes: [],
      columns: [L('temperature_C', '°C'), L('evaporation_mm_d', 'mm/d'), L('li_in_t_d', 't/d')],
      rows: [{ id: 'E1', temperature_C: 10, evaporation_mm_d: 5, li_in_t_d: 1 },
             { id: 'E2', temperature_C: 11, evaporation_mm_d: 6, li_in_t_d: 1 }] },
  };

  it('muestra los gráficos por poza del escenario elegido, con su clima', () => {
    render(<ReportCharts report={rep} scenario={1} />);
    expect(screen.getByText(/Escenario E2 · Preconcentración · Li\+ vs Na\+ \(t\/d\)/)).toBeTruthy();
    expect(screen.queryByText(/Escenario E1 · Preconcentración · Li\+ vs Na\+/)).toBeNull();
    expect(screen.getByText('Clima de cada escenario')).toBeTruthy();
    expect(screen.getByText(/Evolución de cada sal en la cascada/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '%p/p' }));
    expect(screen.getByText(/Escenario E2 · Preconcentración · Li\+ vs Na\+ \(%p\/p\)/)).toBeTruthy();
  });

  it('para imprimir, todos los escenarios', () => {
    dibujados.length = 0;
    render(<ChartPrintContext.Provider value><ReportCharts report={rep} allScenarios /></ChartPrintContext.Provider>);
    expect(screen.getByText(/Escenario E1 · Preconcentración · Li\+ vs Na\+/)).toBeTruthy();
    expect(screen.getByText(/Escenario E2 · Preconcentración · Li\+ vs Na\+/)).toBeTruthy();
    // En la vista de impresión, todos en SVG y sin caja de herramientas.
    expect(dibujados.length).toBeGreaterThan(0);
    expect(dibujados.every((d) => d.print && d.option.toolbox === undefined)).toBe(true);
  });

  it('balance de litio y recuperaciones del escenario, desde sus KPIs', () => {
    dibujados.length = 0;
    const conKpis = { ...etapa, kpis: { li_in_t_d: 1, li_out_t_d: 0.8, li_recovery_pct: 80 } };
    const r: StaticReport = { ...rep, scenarios: [{ ...rep.scenarios[0], stages: [conKpis],
      process_kpis: { process_li_recovery_pct: 75 } }] };
    render(<ReportCharts report={r} />);
    expect(screen.getByText('Escenario E1 · Recuperación de Li (%)')).toBeTruthy();
    expect(screen.getByText('Escenario E1 · Balance de litio (t/d de Li)')).toBeTruthy();
    const tipos = dibujados.map((d) => (d.option.series as { type: string }[])[0].type);
    expect(tipos).toContain('sankey');
    expect(tipos).toContain('gauge');
  });

  it('los gráficos apilados comparten cursor; barras o líneas a elección', () => {
    dibujados.length = 0;
    render(<ReportCharts report={rep} scenario={0} />);
    const grupos = dibujados.map((d) => d.group).filter(Boolean);
    expect(grupos).toContain('clima');
    expect(grupos.filter((g) => g === 'Escenario E1 · precon-Na+')).toHaveLength(2);
    const tipo = () => dibujados.map((d) => (d.option.series as { type: string }[])[0].type)
      .find((x) => x === 'bar' || x === 'line');
    expect(tipo()).toBe('bar');
    dibujados.length = 0;
    fireEvent.click(screen.getByRole('tab', { name: 'Líneas' }));
    expect(tipo()).toBe('line');
  });
});
