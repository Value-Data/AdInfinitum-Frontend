import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
}));

import ReportView, { KpiCards, formatCell, orderColumns, orderKpis } from '../../src/f6/ReportView';
import { __setLabelsCache } from '../../src/f6/labels';
import type { DynamicReport, ReportWarning, StaticReport } from '../../src/types/report';
import { LanguageProvider } from '../../src/i18n/LanguageContext';

__setLabelsCache('es', {
  'result.li_recovery_pct': 'Recuperación de Li',
  'result.pond_balance': 'Balance por poza',
  'result.evaporation_t_d': 'Evaporación',
  'result.precon': 'Preconcentración',
  'result.well_brine': 'Salmuera de pozo',
  'result.li_balance': 'Balance de Li por poza',
  'result.li_in_t': 'Li que entra',
  'result.li_balance_residual_t': 'Residuo de cierre de Li',
  'result.cascade_total': 'Cascada',
  'result.note_li_balance': 'Li+ en el período (t).',
  'result.note_li_balance_start_empty': 'Las pozas partieron vacías.',
  'result.report_warnings': 'Avisos',
  'result.warning_rising_pond': 'Altura de la poza en aumento sostenido',
  'result.warning_above_berm': 'Nivel de la poza sobre la berma',
});
__setLabelsCache('en', {
  'result.report_warnings': 'Warnings',
  'result.warning_rising_pond': 'Sustained pond height rise',
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
    process_kpis: {}, global_balance: null, warnings: [],
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
      process_kpis: {}, global_balance: null, warnings: [],
    };
    render(<ReportView report={rep} />);
    expect(screen.getByTestId('liming-detail').textContent).toContain('Detalle planta de reactivos (promedio de 120 días con feed)');
    const orden = Array.from(document.querySelectorAll('[data-testid^="report-table-"]')).map((e) => e.getAttribute('data-testid'));
    expect(orden).toEqual(['report-table-liming_streams', 'report-table-liming_solids', 'report-table-liming_steps',
      'report-table-liming_step_composition', 'report-table-liming_reagent_detail']);
  });
});

describe('reporte del dinámico: balance de Li y avisos (cambios finales, puntos 6 y 14)', () => {
  const L = (key: string) => ({ key, unit: 't', kind: 'label' as const, formula: key === 'li_balance_residual_t'
    ? 'li_in_t − li_out_t − li_leakage_t − li_entrainment_t − li_inventory_delta_t' : null });
  const liBalance = {
    key: 'li_balance', row_kind: 'pond' as const,
    notes: ['note_li_balance', 'note_li_balance_start_empty'],
    columns: ['li_in_t', 'li_out_t', 'li_leakage_t', 'li_entrainment_t', 'li_inventory_start_t', 'li_inventory_end_t',
      'li_inventory_delta_t', 'li_balance_residual_t'].map(L),
    rows: [
      { id: 'Pz1', li_in_t: 100, li_out_t: 90, li_leakage_t: 1, li_entrainment_t: 2, li_inventory_start_t: 0,
        li_inventory_end_t: 7, li_inventory_delta_t: 7, li_balance_residual_t: 0 },
      { id: 'cascade_total', li_in_t: 100, li_out_t: 90, li_leakage_t: 1, li_entrainment_t: 2,
        li_inventory_start_t: 0, li_inventory_end_t: 7, li_inventory_delta_t: 7, li_balance_residual_t: 0 },
    ],
  };
  const aviso = (extra: Partial<ReportWarning> = {}): ReportWarning => ({
    code: 'rising_pond', stage: 'postliming', pond: 'C7', params: { height_delta_m: 0.17 },
    message: { es: 'La poza C7 sube 0,17 m en 365 días.', en: 'Pond C7 rises 0.17 m over 365 days.' }, ...extra,
  });
  const rep = (warnings: ReportWarning[]): DynamicReport => ({
    kind: 'chain', period: { start: '2024-01-01', end: '2024-12-31', n_days: 366 },
    params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
    stages: [
      { stage: 'precon', kpis: { li_recovery_pct: 64 }, tables: [tabla, liBalance] },
      { stage: 'postliming', kpis: { li_recovery_pct: 80 }, tables: [{ ...liBalance }] },
    ],
    process_kpis: {}, global_balance: null, warnings,
  });

  it('el balance de Li sale como las otras tablas por poza, con la fila de la cascada como total', () => {
    render(<ReportView report={rep([])} />);
    const t = screen.getAllByTestId('report-table-li_balance')[0];
    expect(within(t).getByText('Balance de Li por poza')).toBeTruthy();
    expect(within(t).getByText('Li que entra (t)')).toBeTruthy();
    // La columna derivada lleva su fórmula.
    expect(within(t).getByText('Residuo de cierre de Li (t)').closest('th')!.getAttribute('title'))
      .toContain('li_in_t − li_out_t');
    // La cascada con su etiqueta (no "cascade_total") y marcada como total.
    const fila = within(t).getByText('Cascada').closest('tr')!;
    expect(fila.getAttribute('data-total')).toBe('true');
    expect(within(t).queryByText('cascade_total')).toBeNull();
    expect(within(t).getByText('Pz1').closest('tr')!.getAttribute('data-total')).toBeNull();
    // Las notas, con sus etiquetas.
    expect(within(t).getByText('Li+ en el período (t).')).toBeTruthy();
    expect(within(t).getByText('Las pozas partieron vacías.')).toBeTruthy();
  });

  it('los avisos van destacados al inicio de su etapa, con el título del diccionario y el mensaje', () => {
    render(<ReportView report={rep([aviso(), aviso({ code: 'above_berm', pond: 'C6',
      message: { es: 'La poza C6 supera la berma.', en: 'Pond C6 is above the berm.' } })])} />);
    expect(screen.queryByTestId('report-warnings-precon')).toBeNull();
    const bloque = screen.getByTestId('report-warnings-postliming');
    expect(within(bloque).getByRole('heading').textContent).toBe('Avisos (2)');
    const items = within(bloque).getAllByTestId('report-warnings-postliming-item');
    expect(items.map((i) => i.getAttribute('data-code'))).toEqual(['rising_pond', 'above_berm']);
    expect(items[0].textContent).toContain('Altura de la poza en aumento sostenido · C7');
    expect(items[0].textContent).toContain('La poza C7 sube 0,17 m en 365 días.');
    expect(items[1].textContent).toContain('Nivel de la poza sobre la berma · C6');
    // Antes que los KPIs y las tablas de la etapa.
    const etapa = bloque.closest('section.mb-6')!;
    const orden = Array.from(etapa.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid'));
    expect(orden.indexOf('report-warnings-postliming')).toBeLessThan(orden.indexOf('kpi-li_recovery_pct'));
    expect(orden.indexOf('report-warnings-postliming')).toBeLessThan(orden.indexOf('report-table-li_balance'));
  });

  it('en inglés, el mensaje en inglés', () => {
    localStorage.setItem('adinf_language', 'en');
    try {
      render(<LanguageProvider><ReportView report={rep([aviso()])} /></LanguageProvider>);
      const bloque = screen.getByTestId('report-warnings-postliming');
      expect(within(bloque).getByRole('heading').textContent).toBe('Warnings (1)');
      expect(bloque.textContent).toContain('Sustained pond height rise · C7');
      expect(bloque.textContent).toContain('Pond C7 rises 0.17 m over 365 days.');
    } finally {
      localStorage.removeItem('adinf_language');
    }
  });

  it('en pantalla por pestañas, la de la etapa con avisos lo dice; un aviso de otra etapa va en el resumen', () => {
    render(<ReportView paged report={rep([aviso(), aviso({ stage: 'liming', pond: null,
      message: { es: 'Aviso de una etapa que no está.' } })])} />);
    // Con texto, sin glifos: "· 1 aviso".
    expect(screen.getByTestId('result-section-warnings-stage:postliming').textContent).toBe(' · 1 aviso');
    expect(screen.queryByTestId('result-section-warnings-stage:precon')).toBeNull();
    // Resumen: el aviso suelto.
    expect(screen.getByTestId('report-warnings').textContent).toContain('Aviso de una etapa que no está.');
    fireEvent.click(screen.getByTestId('result-section-warnings-stage:postliming').closest('button')!);
    expect(screen.getByTestId('report-warnings-postliming')).toBeTruthy();
  });

  it('un reporte sin avisos (backend anterior) se dibuja igual', () => {
    const viejo = { ...rep([]) } as Partial<DynamicReport>;
    delete viejo.warnings;
    render(<ReportView report={viejo as DynamicReport} paged />);
    expect(screen.queryByTestId(/report-warnings/)).toBeNull();
    expect(screen.getByTestId('result-sections')).toBeTruthy();
  });
});
