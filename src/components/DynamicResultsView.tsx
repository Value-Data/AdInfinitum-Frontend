import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DynamicCascadeOrPostlimingResults,
  DynamicEncaladoResults,
  DynamicResults,
  ExecutionFile,
} from '../types';
import { downloadExecutionFile } from '../services/api';
import { scaleResults } from '../utils/dynamicScale';
import { displayPondName } from '../utils/dynamicDisplayNames';

const CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

type Props = {
  executionId: string;
  results: DynamicResults;
  files: ExecutionFile[];
};

type ResultTabKey = 'kpis' | 'tabla1' | 'tabla2' | 'tabla3' | 'compacta' | 'graficos' | 'archivos';

function fmt(n: number | undefined | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: digits });
  return n.toFixed(digits);
}

function fmtSci(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-4 && n !== 0) return n.toExponential(3);
  return fmt(n, 4);
}

// ============================================================
// KPI cards
// ============================================================
function KpiCards({ results }: { results: DynamicResults }) {
  const k = results.kpis;
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <Card title="Recovery Li" value={`${fmt(k.recovery_li_pct, 2)}%`} sub="último año" />
      <Card title="Producción Li" value={`${fmt(k.annual_li_production_ton, 1)} t/y`} sub="último año" />
      <Card title="Días simulados" value={String(k.n_days_simulated)} sub={`ventana anual ${results.stage !== 'encalado' ? `${(results as DynamicCascadeOrPostlimingResults).annual_window?.[0]}–${(results as DynamicCascadeOrPostlimingResults).annual_window?.[1]}` : '—'}`} />
      <Card title="AQSOL convergencia" value={`${fmt(k.aqsol_convergence_pct, 2)}%`} sub={results.stage === 'encalado' ? `${(results as DynamicEncaladoResults).n_days_aqsol_failed} días fallaron` : 'days_ok / total'} />
    </div>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tabla 1 — Balance global por poza
// ============================================================
function Tabla1({ results }: { results: DynamicCascadeOrPostlimingResults }) {
  const { pond_names, annual_aggregates } = results;
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Poza</th>
            <th>Área m²</th>
            <th>Flujo in t/d</th>
            <th>Flujo in t/y</th>
            <th>Hold Up Δ t</th>
            <th>Evap t/y</th>
            <th>Evap mm/d</th>
            <th>Flujo out t/d</th>
            <th>Flujo out t/y</th>
            <th>Seepage t/y</th>
            <th>Entrain t/y</th>
            <th>Entrain %</th>
            <th>Sales t/y</th>
            <th>Densidad</th>
            <th>aw</th>
          </tr>
        </thead>
        <tbody>
          {pond_names.map((name) => {
            const a = annual_aggregates[name] || {};
            return (
              <tr key={name}>
                <td className="font-medium" title={name}>{displayPondName(name)}</td>
                <td className="font-mono text-sm">{fmt(a.area_m2, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.flow_in_t_d_avg)}</td>
                <td className="font-mono text-sm">{fmt(a.flow_in_t_y, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.hold_up_delta_t)}</td>
                <td className="font-mono text-sm">{fmt(a.evap_t_y, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.evap_mm_d_avg, 3)}</td>
                <td className="font-mono text-sm">{fmt(a.flow_out_t_d_avg)}</td>
                <td className="font-mono text-sm">{fmt(a.flow_out_t_y, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.seepage_t_y, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.entrainment_t_y, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.entrainment_pct_avg, 2)}</td>
                <td className="font-mono text-sm">{fmt(a.salt_t_y, 0)}</td>
                <td className="font-mono text-sm">{fmt(a.density_avg, 2)}</td>
                <td className="font-mono text-sm">{fmt(a.water_activity_avg, 4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Tabla 2 — Composiciones %w/w (2A) y t/y (2B)
// ============================================================
function Tabla2({ results }: { results: DynamicCascadeOrPostlimingResults }) {
  const [unit, setUnit] = useState<'pct' | 'ton'>('pct');
  const { pond_names, table_species, annual_composition_pct, annual_species_t_year } = results;
  const source = unit === 'pct' ? annual_composition_pct : annual_species_t_year;
  return (
    <div>
      <div className="flex gap-2 mb-2 text-xs">
        <button
          className={`px-2 py-1 rounded border ${unit === 'pct' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('pct')}
        >
          2A · %w/w
        </button>
        <button
          className={`px-2 py-1 rounded border ${unit === 'ton' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('ton')}
        >
          2B · t/año
        </button>
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Poza</th>
              {table_species.map((sp) => (
                <th key={sp}>{sp}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pond_names.map((name) => {
              const row = source[name] || {};
              return (
                <tr key={name}>
                  <td className="font-medium" title={name}>{displayPondName(name)}</td>
                  {table_species.map((sp) => (
                    <td key={sp} className="font-mono text-xs">
                      {unit === 'pct' ? fmt(row[sp], 4) : fmtSci(row[sp])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Tabla 3 — Sales precipitadas (3A t/y, 3B %w/w)
// ============================================================
function Tabla3({ results }: { results: DynamicCascadeOrPostlimingResults }) {
  const [unit, setUnit] = useState<'ton' | 'pct'>('ton');
  const { pond_names, main_salts, annual_salts_t_year, annual_salts_pct } = results;
  const source = unit === 'ton' ? annual_salts_t_year : annual_salts_pct;
  return (
    <div>
      <div className="flex gap-2 mb-2 text-xs">
        <button
          className={`px-2 py-1 rounded border ${unit === 'ton' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('ton')}
        >
          3A · t/año
        </button>
        <button
          className={`px-2 py-1 rounded border ${unit === 'pct' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('pct')}
        >
          3B · %w/w
        </button>
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Poza</th>
              {main_salts.map((s) => (
                <th key={s}>{s}</th>
              ))}
              {unit === 'ton' && <th>Total t/y</th>}
            </tr>
          </thead>
          <tbody>
            {pond_names.map((name) => {
              const row = (source[name] || {}) as Record<string, number>;
              const total = (annual_salts_t_year[name] || {})._total ?? 0;
              return (
                <tr key={name}>
                  <td className="font-medium" title={name}>{displayPondName(name)}</td>
                  {main_salts.map((s) => (
                    <td key={s} className="font-mono text-xs">
                      {unit === 'ton' ? fmtSci(row[s]) : fmt(row[s], 2)}
                    </td>
                  ))}
                  {unit === 'ton' && <td className="font-mono text-xs">{fmt(total, 1)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Tabla compacta (11 species + outflow)
// ============================================================
const COMPACT_SPECIES = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'Cl-', 'SO4--', 'H3BO3', 'B4O7--', 'BO2-',
];

function TablaCompacta({ results }: { results: DynamicCascadeOrPostlimingResults }) {
  const { pond_names, annual_composition_pct, annual_aggregates } = results;
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Poza</th>
            <th>Flujo salida t/d</th>
            {COMPACT_SPECIES.map((sp) => (
              <th key={sp}>{sp}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pond_names.map((name) => {
            const pcts = annual_composition_pct[name] || {};
            const flow = annual_aggregates[name]?.flow_out_t_d_avg ?? 0;
            return (
              <tr key={name}>
                <td className="font-medium" title={name}>{displayPondName(name)}</td>
                <td className="font-mono text-sm">{fmt(flow)}</td>
                {COMPACT_SPECIES.map((sp) => (
                  <td key={sp} className="font-mono text-xs">{fmt(pcts[sp], 4)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Charts (Section 3.4)
// ============================================================
// All species available in the daily_series (matches backend _TABLE_SPECIES order)
const ALL_CHART_SPECIES = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'H+',
  'Cl-', 'HSO4-', 'SO4--', 'OH-',
  'CO2(aq)', 'HCO3-', 'CO3--',
  'H3BO3', 'B4O7--', 'BO2-',
];

function ChartsCascadePostliming({
  results,
  executionId,
}: {
  results: DynamicCascadeOrPostlimingResults;
  executionId: string;
}) {
  const { pond_names, daily_series, default_chart_species } = results;
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(default_chart_species);

  // Pivot daily_series to wide: rows = days, cols = pond names
  const pivot = useMemo(() => {
    const dayMap = new Map<number, Record<string, number>>();
    for (const name of pond_names) {
      for (const s of daily_series[name] || []) {
        if (!dayMap.has(s.day)) dayMap.set(s.day, { day: s.day });
        const row = dayMap.get(s.day)!;
        row[`${name}__inflow_ton`] = s.inflow_ton;
        row[`${name}__height_m`] = s.height_m;
        row[`${name}__salt_precipitated_ton`] = s.salt_precipitated_ton;
        for (const sp of ALL_CHART_SPECIES) {
          const key = `${sp}_pct`;
          row[`${name}__${sp}_pct`] = (s as unknown as Record<string, number>)[key] ?? 0;
        }
      }
    }
    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  }, [pond_names, daily_series]);

  const toggleSpecies = (sp: string) => {
    setSelectedSpecies((prev) =>
      prev.includes(sp) ? prev.filter((s) => s !== sp) : [...prev, sp],
    );
  };

  const renderChart = (metric: string, ylabel: string, title: string) => (
    <div className="card p-3 mb-4">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={pivot}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="day" label={{ value: 'Día', position: 'insideBottom', offset: -2 }} />
          <YAxis label={{ value: ylabel, angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          {pond_names.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={`${name}__${metric}`}
              name={displayPondName(name)}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              dot={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div>
      {renderChart('inflow_ton', 't/d', 'Flujos de entrada por poza')}
      {renderChart('height_m', 'm', 'Altura por poza')}

      {/* Fixed Li% chart — always visible */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Li% por poza (por dia)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={pivot}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" label={{ value: 'Dia', position: 'insideBottom', offset: -2 }} />
            <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {pond_names.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={`${name}__Li+_pct`}
                name={displayPondName(name)}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Species selector for composition charts */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Composiciones — elegir especies</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_CHART_SPECIES.map((sp) => {
            const active = selectedSpecies.includes(sp);
            return (
              <button
                key={sp}
                onClick={() => toggleSpecies(sp)}
                className={`px-2 py-1 text-xs rounded border ${
                  active ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
                }`}
              >
                {sp}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSpecies.map((sp) =>
        renderChart(`${sp}_pct`, '%w/w', `Composición ${sp} por poza`),
      )}
      <ChartSalesPerPond results={results} executionId={executionId} />
    </div>
  );
}

function ChartSalesPerPond({
  results,
  executionId,
}: {
  results: DynamicCascadeOrPostlimingResults;
  executionId: string;
}) {
  const { pond_names, run_tag, stage } = results;
  const [selectedPond, setSelectedPond] = useState<string>(pond_names[0] || '');
  const [data, setData] = useState<Record<string, number>[]>([]);
  const [saltNames, setSaltNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Build the CSV file name convention used by the runner.
  const filenameFor = (pondName: string) => {
    if (stage === 'postliming') return `postliming_pz_${pondName}_${run_tag}.csv`;
    return `cascade_pond_${pondName}_${run_tag}.csv`;
  };

  useEffect(() => {
    if (!selectedPond) return;
    setLoading(true);
    setErr(null);
    const fname = filenameFor(selectedPond);
    downloadExecutionFile(executionId, fname)
      .then((blob) => blob.text())
      .then((text) => {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setData([]);
          setSaltNames([]);
          return;
        }
        const header = lines[0].split(',');
        const dayIdx = header.indexOf('day');
        const saltCols = header
          .map((h, i) => ({ h, i }))
          .filter(({ h }) => h.startsWith('salt_') && h.endsWith('_ton'));
        const rows: Record<string, number>[] = [];
        for (let li = 1; li < lines.length; li++) {
          const cols = lines[li].split(',');
          const row: Record<string, number> = {
            day: dayIdx >= 0 ? parseInt(cols[dayIdx]) || li : li,
          };
          for (const { h, i } of saltCols) {
            const saltName = h.replace(/^salt_/, '').replace(/_ton$/, '');
            row[saltName] = parseFloat(cols[i]) || 0;
          }
          rows.push(row);
        }
        // Only keep salts with at least one nonzero value
        const nonzero = saltCols
          .map(({ h }) => h.replace(/^salt_/, '').replace(/_ton$/, ''))
          .filter((s) => rows.some((r) => Math.abs(r[s]) > 1e-12));
        setSaltNames(nonzero);
        setData(rows);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPond, executionId, run_tag, stage]);

  return (
    <div className="card p-3 mb-4">
      <h4 className="text-sm font-semibold mb-2">Sales precipitadas por poza (t/d) — una línea por sal</h4>
      <div className="flex gap-2 mb-2 items-center text-xs">
        <label>Poza:</label>
        <select
          className="input"
          value={selectedPond}
          onChange={(e) => setSelectedPond(e.target.value)}
        >
          {pond_names.map((n) => (
            <option key={n} value={n}>
              {displayPondName(n)}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          ({saltNames.length} sales con valores &gt; 0 en esta poza)
        </span>
      </div>
      {loading && <p className="text-xs">Cargando…</p>}
      {err && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>Error: {err}</p>}
      {!loading && !err && data.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Sin datos de sales para esta poza.
        </p>
      )}
      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" label={{ value: 'Día', position: 'insideBottom', offset: -2 }} />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {saltNames.map((salt, i) => (
              <Line
                key={salt}
                type="monotone"
                dataKey={salt}
                name={salt}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const ENC_COMPOSITION_SPECIES = ['Li+', 'Mg++', 'H2O', 'K+', 'SO4--'];

function ChartsEncalado({ results }: { results: DynamicEncaladoResults }) {
  const data = useMemo(
    () =>
      results.reagents_daily.map((r) => ({
        day: r.day,
        lechada: r.lechada_t_d,
        cacl2: r.cacl2_t_d,
      })),
    [results.reagents_daily],
  );
  const flowData = useMemo(
    () => results.daily_series.map((r) => ({ day: r.day, flow: r.flow_out_t_d })),
    [results.daily_series],
  );
  const ratioData = useMemo(
    () => results.daily_series.map((r) => ({ day: r.day, ratio: r.so4_mg_ratio_feed })),
    [results.daily_series],
  );

  // Composition %w/w from daily_series (backend now includes sp_pct fields)
  const compData = useMemo(
    () =>
      results.daily_series.map((r) => {
        const row: Record<string, number> = { day: r.day };
        for (const sp of ENC_COMPOSITION_SPECIES) {
          row[sp] = (r as unknown as Record<string, number>)[`${sp}_pct`] ?? 0;
        }
        return row;
      }),
    [results.daily_series],
  );

  // Salt precipitated total per day
  const saltData = useMemo(
    () =>
      results.daily_series.map((r) => ({
        day: r.day,
        salt: (r as unknown as Record<string, number>).salt_precipitated_ton ?? 0,
      })),
    [results.daily_series],
  );

  // Li% per day
  const liData = useMemo(
    () =>
      results.daily_series.map((r) => ({
        day: r.day,
        li_pct: (r as unknown as Record<string, number>).li_pct ?? 0,
      })),
    [results.daily_series],
  );

  return (
    <div>
      {/* Li% */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Li% salida encalado (por dia)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={liData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line type="monotone" dataKey="li_pct" name="Li%" stroke={CHART_COLORS[0]} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Composición de salida */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Composicion salida encalado (%w/w por dia)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={compData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: '%w/w', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {ENC_COMPOSITION_SPECIES.map((sp, i) => (
              <Line
                key={sp}
                type="monotone"
                dataKey={sp}
                name={sp}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sales precipitadas */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Sales precipitadas totales (t/d)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={saltData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line type="monotone" dataKey="salt" name="Sales totales" stroke={CHART_COLORS[4]} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Consumo de reactivos */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Consumo de reactivos (t/d)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="lechada" name="Lechada de cal" stroke={CHART_COLORS[0]} dot={false} />
            <Line type="monotone" dataKey="cacl2" name="Solucion CaCl2" stroke={CHART_COLORS[1]} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Flujo de salida */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Flujo de salida (P2519) t/d</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={flowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line type="monotone" dataKey="flow" name="Flow out" stroke={CHART_COLORS[2]} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ratio SO4/Mg */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">Ratio SO4/Mg del feed</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: 'SO4/Mg', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line type="monotone" dataKey="ratio" name="SO4/Mg" stroke={CHART_COLORS[3]} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// Files tab
// ============================================================
function FilesTab({ executionId, files }: { executionId: string; files: ExecutionFile[] }) {
  const handleDownload = async (name: string) => {
    const blob = await downloadExecutionFile(executionId, name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <table>
      <thead>
        <tr>
          <th>Archivo</th>
          <th>Tamaño</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.name}>
            <td className="font-mono text-xs">{f.name}</td>
            <td className="font-mono text-xs">{(f.size_bytes / 1024).toFixed(1)} KB</td>
            <td>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(f.name)}>
                Descargar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// Main view with tabs
// ============================================================
export default function DynamicResultsView({ executionId, results, files }: Props) {
  const [tab, setTab] = useState<ResultTabKey>('kpis');
  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [scaleInput, setScaleInput] = useState<string>('1');

  const scaledResults = useMemo(
    () => scaleResults(results, scaleFactor),
    [results, scaleFactor],
  );

  const isCascadeOrPost = scaledResults.stage !== 'encalado';
  const cp = isCascadeOrPost ? (scaledResults as DynamicCascadeOrPostlimingResults) : null;
  const enc = !isCascadeOrPost ? (scaledResults as DynamicEncaladoResults) : null;

  const applyScale = () => {
    const v = parseFloat(scaleInput);
    if (Number.isFinite(v) && v > 0) setScaleFactor(v);
  };
  const resetScale = () => {
    setScaleFactor(1);
    setScaleInput('1');
  };

  const tabs: { key: ResultTabKey; label: string; visible: boolean }[] = [
    { key: 'kpis', label: 'KPIs', visible: true },
    { key: 'tabla1', label: 'Tabla 1 · Balance', visible: !!cp },
    { key: 'tabla2', label: 'Tabla 2 · Composiciones', visible: !!cp },
    { key: 'tabla3', label: 'Tabla 3 · Sales', visible: !!cp },
    { key: 'compacta', label: 'Tabla compacta', visible: !!cp },
    { key: 'graficos', label: 'Gráficos', visible: true },
    { key: 'archivos', label: `Archivos (${files.length})`, visible: true },
  ];

  return (
    <div>
      {/* Scale factor control (Section 3.5) */}
      <div
        className="card p-3 mb-3 flex flex-wrap items-end gap-3"
        style={{ background: scaleFactor !== 1 ? '#fff8e1' : undefined }}
      >
        <div>
          <label className="label">Factor de escalado (post-corrida)</label>
          <input
            type="number"
            className="input input-number w-28"
            step={0.01}
            min={0.01}
            value={scaleInput}
            onChange={(e) => setScaleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyScale();
            }}
          />
        </div>
        <button className="btn btn-outline btn-sm" onClick={applyScale}>
          Aplicar
        </button>
        {scaleFactor !== 1 && (
          <button className="btn btn-outline btn-sm" onClick={resetScale}>
            Reset (1.0)
          </button>
        )}
        <p className="text-xs flex-1" style={{ color: 'var(--color-text-secondary)' }}>
          Multiplica flujos, masas anuales, sales y reactivos sin re-correr el motor.
          NO afecta composiciones %w/w, alturas, densidades ni actividad de agua.
          {scaleFactor !== 1 && (
            <span className="font-mono ml-2">Aplicado: ×{scaleFactor}</span>
          )}
        </p>
      </div>

      <div className="flex gap-0 border-b mb-4" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.filter((t) => t.visible).map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-current' : 'border-transparent'
            }`}
            style={{
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: tab === t.key ? 'var(--color-primary)' : 'transparent',
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kpis' && <KpiCards results={results} />}
      {tab === 'tabla1' && cp && <Tabla1 results={cp} />}
      {tab === 'tabla2' && cp && <Tabla2 results={cp} />}
      {tab === 'tabla3' && cp && <Tabla3 results={cp} />}
      {tab === 'compacta' && cp && <TablaCompacta results={cp} />}
      {tab === 'graficos' && cp && <ChartsCascadePostliming results={cp} executionId={executionId} />}
      {tab === 'graficos' && enc && <ChartsEncalado results={enc} />}
      {tab === 'archivos' && <FilesTab executionId={executionId} files={files} />}
    </div>
  );
}
