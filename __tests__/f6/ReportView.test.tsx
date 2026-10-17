import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
}));

import ReportView, { KpiCards, formatCell, orderColumns, orderKpis } from '../../src/f6/ReportView';
import { __setLabelsCache } from '../../src/f6/labels';
import type { DynamicReport, StaticReport } from '../../src/types/report';

__setLabelsCache('es', {
  'result.li_recovery_pct': 'Recuperación de Li',
  'result.pond_balance': 'Balance por poza',
  'result.evaporation_t_d': 'Evaporación',
  'result.precon': 'Preconcentración',
  'result.well_brine': 'Salmuera de pozo',
});

const tabla = {
  key: 'pond_balance', row_kind: 'pond' as const, notes: [],
  columns: [{ key: 'id', unit: '', kind: 'label' as const },
            { key: 'evaporation_t_d', unit: 't/d', kind: 'label' as const },
            { key: 'Li+', unit: 't/d', kind: 'species' as const }],
  rows: [{ id: 'Pz1', evaporation_t_d: 1234.5, 'Li+': 0.01234 }, { id: 'Pz2', evaporation_t_d: null, 'Li+': 0 }],
};

describe('reporte del dinámico', () => {
  const rep: DynamicReport = {
    kind: 'dynamic', period: { start: '2024-01-23', end: '2024-02-21', n_days: 30 },
    params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
    stages: [{ stage: 'precon', kpis: { li_recovery_pct: 64 }, tables: [tabla] }],
    process_kpis: {}, global_balance: null,
  };

  it('dibuja KPIs y tablas con las etiquetas del diccionario y las unidades del reporte', () => {
    render(<ReportView report={rep} />);
    expect(screen.getByText('Preconcentración')).toBeTruthy();
    expect(within(screen.getByTestId('kpi-li_recovery_pct')).getByText('Recuperación de Li')).toBeTruthy();
    const t = screen.getByTestId('report-table-pond_balance');
    expect(within(t).getByText('Balance por poza')).toBeTruthy();
    expect(within(t).getByText('Evaporación (t/d)')).toBeTruthy();
    // Una especie se llama como en el catálogo; una poza, como la nombró el usuario.
    expect(within(t).getByText('Li+ (t/d)')).toBeTruthy();
    expect(within(t).getByText('Pz1')).toBeTruthy();
    expect(screen.getByText(/23-01-2024 – 21-02-2024/)).toBeTruthy();
  });
});

describe('reporte del estático', () => {
  it('muestra la comparativa y marca el escenario fallido', () => {
    const rep: StaticReport = {
      kind: 'static', params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
      comparison: { ...tabla, key: 'comparison', row_kind: 'scenario' },
      scenarios: [
        { index: 0, label: 'E1', status: 'ok', failed_stage: null, error_message: null, temperature_C: 15,
          evaporation_mm_d: 7, stages: [], process_kpis: {}, global_balance: null },
        { index: 1, label: 'E2', status: 'failed', failed_stage: 'precon', error_message: 'AQSOL',
          temperature_C: 5, evaporation_mm_d: 3, stages: [], process_kpis: {}, global_balance: null },
      ],
    };
    render(<ReportView report={rep} />);
    expect(screen.getByRole('tab', { name: 'E2 ⚠' })).toBeTruthy();
    expect(screen.getByTestId('report-table-comparison')).toBeTruthy();
  });
});

describe('formato de celdas', () => {
  it('vacío, booleanos y más decimales para valores chicos', () => {
    expect(formatCell(null)).toBe('–');
    expect(formatCell(true)).toBe('✓');
    expect(formatCell('Pz1')).toBe('Pz1');
    expect(formatCell(0.01234)).toMatch(/0[,.]0123/);
  });
});

describe('lo del reporte de antes', () => {
  it('tarjetas: recuperación, producción y "AQSOL convergencia" primero; los días van en la tarjeta', () => {
    const kpis = { li_in_t: 10, li_out_t: 8, li_out_t_y: 97, li_recovery_pct: 80, aqsol_converged_pct: 98.5,
      n_aqsol_failed_days: 3 };
    expect(orderKpis(kpis).map(([k]) => k)).toEqual(['li_recovery_pct', 'li_out_t_y', 'aqsol_converged_pct',
      'li_in_t', 'li_out_t']);
    render(<KpiCards kpis={kpis} />);
    const c = screen.getByTestId('kpi-aqsol_converged_pct');
    expect(within(c).getByText('AQSOL convergencia')).toBeTruthy();
    expect(within(c).getByText('98,50 %')).toBeTruthy();
    expect(within(c).getByText('(3 días fallaron)')).toBeTruthy();
    expect(screen.queryByTestId('kpi-n_aqsol_failed_days')).toBeNull();
  });

  it('Tabla 1 por poza en el orden de antes: área, entrada, evaporación (t y mm/d), salida, fugas, impregnación (t y %), sal', () => {
    const L = (key: string, unit = 't') => ({ key, unit, kind: 'label' as const });
    const t = { key: 'pond_balance', row_kind: 'pond' as const, notes: [], rows: [],
      columns: ['inflow_t', 'inflow_t_d_avg', 'outflow_t', 'outflow_t_d_avg', 'evaporation_t', 'evaporation_t_d_avg',
        'leakage_t', 'leakage_t_d_avg', 'entrainment_t', 'entrainment_t_d_avg', 'salt_precipitated_t',
        'salt_precipitated_t_d_avg', 'dilution_water_t', 'dilution_water_t_d_avg', 'area_m2', 'evaporation_mm_d_avg',
        'entrainment_of_outflow_pct'].map((k) => L(k)) };
    expect(orderColumns(t).map((c) => c.key)).toEqual(['area_m2', 'inflow_t', 'inflow_t_d_avg', 'evaporation_t',
      'evaporation_t_d_avg', 'evaporation_mm_d_avg', 'outflow_t', 'outflow_t_d_avg', 'leakage_t', 'leakage_t_d_avg',
      'entrainment_t', 'entrainment_t_d_avg', 'entrainment_of_outflow_pct', 'salt_precipitated_t',
      'salt_precipitated_t_d_avg', 'dilution_water_t', 'dilution_water_t_d_avg']);
    const props = { ...t, key: 'pond_properties', columns: [L('liquid_density', 'kg/m3'), L('area_m2', 'm2')] };
    expect(orderColumns(props).map((c) => c.key)).toEqual(['area_m2', 'liquid_density']);
  });

  it('planta: el detalle de antes al final de la etapa, con los días promediados', () => {
    const tb = (key: string) => ({ key, row_kind: 'step' as const, notes: [],
      columns: [{ key: 'n_days_averaged', unit: 'd', kind: 'label' as const }],
      rows: [{ id: 'step_1', n_days_averaged: 120 }] });
    const rep: DynamicReport = {
      kind: 'dynamic', period: { start: '2024-01-01', end: '2024-12-31', n_days: 366 },
      params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
      stages: [{ stage: 'liming', kpis: {}, tables: [tb('liming_streams'), tb('liming_steps'),
        tb('liming_step_composition'), tb('liming_reagent_detail'), tb('liming_solids')] }],
      process_kpis: {}, global_balance: null,
    };
    render(<ReportView report={rep} />);
    expect(screen.getByTestId('liming-detail').textContent).toContain('Detalle planta de reactivos (promedio de 120 días con feed)');
    const orden = Array.from(document.querySelectorAll('[data-testid^="report-table-"]')).map((e) => e.getAttribute('data-testid'));
    expect(orden).toEqual(['report-table-liming_streams', 'report-table-liming_solids', 'report-table-liming_steps',
      'report-table-liming_step_composition', 'report-table-liming_reagent_detail']);
  });
});
