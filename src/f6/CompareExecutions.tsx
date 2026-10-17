/**
 * Comparación con otras ejecuciones del mismo proyecto y tipo (hasta 3), sobre el mismo
 * gráfico: en el dinámico, una serie diaria elegida de cada una (mismo período); en el
 * estático, un indicador de la comparativa por escenario. Cada ejecución con su trazo.
 * Los valores salen tal cual de `/series` y `/report` de cada una.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  apiError, getExecutionSeries, getReport, isDynamicType, listExecutions,
  type ExecutionDetail, type ExecutionSummary, type ReportQuery,
} from '../services/apiV2';
import type { DailySeries, Report } from '../types/report';
import { isStaticReport } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import { useDecimals } from '../context/DecimalsContext';
import { useLabels } from './labels';
import { dmy } from './common';
import {
  SERIES_COLORS, chartLayout, comparisonColumns, seriesOnDates, unionDates, type SeriesRef,
} from './chartData';
import { COMPARE_LINE_TYPES, categoryOption, dailyLineOption } from './chartOptions';
import { EChart, useChartPrint } from './EChart';
import { Panel, nombreArchivo, useTools } from './chartPanel';

export const MAX_COMPARE = 3;

/** Una ejecución resumida tiene resultados para comparar. */
export function summaryHasResults(e: ExecutionSummary): boolean {
  if (isDynamicType(e.execution_type)) return (e.last_completed_day ?? 0) >= 1 && e.upload_status === 'uploaded';
  return e.status === 'completed' || e.has_partial_results;
}

type Ejecucion = Pick<ExecutionSummary, 'id' | 'run_tag' | 'start_date' | 'started_at'>;

/** "Ejecución <id8> <run_tag> <fecha>" (la fecha de inicio de la simulación o de la corrida). */
export function executionLegend(e: Ejecucion, palabra: string): string {
  const fecha = e.start_date ?? e.started_at?.slice(0, 10) ?? null;
  return [palabra, e.id.slice(0, 8), e.run_tag, fecha ? dmy(fecha) : null].filter(Boolean).join(' ');
}

interface Cargada<T> { exec: Ejecucion; data: T | null; error: string | null }

export default function CompareExecutions({ detail, query, ids: idsIniciales = [], onChange, onSettled }: {
  detail: ExecutionDetail; query: ReportQuery;
  /** Las ejecuciones elegidas al abrir (la vista de impresión las recibe en la URL). */
  ids?: string[];
  onChange?: (ids: string[]) => void;
  /** Avisa cuando ya está todo cargado (o falló): la vista de impresión espera esto. */
  onSettled?: () => void;
}) {
  const t = useT();
  const print = useChartPrint();
  const dinamico = isDynamicType(detail.execution_type);
  const [candidatas, setCandidatas] = useState<ExecutionSummary[] | null>(null);
  const [ids, setIds] = useState<string[]>(idsIniciales.slice(0, MAX_COMPARE));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listExecutions(detail.project_id)
      .then((l) => { if (vivo) setCandidatas(l.filter((e) => e.id !== detail.id
        && e.execution_type === detail.execution_type && summaryHasResults(e))); })
      .catch((err) => { if (vivo) setError(apiError(err).message); });
    return () => { vivo = false; };
  }, [detail.id, detail.project_id, detail.execution_type]);

  const elegir = (id: string) => {
    const nuevos = ids.includes(id) ? ids.filter((x) => x !== id)
      : ids.length < MAX_COMPARE ? [...ids, id] : ids;
    setIds(nuevos);
    onChange?.(nuevos);
  };

  const otras = (candidatas ?? []).filter((e) => ids.includes(e.id));
  const sinNada = (candidatas !== null || error !== null) && otras.length === 0;
  useEffect(() => { if (sinNada) onSettled?.(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sinNada]);
  if (print && otras.length === 0) return null;
  return (
    <section className="mb-6" data-testid="compare-executions">
      <h3 className="text-base font-semibold mb-2 pdf-block">{t('f6_compare')}</h3>
      {!print && (
        <div className="card p-3 mb-3 no-print">
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_compare_hint')}</p>
          {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          {candidatas && candidatas.length === 0 && <p className="text-sm">{t('f6_compare_none')}</p>}
          <div className="flex flex-wrap gap-1" data-testid="compare-candidates">
            {(candidatas ?? []).map((e) => (
              <button key={e.id} className={`btn btn-sm ${ids.includes(e.id) ? 'btn-primary' : 'btn-outline'}`}
                      style={{ textTransform: 'none' }} aria-pressed={ids.includes(e.id)}
                      disabled={!ids.includes(e.id) && ids.length >= MAX_COMPARE}
                      onClick={() => elegir(e.id)}>
                {executionLegend(e, t('f6_execution_label'))}
              </button>
            ))}
          </div>
        </div>
      )}
      {otras.length > 0 && (dinamico
        ? <CompareDaily detail={detail} otras={otras} query={query} onSettled={onSettled} />
        : <CompareStatic detail={detail} otras={otras} query={query} onSettled={onSettled} />)}
    </section>
  );
}

/** Carga `cargar` para la ejecución actual y las otras; cada una con su error aparte. */
function useCargadas<T>(detail: ExecutionDetail, otras: Ejecucion[], clave: string,
  cargar: (id: string) => Promise<T>, onSettled?: () => void): Cargada<T>[] | null {
  const [res, setRes] = useState<Cargada<T>[] | null>(null);
  const todas: Ejecucion[] = useMemo(() => [detail as unknown as Ejecucion, ...otras],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail.id, otras.map((o) => o.id).join(',')]);
  useEffect(() => {
    let vivo = true;
    Promise.allSettled(todas.map((e) => cargar(e.id))).then((r) => {
      if (!vivo) return;
      setRes(r.map((x, i) => ({ exec: todas[i], data: x.status === 'fulfilled' ? x.value : null,
        error: x.status === 'rejected' ? apiError(x.reason).message : null })));
      onSettled?.();
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas, clave]);
  return res;
}

function Errores({ lista }: { lista: Cargada<unknown>[] }) {
  const t = useT();
  const malas = lista.filter((c) => c.error);
  if (malas.length === 0) return null;
  return (
    <ul className="text-xs mb-2 no-print" style={{ color: 'var(--color-danger)' }}>
      {malas.map((c) => <li key={c.exec.id}>{executionLegend(c.exec, t('f6_execution_label'))}: {c.error}</li>)}
    </ul>
  );
}

interface SubProps { detail: ExecutionDetail; otras: Ejecucion[]; query: ReportQuery; onSettled?: () => void }

function CompareDaily({ detail, otras, query, onSettled }: SubProps) {
  const t = useT();
  const { label } = useLabels();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const cargadas = useCargadas<DailySeries>(detail, otras, `${query.period_start}|${query.period_end}`,
    (id) => getExecutionSeries(id, query), onSettled);
  const actual = cargadas?.[0]?.data ?? null;
  // Variables: los grupos de la ejecución actual y la composición de cada especie.
  const variables = useMemo(() => {
    if (!actual) return [];
    const nombre = (k: string) => {
      const v = t(`f6_series_${k}` as never);
      return v && v !== `f6_series_${k}` ? v : label(`result.${k}`, k);
    };
    return [
      ...actual.groups.map((g) => ({ key: g.key, unit: g.unit, title: nombre(g.key),
        series: g.series.map((s) => ({ key: s.key, name: s.pond || s.species || s.salt ? s.key : label(`result.${s.key}`, s.key) })) })),
      ...(actual.composition?.species ?? []).map((sp) => ({ key: `composition_${sp}`, unit: '%p/p',
        title: `${t('f6_series_composition')} ${sp}`,
        series: Object.keys(actual.composition!.ponds).map((p) => ({ key: p, name: p })) })),
    ].filter((v) => v.series.length > 0);
  }, [actual, t, label]);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [serie, setSerie] = useState<string | null>(null);
  const v = variables.find((x) => x.key === grupo) ?? variables[0];
  const s = v?.series.find((x) => x.key === serie)
    ?? v?.series.find((x) => x.key === actual?.product_pond) ?? v?.series[0];
  const titulo = v && s ? `${t('f6_compare')} · ${v.title} · ${s.name}${v.unit ? ` (${v.unit})` : ''}` : '';
  const option = useMemo(() => {
    if (!cargadas || !v || !s) return null;
    const conDatos = cargadas.filter((c) => c.data);
    const fechas = unionDates(conDatos.map((c) => c.data!));
    const ref: SeriesRef = { group: v.key, series: s.key };
    const geo = chartLayout(fechas.length, 'auto', 'date', true);
    return dailyLineOption({
      categories: fechas, unit: v.unit, yName: '', axisLabel: (x) => dmy(x), tooltipTitle: (x) => dmy(x),
      interval: geo.interval, angled: true, print, tools, fileName: nombreArchivo(titulo),
      series: conDatos.map((c, i) => ({
        name: `${executionLegend(c.exec, t('f6_execution_label'))}${i === 0 ? ` ${t('f6_compare_this')}` : ''}`,
        values: seriesOnDates(c.data!, ref, fechas), index: i, width: i === 0 ? 2.2 : 1.6,
        color: SERIES_COLORS[i % SERIES_COLORS.length], lineType: COMPARE_LINE_TYPES[i % COMPARE_LINE_TYPES.length],
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargadas, v?.key, s?.key, print, decimals, t]);
  if (!cargadas) return null;
  return (
    <>
      <Errores lista={cargadas} />
      {!print && v && (
        <div className="flex flex-wrap gap-3 mb-2 text-xs no-print">
          <label className="flex gap-1 items-center">
            <span style={{ color: 'var(--color-text-secondary)' }}>{t('f6_variable')}:</span>
            <select className="input text-xs" style={{ width: 'auto' }} value={v.key} data-testid="compare-variable"
                    onChange={(e) => { setGrupo(e.target.value); setSerie(null); }}>
              {variables.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
            </select>
          </label>
          <label className="flex gap-1 items-center">
            <span style={{ color: 'var(--color-text-secondary)' }}>{t('f6_compare_series')}:</span>
            <select className="input text-xs" style={{ width: 'auto' }} value={s?.key ?? ''} data-testid="compare-series"
                    onChange={(e) => setSerie(e.target.value)}>
              {v.series.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {option && (
        <Panel title={titulo} height={320} wide>
          <EChart option={option} height={320} />
        </Panel>
      )}
    </>
  );
}

function CompareStatic({ detail, otras, query, onSettled }: SubProps) {
  const t = useT();
  const { label } = useLabels();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const cargadas = useCargadas<Report>(detail, otras, String(query.scale_factor ?? ''),
    (id) => getReport(id, { scale_factor: query.scale_factor }), onSettled);
  const actual = cargadas?.[0]?.data ?? null;
  const columnas = actual && isStaticReport(actual) ? comparisonColumns(actual.comparison) : [];
  const [col, setCol] = useState<string | null>(null);
  const c = columnas.find((x) => x.key === col)
    ?? columnas.find((x) => x.key === 'process_li_recovery_pct') ?? columnas[0];
  const nombreCol = c ? label(`result.${c.key}`, c.key) : '';
  const titulo = c ? `${t('f6_compare')} · ${nombreCol}${c.unit ? ` (${c.unit})` : ''}` : '';
  const option = useMemo(() => {
    if (!cargadas || !c) return null;
    const estaticas = cargadas.filter((x) => x.data && isStaticReport(x.data));
    const filas = (x: Cargada<Report>) => (x.data as Extract<Report, { kind: 'static' }>).comparison.rows;
    const escenarios = [...new Set(estaticas.flatMap((x) => filas(x).map((r) => String(r.id))))];
    return categoryOption({
      categories: escenarios, kind: 'lines', yName: nombreCol, unit: c.unit, print, tools,
      fileName: nombreArchivo(titulo),
      series: estaticas.map((x, i) => {
        const porId = new Map(filas(x).map((r) => [String(r.id), r[c.key]]));
        return {
          name: `${executionLegend(x.exec, t('f6_execution_label'))}${i === 0 ? ` ${t('f6_compare_this')}` : ''}`,
          values: escenarios.map((e) => { const val = porId.get(e); return typeof val === 'number' ? val : null; }),
          color: SERIES_COLORS[i % SERIES_COLORS.length], lineType: COMPARE_LINE_TYPES[i % COMPARE_LINE_TYPES.length],
        };
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargadas, c?.key, print, decimals, t, label]);
  if (!cargadas) return null;
  return (
    <>
      <Errores lista={cargadas} />
      {!print && columnas.length > 0 && (
        <label className="flex gap-1 items-center text-xs mb-2 no-print">
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('f6_compare_indicator')}:</span>
          <select className="input text-xs" style={{ width: 'auto' }} value={c?.key ?? ''} data-testid="compare-indicator"
                  onChange={(e) => setCol(e.target.value)}>
            {columnas.map((x) => <option key={x.key} value={x.key}>{label(`result.${x.key}`, x.key)}</option>)}
          </select>
        </label>
      )}
      {option && (
        <Panel title={titulo} height={320} wide>
          <EChart option={option} height={320} />
        </Panel>
      )}
    </>
  );
}
