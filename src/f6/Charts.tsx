/**
 * Gráficos de una ejecución. Dibujan lo que devuelve el backend, sin recalcular:
 *   - dinámico: las series diarias del período (`GET /executions/{id}/series`), todos los
 *     días (sin ralear), con paso de marcas y desplazamiento horizontal;
 *   - todos: barras o líneas por poza o por escenario, desde las tablas del reporte.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../services/api';
import { apiError, saveBlob, type ReportQuery } from '../services/apiV2';
import type { Report, ReportTable, StageReport } from '../types/report';
import { isStaticReport } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import { useLabels } from './labels';
import { formatCell } from './ReportView';
import { dmy } from './common';
import {
  DAY_STEPS, SERIES_COLORS, chartLayout, climateRows, hasPondCharts, liVsSpecies, pondRows, saltEvolution,
  seriesStyle, type DayStep, type Row,
} from './chartData';

export const GRID = '#e1e0d9';
/** Lado máximo del lienzo del PNG (los navegadores no dibujan lienzos mucho mayores). */
const MAX_CANVAS = 16000;

interface SeriesGroup {
  key: string;
  unit: string;
  series: { key: string; pond?: boolean; values: (number | null)[] }[];
}
interface DailySeries {
  stage: string;
  dates: string[];
  product_pond: string | null;
  groups: SeriesGroup[];
  /** Composición de la salmuera de cada poza (%p/p), por especie. */
  composition?: { species: string[]; ponds: Record<string, Record<string, (number | null)[]>> } | null;
}

/** Los gráficos de un panel (SVG de recharts, uno debajo del otro) como un PNG, con
 * fondo blanco y su título arriba. Un gráfico ancho (serie larga) baja la escala para
 * no pasarse del lienzo máximo del navegador. */
async function svgToPng(svgs: SVGSVGElement[], titulo: string): Promise<Blob> {
  const cabecera = 28;
  const medidas = svgs.map((s) => s.getBoundingClientRect());
  const ancho = Math.max(...medidas.map((m) => m.width));
  const alto = medidas.reduce((a, m) => a + m.height, 0) + cabecera;
  const escala = Math.min(2, MAX_CANVAS / ancho, MAX_CANVAS / alto);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala); canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(escala, escala);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = '#1f2937'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(titulo, 8, 18);
  let y = cabecera;
  for (const [i, svg] of svgs.entries()) {
    const { width, height } = medidas[i];
    const copia = svg.cloneNode(true) as SVGSVGElement;
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', String(width));
    copia.setAttribute('height', String(height));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)],
      { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise<HTMLImageElement>((ok, mal) => {
        const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = url;
      });
      ctx.drawImage(img, 0, y, width, height);
    } finally {
      URL.revokeObjectURL(url);
    }
    y += height;
  }
  return new Promise<Blob>((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('PNG'))), 'image/png'));
}

/** Todos los gráficos de un contenedor, como PNG en un zip. */
export async function downloadChartsZip(contenedor: HTMLElement, nombre: string): Promise<void> {
  const zip = new JSZip();
  const paneles = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-chart-title]'));
  for (const [i, p] of paneles.entries()) {
    const svgs = Array.from(p.querySelectorAll<SVGSVGElement>('svg.recharts-surface'))
      .filter((s) => !s.closest('.recharts-legend-wrapper'));
    if (svgs.length === 0) continue;
    const titulo = p.dataset.chartTitle ?? `grafico_${i + 1}`;
    const archivo = `${String(i + 1).padStart(2, '0')}_${titulo.replace(/[^\w\-]+/g, '_').slice(0, 60)}.png`;
    zip.file(archivo, await svgToPng(svgs, titulo));
  }
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${nombre}.zip`);
}

/**
 * Un gráfico con su título (el título nombra el PNG del zip). Varios hijos = varios
 * gráficos uno debajo del otro, con el mismo eje X (en vez de dos ejes Y). `minWidth`
 * > 0 ensancha el gráfico y aparece la barra de desplazamiento horizontal.
 */
export function Panel({ title, children, minWidth = 0, height = 280 }: {
  title: string; children: React.ReactNode; minWidth?: number; height?: number;
}) {
  const graficos = React.Children.toArray(children).filter(Boolean) as React.ReactElement[];
  return (
    <div className="card p-3 mb-4 pdf-block" data-chart-title={title}
         style={{ minWidth: 0, gridColumn: minWidth ? '1 / -1' : undefined }}>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div style={{ overflowX: minWidth ? 'auto' : 'visible', width: '100%' }} data-testid="chart-scroll">
        <div style={{ width: minWidth ? `${minWidth}px` : '100%', minWidth: '100%' }}>
          {graficos.map((g, i) => (
            <div key={i} style={{ width: '100%', height: graficos.length > 1 ? Math.round(height * 0.62) : height }}>
              <ResponsiveContainer>{g}</ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Botones de una sola elección (pestañas chicas). */
export function Toggle<K extends string>({ value, options, onChange, testId }: {
  value: K; options: [K, string][]; onChange: (k: K) => void; testId?: string;
}) {
  return (
    <div className="flex gap-1" role="tablist" data-testid={testId}>
      {options.map(([k, texto]) => (
        <button key={k} role="tab" aria-selected={value === k} style={{ textTransform: 'none' }}
                className={`btn btn-sm ${value === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => onChange(k)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

/**
 * Series diarias del período. `print`: para imprimir o el PDF, el gráfico al ancho de la
 * página (sin desplazamiento, que el papel no tiene).
 */
export function DailyCharts({ executionId, query, print = false }: {
  executionId: string; query: ReportQuery; print?: boolean;
}) {
  const t = useT();
  const { label } = useLabels();
  const [data, setData] = useState<DailySeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eje, setEje] = useState<'date' | 'day'>('date');
  const [paso, setPaso] = useState<DayStep>('auto');
  const [especies, setEspecies] = useState<string[]>(['Li+']);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    const params = Object.fromEntries(Object.entries({
      period_start: query.period_start, period_end: query.period_end,
    }).filter(([, v]) => v));
    api.get<DailySeries>(`/executions/${executionId}/series`, { params })
      .then(({ data: d }) => { if (vivo) { setData(d); setError(null); } })
      .catch((err) => { if (vivo) setError(apiError(err).message); });
    return () => { vivo = false; };
  }, [executionId, query.period_start, query.period_end]);

  const grupos = useMemo(() => {
    if (!data) return [];
    // La composición se dibuja como un grupo más por especie elegida: una línea por poza.
    const comp: (SeriesGroup & { title: string })[] = (data.composition?.species ?? [])
      .filter((sp) => especies.includes(sp))
      .map((sp) => ({
        key: `composition_${sp}`, unit: '%p/p', title: `${t('f6_series_composition')} ${sp}`,
        series: Object.entries(data.composition!.ponds).map(([pozo, c]) => ({
          key: pozo, pond: true, values: c[sp] ?? [] })),
      }));
    const todos = [
      ...data.groups.map((g) => ({ ...g, title: t(`f6_series_${g.key}` as never) })),
      ...comp,
    ];
    // Todos los días: nada se ralea, el cursor tiene que poder llegar a cada uno.
    return todos.filter((g) => g.series.some((s) => s.values.some((v) => v !== null && v !== undefined)))
      .map((g) => ({
        ...g,
        rows: data.dates.map((fecha, i) => {
          const fila: Record<string, string | number | null> = { date: fecha, day: i + 1 };
          g.series.forEach((s) => { fila[s.key] = s.values[i] ?? null; });
          return fila;
        }),
      }));
  }, [data, especies, t]);

  if (error) return <p className="text-sm mb-4" style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!data) return null;
  const geo = chartLayout(data.dates.length, print ? 'auto' : paso, eje, print);
  return (
    <section className="mb-6" data-testid="daily-charts" ref={caja}>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-base font-semibold pdf-block pdf-page-break">{t('f6_charts_daily')}</h3>
        <Toggle value={eje} onChange={setEje}
                options={[['date', t('f6_axis_dates')], ['day', t('f6_axis_days')]]} />
        <label className="flex gap-1 items-center text-xs no-print">
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('f6_day_step')}:</span>
          <select className="input text-xs" style={{ width: 'auto' }} value={String(paso)} data-testid="day-step"
                  onChange={(e) => setPaso(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
            {DAY_STEPS.map((o) => (
              <option key={String(o)} value={String(o)}>{o === 'auto' ? t('f6_day_step_auto') : o}</option>
            ))}
          </select>
        </label>
        {(data.composition?.species.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs" data-testid="species-chips">
            <span>{t('f6_series_composition')}:</span>
            {data.composition!.species.map((sp) => (
              <button key={sp} className={`btn btn-sm ${especies.includes(sp) ? 'btn-primary' : 'btn-outline'}`}
                      style={{ textTransform: 'none' }}
                      onClick={() => setEspecies(especies.includes(sp) ? especies.filter((x) => x !== sp)
                        : [...especies, sp])}>
                {sp}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm"
                onClick={() => caja.current && downloadChartsZip(caja.current, `graficos_${data.stage}`)}>
          {t('f6_download_charts')}
        </button>
      </div>
      {geo.minWidth > 0 && (
        <p className="text-xs mb-2 no-print" style={{ color: 'var(--color-text-secondary)' }}>
          {t('f6_chart_scroll_hint')}
        </p>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))' }}>
        {grupos.map((g) => (
          <Panel key={g.key} title={`${g.title} (${g.unit})`} minWidth={geo.minWidth}>
            <LineChart data={g.rows} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey={eje} tick={{ fontSize: 10 }} interval={geo.interval}
                     minTickGap={paso === 'auto' ? 30 : 4} angle={geo.angled ? -35 : 0}
                     textAnchor={geo.angled ? 'end' : 'middle'} height={geo.axisHeight} tickMargin={8}
                     tickFormatter={eje === 'date' ? dmy : undefined} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatCell(v)} width={70} />
              <Tooltip formatter={(v: number) => formatCell(v)}
                       labelFormatter={(l) => (eje === 'date' ? dmy(l) : `${t('f6_day')} ${l}`)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {g.series.map((s, i) => (
                <Line key={s.key} type="monotone" dataKey={s.key} dot={false} connectNulls
                      name={s.pond ? s.key : label(`result.${s.key}`, s.key)}
                      {...seriesStyle(i)}
                      strokeWidth={s.key === data.product_pond ? 2.5 : 1.5} isAnimationActive={false} />
              ))}
            </LineChart>
          </Panel>
        ))}
      </div>
    </section>
  );
}

/** Columnas numéricas de una tabla con la unidad pedida (las de etiqueta, no especies). */
function columnas(table: ReportTable, unidades: string[]) {
  return table.columns.filter((c) => c.key !== 'id' && c.kind === 'label' && unidades.includes(c.unit)
    && table.rows.some((r) => typeof r[c.key] === 'number'));
}

function TableBars({ table, unidades, title, lines = false }: {
  table: ReportTable; unidades: string[]; title?: string; lines?: boolean;
}) {
  const { label } = useLabels();
  const cols = columnas(table, unidades).slice(0, 6);
  if (cols.length === 0 || table.rows.length === 0) return null;
  const Chart = lines ? LineChart : BarChart;
  return (
    <Panel title={title ?? `${label(`result.${table.key}`, table.key)} (${cols[0].unit})`}>
      <Chart data={table.rows} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="id" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatCell(v)} width={70} />
        <Tooltip formatter={(v: number) => formatCell(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {cols.map((c, i) => (lines ? (
          <Line key={c.key} type="monotone" dataKey={c.key} name={label(`result.${c.key}`, c.key)}
                {...seriesStyle(i)} strokeWidth={2} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
        ) : (
          <Bar key={c.key} dataKey={c.key} name={label(`result.${c.key}`, c.key)}
               fill={seriesStyle(i).stroke} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        )))}
      </Chart>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Por poza (estático): lo que mostraba la versión anterior de cada etapa de pozas
// ---------------------------------------------------------------------------
const AXIS = { tick: { fontSize: 10 } };

/** Una línea por poza (eje X = pozas de la cascada), con un solo eje Y. */
function pondLine(data: Row[], key: string, name: string, color: string, unit: string, syncId?: string) {
  return (
    <LineChart data={data} syncId={syncId} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
      <XAxis dataKey="id" {...AXIS} interval={0} />
      <YAxis {...AXIS} width={70} domain={['auto', 'auto']} tickFormatter={(v: number) => formatCell(v)}
             label={{ value: unit ? `${name} (${unit})` : name, angle: -90, position: 'insideLeft',
                      style: { fontSize: 10, textAnchor: 'middle' }, dx: 12 }} />
      <Tooltip formatter={(v: number) => formatCell(v)} />
      <Line type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={{ r: 4 }}
            connectNulls isAnimationActive={false} />
    </LineChart>
  );
}

function StagePondCharts({ stage, mode, prefix }: { stage: StageReport; mode: 'abs' | 'pct'; prefix: string }) {
  const t = useT();
  const nombre = `${prefix}${t(`f6_stage_${stage.stage}` as never)}`;
  const unidad = mode === 'abs' ? 't/d' : '%p/p';
  const { species, rows } = liVsSpecies(stage, mode);
  const pozas = pondRows(stage, mode);
  const sales = saltEvolution(stage);
  const dispersion = pozas.filter((p) => p.liquid_density !== null && p['Li+'] !== null);
  const [li, otra] = [SERIES_COLORS[0], SERIES_COLORS[1]];
  const sync = `${prefix}${stage.stage}`;
  return (
    <>
      <h4 className="text-sm font-semibold pdf-block" style={{ gridColumn: '1 / -1' }}>
        {nombre} · {t('f6_per_pond')}
      </h4>
      {species.map((sp) => (
        <Panel key={sp} title={`${nombre} · Li+ vs ${sp} (${unidad})`} height={340}>
          {[pondLine(rows, 'Li+', 'Li+', li, unidad, `${sync}-${sp}`),
            pondLine(rows, sp, sp, otra, unidad, `${sync}-${sp}`)]}
        </Panel>
      ))}
      {dispersion.length > 0 && (
        <Panel title={`${nombre} · ${t('f6_chart_li_density')} (Li+ ${unidad})`}>
          <ScatterChart margin={{ top: 16, right: 20, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis type="number" dataKey="liquid_density" name={t('f6_chart_density')} unit=" kg/m3"
                   domain={['auto', 'auto']} {...AXIS} tickFormatter={(v: number) => formatCell(v)}
                   label={{ value: `${t('f6_chart_density')} (kg/m3)`, position: 'insideBottom', offset: -12,
                            style: { fontSize: 10 } }} />
            <YAxis type="number" dataKey="Li+" name="Li+" domain={['auto', 'auto']} {...AXIS} width={70}
                   tickFormatter={(v: number) => formatCell(v)} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number) => formatCell(v)}
                     labelFormatter={(_l, p) => String((p?.[0]?.payload as Row | undefined)?.id ?? '')} />
            <Scatter name={t('f6_ponds')} data={dispersion} fill={li} line={{ stroke: li, strokeWidth: 1.5 }}
                     lineType="joint" isAnimationActive={false}>
              <LabelList dataKey="id" position="top" style={{ fontSize: 9, fill: '#52514e' }} />
            </Scatter>
          </ScatterChart>
        </Panel>
      )}
      <Panel title={`${nombre} · ${t('f6_chart_flow_activity')}`} height={340}>
        {[pondLine(pozas, 'outflow_t_d', t('f6_chart_outflow'), SERIES_COLORS[0], 't/d', `${sync}-flow`),
          pondLine(pozas, 'water_activity', t('f6_chart_water_activity'), SERIES_COLORS[6], '', `${sync}-flow`)]}
      </Panel>
      <Panel title={`${nombre} · ${t('f6_chart_density')} (kg/m3)`}>
        {pondLine(pozas, 'liquid_density', t('f6_chart_density'), SERIES_COLORS[7], 'kg/m3')}
      </Panel>
      <Panel title={`${nombre} · ${t('f6_chart_salt_total')} (t/d)`}>
        {pondLine(pozas, 'salt_precipitated_t_d', t('f6_chart_salt_total'), SERIES_COLORS[2], 't/d')}
      </Panel>
      {sales.salts.length > 0 && (
        <Panel title={`${nombre} · ${t('f6_chart_salt_evolution')} (t/d)`} height={360}>
          <LineChart data={sales.rows} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="id" {...AXIS} interval={0} />
            <YAxis {...AXIS} width={70} tickFormatter={(v: number) => formatCell(v)} />
            <Tooltip formatter={(v: number) => formatCell(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {sales.salts.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} {...seriesStyle(i)} strokeWidth={2} dot={{ r: 3 }}
                    connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </Panel>
      )}
    </>
  );
}

/** Temperatura y evaporación de cada escenario (dos gráficos, mismo eje X). */
function ClimateChart({ comparison, lines }: { comparison: ReportTable; lines: boolean }) {
  const t = useT();
  const filas = climateRows(comparison);
  if (!filas.some((f) => f.temperature_C !== null || f.evaporation_mm_d !== null)) return null;
  const uno = (key: string, name: string, unit: string, color: string) => {
    const Chart = lines ? LineChart : BarChart;
    return (
      <Chart data={filas} syncId="clima" margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="id" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={70} tickFormatter={(v: number) => formatCell(v)}
               label={{ value: `${name} (${unit})`, angle: -90, position: 'insideLeft',
                        style: { fontSize: 10, textAnchor: 'middle' }, dx: 12 }} />
        <Tooltip formatter={(v: number) => `${formatCell(v)} ${unit}`} />
        {lines
          ? <Line type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={{ r: 4 }}
                  connectNulls isAnimationActive={false} />
          : <Bar dataKey={key} name={name} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
      </Chart>
    );
  };
  return (
    <Panel title={t('f6_chart_climate')} height={340}>
      {[uno('temperature_C', t('f6_chart_temperature'), '°C', SERIES_COLORS[1]),
        uno('evaporation_mm_d', t('f6_chart_evaporation'), 'mm/d', SERIES_COLORS[0])]}
    </Panel>
  );
}

/**
 * Gráficos desde el reporte. Estático: comparativa y clima de los escenarios, y por poza
 * cada etapa de pozas del escenario elegido (`scenario`) o de todos (`allScenarios`, para
 * imprimir). Dinámico: el balance por poza de cada etapa. Barras o líneas a elección.
 */
export function ReportCharts({ report, scenario = 0, allScenarios = false }: {
  report: Report; scenario?: number; allScenarios?: boolean;
}) {
  const t = useT();
  const caja = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<'bars' | 'lines'>('bars');
  const [modo, setModo] = useState<'abs' | 'pct'>('abs');
  const estatico = isStaticReport(report);
  const escenarios = estatico
    ? (allScenarios ? report.scenarios : report.scenarios.slice(scenario, scenario + 1)) : [];
  const tablas = estatico ? [] : report.stages.flatMap((s) => s.tables.filter((tb) => tb.row_kind === 'pond'));
  const comparativa = estatico ? report.comparison : null;
  const conPozas = escenarios.some((sc) => sc.stages.some(hasPondCharts));
  if (!comparativa && tablas.length === 0) return null;
  const lineas = vista === 'lines';
  return (
    <section className="mb-6" data-testid="report-charts" ref={caja}>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-base font-semibold pdf-block pdf-page-break">{t('f6_charts')}</h3>
        <Toggle value={vista} onChange={setVista} testId="chart-view"
                options={[['bars', t('f6_view_bars')], ['lines', t('f6_view_lines')]]} />
        {conPozas && (
          <>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_chart_li_units')}:</span>
            <Toggle value={modo} onChange={setModo} testId="conc-mode"
                    options={[['abs', 't/d'], ['pct', '%p/p']]} />
          </>
        )}
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm"
                onClick={() => caja.current && downloadChartsZip(caja.current, 'graficos_reporte')}>
          {t('f6_download_charts')}
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))' }}>
        {comparativa && <TableBars table={comparativa} unidades={['%']} lines={lineas} />}
        {comparativa && <TableBars table={comparativa} unidades={['t/d']} lines={lineas} />}
        {comparativa && <ClimateChart comparison={comparativa} lines={lineas} />}
        {tablas.map((tb, i) => <TableBars key={`${tb.key}-${i}`} table={tb} unidades={['t/d']} lines={lineas} />)}
        {escenarios.map((sc) => sc.stages.filter(hasPondCharts).map((st) => (
          <StagePondCharts key={`${sc.index}-${st.stage}`} stage={st} mode={modo}
                           prefix={`${t('f6_scenario')} ${sc.label} · `} />
        )))}
      </div>
    </section>
  );
}
