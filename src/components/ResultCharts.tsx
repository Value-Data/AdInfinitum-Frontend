import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LabelList,
} from 'recharts';
import type { SolverResult } from '../types';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

// Componentes a comparar contra Li+ (excluimos H2O por su escala).
const REFERENCE_SPECIES: Array<{ name: string; color: string }> = [
  { name: 'Na+', color: 'var(--color-warning)' },
  { name: 'K+', color: '#8b5cf6' },
  { name: 'Mg++', color: '#0891b2' },
  { name: 'Ca++', color: '#ea580c' },
  { name: 'Cl-', color: '#6366f1' },
  { name: 'SO4--', color: '#db2777' },
  { name: 'H3BO3', color: '#059669' },
];

// Especies usadas para calcular el total de líquido por poza (mismo conjunto
// que la tabla de Química de flujo de traspaso para que los % sean consistentes).
const LIQUID_TOTAL_SPECIES = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'H+',
  'Cl-', 'HSO4-', 'SO4--', 'OH-',
  'CO2(aq)', 'HCO3-', 'CO3--',
  'H3BO3', 'B4O7--', 'BO2-',
];

// Paleta para series de sales precipitadas.
const SALT_PALETTE = [
  '#0891b2', '#db2777', '#8b5cf6', '#ea580c', '#059669',
  '#6366f1', '#d97706', '#be185d', '#0d9488', '#7c3aed',
  '#dc2626', '#2563eb', '#16a34a', '#a16207', '#9333ea',
  '#0284c7', '#ca8a04', '#15803d', '#c2410c', '#4f46e5',
];

export default function ResultCharts({ stageLabel, result }: Props) {
  const ponds = result.ponds || [];
  const [concentrationView, setConcentrationView] = useState<'abs' | 'pct'>('abs');

  // Total de líquido por poza (suma de las 17 especies) para conversión a %.
  const liquidTotalsByPond = ponds.map((p) => {
    const eq = p.aqsol_result?.eq_liquid ?? {};
    return LIQUID_TOTAL_SPECIES.reduce((acc, sp) => acc + (eq[sp] ?? 0), 0);
  });

  // Concentration comparison: Li+ (reference) vs other main species on dual axis
  const concentrationData = ponds.map((p, idx) => {
    const eq = p.aqsol_result?.eq_liquid ?? {};
    const total = liquidTotalsByPond[idx];
    const toView = (raw: number): number => {
      if (concentrationView === 'abs') return raw;
      if (!total || total <= 0) return 0;
      return (raw / total) * 100;
    };
    const row: Record<string, string | number> = {
      name: p.config.name,
      'Li+': toView(eq['Li+'] ?? 0),
    };
    for (const sp of REFERENCE_SPECIES) {
      row[sp.name] = toView(eq[sp.name] ?? 0);
    }
    return row;
  });

  const concUnit = concentrationView === 'abs' ? 'ton/dia' : '%';

  // Li+ vs densidad — un punto por poza (X = densidad líquida, Y = Li+ en la unidad activa)
  const liVsDensityData = ponds.map((p, idx) => {
    const liRaw = p.aqsol_result?.eq_liquid?.['Li+'] ?? 0;
    const total = liquidTotalsByPond[idx];
    const liValue =
      concentrationView === 'abs'
        ? liRaw
        : !total || total <= 0
          ? 0
          : (liRaw / total) * 100;
    return {
      name: p.config.name,
      density: p.aqsol_result?.density_liquid ?? 0,
      'Li+': liValue,
    };
  });

  // Flow and Water Activity
  const flowData = ponds.map((p) => ({
    name: p.config.name,
    'Flujo salida': p.outlet_flow,
    'Actividad agua': p.aqsol_result?.water_activity ?? 0,
  }));

  // Density
  const densityData = ponds.map((p) => ({
    name: p.config.name,
    Densidad: p.aqsol_result?.density_liquid ?? 0,
  }));

  // Salt Precipitation
  const saltData = ponds.map((p) => ({
    name: p.config.name,
    'Sales precipitadas': p.salt_precipitated,
  }));

  // Evolución por sal individual a través de las pozas.
  // Unión de todas las sales que precipitaron en alguna poza del stage.
  const saltNames = Array.from(
    ponds.reduce<Set<string>>((set, p) => {
      const salts = p.aqsol_result?.precipitated_salts ?? {};
      for (const k of Object.keys(salts)) set.add(k);
      return set;
    }, new Set<string>()),
  );
  // Filtrar sales cuyo máximo sea ~0 para no saturar la leyenda.
  const saltMaxValues: Record<string, number> = {};
  for (const s of saltNames) {
    let mx = 0;
    for (const p of ponds) {
      const v = p.aqsol_result?.precipitated_salts?.[s] ?? 0;
      if (v > mx) mx = v;
    }
    saltMaxValues[s] = mx;
  }
  const activeSalts = saltNames
    .filter((s) => saltMaxValues[s] > 1e-9)
    .sort((a, b) => saltMaxValues[b] - saltMaxValues[a]);

  const saltEvolutionData = ponds.map((p) => {
    const salts = p.aqsol_result?.precipitated_salts ?? {};
    const row: Record<string, string | number> = { name: p.config.name };
    for (const s of activeSalts) row[s] = salts[s] ?? 0;
    return row;
  });

  const chartStyle = {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
  };

  return (
    <div>
      <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
        {stageLabel}
      </h4>

      {/* Header de la sección de comparaciones Li+ vs componente con toggle ton/d ↔ % */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h5
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Li+ vs componentes — comparación por poza
        </h5>
        <div
          className="inline-flex rounded overflow-hidden text-xs"
          style={{ border: '1px solid var(--color-border, #d1d5db)' }}
        >
          {([
            ['abs', 'ton/d'],
            ['pct', '%'],
          ] as const).map(([value, label]) => {
            const active = concentrationView === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setConcentrationView(value)}
                className="px-2 py-1 font-medium"
                style={{
                  backgroundColor: active
                    ? 'var(--color-primary)'
                    : 'var(--color-surface)',
                  color: active ? '#fff' : 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Li+ vs cada componente — un chart separado por comparacion */}
        {REFERENCE_SPECIES.map((sp) => (
          <div key={sp.name} className="card p-4">
            <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Li+ vs {sp.name} por poza ({concUnit})
            </h5>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={concentrationData} style={chartStyle}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis
                  yAxisId="li"
                  tick={{ fontSize: 10 }}
                  label={{
                    value: 'Li+',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 10, fill: 'var(--color-success)' },
                  }}
                />
                <YAxis
                  yAxisId="other"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  label={{
                    value: sp.name,
                    angle: 90,
                    position: 'insideRight',
                    style: { fontSize: 10, fill: sp.color },
                  }}
                />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="li"
                  type="monotone"
                  dataKey="Li+"
                  stroke="var(--color-success)"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="other"
                  type="monotone"
                  dataKey={sp.name}
                  stroke={sp.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

        {/* Li+ vs Densidad — scatter (X: densidad kg/m³, Y: Li+ en unidad activa) */}
        <div className="card p-4">
          <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Li+ ({concUnit}) vs Densidad (kg/m³) por poza
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart
              data={liVsDensityData}
              style={chartStyle}
              margin={{ top: 10, right: 20, bottom: 30, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                dataKey="density"
                name="Densidad"
                unit=" kg/m³"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                label={{
                  value: 'Densidad líquida (kg/m³)',
                  position: 'insideBottom',
                  offset: -15,
                  style: { fontSize: 10, fill: 'var(--color-text-secondary)' },
                }}
              />
              <YAxis
                type="number"
                dataKey="Li+"
                name="Li+"
                unit={concentrationView === 'abs' ? ' ton/d' : ' %'}
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                label={{
                  value: `Li+ (${concUnit})`,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 10, fill: 'var(--color-success)' },
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number | string, _name, item) => {
                  const v = typeof value === 'number' ? value.toFixed(4) : value;
                  if (item?.dataKey === 'density') return [`${v} kg/m³`, 'Densidad'];
                  if (item?.dataKey === 'Li+')
                    return [`${v} ${concentrationView === 'abs' ? 'ton/d' : '%'}`, 'Li+'];
                  return [v, item?.dataKey ?? ''];
                }}
                labelFormatter={(_l, payload) => {
                  const row = payload && payload[0] && (payload[0].payload as { name?: string });
                  return row?.name ?? '';
                }}
              />
              <Scatter
                name="Pozas"
                data={liVsDensityData}
                fill="var(--color-success)"
                line={{ stroke: 'var(--color-success)', strokeWidth: 1.5 }}
                lineType="joint"
              >
                <LabelList
                  dataKey="name"
                  position="top"
                  style={{ fontSize: 9, fill: 'var(--color-text-secondary)' }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Flow and Water Activity */}
        <div className="card p-4">
          <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Flujo y Actividad de Agua
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={flowData} style={chartStyle}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Flujo salida" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="Actividad agua" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Density */}
        <div className="card p-4">
          <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Densidad por poza (g/cm3)
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={densityData} style={chartStyle}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Densidad" stroke="var(--color-danger)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Salt Precipitation (total por poza) */}
        <div className="card p-4">
          <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Sales precipitadas por poza (ton/dia)
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={saltData} style={chartStyle}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Sales precipitadas" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: Evolución de cada sal individual por poza */}
        {activeSalts.length > 0 && (
          <div className="card p-4 lg:col-span-2">
            <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Evolución por sal precipitada (ton/dia) — {activeSalts.length} sal{activeSalts.length === 1 ? '' : 'es'}
            </h5>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={saltEvolutionData} style={chartStyle}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number | string) =>
                    typeof value === 'number' ? value.toFixed(4) : value
                  }
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {activeSalts.map((s, idx) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    stroke={SALT_PALETTE[idx % SALT_PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
