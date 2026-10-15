/**
 * Lectura de una fila de `daily_results` (corridas multi-día del estático).
 *
 * El día puede venir en tres formas y cada consumidor las estaba resolviendo por su
 * cuenta, con resultados distintos:
 *
 *  - `{ precon, encalado, postliming }` — proceso completo;
 *  - un `SolverResult` directo, con `ponds` y sin envoltorio — solo preconcentración;
 *  - `null` — el día reventó y el motivo está en `error_msg`, al lado del resultado.
 *
 * El caso del SolverResult directo es el que se olvidaba: buscar `pc.precon` en una
 * corrida de solo preconcentración devuelve undefined y las columnas de litio quedan
 * vacías, aunque el dato esté ahí.
 */

import type { SolverResult } from '../types';

export interface DailyResultRow {
  day: number;
  date_label: string;
  temperature_C: number;
  evap_rate_mm_day: number;
  result: Record<string, unknown> | null;
  error_msg?: string | null;
  /** Caudal de salmuera usado ese día, cuando el cronograma lo define por día. */
  brine_total_flow?: number | null;
  /** El día falló, pero `result` trae el tren hasta la poza anterior al error. */
  partial?: boolean;
  ponds_completed?: number;
  ponds_total?: number;
}

/**
 * Nombre de la poza donde se cortó el tren, sacado del mensaje de error.
 *
 * Los dos formatos que produce el backend traen el nombre entre paréntesis:
 *   - motor:  "… — Poza 6 (PC 6.1), iteración 2 de 200"
 *   - backend: "… — falló en la poza 6 de 14 (PC 6.1)."
 *
 * Se extrae para mostrarlo en la tabla sin obligar a pasar el mouse por encima.
 */
export function pozaDelError(msg: string | null | undefined): string | undefined {
  if (!msg) return undefined;
  const m = /poza\s+\d+(?:\s+de\s+\d+)?\s*\(([^)]+)\)/i.exec(msg);
  return m ? m[1].trim() : undefined;
}

export interface DailyStages {
  precon?: SolverResult;
  postliming?: SolverResult;
  encalado?: Record<string, unknown>;
  /** Última etapa con datos: la que manda para salida de Li, evaporación y sales. */
  last?: SolverResult;
  /** El día no produjo resultado. */
  failed: boolean;
  /** Motivo, ya sea el error_stage del resultado o el error_msg del día. */
  error?: string;
  /** El día falló pero se conservó el tren hasta la poza anterior al error. */
  partial?: boolean;
  pondsCompleted?: number;
  pondsTotal?: number;
}

export function readDailyResult(dr: DailyResultRow): DailyStages {
  const pc = dr.result;
  if (pc == null) {
    return { failed: true, error: dr.error_msg || undefined };
  }

  // Día parcial: hay resultado, pero es el tren truncado en la poza que falló. No es
  // `failed` (hay datos que mostrar) ni un día limpio (los totales son de un tramo).
  const parcial = dr.partial === true;

  let precon = pc.precon as SolverResult | undefined;
  const postliming = pc.postliming as SolverResult | undefined;
  const encalado = pc.encalado as Record<string, unknown> | undefined;

  // Solo preconcentración: el día ES el SolverResult.
  if (!precon && !postliming && Array.isArray((pc as { ponds?: unknown }).ponds)) {
    precon = pc as unknown as SolverResult;
  }

  const errorStage = (pc as { error_stage?: string }).error_stage;
  return {
    precon,
    postliming,
    encalado,
    last: postliming || precon,
    failed: Boolean(errorStage),
    error: errorStage || dr.error_msg || undefined,
    partial: parcial,
    pondsCompleted: dr.ponds_completed,
    pondsTotal: dr.ponds_total,
  };
}
