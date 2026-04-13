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

export default function ResultCharts({ stageLabel, result }: Props) {
  const ponds = result.ponds || [];

  // Concentration data: Li+ and Na+
  const concentrationData = ponds.map((p) => ({
    name: p.config.name,
    'Li+': p.aqsol_result?.eq_liquid?.['Li+'] ?? 0,
    'Na+': p.aqsol_result?.eq_liquid?.['Na+'] ?? 0,
  }));

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
        {/* Chart 1: Li+ and Na+ */}
        <div className="card p-4">
          <h5 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Li+ y Na+ por poza (ton/dia)
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={concentrationData} style={chartStyle}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Li+" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Na+" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
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

        {/* Chart 4: Salt Precipitation */}
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
      </div>
    </div>
  );
}
