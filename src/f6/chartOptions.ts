/**
 * Opciones de ECharts de cada gráfico, sin React: lo que se puede probar sin dibujar.
 * Los valores llegan tal cual del backend (vía chartData); aquí solo se arma la vista:
 * ejes con su unidad, tooltip con el formato de decimales de la app, zoom, leyenda y
 * caja de herramientas. `print`: sin zoom ni herramientas (el papel no las usa).
 */
import type { EChartsOption, LineSeriesOption, BarSeriesOption } from 'echarts';
import { formatCell } from './ReportView';
import { seriesStyle } from './chartData';

export const GRID = '#e1e0d9';
const TEXTO = '#52514e';
const FUENTE = 10;
/** Desde cuántas series la leyenda pasa a desplazable (en pantalla). */
export const LEGEND_SCROLL_FROM = 9;

/** Textos de la caja de herramientas (vienen del i18n). */
export interface ToolLabels {
  savePng: string;
  zoom: string;
  zoomBack: string;
  restore: string;
}

interface Base {
  print?: boolean;
  tools?: ToolLabels;
  /** Nombre del PNG que baja la caja de herramientas. */
  fileName?: string;
}

/** Una serie de líneas: `index` fija color y trazo (desde la 9ª, cortado). */
export interface LineInput {
  name: string;
  values: (number | null)[];
  index: number;
  width?: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function withUnit(v: unknown, unit: string): string {
  const n = typeof v === 'number' ? v : Array.isArray(v) ? v[v.length - 1] : null;
  const txt = formatCell(n);
  return unit && txt !== '–' ? `${txt} ${unit}` : txt;
}

/** El nombre del eje, con su unidad (solo la unidad si el título del gráfico ya dice qué es). */
export function axisName(name: string, unit: string): string {
  return name && unit ? `${name} (${unit})` : name || unit;
}

interface AxisParam { marker?: string; seriesName?: string; value?: unknown; axisValue?: unknown; name?: string }

/** Tooltip de eje: el título (fecha, día o poza) y cada serie con su valor y unidad. */
export function axisTooltip(title: (v: string) => string, unit: string) {
  return (params: unknown): string => {
    const ps = (Array.isArray(params) ? params : [params]) as AxisParam[];
    if (ps.length === 0) return '';
    const cabeza = esc(title(String(ps[0].axisValue ?? ps[0].name ?? '')));
    const filas = ps.map((p) => `${p.marker ?? ''}${esc(p.seriesName ?? '')}`
      + `<span style="float:right;margin-left:16px;font-weight:600">${esc(withUnit(p.value, unit))}</span>`);
    return [`<b>${cabeza}</b>`, ...filas].join('<br/>');
  };
}

/**
 * Filas que ocupa una leyenda plana de estos nombres en `ancho` px (aprox.: ECharts no
 * corre la grilla por la leyenda, así que se le deja el lugar).
 */
export function legendRows(names: string[], ancho: number): number {
  if (names.length === 0) return 0;
  let filas = 1;
  let x = 0;
  for (const n of names) {
    const w = 28 + n.length * 6.5;
    if (x > 0 && x + w > ancho) { filas += 1; x = 0; }
    x += w;
  }
  return filas;
}

function legend(names: string[], print: boolean): { option: EChartsOption['legend']; height: number } {
  if (names.length < 2) return { option: undefined, height: 0 };
  const scroll = !print && names.length >= LEGEND_SCROLL_FROM;
  const filas = scroll ? 1 : legendRows(names, print ? 480 : 340);
  return {
    option: {
      type: scroll ? 'scroll' : 'plain', top: 0, left: 0, right: print ? 0 : 96,
      itemWidth: 18, itemHeight: 8, textStyle: { fontSize: 11, color: TEXTO }, data: names,
    },
    height: filas * 20,
  };
}

function toolbox(o: Base, zoom: boolean): EChartsOption['toolbox'] {
  if (o.print) return undefined;
  const tx = o.tools;
  return {
    right: 4, top: 0, itemSize: 13,
    feature: {
      ...(zoom ? { dataZoom: { yAxisIndex: 'none', title: { zoom: tx?.zoom, back: tx?.zoomBack } } } : {}),
      restore: { title: tx?.restore },
      saveAsImage: { type: 'png', pixelRatio: 2, backgroundColor: '#ffffff', title: tx?.savePng, name: o.fileName },
    },
  };
}

function valueAxis(name: string, unit: string, scale: boolean) {
  return {
    type: 'value' as const,
    scale,
    name: axisName(name, unit),
    nameLocation: 'end' as const,
    nameTextStyle: { fontSize: FUENTE, color: TEXTO, align: 'left' as const },
    axisLabel: { fontSize: FUENTE, color: TEXTO, formatter: (v: number) => formatCell(v) },
    splitLine: { lineStyle: { color: GRID, type: 'dashed' as const } },
  };
}

function grid(top: number, bottom: number) {
  return { left: 8, right: 20, top, bottom, containLabel: true };
}

/**
 * Serie diaria: una línea por serie (poza, especie, sal), todos los días (sin ralear: el
 * `lttb` solo afina el dibujo cuando hay más días que píxeles; el tooltip ve cada día).
 * Zoom con la rueda y con la barra de abajo; `interval` es el paso de marcas del eje.
 */
export function dailyLineOption(o: Base & {
  categories: (string | number)[];
  series: LineInput[];
  yName: string;
  unit: string;
  axisLabel: (v: string) => string;
  tooltipTitle: (v: string) => string;
  interval: number | 'auto';
  angled: boolean;
}): EChartsOption {
  const print = Boolean(o.print);
  const ley = legend(o.series.map((s) => s.name), print);
  const series: LineSeriesOption[] = o.series.map((s) => {
    const st = seriesStyle(s.index);
    return {
      type: 'line', name: s.name, data: s.values, color: st.color,
      sampling: 'lttb', showSymbol: false, symbolSize: 5, connectNulls: true,
      lineStyle: { width: s.width ?? 1.5, type: st.dashed ? 'dashed' : 'solid' },
    };
  });
  return {
    animation: false,
    legend: ley.option,
    toolbox: toolbox(o, true),
    tooltip: { trigger: 'axis', confine: true, formatter: axisTooltip(o.tooltipTitle, o.unit) },
    grid: grid(ley.height + 26, print ? 8 : 40),
    xAxis: {
      type: 'category', data: o.categories.map(String), boundaryGap: false,
      axisLabel: {
        fontSize: FUENTE, color: TEXTO, interval: o.interval, rotate: o.angled ? 35 : 0,
        hideOverlap: o.interval === 'auto', formatter: (v: string) => o.axisLabel(v),
      },
    },
    yAxis: valueAxis(o.yName, o.unit, true),
    dataZoom: print ? undefined : [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 6,
        labelFormatter: (_i: number, v: string) => o.axisLabel(v) },
    ],
    series,
  };
}

/** Una serie por columna, por categoría (poza o escenario): barras o líneas. */
export interface CategoryInput {
  name: string;
  values: (number | null)[];
  /** Color fijo (si no, el de su posición). */
  color?: string;
}

/**
 * Barras o líneas por poza o por escenario. `scale`: el eje Y se ajusta a los datos (no
 * arranca en cero), como en los gráficos de una sola magnitud por poza.
 */
export function categoryOption(o: Base & {
  categories: string[];
  series: CategoryInput[];
  kind: 'bars' | 'lines';
  yName: string;
  unit: string;
  scale?: boolean;
  /** Sin leyenda (una sola serie, nombrada en el eje). */
  legend?: boolean;
}): EChartsOption {
  const print = Boolean(o.print);
  const ley = o.legend === false ? { option: undefined, height: 0 } : legend(o.series.map((s) => s.name), print);
  const series = o.series.map((s, i): LineSeriesOption | BarSeriesOption => {
    const st = seriesStyle(i);
    const color = s.color ?? st.color;
    return o.kind === 'bars'
      ? { type: 'bar', name: s.name, data: s.values, color, barMaxWidth: 48, itemStyle: { borderRadius: [4, 4, 0, 0] } }
      : { type: 'line', name: s.name, data: s.values, color, symbol: 'circle', symbolSize: 7, connectNulls: true,
          smooth: true, smoothMonotone: 'x', lineStyle: { width: 2, type: st.dashed && !s.color ? 'dashed' : 'solid' } };
  });
  return {
    animation: false,
    legend: ley.option,
    toolbox: toolbox(o, false),
    tooltip: { trigger: 'axis', confine: true, formatter: axisTooltip((v) => v, o.unit) },
    grid: grid(ley.height + 26, 8),
    xAxis: {
      type: 'category', data: o.categories, boundaryGap: o.kind === 'bars',
      axisLabel: { fontSize: FUENTE, color: TEXTO, interval: 0, hideOverlap: false },
    },
    yAxis: valueAxis(o.yName, o.unit, Boolean(o.scale)),
    series,
  };
}

/**
 * Li+ contra densidad, un punto por poza con su nombre, unidos en el orden de la
 * cascada (una línea sobre un eje X de valores).
 */
export function pondScatterOption(o: Base & {
  points: { id: string; x: number; y: number }[];
  xName: string; xUnit: string;
  yName: string; yUnit: string;
  seriesName: string;
  color: string;
}): EChartsOption {
  return {
    animation: false,
    toolbox: toolbox(o, false),
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (p: unknown) => {
        const d = p as { name: string; value: [number, number] };
        return `<b>${esc(d.name)}</b><br/>${esc(o.xName)}: ${esc(withUnit(d.value[0], o.xUnit))}`
          + `<br/>${esc(o.yName)}: ${esc(withUnit(d.value[1], o.yUnit))}`;
      },
    },
    grid: grid(32, 28),
    xAxis: {
      ...valueAxis(o.xName, o.xUnit, true),
      nameLocation: 'middle', nameGap: 26, nameTextStyle: { fontSize: FUENTE, color: TEXTO },
      splitLine: { lineStyle: { color: GRID, type: 'dashed' } },
    },
    yAxis: valueAxis(o.yName, o.yUnit, true),
    series: [{
      type: 'line', name: o.seriesName, color: o.color, symbol: 'circle', symbolSize: 8,
      lineStyle: { width: 1.5 },
      data: o.points.map((p) => ({ value: [p.x, p.y], name: p.id })),
      label: { show: true, position: 'top', formatter: '{b}', fontSize: 9, color: TEXTO },
    }],
  };
}
