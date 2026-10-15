/**
 * Opciones de ECharts de cada gráfico, sin React: lo que se puede probar sin dibujar.
 * Los valores llegan tal cual del backend (vía chartData); aquí solo se arma la vista:
 * ejes con su unidad, tooltip con el formato de decimales de la app, zoom, leyenda y
 * caja de herramientas. `print`: sin zoom ni herramientas (el papel no las usa).
 */
import type {
  BarSeriesOption, EChartsOption, HeatmapSeriesOption, LineSeriesOption, SankeySeriesOption,
} from 'echarts';
import { formatCell } from './ReportView';
import { fmtNum } from '../utils/numberFormat';
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
  /** Color y trazo fijos (p. ej. una ejecución en la comparación); si no, los de `index`. */
  color?: string;
  lineType?: LineType;
}

export type LineType = 'solid' | 'dashed' | 'dotted';
/** Trazos de la comparación de ejecuciones: la actual continua, las otras distintas. */
export const COMPARE_LINE_TYPES: LineType[] = ['solid', 'dashed', 'dotted', 'dashed'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** El valor con el formato de decimales de la app (o `digits` decimales, que el selector
 * global de decimales igual puede cambiar) y su unidad. */
export function withUnit(v: unknown, unit: string, digits?: number): string {
  const n = typeof v === 'number' ? v : Array.isArray(v) ? v[v.length - 1] : null;
  const txt = digits === undefined ? formatCell(n) : (fmtNum(n, digits) || '–');
  return unit && txt !== '–' ? `${txt} ${unit}` : txt;
}

/** El nombre del eje, con su unidad (solo la unidad si el título del gráfico ya dice qué es). */
export function axisName(name: string, unit: string): string {
  return name && unit ? `${name} (${unit})` : name || unit;
}

interface AxisParam { marker?: string; seriesName?: string; value?: unknown; axisValue?: unknown; name?: string }

/** Tooltip de eje: el título (fecha, día o poza) y cada serie con su valor y unidad (una
 * para todas, o la de cada serie por su nombre en los gráficos de dos ejes). */
export function axisTooltip(title: (v: string) => string, unit: string | ((serie: string) => string), digits?: number) {
  return (params: unknown): string => {
    const ps = (Array.isArray(params) ? params : [params]) as AxisParam[];
    if (ps.length === 0) return '';
    const cabeza = esc(title(String(ps[0].axisValue ?? ps[0].name ?? '')));
    const filas = ps.map((p) => `${p.marker ?? ''}${esc(p.seriesName ?? '')}`
      + `<span style="float:right;margin-left:16px;font-weight:600">${esc(withUnit(p.value, typeof unit === 'string' ? unit : unit(p.seriesName ?? ''), digits))}</span>`);
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

function valueAxis(name: string, unit: string, scale: boolean, digits?: number) {
  return {
    type: 'value' as const,
    scale,
    name: axisName(name, unit),
    nameLocation: 'end' as const,
    nameTextStyle: { fontSize: FUENTE, color: TEXTO, align: 'left' as const },
    axisLabel: { fontSize: FUENTE, color: TEXTO,
      formatter: (v: number) => (digits === undefined ? formatCell(v) : fmtNum(v, digits)) },
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
      type: 'line', name: s.name, data: s.values, color: s.color ?? st.color,
      sampling: 'lttb', showSymbol: false, symbolSize: 5, connectNulls: true,
      lineStyle: { width: s.width ?? 1.5, type: s.lineType ?? (st.dashed ? 'dashed' : 'solid') },
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
  lineType?: LineType;
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
  /** Decimales fijos (p. ej. densidad en g/cm3, donde 2 no alcanzan). */
  digits?: number;
}): EChartsOption {
  const print = Boolean(o.print);
  const ley = o.legend === false ? { option: undefined, height: 0 } : legend(o.series.map((s) => s.name), print);
  const series = o.series.map((s, i): LineSeriesOption | BarSeriesOption => {
    const st = seriesStyle(i);
    const color = s.color ?? st.color;
    return o.kind === 'bars'
      ? { type: 'bar', name: s.name, data: s.values, color, barMaxWidth: 48, itemStyle: { borderRadius: [4, 4, 0, 0] } }
      : { type: 'line', name: s.name, data: s.values, color, symbol: 'circle', symbolSize: 7, connectNulls: true,
          smooth: true, smoothMonotone: 'x', lineStyle: { width: 2, type: s.lineType ?? (st.dashed && !s.color ? 'dashed' : 'solid') } };
  });
  return {
    animation: false,
    legend: ley.option,
    toolbox: toolbox(o, false),
    tooltip: { trigger: 'axis', confine: true, formatter: axisTooltip((v) => v, o.unit, o.digits) },
    grid: grid(ley.height + 26, 8),
    xAxis: {
      type: 'category', data: o.categories, boundaryGap: o.kind === 'bars',
      axisLabel: { fontSize: FUENTE, color: TEXTO, interval: 0, hideOverlap: false },
    },
    yAxis: valueAxis(o.yName, o.unit, Boolean(o.scale), o.digits),
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
    // Un margen alrededor de los puntos, para que el nombre de la poza no pise los ejes.
    xAxis: {
      ...valueAxis(o.xName, o.xUnit, true), boundaryGap: ['4%', '4%'],
      nameLocation: 'middle', nameGap: 26, nameTextStyle: { fontSize: FUENTE, color: TEXTO },
      splitLine: { lineStyle: { color: GRID, type: 'dashed' } },
    },
    yAxis: { ...valueAxis(o.yName, o.yUnit, true), boundaryGap: ['8%', '12%'] },
    series: [{
      type: 'line', name: o.seriesName, color: o.color, symbol: 'circle', symbolSize: 8,
      lineStyle: { width: 1.5 },
      data: o.points.map((p) => ({ value: [p.x, p.y], name: p.id })),
      label: { show: true, position: 'top', formatter: '{b}', fontSize: 9, color: TEXTO },
    }],
  };
}

// ---------------------------------------------------------------------------
// Litio: de la salmuera de pozo al producto (Sankey)
// ---------------------------------------------------------------------------
const GRIS_PERDIDA = '#b8b6ae';
const VERDE_PRODUCTO = '#1baf7a';
const AZUL = '#2a78d6';

/** Un tramo del Sankey: el Li que entra y sale de una etapa, ya con sus nombres. */
export interface LiStageInput { name: string; li_in: number | null; li_out: number | null; lossName: string }

/**
 * Li por etapa, en cadena: entrada → etapa → (siguiente etapa | producto), y de cada etapa
 * lo que no sale con la salmuera ("no recuperado" = entra − sale: el reporte no separa
 * aún sal precipitada, arrastre e infiltración). Los montos salen de los KPIs de cada
 * etapa; un tramo sin dato (o en cero) no se dibuja. Tooltip con el % del Li que entra a
 * la primera etapa.
 */
export function liSankeyOption(o: Base & {
  stages: LiStageInput[];
  sourceName: string;
  productName: string;
  unit: string;
  /** "del Li que entra" (i18n). */
  pctLabel: string;
}): EChartsOption {
  const links: { source: string; target: string; value: number; loss: boolean }[] = [];
  const nodos = new Set<string>();
  const enlazar = (source: string, target: string, value: number | null, loss = false) => {
    if (value === null || !(value > 0)) return;
    links.push({ source, target, value, loss });
    nodos.add(source).add(target);
  };
  o.stages.forEach((st, i) => {
    if (i === 0) enlazar(o.sourceName, st.name, st.li_in);
    const sig = o.stages[i + 1];
    enlazar(st.name, sig ? sig.name : o.productName, st.li_out);
    if (st.li_in !== null && st.li_out !== null) enlazar(st.name, st.lossName, st.li_in - st.li_out, true);
  });
  const base = o.stages[0]?.li_in ?? null;
  const pct = (v: number) => (base && base > 0 ? ` · ${formatCell(v / base * 100)} % ${o.pctLabel}` : '');
  const perdidas = new Set(o.stages.map((s) => s.lossName));
  const serie: SankeySeriesOption = {
    // Alineado a la izquierda: lo no recuperado de cada etapa queda junto a la etapa
    // siguiente, no amontonado a la derecha.
    type: 'sankey', left: 8, right: 150, top: 16, bottom: 16, nodeGap: 14, nodeWidth: 14, nodeAlign: 'left',
    layoutIterations: 0, draggable: !o.print, emphasis: { focus: 'adjacency' },
    label: {
      fontSize: 11, color: TEXTO, width: 140, overflow: 'break',
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number };
        return `${d.name}\n${withUnit(d.value, o.unit)}`;
      },
    },
    lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
    data: [...nodos].map((n) => ({
      name: n,
      itemStyle: { color: perdidas.has(n) ? GRIS_PERDIDA : n === o.productName ? VERDE_PRODUCTO : AZUL },
    })),
    links: links.map((l) => ({
      source: l.source, target: l.target, value: l.value,
      ...(l.loss ? { lineStyle: { color: GRIS_PERDIDA, opacity: 0.5 } } : {}),
    })),
  };
  return {
    animation: false,
    toolbox: toolbox(o, false),
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (p: unknown) => {
        const d = p as { dataType?: string; name: string; value: number; data: { source?: string; target?: string } };
        const titulo = d.dataType === 'edge' ? `${d.data.source} → ${d.data.target}` : d.name;
        return `<b>${esc(titulo)}</b><br/>${esc(withUnit(d.value, o.unit))}${esc(pct(d.value))}`;
      },
    },
    series: [serie],
  };
}

// ---------------------------------------------------------------------------
// Mapa de calor poza × día
// ---------------------------------------------------------------------------
/** Paleta secuencial (de claro a oscuro, un solo tono) del mapa de calor. */
export const HEAT_COLORS = ['#eaf2fb', '#a9cbef', '#5b9be0', '#2a78d6', '#164c8f'];

/**
 * Una celda por poza y día con el valor del backend; los días sin dato quedan vacíos. La
 * escala de colores va del mínimo al máximo de lo dibujado, con su unidad. La poza de
 * producto va marcada en el eje. Sin dibujo progresivo: se dibuja entero de una vez (la
 * impresión y el PDF no esperan cuadros de animación).
 */
export function pondHeatmapOption(o: Base & {
  categories: string[];
  ponds: string[];
  values: (number | null | undefined)[][];
  unit: string;
  productPond: string | null;
  axisLabel: (v: string) => string;
  tooltipTitle: (v: string) => string;
  interval: number | 'auto';
}): EChartsOption {
  const print = Boolean(o.print);
  const data: [number, number, number][] = [];
  let min = Infinity;
  let max = -Infinity;
  o.values.forEach((serie, y) => serie.forEach((v, x) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    data.push([x, y, v]);
    if (v < min) min = v;
    if (v > max) max = v;
  }));
  if (data.length === 0) { min = 0; max = 1; } else if (min === max) { max = min + 1; }
  const serie: HeatmapSeriesOption = {
    type: 'heatmap', data, progressive: 0,
    emphasis: { itemStyle: { borderColor: '#1f2937', borderWidth: 1 } },
  };
  return {
    animation: false,
    toolbox: toolbox(o, true),
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (p: unknown) => {
        const [x, y, v] = (p as { value: [number, number, number] }).value;
        return `<b>${esc(o.tooltipTitle(String(o.categories[x])))}</b><br/>${esc(o.ponds[y])}: `
          + `<b>${esc(withUnit(v, o.unit))}</b>`;
      },
    },
    grid: { left: 8, right: 20, top: 26, bottom: print ? 46 : 78, containLabel: true },
    xAxis: {
      type: 'category', data: o.categories,
      axisLabel: {
        fontSize: FUENTE, color: TEXTO, interval: o.interval, rotate: 35, hideOverlap: o.interval === 'auto',
        formatter: (v: string) => o.axisLabel(v),
      },
    },
    yAxis: {
      type: 'category', data: o.ponds, inverse: true,
      axisLabel: {
        fontSize: FUENTE, color: TEXTO,
        formatter: (v: string) => (v === o.productPond ? `{p|${v} ★}` : v),
        rich: { p: { fontWeight: 'bold', color: AZUL, fontSize: FUENTE + 1 } },
      },
    },
    visualMap: {
      type: 'continuous', min, max, calculable: !print, orient: 'horizontal', left: 'center',
      bottom: print ? 0 : 30, itemHeight: 220, itemWidth: 10,
      formatter: (v: unknown) => withUnit(v, o.unit), textStyle: { fontSize: FUENTE, color: TEXTO },
      inRange: { color: HEAT_COLORS },
    },
    dataZoom: print ? undefined : [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 16, bottom: 4,
        labelFormatter: (_i: number, v: string) => o.axisLabel(v) },
    ],
    series: [serie],
  };
}

// ---------------------------------------------------------------------------
// Dos magnitudes por poza en un gráfico, cada una con su eje Y (como la versión anterior)
// ---------------------------------------------------------------------------
export interface AxisSeriesInput { name: string; unit: string; values: (number | null)[]; color: string; width?: number }

/**
 * Líneas por poza con dos ejes Y: `left` en el eje izquierdo y `right` en el derecho,
 * cada eje nombrado con su serie y unidad, y la leyenda con las dos. Es la forma de los
 * gráficos "Li+ vs especie" y "Flujo y actividad de agua" del reporte de antes.
 */
export function dualAxisOption(o: Base & {
  categories: string[];
  left: AxisSeriesInput;
  right: AxisSeriesInput;
}): EChartsOption {
  const linea = (s: AxisSeriesInput, eje: number, simbolo: number): LineSeriesOption => ({
    type: 'line', name: s.name, data: s.values, yAxisIndex: eje, color: s.color, symbol: 'circle',
    symbolSize: simbolo, connectNulls: true, smooth: true, smoothMonotone: 'x', lineStyle: { width: s.width ?? 2 },
  });
  const eje = (s: AxisSeriesInput, lado: 'left' | 'right') => ({
    ...valueAxis(s.name, s.unit, true), position: lado,
    nameTextStyle: { fontSize: FUENTE, color: s.color, align: lado },
    ...(lado === 'right' ? { splitLine: { show: false } } : {}),
  });
  const unidades = new Map([[o.left.name, o.left.unit], [o.right.name, o.right.unit]]);
  return {
    animation: false,
    legend: { top: 0, left: 0, right: o.print ? 0 : 96, itemWidth: 18, itemHeight: 8,
      textStyle: { fontSize: 11, color: TEXTO }, data: [o.left.name, o.right.name] },
    toolbox: toolbox(o, false),
    tooltip: { trigger: 'axis', confine: true, formatter: axisTooltip((v) => v, (n) => unidades.get(n) ?? '') },
    grid: grid(46, 8),
    xAxis: {
      type: 'category', data: o.categories, boundaryGap: false,
      axisLabel: { fontSize: FUENTE, color: TEXTO, interval: 0, hideOverlap: false },
    },
    yAxis: [eje(o.left, 'left'), eje(o.right, 'right')],
    series: [linea(o.left, 0, 8), linea(o.right, 1, 6)],
  };
}
