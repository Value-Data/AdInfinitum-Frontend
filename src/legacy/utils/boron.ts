/* ============================================================
   Boro (B) derivado de las especies con boro.
   mB = (PM_B/PM_H3BO3)·m_H3BO3 + (4·PM_B/PM_B4O7)·m_B4O7 + (PM_B/PM_BO2)·m_BO2
   La combinación es lineal en MASA, así que el mismo cálculo aplica tanto a
   %w/w (fracción de masa) como a masa/tonelaje.
   Pesos moleculares (g/mol): B=10.811, H3BO3=61.83302, B4O7--=155.2398, BO2-=42.8098.
   ============================================================ */
const PM_B = 10.811;
export const BORON_FACTORS = {
  'H3BO3': PM_B / 61.83302, // 1 átomo de B  ≈ 0.174842
  'B4O7--': (4 * PM_B) / 155.2398, // 4 átomos de B ≈ 0.278562
  'BO2-': PM_B / 42.8098, // 1 átomo de B  ≈ 0.252537
} as const;

/** Devuelve la masa/composición de Boro a partir de un dict {especie: valor}. */
export function boronFrom(comp: Record<string, number> | undefined | null): number {
  if (!comp) return 0;
  return (
    BORON_FACTORS['H3BO3'] * (comp['H3BO3'] ?? 0) +
    BORON_FACTORS['B4O7--'] * (comp['B4O7--'] ?? 0) +
    BORON_FACTORS['BO2-'] * (comp['BO2-'] ?? 0)
  );
}
