// Salmuera de pozo del modelo dinámico expresada como composición (%w/w).
//
// El motor dinámico normaliza el brine a fracciones unitarias y descarta la escala
// absoluta (ver backend dynamic_runner: `unit = {k: v / total}`); el caudal real sale
// de `precon.average_flow_ton_day`. Por eso la entrada natural es un porcentaje, no
// un flujo: lo que se tipeaba en t/d nunca fue un caudal, solo una proporción.
//
// Criterio de edición: ENTRADA LIBRE. Lo que el usuario tipea se guarda tal cual y no
// se reescala nunca — un análisis de laboratorio puede cerrar en 99,98 y ese dato es
// legítimo. La suma se muestra como diagnóstico y hay un normalizador explícito. La
// masa en t/d se deriva normalizando por la suma real, que es exactamente lo que el
// motor hará al correr.

/** Decimales que se conservan al convertir configuraciones antiguas en t/d. */
const PCT_DECIMALS = 6;

/**
 * Suma máxima para considerar que un dict YA está en base porcentual.
 *
 * Tiene que ser ANCHA, no ceñida a 100: con entrada libre el usuario pasa por sumas
 * como 85 o 112 mientras carga la tabla, y una ventana estrecha las tomaría por t/d y
 * renormalizaría lo recién tipeado. Una salmuera guardada en t/d suma del orden del
 * flujo (miles), así que 200 separa ambos mundos con margen de sobra.
 *
 * Clasificar de más no rompe los números: las masas se derivan dividiendo por la suma
 * REAL, así que una salmuera diminuta en t/d mal clasificada igual muestra t/d
 * correctos — solo cambiaría la escala del % y dispararía el aviso.
 */
export const PCT_MAX_SUM = 200;

/**
 * Desvío máximo que se considera "cierra en 100" para el aviso al usuario. Es mucho
 * más estricto que PCT_MAX_SUM: ese decide cómo INTERPRETAR el dict, este decide
 * si hay que ALERTAR. Solo absorbe ruido de punto flotante.
 */
export const PCT_WARN_TOLERANCE = 0.01;

const round = (n: number): number => {
  const f = 10 ** PCT_DECIMALS;
  return Math.round(n * f) / f;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function sumValues(brine: Record<string, number>): number {
  return Object.values(brine).reduce((s, v) => s + num(v), 0);
}

/** ¿El dict ya está expresado como composición, y no como flujo en t/d? */
export function isPercentBasis(brine: Record<string, number>): boolean {
  const s = sumValues(brine);
  return s > 0 && s <= PCT_MAX_SUM;
}

/**
 * Reescala a base porcentual (suma exactamente 100). Es lo que ejecuta el botón
 * "Normalizar a 100" y también el motor al correr la simulación.
 */
export function normalizeToHundred(brine: Record<string, number>): Record<string, number> {
  const total = sumValues(brine);
  const out: Record<string, number> = {};
  if (total <= 0) {
    for (const k of Object.keys(brine)) out[k] = 0;
    return out;
  }
  for (const [k, v] of Object.entries(brine)) out[k] = round((num(v) / total) * 100);
  return out;
}

/**
 * Vista en %w/w para editar: preserva el dict si ya es una composición (fidelidad de
 * lo tipeado) y solo convierte cuando viene en t/d de una configuración anterior.
 */
export function asPercentBasis(brine: Record<string, number>): Record<string, number> {
  return isPercentBasis(brine) ? { ...brine } : normalizeToHundred(brine);
}

/** Fija el %w/w de una especie sin tocar las demás. */
export function setSpeciesPercent(
  brine: Record<string, number>,
  species: string,
  pct: number,
): Record<string, number> {
  const p = Math.min(100, Math.max(0, num(pct)));
  return { ...asPercentBasis(brine), [species]: p };
}

/**
 * Diagnóstico de cierre de la composición para avisar en la UI.
 *
 * `delta` es cuánto falta (negativo) o sobra (positivo) para llegar a 100 — se muestra
 * al usuario para que sepa qué corregir, no solo que algo está mal.
 */
export function compositionClosure(brine: Record<string, number>): {
  sum: number;
  delta: number;
  closes: boolean;
} {
  const sum = sumValues(asPercentBasis(brine));
  const delta = sum - 100;
  return { sum, delta, closes: Math.abs(delta) <= PCT_WARN_TOLERANCE };
}

export interface BrineCompositionRow {
  species: string;
  /** %w/w tal como lo tipeó el usuario. */
  pct: number;
  /** Masa derivada en t/d = pct / suma × flujo total (normalización del motor). */
  mass: number;
}

/**
 * Filas de la tabla de composición: el orden canónico primero, y al final cualquier
 * especie extra presente en el dict (para que el total mostrado cuadre con las filas).
 *
 * `totalPct` es la suma REAL (puede no ser 100); `totalMass` siempre da el flujo total
 * porque las masas se derivan normalizando.
 */
export function buildBrineCompositionRows(
  brine: Record<string, number>,
  order: readonly string[],
  totalFlow: number,
): { rows: BrineCompositionRow[]; totalPct: number; totalMass: number } {
  const base = asPercentBasis(brine);
  const flow = num(totalFlow);
  const sum = sumValues(base);

  const species = [
    ...order.filter((s) => s in base),
    ...Object.keys(base).filter((s) => !order.includes(s)),
  ];
  // Especies del orden canónico ausentes del dict: se muestran en cero, editables.
  for (const s of order) if (!species.includes(s)) species.push(s);

  const rows = species.map((sp) => {
    const pct = num(base[sp]);
    return { species: sp, pct, mass: sum > 0 ? (pct / sum) * flow : 0 };
  });
  return {
    rows,
    totalPct: sum,
    totalMass: rows.reduce((s, r) => s + r.mass, 0),
  };
}
