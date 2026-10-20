/**
 * Gráficos de una ejecución (ECharts). Dibujan lo que devuelve el backend, sin recalcular:
 *   - dinámico: las series diarias del período (`GET /executions/{id}/series`), todos los
 *     días (sin ralear), al ancho de la página, con zoom y paso de marcas;
 *   - todos: barras o líneas por poza o por escenario, desde las tablas del reporte.
 * Las opciones salen de `chartOptions` (probadas sin dibujar).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { apiError, getExecutionSeries, saveBlob, type ReportQuery } from '../services/apiV2';
import type { DailySeries, Report, ReportColumn, ReportTable, StageReport } from '../types/report';
import { isStaticReport } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { useDecimals } from '../context/DecimalsContext';
import { useLabels } from './labels';
import { dmy } from './common';
import {
  DAY_STEPS, LIMING_SALTS, LI_BRINE, SERIES_COLORS, lastStageTotals, chartLayout, climateRows, dailyGroups, dailyRows, hasPondCharts, liVsSpecies,
  pondRows, saltEvolution, saltPonds, seriesUsesOwnName, type DailyGroup, type DayStep, type Row,
} from './chartData';
import {
  categoryOption, dailyLineOption, dualAxisOption, pondScatterOption,
} from './chartOptions';
import { EChart, useChartPrint } from './EChart';
import { Panel, SmoothContext, Toggle, nombreArchivo, useSmooth, useTools } from './chartPanel';
import { LiSankeyPanel, PondHeatmap } from './ProCharts';
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

/** Las especies de la composición impresa: las 8 de siempre y el H2O, como el PDF de
 * antes y el del servidor. */
export const PRINT_SERIES_SPECIES = ['Li+', 'Mg++', 'SO4--', 'K+', 'Na+', 'Ca++', 'Cl-', 'H3BO3', 'H2O'];

/** Grilla de paneles: columnas de 460 px como mínimo, o una sola si la pantalla es más
 * angosta (nunca más ancha que la página). */
const CHART_GRID: React.CSSProperties = { gridTemplateColumns: 'repeat(auto-fill, minmax(min(460px, 100%), 1fr))' };
/** Alto de un gráfico diario en pantalla (cabe la barra de zoom) y al imprimir. */
const DAILY_HEIGHT = { screen: 320, print: 280 };

/**
 * Series diarias del período. En pantalla, cada gráfico a todo el ancho, con zoom.
 * `print` (o la vista de impresión): al ancho de la página (sin zoom, que el papel no
 * tiene) y en SVG.
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
  // Li+ ya va en "Li% por poza" (de la salmuera); las demás especies, a elección.
  const [especies, setEspecies] = useState<string[]>([]);
  const [todas, setTodas] = useState(false);
  const [pozaSales, setPozaSales] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    getExecutionSeries(executionId, query, print && !todas ? PRINT_SERIES_SPECIES : todas)
      .then((d) => { if (vivo) { setData(d); setError(null); } })
      .catch((err) => { if (vivo) setError(apiError(err).message); })
      .finally(() => { if (vivo) onSettled?.(); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId, query.period_start, query.period_end, todas, print]);

  const pozasConSal = useMemo(() => (data ? saltPonds(data) : []), [data]);
  // La poza de las sales: la elegida si sigue en la serie; si no, la de producto o la primera.
  const poza = pozaSales && pozasConSal.includes(pozaSales) ? pozaSales
    : (data?.product_pond && pozasConSal.includes(data.product_pond) ? data.product_pond : pozasConSal[0] ?? null);

  // Para imprimir, la composición de todas las especies (como el PDF de antes); en
  // pantalla, las elegidas con los botones.
  const especiesVista = print ? (data?.composition?.species ?? especies) : especies;
  const grupos = useMemo(() => (data ? dailyGroups(data, especiesVista, poza) : [])
    .map((g) => ({ ...g, rows: dailyRows(data!, g) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, especiesVista.join('|'), poza]);

  // Los gráficos que estaban en el reporte de antes llevan su título de antes (con la
  // unidad ya incluida si así se llamaban).
  const viejo = (g: DailyGroup): { texto: string; conUnidad: boolean } | null => {
    if (g.origin === 'composition') {
      return { texto: `${t('dynreport_composition_prefix')} ${g.subject} ${t('dynreport_composition_suffix')}`, conUnidad: false };
    }
    if (g.origin !== 'group') return null;
    const planta = data?.stage === 'liming';
    const claves: Record<string, [TranslationKey, boolean]> = planta
      ? { li_pct: ['dynres_enc_li_out', true], outlet_composition_pct_old: ['dynres_enc_composition_out', true],
          [LIMING_SALTS]: ['dynres_enc_total_salts', true], reagent_solutions_t_d: ['reagent_consumption', true],
          liming_flows: ['flow_out', true], so4_mg_ratio: ['so4_mg_ratio', true] }
      : { inflow_t_d: ['inflow_per_pond', false], height_m: ['height_per_pond', false],
          [LI_BRINE]: ['li_per_pond_per_day', true] };
    const c = claves[g.key];
    return c ? { texto: t(c[0]), conUnidad: c[1] } : null;
  };
  const titulo = (g: DailyGroup) => {
    const v0 = viejo(g);
    if (v0) return v0.texto;
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
      const nombre = g.unit && !viejo(g)?.conUnidad ? `${titulo(g)} (${g.unit})` : titulo(g);
      const nombreSerie = (s: (typeof g.series)[number]) => (SERIE_VIEJA[s.key] ? t(SERIE_VIEJA[s.key])
        : seriesUsesOwnName(s) ? s.key : label(`result.${s.key}`, s.key));
      return {
        key: g.key, title: nombre,
        notes: g.series.filter((s) => s.formula).map((s) => `${nombreSerie(s)}: ${s.formula}`),
        option: dailyLineOption({
          categories: categorias, unit: g.unit, yName: '', axisLabel: marca, tooltipTitle: cabeza,
          interval: geo.interval, angled: geo.angled, print, tools, fileName: nombreArchivo(nombre),
          series: g.series.map((s, i) => ({
            name: nombreSerie(s), formula: s.formula,
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
  const listaEspecies = (data.composition?.species ?? []).filter((sp) => data.stage === 'liming' || sp !== 'Li+');
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
          {t('f6_chart_zoom_hint')}
        </p>
      )}
      <div className="grid gap-3" style={CHART_GRID}>
        {opciones.map((o) => (
          <Panel key={o.key} title={o.title} notes={o.notes} wide={!print}
                 height={print ? DAILY_HEIGHT.print : DAILY_HEIGHT.screen}>
            <EChart option={o.option} height={print ? DAILY_HEIGHT.print : DAILY_HEIGHT.screen} />
          </Panel>
        ))}
        <PondHeatmap data={data} eje={eje} interval={geo.interval}
                     titleOf={(key, sp) => (sp ? `${t('f6_series_composition')} ${sp}`
                       : titulo({ key, unit: '', series: [], origin: 'group' }))} />
      </div>
    </section>
  );
}

/** Series de la planta con su nombre del reporte de antes. */
const SERIE_VIEJA: Record<string, TranslationKey> = {
  lime_slurry: 'dynres_lime_milk', cacl2_solution: 'dynres_cacl2_solution',
  steps_salt_precipitated: 'dynres_total_salts_line',
};

/** Columnas numéricas de una tabla con la unidad pedida (las de etiqueta, no especies). */
function columnas(table: ReportTable, unidades: string[]) {
  return table.columns.filter((c) => c.key !== 'id' && c.kind === 'label' && unidades.includes(c.unit)
    && table.rows.some((r) => typeof r[c.key] === 'number'));
}

const valores = (rows: Row[] | ReportTable['rows'], key: string) =>
  rows.map((r) => (typeof r[key] === 'number' ? (r[key] as number) : null));

function TableBars({ table, unidades, title, lines = false, keys, skip = [] }: {
  table: ReportTable; unidades: string[]; title?: string; lines?: boolean;
  /** Solo estas columnas, en este orden; `skip`: estas no. */
  keys?: string[]; skip?: string[];
}) {
  const { label } = useLabels();
  const { decimals } = useDecimals();
  const tools = useTools();
  const smooth = useSmooth();
  const print = useChartPrint();
  const todas = columnas(table, unidades).filter((c) => !skip.includes(c.key));
  const cols = (keys ? keys.map((k) => todas.find((c) => c.key === k)).filter((c): c is ReportColumn => Boolean(c))
    : todas).slice(0, 6);
  const nombre = title ?? `${label(`result.${table.key}`, table.key)} (${cols[0]?.unit ?? ''})`;
  const option = useMemo(() => categoryOption({ smooth,
    categories: table.rows.map((r) => String(r.id)), kind: lines ? 'lines' : 'bars',
    yName: '', unit: cols[0]?.unit ?? '', print, tools, fileName: nombreArchivo(nombre),
    series: cols.map((c) => ({ name: label(`result.${c.key}`, c.key), values: valores(table.rows, c.key) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [smooth, table, lines, print, decimals, label, nombre, cols.map((c) => c.key).join('|')]);
  if (cols.length === 0 || table.rows.length === 0) return null;
  const notas = cols.filter((c) => c.formula).map((c) => `${label(`result.${c.key}`, c.key)}: ${c.formula}`);
  return (
    <Panel title={nombre} notes={notas}>
      <EChart option={option} height={280} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Por poza (estático): los gráficos del reporte de antes (ResultCharts), en su orden:
// Li+ vs cada especie (dos ejes), Li+ vs densidad, flujo y actividad de agua (dos ejes),
// densidad, sales precipitadas y evolución de cada sal.
// ---------------------------------------------------------------------------
/** Li+ en el reporte de antes: verde y más grueso. */
const LI_COLOR = '#1baf7a';
const ESPECIE_COLOR: Record<string, string> = {
  'Na+': '#eda100', 'K+': '#6250d6', 'Mg++': '#0891b2', 'Ca++': '#eb6834', 'Cl-': '#2a78d6',
  'SO4--': '#e87ba4', H3BO3: '#008300',
};

/** Una magnitud por poza (eje X = pozas de la cascada), con su eje Y nombrado con la unidad. */
function PondLinePanel({ title, data, valueKey, name, unit, color, factor = 1, digits }: {
  title: string; data: Row[]; valueKey: string; name: string; unit: string; color: string;
  /** Solo para mostrar en otra unidad (p. ej. kg/m3 → g/cm3 = ÷ 1000). */
  factor?: number;
  digits?: number;
}) {
  const { decimals } = useDecimals();
  const tools = useTools();
  const smooth = useSmooth();
  const print = useChartPrint();
  const option = useMemo(() => categoryOption({ smooth,
    categories: data.map((r) => r.id), kind: 'lines', yName: name, unit, scale: true, print, tools, digits,
    fileName: nombreArchivo(title),
    series: [{ name, values: valores(data, valueKey).map((v) => (v === null ? null : v * factor)), color }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [smooth, data, valueKey, name, unit, factor, digits, print, decimals, title]);
  return <Panel title={title}><EChart option={option} height={280} /></Panel>;
}

interface EjeSerie { key: string; name: string; unit: string; color: string; width?: number }

/** Dos magnitudes por poza en un gráfico, cada una con su eje Y. */
function DualAxisPanel({ title, data, left, right, height = 300 }: {
  title: string; data: Row[]; left: EjeSerie; right: EjeSerie; height?: number;
}) {
  const { decimals } = useDecimals();
  const tools = useTools();
  const smooth = useSmooth();
  const print = useChartPrint();
  const option = useMemo(() => dualAxisOption({ smooth,
    categories: data.map((r) => r.id), print, tools, fileName: nombreArchivo(title),
    left: { ...left, values: valores(data, left.key) }, right: { ...right, values: valores(data, right.key) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [smooth, data, left.key, right.key, left.name, right.name, left.unit, print, decimals, title]);
  return <Panel title={title} height={height}><EChart option={option} height={height} /></Panel>;
}

function StagePondCharts({ stage, mode, prefix }: { stage: StageReport; mode: 'abs' | 'pct'; prefix: string }) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const smooth = useSmooth();
  const print = useChartPrint();
  const nombre = `${prefix}${t(`f6_stage_${stage.stage}` as never)}`;
  const unidad = mode === 'abs' ? 't/d' : '%p/p';
  const { species, rows } = liVsSpecies(stage, mode);
  const pozas = pondRows(stage, mode);
  const sales = saltEvolution(stage);
  const dispersion = pozas.filter((p) => p.liquid_density !== null && p['Li+'] !== null);
  const porPoza = t('charts_per_pond');
  const tituloDispersion = `${nombre} · Li+ (${unidad}) vs ${t('charts_density')} (kg/m3) ${porPoza}`;
  const tituloSales = `${nombre} · ${t('charts_salt_evolution')} (t/d) — ${sales.salts.length} `
    + `${sales.salts.length === 1 ? t('charts_salt_singular') : t('charts_salt_plural')}`;
  const opDispersion = useMemo(() => pondScatterOption({
    points: dispersion.map((p) => ({ id: p.id, x: p.liquid_density as number, y: p['Li+'] as number })),
    xName: t('charts_density'), xUnit: 'kg/m3', yName: 'Li+', yUnit: unidad,
    seriesName: t('charts_ponds'), color: LI_COLOR, print, tools, fileName: nombreArchivo(tituloDispersion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stage, mode, print, decimals, t]);
  const opSales = useMemo(() => categoryOption({ smooth,
    categories: sales.rows.map((r) => r.id), kind: 'lines', yName: '', unit: 't/d', print, tools,
    fileName: nombreArchivo(tituloSales),
    series: sales.salts.map((s) => ({ name: s, values: valores(sales.rows, s) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [smooth, stage, print, decimals, t]);
  return (
    <>
      <h4 className="text-sm font-semibold pdf-block" style={{ gridColumn: '1 / -1' }}>
        {nombre} · {t('charts_li_vs_components')}
      </h4>
      {species.map((sp) => (
        <DualAxisPanel key={sp} title={`${nombre} · Li+ vs ${sp} ${porPoza} (${unidad})`} data={rows}
                       left={{ key: 'Li+', name: 'Li+', unit: unidad, color: LI_COLOR, width: 3 }}
                       right={{ key: sp, name: sp, unit: unidad, color: ESPECIE_COLOR[sp] ?? SERIES_COLORS[1] }} />
      ))}
      {dispersion.length > 0 && (
        <Panel title={tituloDispersion}>
          <EChart option={opDispersion} height={300} />
        </Panel>
      )}
      <DualAxisPanel title={`${nombre} · ${t('charts_flow_water_activity')}`} data={pozas}
                     left={{ key: 'outflow_t_d', name: t('charts_outlet_flow'), unit: 't/d', color: SERIES_COLORS[0] }}
                     right={{ key: 'water_activity', name: t('props_water_activity'), unit: '', color: SERIES_COLORS[6] }} />
      {/* En g/cm3, como el PDF de antes (el backend la da en kg/m3: ÷ 1000 solo para mostrar). */}
      <PondLinePanel title={`${nombre} · ${t('charts_density_per_pond')} (g/cm3)`} data={pozas}
                     valueKey="liquid_density" name={t('charts_density')} unit="g/cm3" factor={1 / 1000} digits={4}
                     color={SERIES_COLORS[7]} />
      <PondLinePanel title={`${nombre} · ${t('charts_salts_per_pond')} (t/d)`} data={pozas}
                     valueKey="salt_precipitated_t_d" name={t('charts_precipitated_salts')} unit="t/d" color="#0891b2" />
      {sales.salts.length > 0 && (
        <Panel title={tituloSales} height={380} wide>
          <EChart option={opSales} height={380} />
        </Panel>
      )}
    </>
  );
}

const EVAP_SALES_COLS = ['precon_evaporation_t_d', 'precon_salt_precipitated_t_d',
  'postliming_evaporation_t_d', 'postliming_salt_precipitated_t_d'];

/** "Evap total / Sales total" de cada escenario (t/d), de la última etapa de pozas, como
 * el gráfico por día del estático de antes. Sin las columnas en la comparativa, no va. */
function EvapSaltsChart({ comparison, lines }: { comparison: ReportTable; lines: boolean }) {
  const t = useT();
  const { label } = useLabels();
  const { decimals } = useDecimals();
  const tools = useTools();
  const smooth = useSmooth();
  const print = useChartPrint();
  const { rows, formulas } = lastStageTotals(comparison);
  const titulo = `${t('execres_evap_total')} / ${t('execres_salts_total')} (t/d)`;
  const option = useMemo(() => categoryOption({ smooth,
    categories: rows.map((r) => r.id), kind: lines ? 'lines' : 'bars', yName: '', unit: 't/d', print, tools,
    fileName: nombreArchivo(titulo),
    series: [{ name: t('execres_evap_total'), values: valores(rows, 'evaporation_t_d') },
      { name: t('execres_salts_total'), values: valores(rows, 'salt_precipitated_t_d') }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [smooth, comparison, lines, print, decimals, t]);
  if (!rows.some((r) => r.evaporation_t_d !== null || r.salt_precipitated_t_d !== null)) return null;
  const notas = Object.entries(formulas).map(([k, f]) => `${label(`result.${k}`, k)}: ${f}`);
  return <Panel title={titulo} notes={notas}><EChart option={option} height={280} /></Panel>;
}

/** Temperatura y evaporación de cada escenario (dos gráficos, mismo eje X, cursor compartido). */
function ClimateChart({ comparison, lines }: { comparison: ReportTable; lines: boolean }) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const smooth = useSmooth();
  const print = useChartPrint();
  const filas = climateRows(comparison);
  const titulo = t('f6_chart_climate');
  const opciones = useMemo(() => [
    { key: 'temperature_C', name: t('f6_chart_temperature'), unit: '°C', color: SERIES_COLORS[1] },
    { key: 'evaporation_mm_d', name: t('f6_chart_evaporation'), unit: 'mm/d', color: SERIES_COLORS[0] },
  ].map((l) => categoryOption({ smooth,
    categories: filas.map((f) => f.id), kind: lines ? 'lines' : 'bars', yName: l.name, unit: l.unit,
    legend: false, print, tools, fileName: nombreArchivo(titulo),
    series: [{ name: l.name, values: valores(filas, l.key), color: l.color }],
  })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [smooth, comparison, lines, print, decimals, t]);
  if (!filas.some((f) => f.temperature_C !== null || f.evaporation_mm_d !== null)) return null;
  return (
    <Panel title={titulo} height={340}>
      {opciones.map((o, i) => <EChart key={i} option={o} height={340} group="clima" />)}
    </Panel>
  );
}

/** Las sub-pestañas de "Gráficos" (estático): una por etapa con pozas (los gráficos de
 * antes), la comparativa de escenarios y el balance de Li. Las de "Balance de masas"
 * (dinámico): primero el balance de Li y después el balance por poza. Al imprimir no hay
 * pestañas: salen todos. */
export type ChartGroup = `stage:${string}` | 'compare' | 'balance';

export function chartGroups(report: Report, scenario = 0): ChartGroup[] {
  if (!isStaticReport(report)) {
    const porPoza = report.stages.some((s) => s.tables.some((tb) => tb.row_kind === 'pond'));
    return porPoza ? ['balance', 'compare'] : ['balance'];
  }
  const grupos: ChartGroup[] = [];
  const sc = report.scenarios[Math.min(scenario, report.scenarios.length - 1)];
  (sc?.stages ?? []).filter(hasPondCharts).forEach((st) => grupos.push(`stage:${st.stage}`));
  if (report.comparison) grupos.push('compare');
  grupos.push('balance');
  return grupos;
}

/**
 * Gráficos desde el reporte. Estático: comparativa y clima de los escenarios, y por poza
 * cada etapa de pozas del escenario elegido (`scenario`) o de todos (`allScenarios`, para
 * imprimir). Dinámico (pestaña "Balance de masas"): el balance de Li y el balance por poza
 * de cada etapa. Barras o líneas a elección.
 */
export function ReportCharts({ report, scenario = 0, allScenarios = false, paged = false }: {
  report: Report; scenario?: number; allScenarios?: boolean; paged?: boolean;
}) {
  const t = useT();
  const caja = useRef<HTMLDivElement>(null);
  const grupos = chartGroups(report, scenario);
  const [elegido, setElegido] = useState<ChartGroup>(grupos[0]);
  const grupo: ChartGroup | null = paged ? (grupos.includes(elegido) ? elegido : grupos[0]) : null;
  const ver = (g: ChartGroup) => grupo === null || grupo === g;
  const [vista, setVista] = useState<'bars' | 'lines'>('bars');
  const [modo, setModo] = useState<'abs' | 'pct'>('abs');
  const [trazo, setTrazo] = useState<'curve' | 'straight'>('curve');
  const estatico = isStaticReport(report);
  const escenarios = estatico
    ? (allScenarios ? report.scenarios : report.scenarios.slice(scenario, scenario + 1)) : [];
  const tablas = estatico ? [] : report.stages.flatMap((s) => s.tables.filter((tb) => tb.row_kind === 'pond'));
  const comparativa = estatico ? report.comparison : null;
  const conPozas = escenarios.some((sc) => sc.stages.some(hasPondCharts));
  if (estatico && !comparativa) return null;
  const lineas = vista === 'lines';
  const nombreGrupo = (g: ChartGroup) => (g === 'balance' ? t('f6_charts_group_balance')
    : g === 'compare' ? t(estatico ? 'f6_charts_group_compare_static' : 'f6_charts_group_compare_dynamic')
      : t(`f6_stage_${g.slice('stage:'.length)}` as never));
  return (
    <section className="mb-6" data-testid="report-charts" ref={caja}>
      {grupo !== null && grupos.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3 no-print" role="tablist" data-testid="chart-groups">
          {grupos.map((g) => (
            <button key={g} role="tab" aria-selected={g === grupo}
                    className={`btn btn-sm ${g === grupo ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setElegido(g)}>
              {nombreGrupo(g)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-base font-semibold pdf-block pdf-page-break">
          {grupo === null ? t('f6_charts') : nombreGrupo(grupo)}
        </h3>
        {/* Barras o líneas: solo cambia la comparativa (los por poza son siempre líneas). */}
        {ver('compare') && (
          <Toggle value={vista} onChange={setVista} testId="chart-view"
                  options={[['bars', t('f6_view_bars')], ['lines', t('f6_view_lines')]]} />
        )}
        {conPozas && (grupo === null || grupo.startsWith('stage:')) && (
          <>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_chart_li_units')}:</span>
            <Toggle value={modo} onChange={setModo} testId="conc-mode"
                    options={[['abs', 't/d'], ['pct', '%p/p']]} />
          </>
        )}
        {/* Curva (como antes) o recta entre pozas/escenarios: lo elige el usuario. */}
        {(lineas || grupo === null || grupo.startsWith('stage:')) && (
          <Toggle value={trazo} onChange={setTrazo} testId="line-shape"
                  options={[['curve', t('f6_line_curve')], ['straight', t('f6_line_straight')]]} />
        )}
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm"
                onClick={() => caja.current && downloadChartsZip(caja.current, 'graficos_reporte')}>
          {t('f6_download_charts')}
        </button>
      </div>
      <SmoothContext.Provider value={trazo === 'curve'}>
      <div className="grid gap-3" style={CHART_GRID}>
        {/* 1) Los de siempre (reporte de antes): por poza de cada etapa. */}
        {escenarios.map((sc) => sc.stages.filter(hasPondCharts).filter((st) => ver(`stage:${st.stage}`)).map((st) => (
          <StagePondCharts key={`${sc.index}-${st.stage}`} stage={st} mode={modo}
                           prefix={`${t('f6_scenario')} ${sc.label} · `} />
        )))}
        {/* 2) Comparativa y clima de los escenarios; balance por poza del dinámico. */}
        {/* Los del estático por día de antes, ahora por escenario: recuperación, Li,
            evaporación / sales, clima. */}
        {ver('compare') && comparativa && <TableBars table={comparativa} unidades={['%']} lines={lineas} title={t('execres_recovery_pct')} />}
        {ver('compare') && comparativa && <TableBars table={comparativa} unidades={['t/d']} lines={lineas} title="Li (t/d)"
                                   keys={['li_in_t_d', 'li_out_t_d']} />}
        {ver('compare') && comparativa && <EvapSaltsChart comparison={comparativa} lines={lineas} />}
        {ver('compare') && comparativa && <ClimateChart comparison={comparativa} lines={lineas} />}
        {ver('compare') && comparativa && <TableBars table={comparativa} unidades={['t/d']} lines={lineas}
                                   skip={['li_in_t_d', 'li_out_t_d', ...EVAP_SALES_COLS]} />}
        {/* Dinámico: el balance de litio primero y después el balance por poza. */}
        {ver('balance') && !estatico && <LiSankeyPanel stages={report.stages} dynamic />}
        {ver('compare') && tablas.map((tb, i) => <TableBars key={`${tb.key}-${i}`} table={tb} unidades={['t/d']} lines={lineas} />)}
        {/* 3) Estático: los nuevos, el balance de litio de cada escenario. */}
        {ver('balance') && escenarios.map((sc) => (
          <LiSankeyPanel key={sc.index} stages={sc.stages} dynamic={false}
                         prefix={`${t('f6_scenario')} ${sc.label} · `} />
        ))}
      </div>
      </SmoothContext.Provider>
    </section>
  );
}
