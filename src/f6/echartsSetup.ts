/**
 * ECharts con solo lo que usan los gráficos (tree-shaking): líneas, barras, Sankey, mapa
 * de calor y medidores (la dispersión es una línea sobre un eje de valores), con ejes,
 * tooltip, leyenda, zoom, escala de colores y caja de herramientas. Lienzo en pantalla y
 * SVG para imprimir (vectorial, nítido en papel).
 */
import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, HeatmapChart, LineChart, SankeyChart } from 'echarts/charts';
import {
  DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent,
  VisualMapContinuousComponent,
} from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart, SankeyChart, HeatmapChart, GaugeChart,
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, ToolboxComponent,
  VisualMapContinuousComponent,
  CanvasRenderer, SVGRenderer,
]);

export { echarts };
export type EChartsInstance = echarts.ECharts;
