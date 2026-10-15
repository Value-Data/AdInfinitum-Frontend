/**
 * Datos y geometría de los gráficos, sin React: lo que se puede probar sin dibujar.
 * Los valores salen tal cual de lo que devuelve el backend; aquí solo se ordenan.
 */

/** Paleta categórica (mismo orden que `--chart-series-*` en tokens.css). Va en hex y no
 * como variable CSS porque el SVG exportado a PNG no resuelve variables. Validada con
 * el validador de dataviz (banda de luminosidad, croma, separación CVD). */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
  '#6250d6', '#e34948'];

/** Estilo de la serie i: las 8 primeras por color; desde la 9ª se repiten con trazo
 * cortado, para que nunca dos series se distingan solo por un color generado. */
export function seriesStyle(i: number): { stroke: string; strokeDasharray?: string } {
  const stroke = SERIES_COLORS[i % SERIES_COLORS.length];
  return i >= SERIES_COLORS.length ? { stroke, strokeDasharray: '6 3' } : { stroke };
}

// ---------------------------------------------------------------------------
// Eje X de las series diarias
// ---------------------------------------------------------------------------
export type DayStep = number | 'auto';
/** Las opciones de la versión anterior: una marca cada N días. */
export const DAY_STEPS: DayStep[] = ['auto', 10, 30, 60, 100, 200, 365];

const PX_PER_TICK = 46;
/** Píxeles mínimos por día: con menos, el cursor salta días y alguno queda inalcanzable. */
export const PX_PER_DAY = 3;

export interface ChartLayout {
  /** Prop `interval` del eje X de recharts. */
  interval: number | 'preserveStartEnd';
  angled: boolean;
  /** Alto del eje X (las etiquetas en ángulo necesitan más). */
  axisHeight: number;
  /** Ancho mínimo del gráfico en px; 0 = el ancho del panel (sin barra de desplazamiento). */
  minWidth: number;
}

/**
 * Geometría de un gráfico diario de `nDays` puntos (todos: no se ralea). Con un paso
 * elegido, una marca cada `step` días y el gráfico se ensancha para que quepan; además,
 * con muchos días el gráfico nunca baja de `PX_PER_DAY` por día, para que el cursor
 * alcance cada día. `fit` (impresión/PDF) lo deja al ancho de la página.
 */
export function chartLayout(nDays: number, step: DayStep, mode: 'day' | 'date', fit = false): ChartLayout {
  const paso = step === 'auto' ? null : Math.max(1, Math.round(step));
  const marcas = paso ? Math.floor(Math.max(0, nDays - 1) / paso) + 1 : 0;
  const angled = mode === 'date' || marcas > 10;
  if (fit) {
    return { interval: 'preserveStartEnd', angled: mode === 'date', axisHeight: mode === 'date' ? 62 : 30, minWidth: 0 };
  }
  const porMarcas = marcas > 16 ? Math.round(marcas * PX_PER_TICK) : 0;
  const porDias = nDays * PX_PER_DAY > 900 ? nDays * PX_PER_DAY : 0;
  return {
    interval: paso ? paso - 1 : 'preserveStartEnd',
    angled,
    axisHeight: angled ? 62 : 30,
    minWidth: Math.max(porMarcas, porDias),
  };
}
