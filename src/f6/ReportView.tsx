/**
 * Un reporte del backend (`app/reporting`), dibujado tal cual: KPIs y tablas con sus
 * columnas y unidades. El front no calcula nada (§16): solo pone etiquetas y formato.
 */
import React, { createContext, useContext, useState } from 'react';
import type {
  DynamicReport, Report, ReportColumn, ReportTable, StageReport, StaticReport,
} from '../types/report';
import { isStaticReport } from '../types/report';
import { fmtNum } from '../utils/numberFormat';
import { useDecimals } from '../context/DecimalsContext';
import { useLabels, type LabelFn } from './labels';
import { useT } from '../i18n/LanguageContext';
import { dmy } from './common';
import { recoveries } from './chartData';

/** Decimales por defecto: más para valores chicos (fracciones, concentraciones). */
export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '–';
  if (typeof v === 'boolean') return v ? '✓' : '–';
  if (typeof v === 'number') {
    const abs = Math.abs(v);
    return fmtNum(v, abs !== 0 && abs < 1 ? 4 : 2) || '–';
  }
  return String(v);
}

export function columnHeader(c: ReportColumn, label: LabelFn): string {
  const nombre = c.kind === 'label' ? label(`result.${c.key}`, c.key) : c.key;
  return c.unit ? `${nombre} (${c.unit})` : nombre;
}

/**
 * Una fórmula del backend (con nombres internos) para leer: cada nombre con su etiqueta
 * del diccionario, y debajo la fórmula tal cual. Sin etiqueta, el nombre queda igual.
 */
export function formulaText(formula: string, label: LabelFn): string {
  const legible = formula.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (tok) => label(`result.${tok}`, tok));
  return legible === formula ? formula : `${legible}\n${formula}`;
}

const MARCA: React.CSSProperties = { color: 'var(--color-primary)', cursor: 'help', marginLeft: 4 };

/** Lo que identifica la fila: las pozas y escenarios se llaman como los nombró el usuario. */
export function rowHeader(table: ReportTable, id: string, label: LabelFn): string {
  if (table.row_kind === 'pond' || table.row_kind === 'scenario' || table.row_kind === 'salt') {
    return id;
  }
  return label(`result.${id}`, id);
}

/**
 * Orden de columnas de la "Tabla 1" de antes (balance por poza): área, entrada,
 * evaporación (t y mm/d), salida, fugas, impregnación (t y % de la salida), sal
 * precipitada; lo demás después, como venga. En otras tablas por poza, el área primero.
 */
const ORDEN_TABLA_1 = ['area_m2', 'inflow_t', 'inflow_t_d_avg', 'inflow_t_d', 'evaporation_t', 'evaporation_t_d_avg',
  'evaporation_t_d', 'evaporation_mm_d_avg', 'outflow_t', 'outflow_t_d_avg', 'outflow_t_d', 'leakage_t',
  'leakage_t_d_avg', 'leakage_t_d', 'entrainment_t', 'entrainment_t_d_avg', 'entrainment_t_d',
  'entrainment_of_outflow_pct', 'salt_precipitated_t', 'salt_precipitated_t_d_avg', 'salt_precipitated_t_d'];

export function orderColumns(table: ReportTable): ReportColumn[] {
  const columnas = table.columns.filter((c) => c.key !== 'id');
  const orden = table.key === 'pond_balance' ? ORDEN_TABLA_1 : table.row_kind === 'pond' ? ['area_m2'] : [];
  const lugar = (c: ReportColumn) => (orden.includes(c.key) ? orden.indexOf(c.key) : orden.length);
  return [...columnas].sort((a, b) => lugar(a) - lugar(b));
}

/**
 * Al imprimir (vista de impresión, "Bajar PDF", "Imprimir"), una tabla ancha no cabe en
 * la hoja y se cortaba a la derecha: se parte en bloques de columnas, cada uno con la
 * columna de la fila, como el PDF del servidor ("columnas 1–8 de 15"). En pantalla es una
 * sola tabla con la primera columna fija al desplazarse.
 */
export const PRINT_COLUMNS = 7;
export const PrintTablesContext = createContext(false);

export function splitColumns<T>(cols: T[], max: number): T[][] {
  if (cols.length === 0) return [[]];
  const bloques: T[][] = [];
  for (let i = 0; i < cols.length; i += max) bloques.push(cols.slice(i, i + max));
  return bloques;
}

function TableBody({ table, columnas, label, print = false }: {
  table: ReportTable; columnas: ReportColumn[]; label: LabelFn; print?: boolean;
}) {
  return (
    <table className={print ? 'text-xs print-table' : 'text-sm'}>
      <thead>
        <tr>
          <th className="sticky-col" />
          {columnas.map((c) => (
            <th key={c.key} className={`text-right ${print ? '' : 'whitespace-nowrap'}`}
                style={c.kind === 'label' ? undefined : { textTransform: 'none' }}
                title={c.formula ? formulaText(c.formula, label) : undefined}>
              {columnHeader(c, label)}
              {c.formula && <span style={MARCA} aria-label={formulaText(c.formula, label)}>ⓘ</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, i) => {
          const deFila = typeof r.formula === 'string' && r.formula ? formulaText(r.formula, label) : undefined;
          return (
            <tr key={`${r.id}-${i}`}>
              <td className="font-medium whitespace-nowrap sticky-col" title={deFila}>
                {rowHeader(table, String(r.id), label)}
                {deFila && <span style={MARCA} aria-label={deFila}>ⓘ</span>}
              </td>
              {columnas.map((c) => {
                // La celda derivada lleva la fórmula de su columna o, si no, la de su fila.
                const f = c.formula ? formulaText(c.formula, label) : (typeof r[c.key] === 'number' ? deFila : undefined);
                return (
                  <td key={c.key} className="text-right font-mono" title={f}
                      style={f ? { cursor: 'help' } : undefined}>{formatCell(r[c.key])}</td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ReportTableView({ table }: { table: ReportTable }) {
  useDecimals();
  const { label } = useLabels();
  const t = useT();
  const impresa = useContext(PrintTablesContext);
  const columnas = orderColumns(table);
  const bloques = impresa ? splitColumns(columnas, PRINT_COLUMNS) : [columnas];
  const titulo = label(`result.${table.key}`, table.key);
  const notas = table.notes.length > 0 && (
    <ul className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      {table.notes.map((n) => <li key={n}>{label(`result.${n}`, n)}</li>)}
    </ul>
  );
  const cabeza = (sub?: string) => (
    <div className="px-3 py-2 text-sm font-semibold"
         style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}>
      {titulo}
      {sub && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>{sub}</span>}
    </div>
  );
  if (impresa) {
    // Cada bloque es su propio `.pdf-block`: el PDF corta entre bloques y no dentro.
    return (
      <div className="mb-4" data-testid={`report-table-${table.key}`}>
        {bloques.map((cols, k) => {
          const desde = k * PRINT_COLUMNS + 1;
          const sub = bloques.length === 1 ? undefined : t('f6_columns_range').replace('{a}', String(desde))
            .replace('{b}', String(desde + cols.length - 1)).replace('{n}', String(columnas.length));
          return (
            <div key={k} className="card mb-2 pdf-block">
              {cabeza(sub)}
              <TableBody table={table} columnas={cols} label={label} print />
              {k === bloques.length - 1 && notas}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto mb-4 pdf-block report-table" data-testid={`report-table-${table.key}`}>
      {cabeza()}
      <TableBody table={table} columnas={columnas} label={label} />
      {notas}
    </div>
  );
}

/** Las tarjetas que iban primero en el reporte de antes: recuperación, producción de Li y
 * convergencia del AQSOL; después las demás, como las manda el backend. */
export const KPI_FIRST = ['li_recovery_pct', 'li_out_t_y', 'aqsol_converged_pct'];
/** Van dentro de la tarjeta de la convergencia del AQSOL, no solas. */
const KPI_IN_AQSOL = ['n_aqsol_failed_days', 'n_aqsol_ok_days', 'n_aqsol_days'];

export function orderKpis(kpis: Record<string, number | null>): [string, number | null][] {
  const entradas = Object.entries(kpis).filter(([k]) => !KPI_IN_AQSOL.includes(k));
  const lugar = (k: string) => (KPI_FIRST.includes(k) ? KPI_FIRST.indexOf(k) : KPI_FIRST.length);
  return [...entradas].sort((a, b) => lugar(a[0]) - lugar(b[0]));
}

export function KpiCards({ kpis }: { kpis: Record<string, number | null> }) {
  const { label } = useLabels();
  const t = useT();
  const entradas = orderKpis(kpis);
  if (entradas.length === 0) return null;
  // "AQSOL convergencia" como antes: "x %" y debajo los días (ok/total si el reporte los
  // trae; si no, los que fallaron).
  const aqsol = (v: number | null) => {
    const ok = kpis.n_aqsol_ok_days;
    const total = kpis.n_aqsol_days;
    const fallas = kpis.n_aqsol_failed_days;
    const sub = typeof ok === 'number' && typeof total === 'number' ? `(${formatCell(ok)}/${formatCell(total)} ${t('f6_days')})`
      : typeof fallas === 'number' ? `(${fallas} ${t('dynres_days_failed')})` : null;
    return { titulo: t('aqsol_convergence'), valor: v === null ? '–' : `${formatCell(v)} %`, sub };
  };
  return (
    <div className="grid gap-3 mb-4 pdf-block" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {entradas.map(([k, v]) => {
        const c = k === 'aqsol_converged_pct' ? aqsol(v) : { titulo: label(`result.${k}`, k), valor: formatCell(v), sub: null };
        return (
          <div key={k} className="card p-3" data-testid={`kpi-${k}`}>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.titulo}</div>
            <div className="text-lg font-semibold font-mono">{c.valor}</div>
            {c.sub && <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{c.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Recuperación de Li de cada etapa y del proceso (si el reporte la trae) como barras
 * horizontales de 0 a 100 %, junto a las tarjetas de KPIs (que siguen igual).
 */
export function RecoveryBars({ stages, processKpis }: {
  stages: StageReport[]; processKpis: Record<string, number | null>;
}) {
  useDecimals();
  const t = useT();
  const filas = recoveries(stages, processKpis);
  // Con una sola etapa y sin proceso, la tarjeta de KPIs ya lo dice todo.
  if (filas.length < 2 || !filas.some((f) => f.value !== null)) return null;
  return (
    <div className="card p-3 mb-4 pdf-block" data-testid="recovery-bars" style={{ maxWidth: 640 }}>
      <div className="text-sm font-semibold mb-2">{t('f6_recovery_panel')} (%)</div>
      {filas.map((f) => {
        const ancho = f.value === null ? 0 : Math.max(0, Math.min(100, f.value));
        return (
          <div key={f.key} className="flex items-center gap-3 text-sm mb-1">
            <span style={{ width: 190, color: 'var(--color-text-secondary)' }}>
              {f.key === 'process' ? t('f6_process_full') : t(`f6_stage_${f.key}` as never)}
            </span>
            <div className="flex-1 rounded" style={{ height: 10, background: 'var(--color-border)' }}
                 role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.value ?? undefined}>
              <div className="rounded" style={{ height: 10, width: `${ancho}%`,
                background: f.key === 'process' ? '#1baf7a' : 'var(--color-primary)' }} />
            </div>
            <span className="font-mono text-right" style={{ width: 84 }}>
              {f.value === null ? '–' : `${formatCell(f.value)} %`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Sub-pestañas de "Resultados" en pantalla: el resumen (KPIs del proceso, recuperación y
 * la comparativa de escenarios), una por etapa y el balance global. Impreso, todo.
 */
export type ResultSection = 'summary' | `stage:${string}` | 'global';
const SectionContext = createContext<ResultSection | null>(null);
const useVer = () => {
  const actual = useContext(SectionContext);
  return (k: ResultSection) => actual === null || actual === k;
};

export function resultSections(report: Report, scenario = 0): ResultSection[] {
  const fuente = isStaticReport(report)
    ? report.scenarios[Math.min(scenario, report.scenarios.length - 1)] : report;
  const out: ResultSection[] = ['summary'];
  (fuente?.stages ?? []).forEach((st) => out.push(`stage:${st.stage}`));
  if (fuente?.global_balance) out.push('global');
  return out;
}

/** Tablas del detalle de la planta (el "Detalle planta de reactivos" de antes). */
const LIMING_DETAIL = ['liming_steps', 'liming_step_composition', 'liming_reagent_detail'];

function StageBlock({ stage }: { stage: StageReport }) {
  const t = useT();
  const detalle = stage.tables.filter((tb) => LIMING_DETAIL.includes(tb.key));
  const dias = detalle.flatMap((tb) => tb.rows).map((r) => r.n_days_averaged).find((v) => typeof v === 'number');
  return (
    <section className="mb-6">
      <h3 className="text-base font-semibold mb-2 pdf-block">{t(`f6_stage_${stage.stage}` as never)}</h3>
      <KpiCards kpis={stage.kpis} />
      {stage.tables.filter((tb) => !LIMING_DETAIL.includes(tb.key)).map((tb) => <ReportTableView key={tb.key} table={tb} />)}
      {detalle.length > 0 && (
        <>
          <h4 className="text-sm font-semibold mb-2 pdf-block" data-testid="liming-detail">
            {t('dynreport_reagent_detail_prefix')} {dias ?? '–'} {t('dynreport_reagent_detail_suffix')}
          </h4>
          {detalle.map((tb) => <ReportTableView key={tb.key} table={tb} />)}
        </>
      )}
    </section>
  );
}

function DynamicReportView({ report }: { report: DynamicReport }) {
  const t = useT();
  const ver = useVer();
  return (
    <div>
      {ver('summary') && <p className="text-sm mb-3 pdf-block" style={{ color: 'var(--color-text-secondary)' }}>
        {t('f6_period')}: {dmy(report.period.start)} – {dmy(report.period.end)} ({report.period.n_days} {t('f6_days')})
        {report.params.scale_factor !== 1 && ` · ${t('f6_scale_factor')}: ${report.params.scale_factor}`}
      </p>}
      {ver('summary') && Object.keys(report.process_kpis).length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-2 pdf-block">{t('f6_process_full')}</h3>
          <KpiCards kpis={report.process_kpis} />
        </section>
      )}
      {ver('summary') && <RecoveryBars stages={report.stages} processKpis={report.process_kpis} />}
      {report.stages.filter((s) => ver(`stage:${s.stage}`)).map((s) => <StageBlock key={s.stage} stage={s} />)}
      {ver('global') && report.global_balance && <ReportTableView table={report.global_balance} />}
    </div>
  );
}

function ScenarioBlock({ sc }: { sc: StaticReport['scenarios'][number] }) {
  const t = useT();
  const ver = useVer();
  return (
    <>
      {ver('summary') && sc.status === 'failed' && (
        <div className="card p-3 mb-3 text-sm pdf-block" style={{ borderColor: '#fca5a5' }}>
          {t('f6_scenario_failed')} ({sc.failed_stage ?? '–'}): {sc.error_message}
        </div>
      )}
      {ver('summary') && (
        <p className="text-sm mb-3 pdf-block" style={{ color: 'var(--color-text-secondary)' }}>
          {sc.temperature_C ?? '–'} °C · {sc.evaporation_mm_d ?? '–'} mm/d
        </p>
      )}
      {ver('summary') && Object.keys(sc.process_kpis).length > 0 && <KpiCards kpis={sc.process_kpis} />}
      {ver('summary') && <RecoveryBars stages={sc.stages} processKpis={sc.process_kpis} />}
      {sc.stages.filter((s) => ver(`stage:${s.stage}`)).map((s) => <StageBlock key={s.stage} stage={s} />)}
      {ver('global') && sc.global_balance && <ReportTableView table={sc.global_balance} />}
    </>
  );
}

function ComparisonInSummary({ table }: { table: ReportTable }) {
  const ver = useVer();
  return ver('summary') ? <ReportTableView table={table} /> : null;
}

function StaticReportView({ report, printAll, scenario, onScenario }: {
  report: StaticReport; printAll?: boolean; scenario?: number; onScenario?: (i: number) => void;
}) {
  const t = useT();
  const [propio, setPropio] = useState(0);
  // Controlado desde fuera (para que los gráficos muestren el mismo escenario) o propio.
  const i = scenario ?? propio;
  const setI = onScenario ?? setPropio;
  const sc = report.scenarios[Math.min(i, report.scenarios.length - 1)];
  if (printAll) {
    // Para imprimir: todos los escenarios, uno detrás del otro, cada uno en su página.
    return (
      <div>
        <ReportTableView table={report.comparison} />
        {report.scenarios.map((s) => (
          <section key={s.index} className="print-page-break">
            <h3 className="text-base font-semibold mb-2 pdf-block pdf-page-break">{t('f6_scenario')} {s.label}</h3>
            <ScenarioBlock sc={s} />
          </section>
        ))}
      </div>
    );
  }
  return (
    <div>
      <ComparisonInSummary table={report.comparison} />
      {report.scenarios.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-3" role="tablist">
            {report.scenarios.map((s, j) => (
              <button key={s.index} role="tab" aria-selected={j === i}
                      className={`btn ${j === i ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setI(j)}>
                {s.label}{s.status === 'failed' ? ' ⚠' : ''}
              </button>
            ))}
          </div>
          <ScenarioBlock sc={sc} />
        </>
      )}
    </div>
  );
}

export default function ReportView({ report, printAll, paged, scenario, onScenario }: {
  report: Report; printAll?: boolean; paged?: boolean; scenario?: number; onScenario?: (i: number) => void;
}) {
  const t = useT();
  const [elegida, setElegida] = useState<ResultSection>('summary');
  const secciones = resultSections(report, scenario ?? 0);
  const seccion: ResultSection | null = paged && !printAll
    ? (secciones.includes(elegida) ? elegida : 'summary') : null;
  const nombre = (k: ResultSection) => (k === 'summary' ? t('f6_results_summary')
    : k === 'global' ? t('f6_results_global') : t(`f6_stage_${k.slice('stage:'.length)}` as never));
  const vista = isStaticReport(report)
    ? <StaticReportView report={report} printAll={printAll} scenario={scenario} onScenario={onScenario} />
    : <DynamicReportView report={report} />;
  const conSecciones = (
    <>
      {seccion !== null && secciones.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3 no-print" role="tablist" data-testid="result-sections">
          {secciones.map((k) => (
            <button key={k} role="tab" aria-selected={k === seccion}
                    className={`btn btn-sm ${k === seccion ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setElegida(k)}>
              {nombre(k)}
            </button>
          ))}
        </div>
      )}
      <SectionContext.Provider value={seccion}>{vista}</SectionContext.Provider>
    </>
  );
  return printAll ? <PrintTablesContext.Provider value>{conSecciones}</PrintTablesContext.Provider> : conSecciones;
}
