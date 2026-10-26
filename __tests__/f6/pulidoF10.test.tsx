/**
 * Pulido de la interfaz (F10): unidades que no se repiten, unidades de los KPIs, el
 * resumen de una corrida de una sola etapa y el tipo que ofrece "Lanzar una ejecución".
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
  getSection: vi.fn(async () => ({ data: { scenarios: [] } })),
}));

import { getSection, type SectionState } from '../../src/services/apiV2';
import { labelWithUnit } from '../../src/f6/labels';
import ReportView, { KpiCards } from '../../src/f6/ReportView';
import LaunchPanel, { defaultLaunchType, typeConfigured } from '../../src/f6/LaunchPanel';
import type { DynamicReport } from '../../src/types/report';

const guardada = (kind: string): SectionState => ({ kind, latest_version_no: 1 } as SectionState);

describe('etiqueta con unidad', () => {
  it('no repite la unidad cuando la etiqueta ya la trae escrita de otra forma', () => {
    expect(labelWithUnit('Composición (%p/p)', '%w/w')).toBe('Composición (%p/p)');
    expect(labelWithUnit('Dilución (fracción)', 'frac')).toBe('Dilución (fracción)');
    expect(labelWithUnit('Área de proceso (m²)', 'm2')).toBe('Área de proceso (m²)');
  });

  it('la agrega cuando la etiqueta no la tiene', () => {
    expect(labelWithUnit('Caudal de salida', 't/d')).toBe('Caudal de salida (t/d)');
    expect(labelWithUnit('Fugas', 'frac')).toBe('Fugas (frac)');
  });
});

describe('tarjetas de KPIs', () => {
  it('cada valor lleva su unidad; un valor vacío no', () => {
    render(<KpiCards kpis={{ li_out_t_y: 9618.6, li_recovery_pct: 83.09, li_in_t: null }} />);
    expect(screen.getByTestId('kpi-li_out_t_y').textContent).toContain('t/y');
    expect(screen.getByTestId('kpi-li_recovery_pct').textContent).toContain('%');
    expect(screen.getByTestId('kpi-li_in_t').textContent).not.toMatch(/\bt$/);
  });

  it('la recuperación del proceso va primero', () => {
    render(<KpiCards kpis={{ li_out_t_y: 1, process_li_recovery_pct: 80 }} />);
    const ids = screen.getAllByTestId(/^kpi-/).map((e) => e.getAttribute('data-testid'));
    expect(ids[0]).toBe('kpi-process_li_recovery_pct');
  });
});

describe('resumen de una corrida de una sola etapa', () => {
  const rep: DynamicReport = {
    kind: 'dynamic', period: { start: '2026-04-21', end: '2026-04-30', n_days: 10 },
    params: { period_start: null, period_end: null, scale_factor: 1, days_year: {} },
    stages: [{ stage: 'precon', kpis: { li_recovery_pct: 64, li_out_t_y: 120 }, tables: [] }],
    process_kpis: {}, global_balance: null, warnings: [],
  };

  it('en pantalla, sin KPIs del proceso, muestra los de la etapa (antes quedaba solo el período)', () => {
    render(<ReportView report={rep} paged />);
    const resumen = screen.getByTestId('summary-kpis-precon');
    expect(within(resumen).getByTestId('kpi-li_recovery_pct')).toBeTruthy();
  });

  it('impreso no los repite: la etapa ya va completa debajo', () => {
    render(<ReportView report={rep} printAll />);
    expect(screen.queryByTestId('summary-kpis-precon')).toBeNull();
    expect(screen.getAllByTestId('kpi-li_recovery_pct')).toHaveLength(1);
  });

  it('con KPIs del proceso, el resumen queda como estaba', () => {
    render(<ReportView report={{ ...rep, process_kpis: { process_li_recovery_pct: 50 } }} paged />);
    expect(screen.queryByTestId('summary-kpis-precon')).toBeNull();
  });
});

describe('tipo que ofrece "Lanzar una ejecución"', () => {
  it('el primero que el proyecto puede correr', () => {
    expect(defaultLaunchType([guardada('precon_dynamic')])).toBe('dynamic_precon');
    expect(defaultLaunchType([guardada('precon_static'), guardada('liming_static'), guardada('postliming_static')]))
      .toBe('static_full');
    expect(defaultLaunchType([guardada('precon_static')])).toBe('static_precon');
    expect(defaultLaunchType([])).toBe('static_full');
  });

  it('el proceso completo pide las tres secciones del estático', () => {
    expect(typeConfigured('static_full', [guardada('precon_static'), guardada('liming_static')])).toBe(false);
    expect(typeConfigured('dynamic_liming', [guardada('liming_static')])).toBe(false);
  });

  it('marca los tipos sin configurar y no pide escenarios de una precon estática que no existe', () => {
    vi.mocked(getSection).mockClear();
    render(<LaunchPanel projectId="p1" executions={[]} sections={[guardada('precon_dynamic')]} onLaunched={() => undefined} />);
    const tipo = screen.getByTestId('launch-type') as HTMLSelectElement;
    expect(tipo.value).toBe('dynamic_precon');
    const textos = Array.from(tipo.options).map((o) => o.textContent ?? '');
    expect(textos.find((x) => x.startsWith('Estático · proceso completo'))).toMatch(/sin configurar/);
    expect(textos.find((x) => x.startsWith('Dinámico · preconcentración'))).not.toMatch(/sin configurar/);
    expect(getSection).not.toHaveBeenCalled();
  });
});
