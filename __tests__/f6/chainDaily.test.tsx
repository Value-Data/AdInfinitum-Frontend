import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const series = vi.fn(async () => ({ stage: 'precon', dates: [], ponds: [], groups: [], composition: null }));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
  getExecutionSeries: (...a: unknown[]) => series(...(a as [])),
}));

import { DailyCharts, PRINT_SERIES_SPECIES } from '../../src/f6/Charts';
import { executionTabs } from '../../src/f6/executionTabs';
import { __setLabelsCache } from '../../src/f6/labels';

__setLabelsCache('es', {});

describe('series diarias como el PDF de antes', () => {
  it('impresas, piden la composición con el H2O', async () => {
    render(<DailyCharts executionId="e1" query={{}} print />);
    await waitFor(() => expect(series).toHaveBeenCalled());
    expect(series.mock.calls.at(-1)?.[2]).toEqual(PRINT_SERIES_SPECIES);
    expect(PRINT_SERIES_SPECIES).toContain('H2O');
  });
  it('el reporte de cadena tiene su pestaña de series diarias', () => {
    expect(executionTabs({ dynamic: true, chain: true, files: false })).toContain('daily');
  });
});

describe('series diarias de la cadena', () => {
  it('una sección por etapa completada, cada una con su ejecución y el período común', async () => {
    const { ChainDailyCharts } = await import('../../src/f6/ChainDailyCharts');
    series.mockClear();
    const listo = vi.fn();
    const { getByTestId, queryByTestId } = render(<ChainDailyCharts onSettled={listo}
      query={{ period_start: '2024-01-01', period_end: '2024-01-31' }}
      chain={{ complete: true, stages: ['precon', 'liming', 'postliming'], executions: [
        { id: 'a', stage: 'precon', status: 'completed' }, { id: 'b', stage: 'liming', status: 'completed' },
        { id: 'c', stage: 'postliming', status: 'failed' }] as never }} />);
    expect(getByTestId('chain-daily-precon')).toBeTruthy();
    expect(getByTestId('chain-daily-liming')).toBeTruthy();
    expect(queryByTestId('chain-daily-postliming')).toBeNull();
    await waitFor(() => expect(listo).toHaveBeenCalledTimes(1));
    expect(series.mock.calls.map((c) => [c[0], (c[1] as { period_start: string }).period_start]))
      .toEqual([['a', '2024-01-01'], ['b', '2024-01-01']]);
  });
});
