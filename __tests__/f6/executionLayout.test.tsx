import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
}));

import ReportView, { resultSections, splitColumns } from '../../src/f6/ReportView';
import { chartGroups } from '../../src/f6/Charts';
import { executionTabs, parseTab } from '../../src/f6/executionTabs';
import { Pager, pageSlice } from '../../src/f6/paging';
import type { ReportColumn, StaticReport } from '../../src/types/report';

const col = (k: string): ReportColumn => ({ key: k, unit: 't/d', kind: 'species' });
const ancha = {
  key: 'pond_flow', row_kind: 'pond' as const, notes: [],
  columns: [{ key: 'id', unit: '', kind: 'label' as const }, ...Array.from({ length: 10 }, (_, i) => col(`c${i + 1}`))],
  rows: [{ id: 'Pz1', ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i + 1}`, i])) }],
};
const estatico = (stages: StaticReport['scenarios'][number]['stages']): StaticReport => ({
  kind: 'static', params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
  comparison: { ...ancha, key: 'comparison', row_kind: 'scenario' },
  scenarios: [{ index: 0, label: 'E1', status: 'ok', failed_stage: null, error_message: null, temperature_C: 15,
    evaporation_mm_d: 7, stages, process_kpis: {}, global_balance: null }],
});

describe('tablas anchas al imprimir', () => {
  it('parte las columnas en bloques de a lo más n', () => {
    const cols = Array.from({ length: 10 }, (_, i) => col(`c${i}`));
    expect(splitColumns(cols, 7).map((b) => b.length)).toEqual([7, 3]);
    expect(splitColumns(cols.slice(0, 4), 7).map((b) => b.length)).toEqual([4]);
    expect(splitColumns([], 7)).toEqual([[]]);
  });

  it('impresa, una tabla de 10 columnas sale en dos, cada una con la poza y "columnas a–b de n"', () => {
    render(<ReportView report={estatico([{ stage: 'precon', kpis: {}, tables: [ancha] }])} printAll />);
    const t = screen.getByTestId('report-table-pond_flow');
    const tablas = within(t).getAllByRole('table');
    expect(tablas).toHaveLength(2);
    tablas.forEach((tb) => expect(within(tb).getByText('Pz1')).toBeTruthy());
    expect(within(t).getByText(/columnas 1–7 de 10/)).toBeTruthy();
    expect(within(t).getByText(/columnas 8–10 de 10/)).toBeTruthy();
  });

  it('en pantalla sigue siendo una sola tabla, con la primera columna fija', () => {
    render(<ReportView report={estatico([{ stage: 'precon', kpis: {}, tables: [ancha] }])} />);
    const t = screen.getByTestId('report-table-pond_flow');
    expect(within(t).getAllByRole('table')).toHaveLength(1);
    expect(within(t).getByText('Pz1').closest('td')?.className).toMatch(/sticky-col/);
  });
});

describe('pestañas de la ejecución', () => {
  it('resultados primero; diarios solo en el dinámico; archivos si hay', () => {
    expect(executionTabs({ dynamic: false, chain: false, files: false }))
      .toEqual(['results', 'charts', 'compare']);
    expect(executionTabs({ dynamic: true, chain: false, files: true }))
      .toEqual(['results', 'charts', 'daily', 'compare', 'files']);
    // El reporte de la cadena: las series diarias de cada etapa, sin comparación.
    expect(executionTabs({ dynamic: true, chain: true, files: false })).toEqual(['results', 'charts', 'daily']);
    expect(executionTabs({ dynamic: false, chain: false, files: false, compare: false })).toEqual(['results', 'charts']);
  });

  it('una pestaña desconocida o que no aplica cae en resultados', () => {
    const tabs = executionTabs({ dynamic: false, chain: false, files: false });
    expect(parseTab('charts', tabs)).toBe('charts');
    expect(parseTab('daily', tabs)).toBe('results');
    expect(parseTab(null, tabs)).toBe('results');
  });
});

describe('grupos de gráficos', () => {
  const pozas = {
    key: 'pond_properties', row_kind: 'pond' as const, notes: [],
    columns: [{ key: 'id', unit: '', kind: 'label' as const }, { key: 'Li+', unit: 't/d', kind: 'species' as const }],
    rows: [{ id: 'P1', 'Li+': 1 }],
  };
  it('estático: una pestaña por etapa con pozas, la comparativa y el balance de Li', () => {
    const rep = estatico([{ stage: 'precon', kpis: {}, tables: [pozas] }, { stage: 'liming', kpis: {}, tables: [] },
      { stage: 'postliming', kpis: {}, tables: [pozas] }]);
    expect(chartGroups(rep, 0)).toEqual(['stage:precon', 'stage:postliming', 'compare', 'balance']);
  });
  it('dinámico: el balance por poza y el balance de Li', () => {
    expect(chartGroups({
      kind: 'dynamic', period: { start: '2024-01-01', end: '2024-01-02', n_days: 2 },
      params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
      stages: [{ stage: 'precon', kpis: {}, tables: [pozas] }], process_kpis: {}, global_balance: null,
    }, 0)).toEqual(['compare', 'balance']);
  });
});

describe('paginación', () => {
  it('corta la página pedida y la deja dentro del rango', () => {
    const xs = Array.from({ length: 45 }, (_, i) => i);
    expect(pageSlice(xs, 0, 20).items).toEqual(xs.slice(0, 20));
    expect(pageSlice(xs, 2, 20)).toMatchObject({ page: 2, pages: 3, items: xs.slice(40) });
    expect(pageSlice(xs, 9, 20).page).toBe(2);
    expect(pageSlice([], 0, 20)).toMatchObject({ page: 0, pages: 1, items: [] });
  });
  it('el paginador solo aparece con más de una página y avanza', () => {
    const onPage = vi.fn();
    const { rerender, container } = render(<Pager page={0} pages={1} total={5} size={20} onPage={onPage} />);
    expect(container.textContent).toBe('');
    rerender(<Pager page={0} pages={3} total={45} size={20} onPage={onPage} />);
    expect(screen.getByText('1–20 / 45')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '›' }));
    expect(onPage).toHaveBeenCalledWith(1);
    expect((screen.getByRole('button', { name: '‹' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('sub-pestañas de Resultados', () => {
  const st = (stage: string) => ({ stage, kpis: { li_recovery_pct: 90 }, tables: [{ ...ancha, key: `t_${stage}` }] });
  it('resumen, una por etapa y el balance global si viene', () => {
    const rep = estatico([st('precon'), st('liming'), st('postliming')]);
    expect(resultSections(rep, 0)).toEqual(['summary', 'stage:precon', 'stage:liming', 'stage:postliming']);
    rep.scenarios[0].global_balance = { ...ancha, key: 'global_balance' };
    expect(resultSections(rep, 0)).toEqual(['summary', 'stage:precon', 'stage:liming', 'stage:postliming', 'global']);
  });
  it('paginada muestra solo la etapa elegida; impresa, todas', () => {
    const rep = estatico([st('precon'), st('postliming')]);
    const { unmount } = render(<ReportView report={rep} paged />);
    expect(screen.getByTestId('report-table-comparison')).toBeTruthy();
    expect(screen.queryByTestId('report-table-t_precon')).toBeNull();
    fireEvent.click(within(screen.getByTestId('result-sections')).getByRole('tab', { name: 'Preconcentración' }));
    expect(screen.getByTestId('report-table-t_precon')).toBeTruthy();
    expect(screen.queryByTestId('report-table-t_postliming')).toBeNull();
    unmount();
    render(<ReportView report={rep} printAll />);
    expect(screen.getByTestId('report-table-t_precon')).toBeTruthy();
    expect(screen.getByTestId('report-table-t_postliming')).toBeTruthy();
  });
});

describe('lo que se muestra según el rol', () => {
  it('sin las capacidades cargadas no se ofrece nada extra; con ellas, lo que el rol permite', async () => {
    const { canDo } = await import('../../src/f6/executionTabs');
    expect(canDo(null, 'view_logs')).toBe(false);
    expect(canDo(['view_results'], 'view_logs')).toBe(false);
    expect(canDo(['view_results', 'view_logs'], 'view_logs')).toBe(true);
  });
});
