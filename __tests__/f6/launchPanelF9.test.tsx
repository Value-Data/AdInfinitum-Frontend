/**
 * Panel de lanzamiento (cambios finales, punto 7): la planta y la concentración del
 * dinámico alimentadas con los datos de su sección piden fecha de inicio y días, no
 * origen; alimentadas por una ejecución, como siempre. Los errores del backend al lanzar
 * se muestran con su código (y el campo, en `horizon`).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionSummary, SectionState } from '../../src/services/apiV2';

const m = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getSection: vi.fn(async () => null),
  launchExecution: (...a: unknown[]) => m.launch(...a),
}));

import LaunchPanel from '../../src/f6/LaunchPanel';

const planta = { id: 'planta-1', project_id: 'p1', execution_type: 'dynamic_liming', status: 'completed',
  upload_status: 'uploaded', run_tag: 'base', created_at: '2026-10-20T10:00:00', last_completed_day: 30,
  has_partial_results: false, created_by: 'u' } as ExecutionSummary;
const conc = { ...planta, id: 'conc-1', execution_type: 'dynamic_postliming' } as ExecutionSummary;

function ver(secciones: SectionState[], ejecuciones: ExecutionSummary[] = [planta, conc]) {
  return render(<LaunchPanel projectId="p1" executions={ejecuciones} sections={secciones} onLaunched={() => undefined} />);
}
const elegir = (tipo: string) => fireEvent.change(screen.getByTestId('launch-type'), { target: { value: tipo } });

beforeEach(() => {
  vi.clearAllMocks();
  m.launch.mockResolvedValue({ id: 'nueva' });
});

describe('lanzar la planta y la concentración del dinámico', () => {
  it('con datos: fecha de inicio y días, sin elegir origen', async () => {
    ver([{ kind: 'liming_dynamic', feed_source: 'data' }] as SectionState[]);
    elegir('dynamic_liming');
    expect(screen.queryByTestId('launch-source')).toBeNull();
    fireEvent.change(screen.getByTestId('launch-start'), { target: { value: '2024-01-23' } });
    fireEvent.change(screen.getByTestId('launch-days'), { target: { value: '90' } });
    // Los días son obligatorios: sin "(opcional)".
    expect(screen.getByText('Días')).toBeTruthy();
    fireEvent.click(screen.getByText('Lanzar'));
    await waitFor(() => expect(m.launch).toHaveBeenCalled());
    expect(m.launch.mock.calls[0][1]).toMatchObject({ execution_type: 'dynamic_liming', start_date: '2024-01-23', n_days: 90 });
    expect(m.launch.mock.calls[0][1]).not.toHaveProperty('source_execution_id');
  });

  it('la concentración con datos que continúa otra: sin fecha de inicio', () => {
    ver([{ kind: 'postliming_dynamic', feed_source: 'data' }] as SectionState[]);
    elegir('dynamic_postliming');
    expect(screen.getByTestId('launch-start')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Sin continuación'), { target: { value: 'conc-1' } });
    expect(screen.queryByTestId('launch-start')).toBeNull();
    expect(screen.getByTestId('launch-days')).toBeTruthy();
  });

  it('alimentadas por una ejecución: origen; la planta sin fecha ni días, la concentración con días opcionales', () => {
    ver([{ kind: 'liming_dynamic', feed_source: 'execution' }, { kind: 'postliming_dynamic', feed_source: 'execution' }] as SectionState[]);
    elegir('dynamic_liming');
    expect(screen.getByTestId('launch-source')).toBeTruthy();
    expect(screen.queryByTestId('launch-start')).toBeNull();
    expect(screen.queryByTestId('launch-days')).toBeNull();
    elegir('dynamic_postliming');
    expect(screen.getByTestId('launch-source')).toBeTruthy();
    expect(screen.queryByTestId('launch-start')).toBeNull();
    expect(screen.getByText('Días (opcional)')).toBeTruthy();
  });

  it('el error de horizonte del backend se ve con la serie que no alcanza', async () => {
    m.launch.mockRejectedValue({ response: { status: 422, data: { detail: 'x', code: 'horizon',
      message: 'Las series no cubren la corrida.', field: 'series.brine_flow_t_d' } } });
    ver([{ kind: 'liming_dynamic', feed_source: 'data' }] as SectionState[]);
    elegir('dynamic_liming');
    fireEvent.click(screen.getByText('Lanzar'));
    expect((await screen.findByTestId('launch-error')).textContent)
      .toBe('Las series no cubren la corrida. · series.brine_flow_t_d (horizon)');
  });

  it('start_date_required / n_days_required llegan con su código', async () => {
    m.launch.mockRejectedValue({ response: { status: 422, data: { code: 'start_date_required',
      message: 'Falta la fecha de inicio de la corrida.' } } });
    ver([{ kind: 'liming_dynamic', feed_source: 'data' }] as SectionState[]);
    elegir('dynamic_liming');
    fireEvent.click(screen.getByText('Lanzar'));
    expect((await screen.findByTestId('launch-error')).textContent)
      .toBe('Falta la fecha de inicio de la corrida. (start_date_required)');
  });
});
