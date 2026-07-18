// Utilidad compartida para la tabla "Masa ingreso salmuera de pozo" (feed inicial).
// Se usa en la vista estática/dinámica, en los reportes PDF y en los Excel.

// Orden de especies para la tabla de salmuera de pozo (ingreso).
export const WELL_BRINE_SPECIES = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'H+', 'Cl-', 'HSO4-',
  'SO4--', 'OH-', 'CO2(aq)', 'HCO3-', 'CO3--', 'H3BO3', 'B4O7--', 'BO2-',
];

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
 * - `static`: el brine vive en `snapshot.brine` como `{especie: t/d}` directamente,
 *   por lo que el flujo total = suma de sus valores.
 *
 * Devuelve `null` si no hay datos suficientes (para no renderizar la tabla).
 */
export function resolveWellBrineFeed(
  snapshot: Record<string, unknown> | null | undefined,
  mode: 'dynamic' | 'static',
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
  } else {
    brine = snapshot.brine as Record<string, number> | undefined;
  }

  if (!brine) return null;
  const total = Object.values(brine).reduce((s, v) => s + (Number(v) || 0), 0);
  if (total <= 0) return null;

  // Estático (o sin flujo declarado): el brine ya está en t/d → el flujo es su suma.
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
): unknown[][] {
  const feed = resolveWellBrineFeed(snapshot, mode);
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
