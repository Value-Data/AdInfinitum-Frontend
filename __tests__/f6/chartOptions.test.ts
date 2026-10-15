// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  LEGEND_SCROLL_FROM, axisName, axisTooltip, categoryOption, dailyLineOption, legendRows, pondScatterOption,
} from '../../src/f6/chartOptions';
import { SERIES_COLORS } from '../../src/f6/chartData';
import { setDecimalsOverride } from '../../src/utils/numberFormat';
import { echarts } from '../../src/f6/echartsSetup';

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const tools = { savePng: 'PNG', zoom: 'Zoom', zoomBack: 'Atrás', restore: 'Restablecer' };
const dias = Array.from({ length: 1460 }, (_x, i) => `2024-01-${String((i % 28) + 1).padStart(2, '0')}`);
const diaria = (n: number, extra: Partial<Parameters<typeof dailyLineOption>[0]> = {}) => dailyLineOption({
  categories: dias, unit: 't/d', yName: '', axisLabel: (v) => v, tooltipTitle: (v) => `Día ${v}`,
  interval: 'auto', angled: true, tools, fileName: 'flujos',
  series: Array.from({ length: n }, (_x, i) => ({ name: `P${i + 1}`, values: dias.map(() => i), index: i })),
  ...extra,
}) as Any;

afterEach(() => setDecimalsOverride(null));

describe('serie diaria (ECharts)', () => {
  it('una línea por serie, todos los días, con lttb y nulos unidos', () => {
    const o = diaria(3);
    expect(o.series).toHaveLength(3);
    expect(o.xAxis.data).toHaveLength(1460);
    for (const s of o.series) {
      expect(s.type).toBe('line');
      expect(s.sampling).toBe('lttb');
      expect(s.connectNulls).toBe(true);
      expect(s.data).toHaveLength(1460);
    }
    expect(o.animation).toBe(false);
  });

  it('zoom con la rueda y con la barra, y caja de herramientas (PNG, zoom, restablecer)', () => {
    const o = diaria(2);
    expect(o.dataZoom.map((d: Any) => d.type)).toEqual(['inside', 'slider']);
    expect(o.dataZoom.every((d: Any) => d.xAxisIndex === 0)).toBe(true);
    expect(Object.keys(o.toolbox.feature).sort()).toEqual(['dataZoom', 'restore', 'saveAsImage']);
    expect(o.toolbox.feature.saveAsImage).toMatchObject({ type: 'png', pixelRatio: 2, name: 'flujos', title: 'PNG' });
  });

  it('para imprimir: sin zoom ni herramientas', () => {
    const o = diaria(2, { print: true });
    expect(o.dataZoom).toBeUndefined();
    expect(o.toolbox).toBeUndefined();
  });

  it('el eje Y lleva la unidad y el formato de decimales de la app', () => {
    const o = diaria(1);
    expect(o.yAxis.name).toBe('t/d');
    expect(o.yAxis.axisLabel.formatter(1234.5)).toBe('1.234,50');
    setDecimalsOverride(0);
    expect(o.yAxis.axisLabel.formatter(1234.5)).toBe('1.235');
  });

  it('el paso de días va al intervalo de marcas del eje (no ralea los datos)', () => {
    const o = diaria(1, { interval: 9 });
    expect(o.xAxis.axisLabel.interval).toBe(9);
    expect(o.series[0].data).toHaveLength(1460);
  });

  it('leyenda desplazable con muchas series; color y trazo cortado desde la 9ª', () => {
    expect(diaria(LEGEND_SCROLL_FROM - 1).legend.type).toBe('plain');
    const o = diaria(LEGEND_SCROLL_FROM + 3);
    expect(o.legend.type).toBe('scroll');
    expect(o.series[0].color).toBe(SERIES_COLORS[0]);
    expect(o.series[8].color).toBe(SERIES_COLORS[0]);
    expect(o.series[8].lineStyle.type).toBe('dashed');
    expect(o.series[0].lineStyle.type).toBe('solid');
    // Al imprimir no se esconde ninguna: leyenda plana y la grilla baja lo que ocupe.
    const p = diaria(LEGEND_SCROLL_FROM + 3, { print: true });
    expect(p.legend.type).toBe('plain');
    expect(p.grid.top).toBeGreaterThan(o.grid.top);
  });

  it('una sola serie no lleva leyenda; la poza de producto, más gruesa', () => {
    expect(diaria(1).legend).toBeUndefined();
    const o = dailyLineOption({ categories: ['a'], unit: '', yName: '', axisLabel: (v) => v, tooltipTitle: (v) => v,
      interval: 'auto', angled: false, series: [{ name: 'P1', values: [1], index: 0, width: 2.5 }] }) as Any;
    expect(o.series[0].lineStyle.width).toBe(2.5);
  });
});

describe('tooltip', () => {
  it('título del eje y cada serie con valor, unidad y decimales de la app', () => {
    const f = axisTooltip((v) => `Día ${v}`, 't/d');
    const html = f([{ marker: '●', seriesName: 'P<1>', value: 1234.5, axisValue: '31' },
      { marker: '●', seriesName: 'P2', value: null, axisValue: '31' }]);
    expect(html).toContain('<b>Día 31</b>');
    expect(html).toContain('1.234,50 t/d');
    expect(html).toContain('P&#60;1&#62;'); // los nombres de pozas no se inyectan como HTML
    expect(html).toContain('–'); // sin dato, sin unidad
  });
});

describe('por poza y por escenario', () => {
  const base = { categories: ['P1', 'P2'], yName: '', unit: 't/d',
    series: [{ name: 'Entra', values: [1, 2] }, { name: 'Sale', values: [null, 3] }] };

  it('barras desde cero o líneas con puntos', () => {
    const b = categoryOption({ ...base, kind: 'bars', tools }) as Any;
    expect(b.series.map((s: Any) => s.type)).toEqual(['bar', 'bar']);
    expect(b.yAxis.scale).toBe(false);
    expect(b.toolbox.feature.dataZoom).toBeUndefined();
    const l = categoryOption({ ...base, kind: 'lines', scale: true }) as Any;
    expect(l.series.map((s: Any) => s.type)).toEqual(['line', 'line']);
    expect(l.series[1].connectNulls).toBe(true);
    expect(l.yAxis.scale).toBe(true);
    expect(l.xAxis.data).toEqual(['P1', 'P2']);
  });

  it('una magnitud por poza: el eje con nombre y unidad, sin leyenda', () => {
    const o = categoryOption({ ...base, series: [{ name: 'Densidad', values: [1200, 1250], color: '#000' }],
      kind: 'lines', yName: 'Densidad', unit: 'kg/m3', legend: false }) as Any;
    expect(o.yAxis.name).toBe('Densidad (kg/m3)');
    expect(o.legend).toBeUndefined();
    expect(o.series[0].color).toBe('#000');
  });

  it('Li+ contra densidad: un punto por poza con su nombre', () => {
    const o = pondScatterOption({ points: [{ id: 'P1', x: 1200, y: 0.1 }, { id: 'P2', x: 1250, y: 0.2 }],
      xName: 'Densidad', xUnit: 'kg/m3', yName: 'Li+', yUnit: 't/d', seriesName: 'Pozas', color: '#123' }) as Any;
    expect(o.xAxis.type).toBe('value');
    expect(o.xAxis.name).toBe('Densidad (kg/m3)');
    expect(o.yAxis.name).toBe('Li+ (t/d)');
    expect(o.series[0].data[1]).toEqual({ value: [1250, 0.2], name: 'P2' });
    expect(o.series[0].label.formatter).toBe('{b}');
    expect(o.tooltip.formatter({ name: 'P1', value: [1200, 0.1] })).toContain('0,1000 t/d');
  });
});

describe('ayudas', () => {
  it('nombre del eje', () => {
    expect(axisName('Densidad', 'kg/m3')).toBe('Densidad (kg/m3)');
    expect(axisName('', 't/d')).toBe('t/d');
    expect(axisName('Actividad de agua', '')).toBe('Actividad de agua');
  });
  it('filas de la leyenda plana', () => {
    expect(legendRows([], 300)).toBe(0);
    expect(legendRows(['a', 'b'], 300)).toBe(1);
    expect(legendRows(Array.from({ length: 20 }, (_x, i) => `Poza ${i}`), 300)).toBeGreaterThan(3);
  });
});

describe('ECharts acepta las opciones', () => {
  // Render del lado del servidor (SVG, sin DOM): ECharts arma cada gráfico de verdad, con
  // solo los componentes registrados en echartsSetup.
  const dibujar = (option: Any) => {
    const c = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 300 });
    try {
      c.setOption(option);
      return c.renderToSVGString();
    } finally {
      c.dispose();
    }
  };
  it('serie diaria, barras, líneas y dispersión', () => {
    expect(dibujar(diaria(12))).toContain('<svg');
    expect(dibujar(diaria(2, { print: true }))).toContain('<svg');
    expect(dibujar(categoryOption({ categories: ['E1', 'E2'], series: [{ name: 'Li', values: [1, null] }],
      kind: 'bars', yName: '', unit: '%', tools }))).toContain('<svg');
    const svg = dibujar(pondScatterOption({ points: [{ id: 'P1', x: 1200, y: 0.1 }], xName: 'Densidad',
      xUnit: 'kg/m3', yName: 'Li+', yUnit: 't/d', seriesName: 'Pozas', color: '#123' }));
    expect(svg).toContain('P1');
    expect(svg).toContain('Densidad (kg/m3)');
  });
});
