/**
 * Un reporte del backend (`app/reporting`), dibujado tal cual: KPIs y tablas con sus
 * columnas y unidades. El front no calcula nada (§16): solo pone etiquetas y formato.
 */
import React, { useState } from 'react';
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

export function ReportTableView({ table }: { table: ReportTable }) {
  useDecimals();
  const { label } = useLabels();
  const columnas = table.columns.filter((c) => c.key !== 'id');
  return (
    <div className="card overflow-x-auto mb-4 pdf-block" data-testid={`report-table-${table.key}`}>
      <div className="px-3 py-2 text-sm font-semibold"
           style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}>
        {label(`result.${table.key}`, table.key)}
      </div>
      <table className="text-sm">
        <thead>
          <tr>
            <th />
            {columnas.map((c) => (
              <th key={c.key} className="text-right whitespace-nowrap"
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
                <td className="font-medium whitespace-nowrap" title={deFila}>
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
      {table.notes.length > 0 && (
        <ul className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {table.notes.map((n) => <li key={n}>{label(`result.${n}`, n)}</li>)}
        </ul>
      )}
    </div>
  );
}

export function KpiCards({ kpis }: { kpis: Record<string, number | null> }) {
  const { label } = useLabels();
  const entradas = Object.entries(kpis);
  if (entradas.length === 0) return null;
  return (
    <div className="grid gap-3 mb-4 pdf-block" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {entradas.map(([k, v]) => (
        <div key={k} className="card p-3" data-testid={`kpi-${k}`}>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {label(`result.${k}`, k)}
          </div>
          <div className="text-lg font-semibold font-mono">{formatCell(v)}</div>
        </div>
      ))}
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

function StageBlock({ stage }: { stage: StageReport }) {
  const t = useT();
  return (
    <section className="mb-6">
      <h3 className="text-base font-semibold mb-2 pdf-block">{t(`f6_stage_${stage.stage}` as never)}</h3>
      <KpiCards kpis={stage.kpis} />
      {stage.tables.map((t) => <ReportTableView key={t.key} table={t} />)}
    </section>
  );
}

function DynamicReportView({ report }: { report: DynamicReport }) {
  const t = useT();
  const { label } = useLabels();
  return (
    <div>
      <p className="text-sm mb-3 pdf-block" style={{ color: 'var(--color-text-secondary)' }}>
        {t('f6_period')}: {dmy(report.period.start)} – {dmy(report.period.end)} ({report.period.n_days} {t('f6_days')})
        {report.params.scale_factor !== 1 && ` · ${t('f6_scale_factor')}: ${report.params.scale_factor}`}
      </p>
      {Object.keys(report.process_kpis).length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-2 pdf-block">{t('f6_process_full')}</h3>
          <KpiCards kpis={report.process_kpis} />
        </section>
      )}
      <RecoveryBars stages={report.stages} processKpis={report.process_kpis} />
      {report.stages.map((s) => <StageBlock key={s.stage} stage={s} />)}
      {report.global_balance && <ReportTableView table={report.global_balance} />}
    </div>
  );
}

function ScenarioBlock({ sc }: { sc: StaticReport['scenarios'][number] }) {
  const t = useT();
  return (
    <>
      {sc.status === 'failed' && (
        <div className="card p-3 mb-3 text-sm pdf-block" style={{ borderColor: '#fca5a5' }}>
          {t('f6_scenario_failed')} ({sc.failed_stage ?? '–'}): {sc.error_message}
        </div>
      )}
      <p className="text-sm mb-3 pdf-block" style={{ color: 'var(--color-text-secondary)' }}>
        {sc.temperature_C ?? '–'} °C · {sc.evaporation_mm_d ?? '–'} mm/d
      </p>
      {Object.keys(sc.process_kpis).length > 0 && <KpiCards kpis={sc.process_kpis} />}
      <RecoveryBars stages={sc.stages} processKpis={sc.process_kpis} />
      {sc.stages.map((s) => <StageBlock key={s.stage} stage={s} />)}
      {sc.global_balance && <ReportTableView table={sc.global_balance} />}
    </>
  );
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
      <ReportTableView table={report.comparison} />
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

export default function ReportView({ report, printAll, scenario, onScenario }: {
  report: Report; printAll?: boolean; scenario?: number; onScenario?: (i: number) => void;
}) {
  return isStaticReport(report)
    ? <StaticReportView report={report} printAll={printAll} scenario={scenario} onScenario={onScenario} />
    : <DynamicReportView report={report} />;
}
