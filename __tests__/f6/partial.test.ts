import { describe, expect, it } from 'vitest';
import { partialInfo } from '../../src/f6/common';

const din = { execution_type: 'dynamic_precon', n_days: 1460 };

describe('aviso de corrida parcial', () => {
  it('dinámico fallido o cancelado con días resueltos: días 1..N de M', () => {
    expect(partialInfo({ ...din, status: 'failed', last_completed_day: 137 }))
      .toEqual({ unit: 'days', done: 137, total: 1460 });
    expect(partialInfo({ ...din, status: 'cancelled', last_completed_day: 10 })?.done).toBe(10);
  });
  it('sin aviso si terminó, si sigue corriendo o si no alcanzó ningún día', () => {
    expect(partialInfo({ ...din, status: 'completed', last_completed_day: 1460 })).toBeNull();
    expect(partialInfo({ ...din, status: 'running', last_completed_day: 5 })).toBeNull();
    expect(partialInfo({ ...din, status: 'failed', last_completed_day: 0 })).toBeNull();
  });
  it('estático: escenarios resueltos de los elegidos', () => {
    const sc = [{ status: 'ok' }, { status: 'failed' }];
    expect(partialInfo({ execution_type: 'static_full', status: 'completed_with_errors', scenarios: sc }))
      .toEqual({ unit: 'scenarios', done: 1, total: 2 });
    expect(partialInfo({ execution_type: 'static_full', status: 'cancelled', scenarios: [{ status: 'ok' }],
      selected_scenarios: [1, 2, 3] })).toEqual({ unit: 'scenarios', done: 1, total: 3 });
  });
});
