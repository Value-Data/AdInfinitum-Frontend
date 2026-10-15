/**
 * Gráficos de una ejecución (ECharts). Dibujan lo que devuelve el backend, sin recalcular:
 *   - dinámico: las series diarias del período (`GET /executions/{id}/series`), todos los
 *     días (sin ralear), con zoom, paso de marcas y desplazamiento horizontal;
 *   - todos: barras o líneas por poza o por escenario, desde las tablas del reporte.
 * Las opciones salen de `chartOptions` (probadas sin dibujar).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { apiError, getExecutionSeries, saveBlob, type ReportQuery } from '../services/apiV2';
import type { DailySeries, Report, ReportTable, StageReport } from '../types/report';
import { isStaticReport } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import { useDecimals } from '../context/DecimalsContext';
import { useLabels } from './labels';
import { dmy } from './common';
import {
  DAY_STEPS, SERIES_COLORS, chartLayout, climateRows, dailyGroups, dailyRows, hasPondCharts, liVsSpecies,
  pondRows, saltEvolution, saltPonds, seriesUsesOwnName, type DailyGroup, type DayStep, type Row,
} from './chartData';
import {
  categoryOption, dailyLineOption, pondScatterOption, type CategoryInput, type ToolLabels,
} from './chartOptions';
import { EChart, useChartPrint } from './EChart';
import { Panel, Toggle, nombreArchivo, useTools } from './chartPanel';
import { LiSankeyPanel, PondHeatmap, RecoveryPanel } from './ProCharts';
import { canvasToBlob, panelCanvas } from './chartImage';

export { GRID } from './chartOptions';
export { Panel, Toggle } from './chartPanel';

/** Todos los gráficos de un contenedor, como PNG en un zip (uno por panel, con su título). */
export async function downloadChartsZip(contenedor: HTMLElement, nombre: string): Promise<void> {
  const zip = new JSZip();
  const paneles = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-chart-title]'));
  for (const [i, p] of paneles.entries()) {
    const titulo = p.dataset.chartTitle ?? `grafico_${i + 1}`;
    const lienzo = await panelCanvas(p, titulo);
    if (!lienzo) continue;
    zip.file(`${String(i + 1).padStart(2, '0')}_${nombreArchivo(titulo)}.png`, await canvasToBlob(lienzo));
  }
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${nombre}.zip`);
}

/**
 * Series diarias del período. `print` (o la vista de impresión): el gráfico al ancho de
 * la página (sin desplazamiento ni zoom, que el papel no tiene) y en SVG.
 */
export function DailyCharts({ executionId, query, print: printProp = false, onSettled }: {
  executionId: string; query: ReportQuery; print?: boolean;
  /** Avisa cuando las series llegaron (o fallaron): la vista de impresión espera esto. */
  onSettled?: () => void;
}) {
  const t = useT();
  const { label } = useLabels();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint() || printProp;
  const [data, setData] = useState<DailySeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eje, setEje] = useState<'date' | 'day'>('date');
  const [paso, setPaso] = useState<DayStep>('auto');
  const [especies, setEspecies] = useState<string[]>(['Li+']);
  const [todas, setTodas] = useState(false);
  const [pozaSales, setPozaSales] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    getExecutionSeries(executionId, query, todas)
      .then((d) => { if (vivo) { setData(d); setError(null); } })
      .catch((err) => { if (vivo) setError(apiError(err).message); })
      .finally(() => { if (vivo) onSettled?.(); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId, query.period_start, query.period_end, todas]);

  const pozasConSal = useMemo(() => (data ? saltPonds(data) : []), [data]);
  // La poza de las sales: la elegida si sigue en la serie; si no, la de producto o la primera.
  const poza = pozaSales && pozasConSal.includes(pozaSales) ? pozaSales
    : (data?.product_pond && pozasConSal.includes(data.product_pond) ? data.product_pond : pozasConSal[0] ?? null);

  const grupos = useMemo(() => (data ? dailyGroups(data, especies, poza) : [])
    .map((g) => ({ ...g, rows: dailyRows(data!, g) })), [data, especies, poza]);

  const titulo = (g: DailyGroup) => {
    if (g.origin === 'composition') return `${t('f6_series_composition')} ${g.subject}`;
    if (g.origin === 'salts') return `${t('f6_series_salts_pond')} · ${g.subject}`;
    const k = `f6_series_${g.key}`;
    const v = t(k as never);
    return v && v !== k ? v : label(`result.${g.key}`, g.key);
  };

  const geo = chartLayout(data?.dates.length ?? 0, print ? 'auto' : paso, eje, print);
  const opciones = useMemo(() => {
    if (!data) return [];
    const categorias = eje === 'date' ? data.dates : data.dates.map((_f, i) => data.days?.[i] ?? i + 1);
    const marca = eje === 'date' ? (v: string) => dmy(v) : (v: string) => v;
    const cabeza = eje === 'date' ? (v: string) => dmy(v) : (v: string) => `${t('f6_day')} ${v}`;
    return grupos.map((g) => {
      const nombre = g.unit ? `${titulo(g)} (${g.unit})` : titulo(g);
      return {
        key: g.key, title: nombre,
        option: dailyLineOption({
          categories: categorias, unit: g.unit, yName: '', axisLabel: marca, tooltipTitle: cabeza,
          interval: geo.interval, angled: geo.angled, print, tools, fileName: nombreArchivo(nombre),
          series: g.series.map((s, i) => ({
            name: seriesUsesOwnName(s) ? s.key : label(`result.${s.key}`, s.key),
            values: s.values.map((v) => v ?? null), index: i,
            width: s.key === data.product_pond ? 2.5 : 1.5,
          })),
        }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, grupos, eje, geo.interval, geo.angled, print, decimals, label, t]);

  if (error) return <p className="text-sm mb-4" style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!data) return null;
  const listaEspecies = data.composition?.species ?? [];
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
        {pozasConSal.length > 0 && (
          <label className="flex gap-1 items-center text-xs no-print">
            <span style={{ color: 'var(--color-text-secondary)' }}>{t('f6_series_salts_pond')}:</span>
            <select className="input text-xs" style={{ width: 'auto' }} value={poza ?? ''} data-testid="salt-pond"
                    onChange={(e) => setPozaSales(e.target.value)}>
              {pozasConSal.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
        {(listaEspecies.length > 0 || data.groups.some((g) => g.series.some((s) => s.species))) && (
          <div className="flex flex-wrap items-center gap-1 text-xs" data-testid="species-chips">
            <span>{t('f6_series_composition')}:</span>
            {listaEspecies.map((sp) => (
              <button key={sp} className={`btn btn-sm ${especies.includes(sp) ? 'btn-primary' : 'btn-outline'}`}
                      style={{ textTransform: 'none' }}
                      onClick={() => setEspecies(especies.includes(sp) ? especies.filter((x) => x !== sp)
                        : [...especies, sp])}>
                {sp}
              </button>
            ))}
            <button className={`btn btn-sm ${todas ? 'btn-primary' : 'btn-outline'}`} data-testid="all-species"
                    style={{ textTransform: 'none' }} title={t('f6_all_species_hint')}
                    onClick={() => setTodas(!todas)}>
              {todas ? t('f6_default_species') : t('f6_all_species')}
            </button>
          </div>
        )}
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm"
                onClick={() => caja.current && downloadChartsZip(caja.current, `graficos_${data.stage}`)}>
          {t('f6_download_charts')}
        </button>
      </div>
      {!print && (
        <p className="text-xs mb-2 no-print" style={{ color: 'var(--color-text-secondary)' }}>
          {t('f6_chart_zoom_hint')}{geo.minWidth > 0 && ` ${t('f6_chart_scroll_hint')}`}
        </p>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))' }}>
        {opciones.map((o) => (
          <Panel key={o.key} title={o.title} minWidth={geo.minWidth}>
            <EChart option={o.option} height={280} />
          </Panel>
        ))}
        <PondHeatmap data={data} eje={eje} interval={geo.interval}
                     titleOf={(key, sp) => (sp ? `${t('f6_series_composition')} ${sp}`
                       : titulo({ key, unit: '', series: [], origin: 'group' }))} />
      </div>
    </section>
  );
}

/** Columnas numéricas de una tabla con la unidad pedida (las de etiqueta, no especies). */
function columnas(table: ReportTable, unidades: string[]) {
  return table.columns.filter((c) => c.key !== 'id' && c.kind === 'label' && unidades.includes(c.unit)
    && table.rows.some((r) => typeof r[c.key] === 'number'));
}

const valores = (rows: Row[] | ReportTable['rows'], key: string) =>
  rows.map((r) => (typeof r[key] === 'number' ? (r[key] as number) : null));

function TableBars({ table, unidades, title, lines = false }: {
  table: ReportTable; unidades: string[]; title?: string; lines?: boolean;
}) {
  const { label } = useLabels();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const cols = columnas(table, unidades).slice(0, 6);
  const nombre = title ?? `${label(`result.${table.key}`, table.key)} (${cols[0]?.unit ?? ''})`;
  const option = useMemo(() => categoryOption({
    categories: table.rows.map((r) => String(r.id)), kind: lines ? 'lines' : 'bars',
    yName: '', unit: cols[0]?.unit ?? '', print, tools, fileName: nombreArchivo(nombre),
    series: cols.map((c) => ({ name: label(`result.${c.key}`, c.key), values: valores(table.rows, c.key) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [table, lines, print, decimals, label, nombre]);
  if (cols.length === 0 || table.rows.length === 0) return null;
  return (
    <Panel title={nombre}>
      <EChart option={option} height={280} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Por poza (estático): lo que mostraba la versión anterior de cada etapa de pozas
// ---------------------------------------------------------------------------
interface PondLine { key: string; name: string; color: string; unit: string }

/** Una línea por poza (eje X = pozas de la cascada), con un solo eje Y nombrado con su unidad. */
function pondLineOption(data: Row[], l: PondLine, kind: 'bars' | 'lines', base: { print: boolean; tools: ToolLabels; fileName: string }) {
  const serie: CategoryInput = { name: l.name, values: valores(data, l.key), color: l.color };
  return categoryOption({
    categories: data.map((r) => r.id), series: [serie], kind, yName: l.name, unit: l.unit,
    scale: true, legend: false, ...base,
  });
}

/** Un panel de una o más magnitudes por poza, una debajo de la otra, con el cursor compartido. */
function PondPanel({ title, data, lines, height, group }: {
  title: string; data: Row[]; lines: PondLine[]; height?: number; group?: string;
}) {
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const opciones = useMemo(() => lines.map((l) => pondLineOption(data, l, 'lines',
    { print, tools, fileName: nombreArchivo(title) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, lines, print, decimals, title]);
  return (
    <Panel title={title} height={height}>
      {opciones.map((o, i) => <EChart key={i} option={o} height={height ?? 280} group={group} />)}
    </Panel>
  );
}

function StagePondCharts({ stage, mode, prefix }: { stage: StageReport; mode: 'abs' | 'pct'; prefix: string }) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const nombre = `${prefix}${t(`f6_stage_${stage.stage}` as never)}`;
  const unidad = mode === 'abs' ? 't/d' : '%p/p';
  const { species, rows } = liVsSpecies(stage, mode);
  const pozas = pondRows(stage, mode);
  const sales = saltEvolution(stage);
  const dispersion = pozas.filter((p) => p.liquid_density !== null && p['Li+'] !== null);
  const [li, otra] = [SERIES_COLORS[0], SERIES_COLORS[1]];
  const sync = `${prefix}${stage.stage}`;
  const tituloDispersion = `${nombre} · ${t('f6_chart_li_density')} (Li+ ${unidad})`;
  const tituloSales = `${nombre} · ${t('f6_chart_salt_evolution')} (t/d)`;
  const opDispersion = useMemo(() => pondScatterOption({
    points: dispersion.map((p) => ({ id: p.id, x: p.liquid_density as number, y: p['Li+'] as number })),
    xName: t('f6_chart_density'), xUnit: 'kg/m3', yName: 'Li+', yUnit: unidad, seriesName: t('f6_ponds'),
    color: li, print, tools, fileName: nombreArchivo(tituloDispersion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stage, mode, print, decimals, t]);
  const opSales = useMemo(() => categoryOption({
    categories: sales.rows.map((r) => r.id), kind: 'lines', yName: '', unit: 't/d', print, tools,
    fileName: nombreArchivo(tituloSales),
    series: sales.salts.map((s) => ({ name: s, values: valores(sales.rows, s) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stage, print, decimals, t]);
  return (
    <>
      <h4 className="text-sm font-semibold pdf-block" style={{ gridColumn: '1 / -1' }}>
        {nombre} · {t('f6_per_pond')}
      </h4>
      {species.map((sp) => (
        <PondPanel key={sp} title={`${nombre} · Li+ vs ${sp} (${unidad})`} height={340} data={rows}
                   group={`${sync}-${sp}`}
                   lines={[{ key: 'Li+', name: 'Li+', color: li, unit: unidad },
                           { key: sp, name: sp, color: otra, unit: unidad }]} />
      ))}
      {dispersion.length > 0 && (
        <Panel title={tituloDispersion}>
          <EChart option={opDispersion} height={280} />
        </Panel>
      )}
      <PondPanel title={`${nombre} · ${t('f6_chart_flow_activity')}`} height={340} data={pozas} group={`${sync}-flow`}
                 lines={[{ key: 'outflow_t_d', name: t('f6_chart_outflow'), color: SERIES_COLORS[0], unit: 't/d' },
                         { key: 'water_activity', name: t('f6_chart_water_activity'), color: SERIES_COLORS[6], unit: '' }]} />
      <PondPanel title={`${nombre} · ${t('f6_chart_density')} (kg/m3)`} data={pozas}
                 lines={[{ key: 'liquid_density', name: t('f6_chart_density'), color: SERIES_COLORS[7], unit: 'kg/m3' }]} />
      <PondPanel title={`${nombre} · ${t('f6_chart_salt_total')} (t/d)`} data={pozas}
                 lines={[{ key: 'salt_precipitated_t_d', name: t('f6_chart_salt_total'), color: SERIES_COLORS[2], unit: 't/d' }]} />
      {sales.salts.length > 0 && (
        <Panel title={tituloSales} height={360}>
          <EChart option={opSales} height={360} />
        </Panel>
      )}
    </>
  );
}

/** Temperatura y evaporación de cada escenario (dos gráficos, mismo eje X, cursor compartido). */
function ClimateChart({ comparison, lines }: { comparison: ReportTable; lines: boolean }) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const filas = climateRows(comparison);
  const titulo = t('f6_chart_climate');
  const opciones = useMemo(() => [
    { key: 'temperature_C', name: t('f6_chart_temperature'), unit: '°C', color: SERIES_COLORS[1] },
    { key: 'evaporation_mm_d', name: t('f6_chart_evaporation'), unit: 'mm/d', color: SERIES_COLORS[0] },
  ].map((l) => categoryOption({
    categories: filas.map((f) => f.id), kind: lines ? 'lines' : 'bars', yName: l.name, unit: l.unit,
    legend: false, print, tools, fileName: nombreArchivo(titulo),
    series: [{ name: l.name, values: valores(filas, l.key), color: l.color }],
  })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [comparison, lines, print, decimals, t]);
  if (!filas.some((f) => f.temperature_C !== null || f.evaporation_mm_d !== null)) return null;
  return (
    <Panel title={titulo} height={340}>
      {opciones.map((o, i) => <EChart key={i} option={o} height={340} group="clima" />)}
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
  if (estatico && !comparativa) return null;
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
        {!estatico && <RecoveryPanel stages={report.stages} processKpis={report.process_kpis} />}
        {!estatico && <LiSankeyPanel stages={report.stages} dynamic />}
        {comparativa && <TableBars table={comparativa} unidades={['%']} lines={lineas} />}
        {comparativa && <TableBars table={comparativa} unidades={['t/d']} lines={lineas} />}
        {comparativa && <ClimateChart comparison={comparativa} lines={lineas} />}
        {tablas.map((tb, i) => <TableBars key={`${tb.key}-${i}`} table={tb} unidades={['t/d']} lines={lineas} />)}
        {escenarios.map((sc) => {
          const prefijo = `${t('f6_scenario')} ${sc.label} · `;
          return (
            <React.Fragment key={sc.index}>
              <RecoveryPanel stages={sc.stages} processKpis={sc.process_kpis} prefix={prefijo} />
              <LiSankeyPanel stages={sc.stages} dynamic={false} prefix={prefijo} />
              {sc.stages.filter(hasPondCharts).map((st) => (
                <StagePondCharts key={`${sc.index}-${st.stage}`} stage={st} mode={modo} prefix={prefijo} />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
