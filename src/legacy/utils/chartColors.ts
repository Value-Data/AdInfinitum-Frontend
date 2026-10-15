/**
 * Paleta de series para los gráficos.
 *
 * Estaba copiada en cuatro archivos (los gráficos del dinámico, los del estático,
 * el reporte y el modo con inventario). Una sola definición mantiene el mismo color
 * para la misma poza entre vistas, que es lo que hace comparable un gráfico con
 * otro al lado.
 */
export const CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

/** Color de la serie n, ciclando la paleta. */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
