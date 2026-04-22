import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

// Paleta para series de sales precipitadas.
const SALT_PALETTE = [
  '#0891b2', '#db2777', '#8b5cf6', '#ea580c', '#059669',
  '#6366f1', '#d97706', '#be185d', '#0d9488', '#7c3aed',
  '#dc2626', '#2563eb', '#16a34a', '#a16207', '#9333ea',
  '#0284c7', '#ca8a04', '#15803d', '#c2410c', '#4f46e5',
];

export default function ResultCharts({ stageLabel, result }: Props) {
  const ponds = result.ponds || [];

  // Concentration comparison: Li+ (reference) vs other main species on dual axis
  const concentrationData = ponds.map((p) => {
    const eq = p.aqsol_result?.eq_liquid ?? {};
    const row: Record<string, string | number> = {
      name: p.config.name,
      'Li+': eq['Li+'] ?? 0,
    };
    for (const sp of REFERENCE_SPECIES) {
      row[sp.name] = eq[sp.name] ?? 0;
    }
    return row;
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Li+ vs cada componente — un chart separado por comparacion */}
        {REFERENCE_SPECIES.map((sp) => (
          <div key={sp.name} className="card p-4">
            <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Li+ vs {sp.name} por poza (ton/dia)
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
