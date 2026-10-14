/**
 * Gráficos de una ejecución. Dibujan lo que devuelve el backend, sin recalcular:
 *   - dinámico: las series diarias del período (`GET /executions/{id}/series`);
 *   - todos: barras por poza o por escenario, desde las tablas del reporte.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../services/api';
import { apiError, saveBlob, type ReportQuery } from '../services/apiV2';
import type { Report, ReportTable } from '../types/report';
import { isStaticReport } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import { useLabels } from './labels';
import { formatCell } from './ReportView';

const COLORES = ['#1f6fb2', '#e07b39', '#3a9d5d', '#c0392b', '#8e44ad', '#16a085', '#d4ac0d',
  '#7f8c8d', '#2c3e50', '#e84393', '#00b894', '#6c5ce7'];
const MAX_PUNTOS = 500;

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

/** Un gráfico (SVG de recharts) como PNG, con fondo blanco y su título arriba. */
async function svgToPng(svg: SVGSVGElement, titulo: string): Promise<Blob> {
  const { width, height } = svg.getBoundingClientRect();
  const copia = svg.cloneNode(true) as SVGSVGElement;
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copia.setAttribute('width', String(width));
  copia.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)],
    { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url;
    });
    const escala = 2, cabecera = 28;
    const canvas = document.createElement('canvas');
    canvas.width = width * escala; canvas.height = (height + cabecera) * escala;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(escala, escala);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height + cabecera);
    ctx.fillStyle = '#1f2937'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(titulo, 8, 18);
    ctx.drawImage(img, 0, cabecera, width, height);
    return await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Todos los gráficos de un contenedor, como PNG en un zip. */
export async function downloadChartsZip(contenedor: HTMLElement, nombre: string): Promise<void> {
  const zip = new JSZip();
  const paneles = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-chart-title]'));
  for (const [i, p] of paneles.entries()) {
    const svg = p.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!svg) continue;
    const titulo = p.dataset.chartTitle ?? `grafico_${i + 1}`;
    const archivo = `${String(i + 1).padStart(2, '0')}_${titulo.replace(/[^\w\-]+/g, '_').slice(0, 60)}.png`;
    zip.file(archivo, await svgToPng(svg, titulo));
  }
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${nombre}.zip`);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-3 mb-4" data-chart-title={title}>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  );
}

import { dmy } from './common';

/** Una de cada k filas para no dibujar miles de puntos (la tabla del reporte tiene el detalle). */
export function thin<T>(rows: T[], max = MAX_PUNTOS): T[] {
  if (rows.length <= max) return rows;
  const k = Math.ceil(rows.length / max);
  return rows.filter((_, i) => i % k === 0 || i === rows.length - 1);
}

export function DailyCharts({ executionId, query }: { executionId: string; query: ReportQuery }) {
  const t = useT();
  const { label } = useLabels();
  const [data, setData] = useState<DailySeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eje, setEje] = useState<'date' | 'day'>('date');
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
    return todos.filter((g) => g.series.some((s) => s.values.some((v) => v !== null && v !== undefined)))
      .map((g) => ({
        ...g,
        rows: thin(data.dates.map((fecha, i) => {
          const fila: Record<string, string | number | null> = { date: fecha, day: i + 1 };
          g.series.forEach((s) => { fila[s.key] = s.values[i] ?? null; });
          return fila;
        })),
      }));
  }, [data, especies, t]);

  if (error) return <p className="text-sm mb-4" style={{ color: '#b91c1c' }}>{error}</p>;
  if (!data) return null;
  return (
    <section className="mb-6" data-testid="daily-charts" ref={caja}>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-base font-semibold">{t('f6_charts_daily')}</h3>
        <div className="flex gap-1" role="tablist">
          {(['date', 'day'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={eje === k}
                    className={`btn btn-sm ${eje === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEje(k)}>
              {k === 'date' ? t('f6_axis_dates') : t('f6_axis_days')}
            </button>
          ))}
        </div>
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
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))' }}>
        {grupos.map((g) => (
          <Panel key={g.key} title={`${g.title} (${g.unit})`}>
            <LineChart data={g.rows} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={eje} tick={{ fontSize: 10 }} minTickGap={30}
                     tickFormatter={eje === 'date' ? dmy : undefined} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatCell(v)} width={70} />
              <Tooltip formatter={(v: number) => formatCell(v)}
                       labelFormatter={(l) => (eje === 'date' ? dmy(l) : `${t('f6_day')} ${l}`)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {g.series.map((s, i) => (
                <Line key={s.key} type="monotone" dataKey={s.key} dot={false} connectNulls
                      name={s.pond ? s.key : label(`result.${s.key}`, s.key)}
                      stroke={COLORES[i % COLORES.length]}
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

function TableBars({ table, unidades, title }: { table: ReportTable; unidades: string[]; title?: string }) {
  const { label } = useLabels();
  const cols = columnas(table, unidades).slice(0, 6);
  if (cols.length === 0 || table.rows.length === 0) return null;
  return (
    <Panel title={title ?? `${label(`result.${table.key}`, table.key)} (${cols[0].unit})`}>
      <BarChart data={table.rows} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="id" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatCell(v)} width={70} />
        <Tooltip formatter={(v: number) => formatCell(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {cols.map((c, i) => (
          <Bar key={c.key} dataKey={c.key} name={label(`result.${c.key}`, c.key)}
               fill={COLORES[i % COLORES.length]} isAnimationActive={false} />
        ))}
      </BarChart>
    </Panel>
  );
}

/** Barras desde el reporte: comparativa de escenarios o el balance por poza de cada etapa. */
export function ReportCharts({ report, scenario = 0 }: { report: Report; scenario?: number }) {
  const t = useT();
  const caja = useRef<HTMLDivElement>(null);
  const etapas = isStaticReport(report) ? (report.scenarios[scenario]?.stages ?? []) : report.stages;
  const tablas = etapas.flatMap((s) => s.tables.filter((tb) => tb.row_kind === 'pond'));
  const comparativa = isStaticReport(report) ? report.comparison : null;
  if (!comparativa && tablas.length === 0) return null;
  return (
    <section className="mb-6" data-testid="report-charts" ref={caja}>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-base font-semibold">{t('f6_charts')}</h3>
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm"
                onClick={() => caja.current && downloadChartsZip(caja.current, 'graficos_reporte')}>
          {t('f6_download_charts')}
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))' }}>
        {comparativa && <TableBars table={comparativa} unidades={['%']} />}
        {comparativa && <TableBars table={comparativa} unidades={['t/d']} />}
        {tablas.map((tb, i) => <TableBars key={`${tb.key}-${i}`} table={tb} unidades={['t/d']} />)}
      </div>
    </section>
  );
}
