/**
 * ECharts con solo lo que usan los gráficos (tree-shaking): líneas y barras (la
 * dispersión es una línea sobre un eje de valores), con ejes, tooltip, leyenda, zoom y
 * caja de herramientas. Lienzo en pantalla y SVG para imprimir (vectorial, nítido en
 * papel).
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart,
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, ToolboxComponent,
  CanvasRenderer, SVGRenderer,
]);

export { echarts };
export type EChartsInstance = echarts.ECharts;
