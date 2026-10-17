// Utilidad compartida para la tabla "Masa ingreso salmuera de pozo" (feed inicial).
// Se usa en la vista estática/dinámica, en los reportes PDF y en los Excel.

import { CANONICAL_SPECIES_ORDER } from './species';

// Orden de especies para la tabla de salmuera de pozo (ingreso). Las que agregue el
// motor (066) se anexan más abajo, al armar las filas contra la salmuera real.
export const WELL_BRINE_SPECIES = CANONICAL_SPECIES_ORDER;

export interface WellBrineFeedRow {
  species: string;
  /** %w/w de la especie en el feed. */
  pct: number;
  /** Masa de la especie en t/d (fracción × flujo de ingreso). */
  mass: number;
}

export interface WellBrineFeed {
  /** Flujo total de ingreso de salmuera (t/d). */
  flow: number;
  rows: WellBrineFeedRow[];
}

/**
 * Resuelve la composición del feed inicial desde el snapshot de una ejecución.
 *
 * - `dynamic`: el brine vive en `snapshot.dynamic_config.brine` (composición) y el
 *   flujo en `precon.average_flow_ton_day` (o `simulation.average_flow_ton_day`).
 * - `static`: `snapshot.brine` es composición en %w/w y el flujo está en
 *   `snapshot.brine_total_flow`. En snapshots anteriores a la migración 008 el brine
 *   venía en t/d y sin caudal declarado; ahí el flujo sigue siendo la suma.
 *
 * `flowOverride` permite mostrar el ingreso de un día concreto cuando el cronograma
 * define caudal por día: la composición es la misma, cambia la escala.
 *
 * Devuelve `null` si no hay datos suficientes (para no renderizar la tabla).
 */
export function resolveWellBrineFeed(
  snapshot: Record<string, unknown> | null | undefined,
  mode: 'dynamic' | 'static',
  flowOverride?: number | null,
): WellBrineFeed | null {
  if (!snapshot) return null;

  let brine: Record<string, number> | undefined;
  let flow: number | undefined;

  if (mode === 'dynamic') {
    const dc = (snapshot.dynamic_config as Record<string, unknown> | undefined) ?? snapshot;
    brine = dc?.brine as Record<string, number> | undefined;
    flow =
      ((dc?.precon as Record<string, unknown> | undefined)?.average_flow_ton_day as number) ??
      ((dc?.simulation as Record<string, unknown> | undefined)?.average_flow_ton_day as number);
    // Modo con inventario: misma tabla, otro lugar en el snapshot. Su salmuera de pozo
    // ya está en %w/w (`composicion_pp`) y el caudal es `flowrate_tpd`.
    if (!brine) {
      const ic = snapshot.inventario_config as Record<string, unknown> | undefined;
      const feed = ic?.feed as Record<string, unknown> | undefined;
      brine = feed?.composicion_pp as Record<string, number> | undefined;
      flow = feed?.flowrate_tpd as number | undefined;
    }
  } else {
    brine = snapshot.brine as Record<string, number> | undefined;
    // Sin esto el flujo salía como la suma de la composición, o sea 100 t/d fijos.
    const declarado = snapshot.brine_total_flow as number | undefined;
    if (typeof declarado === 'number' && Number.isFinite(declarado) && declarado > 0) {
      flow = declarado;
    }
  }

  if (flowOverride != null && Number.isFinite(flowOverride) && flowOverride > 0) {
    flow = flowOverride;
  }

  if (!brine) return null;
  const total = Object.values(brine).reduce((s, v) => s + (Number(v) || 0), 0);
  if (total <= 0) return null;

  // Sin flujo declarado: es un snapshot antiguo con el brine en t/d, y su suma ES el
  // caudal. Se mantiene para que las ejecuciones viejas sigan mostrando su ingreso.
  if (flow == null || !Number.isFinite(flow) || flow <= 0) flow = total;

  const species = [
    ...WELL_BRINE_SPECIES.filter((s) => s in brine!),
    ...Object.keys(brine).filter((s) => !WELL_BRINE_SPECIES.includes(s)),
  ];

  const rows: WellBrineFeedRow[] = species.map((sp) => {
    const frac = (Number(brine![sp]) || 0) / total;
    return { species: sp, pct: frac * 100, mass: frac * (flow as number) };
  });

  return { flow, rows };
}

/**
 * AOA (matriz de celdas) para una hoja de Excel con la masa de ingreso de salmuera.
 * Números crudos (sin formato de coma) igual que el resto de hojas del libro.
 * Devuelve una AOA con una nota si no hay datos.
 */
export function buildWellBrineFeedAoa(
  snapshot: Record<string, unknown> | null | undefined,
  mode: 'dynamic' | 'static',
  flowOverride?: number | null,
): unknown[][] {
  const feed = resolveWellBrineFeed(snapshot, mode, flowOverride);
  if (!feed) return [['(sin datos de ingreso de salmuera)']];
  const aoa: unknown[][] = [
    ['Masa ingreso salmuera de pozo'],
    ['Flujo total (t/d)', feed.flow],
    [],
    ['Especie', '%w/w', 't/d'],
  ];
  for (const r of feed.rows) aoa.push([r.species, r.pct, r.mass]);
  aoa.push(['Total', 100, feed.flow]);
  return aoa;
}
