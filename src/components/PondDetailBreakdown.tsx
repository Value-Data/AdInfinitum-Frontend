import React from 'react';
import type { PondResult, SolverResult } from '../types';

interface Props {
  stageLabel: string;
  result: SolverResult;
  temperature_C?: number;
}

const SPECIES = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'H+',
  'Cl-', 'HSO4-', 'SO4--', 'OH-',
  'CO2(aq)', 'HCO3-', 'CO3--',
  'H3BO3', 'B4O7--', 'BO2-',
];

function formatNum(v: number | undefined | null, digits = 4): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '-';
  if (v === 0) return '0';
  if (Math.abs(v) < 1e-4) return v.toExponential(3);
  return v.toFixed(digits);
}

type MetricExtractor = (pond: PondResult, temperature_C?: number) => string;

const METRICS: Array<{ label: string; extract: MetricExtractor }> = [
  { label: 'Sales precipitadas (ton/d)', extract: (p) => formatNum(p.salt_precipitated, 3) },
  { label: 'Masa Líquido Impregnado (ton/d)', extract: (p) => formatNum(p.entrainment, 3) },
  { label: 'Evaporación (ton/d)', extract: (p) => formatNum(p.evaporation, 3) },
  { label: 'Infiltración (ton/d)', extract: (p) => formatNum(p.leakage, 5) },
  { label: 'Densidad líquida (kg/m³)', extract: (p) => formatNum(p.aqsol_result?.density_liquid, 2) },
  { label: 'Densidad sólida (kg/m³)', extract: (p) => formatNum(p.aqsol_result?.density_solid, 2) },
  { label: 'Densidad in situ', extract: () => '-' },
  { label: 'Temperatura (°C)', extract: (_p, t) => (t != null ? formatNum(t, 1) : '-') },
  { label: 'pH', extract: (p) => formatNum(p.aqsol_result?.pH, 2) },
  { label: 'Actividad (aw)', extract: (p) => formatNum(p.aqsol_result?.water_activity, 5) },
  { label: 'Área de proceso (m²)', extract: (p) => formatNum(p.config.area_design_m2 / 1.08, 2) },
  { label: 'Área de diseño (m²)', extract: (p) => formatNum(p.config.area_design_m2, 2) },
];

function MatrixSubTable({
  title,
  caption,
  rowLabels,
  headerLabel,
  ponds,
  getValue,
}: {
  title: string;
  caption?: string;
  rowLabels: string[];
  headerLabel: string;
  ponds: PondResult[];
  getValue: (rowLabel: string, pond: PondResult) => number | null | undefined;
}) {
  if (rowLabels.length === 0) {
    return (
      <div className="mt-6">
        <h5
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {title}
        </h5>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sin datos disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h5
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h5>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '12rem' }}>{headerLabel}</th>
              {ponds.map((p, i) => (
                <th key={i}>{p.config.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((label) => (
              <tr key={label}>
                <td className="font-medium">{label}</td>
                {ponds.map((p, i) => (
                  <td key={i} className="font-mono">
                    {formatNum(getValue(label, p) ?? undefined, 5)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {caption}
        </p>
      )}
    </div>
  );
}

export default function PondDetailBreakdown({ stageLabel, result, temperature_C }: Props) {
  const ponds = result.ponds || [];

  if (ponds.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          {stageLabel}
        </h4>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No hay pozas para mostrar.
        </p>
      </div>
    );
  }

  // Collect all precipitated salts across ponds (keep only those with at least one > 0)
  const saltSet = new Set<string>();
  ponds.forEach((p) => {
    const salts = p.aqsol_result?.precipitated_salts || {};
    Object.entries(salts).forEach(([name, v]) => {
      if (typeof v === 'number' && v > 0) saltSet.add(name);
    });
  });
  const saltNames = Array.from(saltSet).sort();

  // Total precipitated per pond (for %w/w)
  const totalSolidsByPond = ponds.map((p) => {
    const direct = p.aqsol_result?.total_solids_g;
    if (typeof direct === 'number' && direct > 0) return direct;
    const salts = p.aqsol_result?.precipitated_salts || {};
    return Object.values(salts).reduce(
      (acc, v) => acc + (typeof v === 'number' && v > 0 ? v : 0),
      0,
    );
  });

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {stageLabel} — desglose por poza
      </h4>

      {/* Main metrics matrix */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '14rem' }}>Métrica</th>
              {ponds.map((p, i) => (
                <th key={i}>{p.config.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.label}>
                <td className="font-medium">{m.label}</td>
                {ponds.map((p, i) => (
                  <td key={i} className="font-mono">
                    {m.extract(p, temperature_C)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Liquid composition (flujo de traspaso) */}
      <MatrixSubTable
        title="Química de flujo de traspaso por componente (ton/d)"
        caption="Composición del líquido a la salida de cada poza."
        rowLabels={SPECIES}
        headerLabel="Especie"
        ponds={ponds}
        getValue={(label, p) => p.aqsol_result?.eq_liquid?.[label] ?? 0}
      />

      {/* Precipitated salts absolute */}
      <MatrixSubTable
        title="Composición de sales precipitadas (ton/d)"
        caption="Sales sólidas que precipitan en cada poza."
        rowLabels={saltNames}
        headerLabel="Sal"
        ponds={ponds}
        getValue={(label, p) => p.aqsol_result?.precipitated_salts?.[label] ?? 0}
      />

      {/* Precipitated salts percent w/w */}
      <MatrixSubTable
        title="Composición de sales precipitadas (%w/w)"
        caption="Fracción másica de cada sal sobre el total de sólidos precipitados de la poza."
        rowLabels={saltNames}
        headerLabel="Sal"
        ponds={ponds}
        getValue={(label, p) => {
          const idx = ponds.indexOf(p);
          const total = totalSolidsByPond[idx];
          if (!total || total <= 0) return 0;
          const v = p.aqsol_result?.precipitated_salts?.[label] ?? 0;
          return (v / total) * 100;
        }}
      />
    </div>
  );
}
