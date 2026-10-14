import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
}));

import ReportView, { formatCell } from '../../src/f6/ReportView';
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
    expect(screen.getByText(/2024-01-23 – 2024-02-21/)).toBeTruthy();
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
