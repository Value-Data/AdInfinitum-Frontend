/**
 * Especies acuosas a mostrar en las vistas de resultados.
 *
 * El catálogo depende de la versión de AQSOL que corrió: la 027 devuelve 17 especies
 * y la 066 devuelve 23 (agrega Ba++, Sr++, NH3(aq), NH4+, NH2COO-, NO3-). Cuando cada
 * tabla llevaba su propia lista fija de 17, las especies nuevas no aparecían nunca
 * aunque el motor las estuviera calculando.
 *
 * La regla: orden canónico primero y después lo que el resultado haya traído de más.
 */

/** Orden canónico — las 17 especies de la base 027. */
export const CANONICAL_SPECIES_ORDER = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'H+',
  'Cl-', 'HSO4-', 'SO4--', 'OH-',
  'CO2(aq)', 'HCO3-', 'CO3--',
  'H3BO3', 'B4O7--', 'BO2-',
];

type SpeciesDict = Record<string, number> | undefined | null;

/**
 * Las especies de `base` siempre, más las que aparezcan en `sources` y no estén ahí.
 *
 * Para tablas de estructura fija (Excel, matriz de detalle por poza, snapshot de
 * parámetros), donde una fila en cero es preferible a que la fila desaparezca según
 * la corrida. `base` por defecto son las 17 canónicas; quien conozca el catálogo real
 * de la corrida (p. ej. el de la versión de AQSOL que se usó) puede pasarlo.
 */
export function speciesWithExtras(
  sources: SpeciesDict[],
  base: string[] = CANONICAL_SPECIES_ORDER,
): string[] {
  const orden = base.length ? base : CANONICAL_SPECIES_ORDER;
  const extra = new Set<string>();
  for (const s of sources) {
    if (s) {
      for (const k of Object.keys(s)) {
        if (!orden.includes(k)) extra.add(k);
      }
    }
  }
  return [...orden, ...Array.from(extra).sort()];
}
