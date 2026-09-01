/**
 * Las tres formas que puede tener un día de `daily_results`.
 *
 * Reportado: en el Excel de una corrida de 365 días de solo preconcentración, la hoja
 * "Resumen Diario" traía día y fecha pero las columnas de litio vacías. El día de una
 * corrida de solo preconcentración ES el SolverResult, no viene envuelto en `precon`.
 */

import { describe, it, expect } from 'vitest';
import { readDailyResult, type DailyResultRow } from '../../src/utils/dailyResult';

const SOLVER = {
  ponds: [{ config: { name: 'PC1' } }],
  li_in: 0.607302890913372,
  li_out: 0.5858374772375967,
  li_recovery_pct: 96.465452,
  total_evaporation: 313.480413,
  total_salt: 53.551038,
};

function fila(result: Record<string, unknown> | null, error_msg?: string): DailyResultRow {
  return { day: 0, date_label: 'Dia 1', temperature_C: 20, evap_rate_mm_day: 7.72, result, error_msg };
}

describe('readDailyResult', () => {
  it('solo preconcentración: el día ES el SolverResult', () => {
    const d = readDailyResult(fila(SOLVER));
    expect(d.precon?.li_in).toBe(0.607302890913372);
    expect(d.last?.li_out).toBe(0.5858374772375967);
    expect(d.last?.li_recovery_pct).toBe(96.465452);
    expect(d.failed).toBe(false);
  });

  it('proceso completo: toma precon y postliming, y la última etapa es postliming', () => {
    const post = { ...SOLVER, li_out: 0.4, li_recovery_pct: 70 };
    const d = readDailyResult(fila({ precon: SOLVER, postliming: post, encalado: { x: 1 } }));
    expect(d.precon?.li_in).toBe(0.607302890913372);
    expect(d.last?.li_out).toBe(0.4);
    expect(d.encalado).toEqual({ x: 1 });
  });

  it('día que reventó: sin resultado, con el motivo del día', () => {
    const d = readDailyResult(fila(null, 'Error de cálculo — Poza 4 (PC4), iteración 2 de 200'));
    expect(d.failed).toBe(true);
    expect(d.error).toMatch(/Poza 4/);
    expect(d.last).toBeUndefined();
  });

  it('día con error_stage: falla y reporta la etapa', () => {
    const d = readDailyResult(fila({ error_stage: 'precon' }));
    expect(d.failed).toBe(true);
    expect(d.error).toBe('precon');
  });
});
