// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  COMPARE_LINE_TYPES, LEGEND_SCROLL_FROM, axisName, axisTooltip, categoryOption, dailyLineOption, legendRows,
  dualAxisOption, liSankeyOption, pondHeatmapOption, pondScatterOption,
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

  it('zoom con Ctrl + rueda y con la barra, y caja de herramientas (PNG, zoom, restablecer)', () => {
    const o = diaria(2);
    expect(o.dataZoom.map((d: Any) => d.type)).toEqual(['inside', 'slider']);
    expect(o.dataZoom.every((d: Any) => d.xAxisIndex === 0)).toBe(true);
    // Arranca con la serie entera; la rueda sola desplaza la página (no queda atrapada).
    expect(o.dataZoom.every((d: Any) => d.start === 0 && d.end === 100)).toBe(true);
    expect(o.dataZoom[0]).toMatchObject({ zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, moveOnMouseMove: true });
    // La barra queda bajo las etiquetas del eje (la grilla le deja su lugar).
    expect(o.grid.bottom).toBeGreaterThan(o.dataZoom[1].bottom + o.dataZoom[1].height);
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
    // Al ancho del panel, las etiquetas que se pisarían se esconden (al acercar, aparecen).
    expect(o.xAxis.axisLabel.hideOverlap).toBe(true);
    expect(diaria(1).xAxis.axisLabel.hideOverlap).toBe(true);
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

describe('balance de litio (Sankey)', () => {
  const etapas = [
    { name: 'Precon', li_in: 100, li_out: 80, lossName: 'Precon · no recuperado' },
    { name: 'Planta', li_in: 80, li_out: 76, lossName: 'Planta · no recuperado' },
    { name: 'Post', li_in: 76, li_out: 60, lossName: 'Post · no recuperado' },
  ];
  const sankey = (stages = etapas, extra = {}) => liSankeyOption({ stages, sourceName: 'Pozo', productName: 'Producto',
    unit: 't', pctLabel: 'del Li que entra', tools, ...extra }) as Any;

  it('pozo → etapas → producto, con lo no recuperado de cada etapa', () => {
    const s = sankey().series[0];
    expect(s.type).toBe('sankey');
    expect(s.links.map((l: Any) => [l.source, l.target, l.value])).toEqual([
      ['Pozo', 'Precon', 100], ['Precon', 'Planta', 80], ['Precon', 'Precon · no recuperado', 20],
      ['Planta', 'Post', 76], ['Planta', 'Planta · no recuperado', 4],
      ['Post', 'Producto', 60], ['Post', 'Post · no recuperado', 16],
    ]);
    expect(s.data.map((n: Any) => n.name)).toContain('Producto');
  });

  it('tooltip con unidad y % del Li que entra', () => {
    const o = sankey();
    const html = o.tooltip.formatter({ dataType: 'edge', name: '', value: 60, data: { source: 'Post', target: 'Producto' } });
    expect(html).toContain('Post → Producto');
    expect(html).toContain('60,00 t');
    expect(html).toContain('60,00 % del Li que entra');
  });

  it('un tramo sin dato no se dibuja; una sola etapa va de la entrada al producto', () => {
    const s = sankey([{ name: 'Planta', li_in: 10, li_out: null, lossName: 'x' }]).series[0];
    expect(s.links).toEqual([{ source: 'Pozo', target: 'Planta', value: 10 }]);
    expect(sankey([], { print: true }).toolbox).toBeUndefined();
  });
});

describe('mapa de calor poza × día', () => {
  const heat = (extra = {}) => pondHeatmapOption({ categories: ['2024-01-01', '2024-01-02', '2024-01-03'],
    ponds: ['P1', 'P2'], values: [[1, null, 3], [2, 5, undefined]], unit: 'kg/m3', productPond: 'P2',
    axisLabel: (v) => v, tooltipTitle: (v) => `Fecha ${v}`, interval: 'auto', tools, ...extra }) as Any;

  it('una celda por poza y día con dato; escala de colores del mínimo al máximo, con unidad', () => {
    const o = heat();
    expect(o.series[0].type).toBe('heatmap');
    expect(o.series[0].progressive).toBe(0);
    expect(o.series[0].data).toEqual([[0, 0, 1], [2, 0, 3], [0, 1, 2], [1, 1, 5]]);
    expect(o.visualMap).toMatchObject({ min: 1, max: 5 });
    expect(o.visualMap.formatter(1234.5)).toBe('1.234,50 kg/m3');
  });

  it('zoom en los días, tooltip fecha/poza/valor y la poza de producto marcada', () => {
    const o = heat();
    expect(o.dataZoom.map((d: Any) => d.type)).toEqual(['inside', 'slider']);
    expect(o.dataZoom[0].zoomOnMouseWheel).toBe('ctrl');
    expect(heat({ interval: 9 }).xAxis.axisLabel.hideOverlap).toBe(true);
    expect(o.tooltip.formatter({ value: [1, 1, 5] })).toBe('<b>Fecha 2024-01-02</b><br/>P2: <b>5,00 kg/m3</b>');
    expect(o.yAxis.axisLabel.formatter('P2')).toBe('{p|P2 ★}');
    expect(o.yAxis.axisLabel.formatter('P1')).toBe('P1');
    const p = heat({ print: true });
    expect(p.dataZoom).toBeUndefined();
    expect(p.visualMap.calculable).toBe(false);
  });
});

describe('dos ejes Y por poza (como el reporte de antes)', () => {
  const o = dualAxisOption({ categories: ['P1', 'P2'], tools,
    left: { name: 'Li+', unit: 't/d', values: [0.1, 0.09], color: '#1baf7a', width: 3 },
    right: { name: 'Na+', unit: 't/d', values: [6, 2], color: '#eda100' } }) as Any;

  it('Li+ en el eje izquierdo y la otra especie en el derecho, cada eje con su nombre y unidad', () => {
    expect(o.yAxis).toHaveLength(2);
    expect(o.yAxis.map((y: Any) => [y.position, y.name])).toEqual([['left', 'Li+ (t/d)'], ['right', 'Na+ (t/d)']]);
    expect(o.series.map((x: Any) => [x.type, x.name, x.yAxisIndex])).toEqual([['line', 'Li+', 0], ['line', 'Na+', 1]]);
    expect(o.series[0].lineStyle.width).toBe(3);
    expect(o.legend.data).toEqual(['Li+', 'Na+']);
    expect(o.xAxis.data).toEqual(['P1', 'P2']);
  });

  it('el tooltip pone la unidad de cada serie', () => {
    const html = o.tooltip.formatter([{ seriesName: 'Li+', value: 0.1, axisValue: 'P1' },
      { seriesName: 'Na+', value: 6, axisValue: 'P1' }]);
    expect(html).toContain('0,1000 t/d');
    expect(html).toContain('6,00 t/d');
  });
});

describe('comparación: trazo y color por ejecución', () => {
  it('las líneas de la serie diaria y por escenario aceptan color y trazo fijos', () => {
    const d = diaria(1, { series: [{ name: 'A', values: [1], index: 0, color: '#111', lineType: 'dotted' }] });
    expect(d.series[0]).toMatchObject({ color: '#111', lineStyle: { type: 'dotted' } });
    const c = categoryOption({ categories: ['E1'], series: [{ name: 'A', values: [1], lineType: COMPARE_LINE_TYPES[1] }],
      kind: 'lines', yName: '', unit: '%' }) as Any;
    expect(c.series[0].lineStyle.type).toBe('dashed');
  });
});

describe('ECharts acepta los gráficos nuevos', () => {
  const dibujar = (option: Any) => {
    const c = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 700, height: 320 });
    try { c.setOption(option); return c.renderToSVGString(); } finally { c.dispose(); }
  };
  it('Sankey, mapa de calor y dos ejes', () => {
    expect(dibujar(liSankeyOption({ stages: [{ name: 'Precon', li_in: 10, li_out: 8, lossName: 'Pérdida' }],
      sourceName: 'Pozo', productName: 'Producto', unit: 't', pctLabel: '', print: true }))).toContain('Producto');
    expect(dibujar(pondHeatmapOption({ categories: ['a', 'b'], ponds: ['P1', 'P2'], values: [[1, 2], [3, null]],
      unit: '', productPond: 'P1', axisLabel: (v) => v, tooltipTitle: (v) => v, interval: 'auto', print: true })))
      .toContain('<svg');
    expect(dibujar(dualAxisOption({ categories: ['P1'], print: true,
      left: { name: 'Li+', unit: 't/d', values: [1], color: '#000' },
      right: { name: 'Na+', unit: 't/d', values: [2], color: '#111' } }))).toContain('Na+ (t/d)');
  });
});

describe('decimales fijos por gráfico', () => {
  it('densidad en g/cm3 con 4 decimales en el eje y el tooltip', () => {
    const o = categoryOption({ categories: ['P1'], series: [{ name: 'Densidad', values: [1.21346] }], kind: 'lines',
      yName: 'Densidad', unit: 'g/cm3', digits: 4 }) as Any;
    expect(o.yAxis.name).toBe('Densidad (g/cm3)');
    expect(o.yAxis.axisLabel.formatter(1.21346)).toBe('1,2135');
    expect(o.tooltip.formatter([{ seriesName: 'Densidad', value: 1.21346, axisValue: 'P1' }])).toContain('1,2135 g/cm3');
  });
});

describe('fórmula de cada serie en el tooltip', () => {
  it('la serie diaria con fórmula la muestra debajo de su valor', () => {
    const o = dailyLineOption({ categories: ['2024-01-01'], unit: 't/d', yName: '', axisLabel: (v) => v,
      tooltipTitle: (v) => v, interval: 'auto', angled: false,
      series: [{ name: 'Lechada de cal', values: [1], index: 0, formula: 'lime + water (encalado_reactivos)' }] }) as Any;
    const html = o.tooltip.formatter([{ seriesName: 'Lechada de cal', value: 1, axisValue: '2024-01-01' }]);
    expect(html).toContain('lime + water (encalado_reactivos)');
  });
});

describe('línea curva o recta', () => {
  const cat = (smooth?: boolean) => categoryOption({
    categories: ['P1', 'P2'], kind: 'lines', yName: '', unit: 't/d', smooth,
    series: [{ name: 'Li+', values: [1, 2] }],
  });
  const dual = (smooth?: boolean) => dualAxisOption({
    categories: ['P1', 'P2'], smooth,
    left: { name: 'Li+', unit: 't/d', values: [1, 2], color: '#000' },
    right: { name: 'Na+', unit: 't/d', values: [3, 4], color: '#111' },
  });
  const suaves = (o: ReturnType<typeof cat>) => (o.series as { smooth?: boolean }[]).map((s) => s.smooth);
  it('por defecto curva, como antes', () => {
    expect(suaves(cat())).toEqual([true]);
    expect(suaves(dual())).toEqual([true, true]);
  });
  it('recta si se elige', () => {
    expect(suaves(cat(false))).toEqual([false]);
    expect(suaves(dual(false))).toEqual([false, false]);
  });
});
