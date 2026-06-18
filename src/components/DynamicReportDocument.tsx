import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DynamicCascadeOrPostlimingResults,
  DynamicEncaladoResults,
} from '../types';
import {
  KpiCards,
  Tabla1,
  Tabla2,
  Tabla3,
  TablaCompacta,
  ChartsEncalado,
} from './DynamicResultsView';
import EncaladoResultPanel from './EncaladoResultPanel';
import { displayPondName } from '../utils/dynamicDisplayNames';

// Width of the offscreen report container (px). Charts use a fixed size so they
// render synchronously (no ResponsiveContainer measurement) and html2canvas can
// capture them reliably.
const CHART_W = 900;
const CHART_H = 240;

const CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

export type ReportStageInput =
  | {
      stage: 'cascade' | 'postliming';
      executionId: string;
      label: string;
      runTag?: string;
      results: DynamicCascadeOrPostlimingResults;
    }
  | {
      stage: 'encalado';
      executionId: string;
      label: string;
      runTag?: string;
      results: DynamicEncaladoResults;
    };

type Props = {
  projectName: string;
  generatedAt: string;
  stages: ReportStageInput[];
};

// A self-contained block that html2canvas captures as one unit (kept together
// on a page when it fits).
function Block({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pdf-block" style={{ marginBottom: 16, breakInside: 'avoid' }}>
      {title && (
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 8px',
            color: 'var(--color-text)',
          }}
        >
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

// Fixed-size, non-animated line chart over the per-pond daily pivot.
function PondChart({
  data,
  pondNames,
  metric,
  title,
  ylabel,
}: {
  data: Record<string, number>[];
  pondNames: string[];
  metric: string;
  title: string;
  ylabel: string;
}) {
  return (
    <Block title={title}>
      <LineChart width={CHART_W} height={CHART_H} data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="day" label={{ value: 'Día', position: 'insideBottom', offset: -2 }} />
        <YAxis label={{ value: ylabel, angle: -90, position: 'insideLeft' }} />
        <Legend />
        {pondNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={`${name}__${metric}`}
            name={displayPondName(name)}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Block>
  );
}

function CascadeOrPostlimingReport({
  results,
}: {
  results: DynamicCascadeOrPostlimingResults;
}) {
  const { pond_names, daily_series, default_chart_species } = results;

  const pivot = useMemo(() => {
    const dayMap = new Map<number, Record<string, number>>();
    for (const name of pond_names) {
      for (const s of daily_series[name] || []) {
        if (!dayMap.has(s.day)) dayMap.set(s.day, { day: s.day });
        const row = dayMap.get(s.day)!;
        row[`${name}__inflow_ton`] = s.inflow_ton;
        row[`${name}__height_m`] = s.height_m;
        const rec = s as unknown as Record<string, number>;
        for (const sp of default_chart_species) {
          row[`${name}__${sp}_pct`] = rec[`${sp}_pct`] ?? 0;
        }
        row[`${name}__Li+_pct`] = rec['Li+_pct'] ?? 0;
      }
    }
    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  }, [pond_names, daily_series, default_chart_species]);

  return (
    <div>
      <Block title="KPIs">
        <KpiCards results={results} />
      </Block>
      <Block title="Tabla 1 · Balance global por poza">
        <Tabla1 results={results} />
      </Block>
      <Block title="Tabla 2A · Composición %w/w">
        <Tabla2 results={results} initialUnit="pct" />
      </Block>
      <Block title="Tabla 2B · Composición t/año">
        <Tabla2 results={results} initialUnit="ton" />
      </Block>
      <Block title="Tabla 3A · Sales t/año">
        <Tabla3 results={results} initialUnit="ton" />
      </Block>
      <Block title="Tabla 3B · Sales %w/w">
        <Tabla3 results={results} initialUnit="pct" />
      </Block>
      <Block title="Tabla compacta">
        <TablaCompacta results={results} />
      </Block>
      <PondChart data={pivot} pondNames={pond_names} metric="inflow_ton" title="Flujos de entrada por poza" ylabel="t/d" />
      <PondChart data={pivot} pondNames={pond_names} metric="height_m" title="Altura por poza" ylabel="m" />
      <PondChart data={pivot} pondNames={pond_names} metric="Li+_pct" title="Li% por poza (por día)" ylabel="%" />
      {default_chart_species.map((sp) => (
        <PondChart
          key={sp}
          data={pivot}
          pondNames={pond_names}
          metric={`${sp}_pct`}
          title={`Composición ${sp} por poza`}
          ylabel="%w/w"
        />
      ))}
    </div>
  );
}

function EncaladoReport({ results }: { results: DynamicEncaladoResults }) {
  return (
    <div>
      <Block title="KPIs">
        <KpiCards results={results} />
      </Block>
      <Block title="Gráficos encalado">
        <ChartsEncalado results={results} />
      </Block>
      {results.encalado_result_averaged && (
        <Block title={`Detalle encalado (promedio de ${results.n_days_averaged ?? 0} días con feed)`}>
          <EncaladoResultPanel
            stageLabel="Encalado"
            result={results.encalado_result_averaged as Record<string, unknown>}
            temperature_C={results.encalado_temperature_C}
          />
        </Block>
      )}
    </div>
  );
}

/**
 * Flat, print-friendly rendering of one or more dynamic stages, consumed by
 * generatePdfFromContainer (utils/pdfReport). Rendered offscreen during export.
 */
export default function DynamicReportDocument({
  projectName,
  generatedAt,
  stages,
}: Props) {
  return (
    <div
      style={{
        width: 1000,
        padding: 24,
        background: '#ffffff',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body, sans-serif)',
      }}
    >
      <div className="pdf-block" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
          Reporte Modelo Dinámico
        </h1>
        <p style={{ margin: '0 0 2px', color: 'var(--color-text-secondary)' }}>
          Proyecto: <strong>{projectName}</strong>
        </p>
        <p style={{ margin: '0 0 12px', color: 'var(--color-text-secondary)' }}>
          Generado: {generatedAt}
        </p>
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Etapa</th>
              <th style={{ textAlign: 'left' }}>Ejecución (ID)</th>
              <th style={{ textAlign: 'left' }}>Tag</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.executionId}>
                <td>{s.label}</td>
                <td style={{ fontFamily: 'monospace' }}>{s.executionId}</td>
                <td style={{ fontFamily: 'monospace' }}>{s.runTag ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stages.map((s) => (
        <div key={s.executionId}>
          <div
            className="pdf-block pdf-page-break"
            style={{
              marginTop: 8,
              marginBottom: 12,
              paddingBottom: 4,
              borderBottom: '2px solid var(--color-primary)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {s.label}{' '}
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                {s.executionId.slice(0, 8)}
              </span>
            </h2>
          </div>
          {s.stage === 'encalado' ? (
            <EncaladoReport results={s.results} />
          ) : (
            <CascadeOrPostlimingReport results={s.results} />
          )}
        </div>
      ))}
    </div>
  );
}
