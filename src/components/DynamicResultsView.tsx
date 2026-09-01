import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useT } from '../i18n/LanguageContext';
import { downloadExecutionFile } from '../services/api';
import { scaleResults } from '../utils/dynamicScale';
import { boronFrom } from '../utils/boron';
import { CANONICAL_SPECIES_ORDER } from '../utils/species';
import { downloadChartsZip } from '../utils/downloadCharts';
import { useDayDateAxis, DayDateToggle, DayStepSelect, XAxisModeProvider, ScrollableChart } from '../utils/chartDateAxis';

// Ticks del eje Y con coma decimal (preserva los ticks "lindos" de recharts).
const fmtAxisEs = (v: number | string): string =>
  typeof v === 'number' ? String(v).replace('.', ',') : String(v);
import { displayPondName } from '../utils/dynamicDisplayNames';
import EncaladoResultPanel from './EncaladoResultPanel';
import DecimalsSelect from './common/DecimalsSelect';
import { downloadDynamicResultsExcel } from '../utils/dynamicResultsExcel';
import { getDecimalsOverride, formatEs } from '../utils/numberFormat';
import { useDecimals } from '../context/DecimalsContext';
import WellBrineFeedTable from './WellBrineFeedTable';

const CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

type Props = {
  executionId: string;
  results: DynamicResults;
  files: ExecutionFile[];
  snapshot?: Record<string, unknown> | null;
};

// La tabla "Masa ingreso salmuera de pozo" se movió a ./WellBrineFeedTable (compartida
// entre estático y dinámico).

type ResultTabKey = 'kpis' | 'tabla1' | 'tabla2' | 'tabla3' | 'compacta' | 'graficos' | 'encalado_detalle' | 'archivos';

function fmt(n: number | undefined | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const ov = getDecimalsOverride();
  const d = ov == null ? digits : ov;
  return formatEs(n, d);
}

function fmtSci(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  // Notación científica solo para valores diminutos; coma en la mantisa.
  if (getDecimalsOverride() == null && Math.abs(n) < 1e-4 && n !== 0)
    return n.toExponential(3).replace('.', ',');
  return fmt(n, 4);
}

// ============================================================
// KPI cards
// ============================================================
export function KpiCards({ results }: { results: DynamicResults }) {
  const t = useT();
  const k = results.kpis;
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <Card title={t('recovery_li')} value={`${fmt(k.recovery_li_pct, 2)}%`} sub={t('last_year')} />
      <Card title={t('li_production')} value={`${fmt(k.annual_li_production_ton, 1)} t/y`} sub={t('last_year')} />
      <Card title={t('days_simulated')} value={String(k.n_days_simulated)} sub={`${t('dynres_annual_window')} ${results.stage !== 'encalado' ? `${(results as DynamicCascadeOrPostlimingResults).annual_window?.[0]}–${(results as DynamicCascadeOrPostlimingResults).annual_window?.[1]}` : '—'}`} />
      <Card title={t('aqsol_convergence')} value={`${fmt(k.aqsol_convergence_pct, 2)}%`} sub={results.stage === 'encalado' ? `${(results as DynamicEncaladoResults).n_days_aqsol_failed} ${t('dynres_days_failed')}` : 'days_ok / total'} />
      {/* Versión del motor termodinámico. Las ejecuciones anteriores al sello no la
          traen: se muestra "No registrada" en vez de asumir una. */}
      <Card
        title={t('aqsol_version')}
        value={results.aqsol?.version ?? t('aqsol_version_unknown')}
        sub={t('aqsol_version_sub')}
      />
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
export function Tabla1({ results }: { results: DynamicCascadeOrPostlimingResults }) {
  const t = useT();
  const { pond_names, annual_aggregates } = results;
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>{t('tbl_pond')}</th>
            <th>{t('dynres_th_area')}</th>
            <th>{t('dynres_th_flow_in_td')}</th>
            <th>{t('dynres_th_flow_in_ty')}</th>
            <th>{t('dynres_th_evap_ty')}</th>
            <th>{t('dynres_th_evap_mmd')}</th>
            <th>{t('dynres_th_flow_out_td')}</th>
            <th>{t('dynres_th_flow_out_ty')}</th>
            <th>{t('dynres_th_seepage')}</th>
            <th>{t('dynres_th_entrain_ty')}</th>
            <th>{t('dynres_th_entrain_pct')}</th>
            <th>{t('dynres_th_salts_ty')}</th>
            <th>{t('dynres_th_density')}</th>
            <th>{t('dynres_th_aw')}</th>
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
export function Tabla2({
  results,
  initialUnit = 'pct',
}: {
  results: DynamicCascadeOrPostlimingResults;
  initialUnit?: 'pct' | 'ton';
}) {
  const t = useT();
  const [unit, setUnit] = useState<'pct' | 'ton'>(initialUnit);
  const { pond_names, table_species, annual_composition_pct, annual_species_t_year } = results;
  const source = unit === 'pct' ? annual_composition_pct : annual_species_t_year;
  return (
    <div>
      <div className="flex gap-2 mb-2 text-xs">
        <button
          className={`px-2 py-1 rounded border ${unit === 'pct' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('pct')}
        >
          {t('dynres_tab_2a')}
        </button>
        <button
          className={`px-2 py-1 rounded border ${unit === 'ton' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('ton')}
        >
          {t('dynres_tab_2b')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t('tbl_pond')}</th>
              {table_species.map((sp) => (
                <th key={sp}>{sp}</th>
              ))}
              <th title="Boro derivado de H3BO3 + B4O7-- + BO2-">B</th>
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
                  <td className="font-mono text-xs">
                    {unit === 'pct' ? fmt(boronFrom(row), 4) : fmtSci(boronFrom(row))}
                  </td>
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
export function Tabla3({
  results,
  initialUnit = 'ton',
}: {
  results: DynamicCascadeOrPostlimingResults;
  initialUnit?: 'ton' | 'pct';
}) {
  const t = useT();
  const [unit, setUnit] = useState<'ton' | 'pct'>(initialUnit);
  const { pond_names, main_salts, annual_salts_t_year, annual_salts_pct } = results;
  const source = unit === 'ton' ? annual_salts_t_year : annual_salts_pct;
  // Mostrar solo las sales que precipitan (algún valor > 0 en alguna poza), igual
  // que los gráficos — se ocultan las columnas de sales que dan cero en todas las
  // pozas. Se usa la masa (t/año) como base de "precipita" y se aplica a ambas
  // vistas (t/año y %w/w) para consistencia.
  const visibleSalts = main_salts.filter((s) =>
    pond_names.some((name) => ((annual_salts_t_year[name] || {}) as Record<string, number>)[s] > 0),
  );
  return (
    <div>
      <div className="flex gap-2 mb-2 text-xs">
        <button
          className={`px-2 py-1 rounded border ${unit === 'ton' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('ton')}
        >
          {t('dynres_tab_3a')}
        </button>
        <button
          className={`px-2 py-1 rounded border ${unit === 'pct' ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
          onClick={() => setUnit('pct')}
        >
          {t('dynres_tab_3b')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t('tbl_pond')}</th>
              {visibleSalts.map((s) => (
                <th key={s}>{s}</th>
              ))}
              {unit === 'ton' && <th>{t('dynres_th_total_ty')}</th>}
            </tr>
          </thead>
          <tbody>
            {pond_names.map((name) => {
              const row = (source[name] || {}) as Record<string, number>;
              const total = (annual_salts_t_year[name] || {})._total ?? 0;
              return (
                <tr key={name}>
                  <td className="font-medium" title={name}>{displayPondName(name)}</td>
                  {visibleSalts.map((s) => (
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

export function TablaCompacta({ results }: { results: DynamicCascadeOrPostlimingResults }) {
  const t = useT();
  const { pond_names, annual_composition_pct, annual_aggregates } = results;
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>{t('tbl_pond')}</th>
            <th>{t('dynres_th_outflow_td')}</th>
            {COMPACT_SPECIES.map((sp) => (
              <th key={sp}>{sp}</th>
            ))}
            <th title="Boro derivado de H3BO3 + B4O7-- + BO2-">B</th>
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
                <td className="font-mono text-xs">{fmt(boronFrom(pcts), 4)}</td>
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
function ChartsCascadePostliming({
  results,
  executionId,
}: {
  results: DynamicCascadeOrPostlimingResults;
  executionId: string;
}) {
  const t = useT();
  const { pond_names, daily_series, default_chart_species } = results;
  // Las especies graficables son las que el motor puso en la serie diaria: 17 con la
  // 027 y 23 con la 066. Antes esto era una copia fija de la lista del backend, así
  // que las que agrega la 066 no tenían casilla ni gráfico. El fallback cubre
  // ejecuciones viejas guardadas sin `table_species`.
  const allChartSpecies = results.table_species?.length
    ? results.table_species
    : CANONICAL_SPECIES_ORDER;
  // Por default, todas las especies/iones seleccionadas para ver todos los gráficos.
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(allChartSpecies);

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
        for (const sp of allChartSpecies) {
          const key = `${sp}_pct`;
          row[`${name}__${sp}_pct`] = (s as unknown as Record<string, number>)[key] ?? 0;
        }
      }
    }
    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  }, [pond_names, daily_series, allChartSpecies]);

  // Toggle Días/Fechas del eje X (usa la fecha de la serie diaria).
  const dayDates = useMemo(() => {
    const first = pond_names.map((n) => daily_series[n]).find((s) => s && s.length);
    return (first ?? []).map((s) => ({ day: s.day, date: (s as { date?: string }).date }));
  }, [pond_names, daily_series]);
  const { mode: xMode, fmtX, xAxisProps, chartMinWidth } = useDayDateAxis(dayDates);
  const xLabel = xMode === 'date' ? t('dynres_axis_date') : t('dynres_axis_day');

  const toggleSpecies = (sp: string) => {
    setSelectedSpecies((prev) =>
      prev.includes(sp) ? prev.filter((s) => s !== sp) : [...prev, sp],
    );
  };

  const renderChart = (metric: string, ylabel: string, title: string) => (
    <div className="card p-3 mb-4">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
        <LineChart data={pivot}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="day" {...xAxisProps} label={{ value: xLabel, position: 'insideBottom', offset: -2 }} />
          <YAxis label={{ value: ylabel, angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
          <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
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
      </ResponsiveContainer></ScrollableChart>
    </div>
  );

  return (
    <div>
      {renderChart('inflow_ton', 't/d', t('inflow_per_pond'))}
      {renderChart('height_m', 'm', t('height_per_pond'))}

      {/* Fixed Li% chart — always visible */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('li_per_pond_per_day')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={pivot}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} label={{ value: xLabel, position: 'insideBottom', offset: -2 }} />
            <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
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
        </ResponsiveContainer></ScrollableChart>
      </div>

      {/* Species selector for composition charts */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('composition_per_pond')}</h4>
        <div className="flex flex-wrap gap-2">
          {allChartSpecies.map((sp) => {
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
        renderChart(`${sp}_pct`, '%w/w', `${t('dynres_composition_pre')} ${sp} ${t('dynres_composition_post')}`),
      )}
      <ChartSalesPerPond results={results} executionId={executionId} />
    </div>
  );
}

/** Agregados del día que comparten el prefijo `salt_` con las sales, pero no son sales.
 *  `salt_accumulated_ton` es el inventario acumulado en la poza (crece monótono hasta
 *  decenas de miles de toneladas) y `salt_precipitated_ton` es el total del día, o sea
 *  la suma de las demás series. Los escribe el runner en el CSV por poza
 *  (dynamic_runner._write_pond_csv). */
const COLUMNAS_AGREGADAS = ['salt_accumulated_ton', 'salt_precipitated_ton'];

/**
 * Columnas de sal del CSV por poza: `salt_<NOMBRE>_ton`, sin los agregados.
 *
 * El filtro por prefijo y sufijo tomaba también los agregados y los graficaba como si
 * fueran dos sales mas, "accumulated" y "precipitated". El acumulado, ademas, aplastaba
 * la escala: cientos de toneladas por dia de las sales reales contra decenas de miles
 * del inventario.
 */
export function saltColumnsFromHeader(header: string[]): { h: string; i: number }[] {
  return header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.startsWith('salt_') && h.endsWith('_ton'))
    .filter(({ h }) => !COLUMNAS_AGREGADAS.includes(h));
}

function ChartSalesPerPond({
  results,
  executionId,
}: {
  results: DynamicCascadeOrPostlimingResults;
  executionId: string;
}) {
  const t = useT();
  const { pond_names, run_tag, stage } = results;
  const [selectedPond, setSelectedPond] = useState<string>(pond_names[0] || '');
  const [data, setData] = useState<Record<string, number>[]>([]);
  const [saltNames, setSaltNames] = useState<string[]>([]);
  const [dayDates, setDayDates] = useState<{ day: number; date?: string }[]>([]);
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
        const dateIdx = header.indexOf('date');
        const saltCols = saltColumnsFromHeader(header);
        const rows: Record<string, number>[] = [];
        const dds: { day: number; date?: string }[] = [];
        for (let li = 1; li < lines.length; li++) {
          const cols = lines[li].split(',');
          const dayVal = dayIdx >= 0 ? parseInt(cols[dayIdx]) || li : li;
          const row: Record<string, number> = { day: dayVal };
          for (const { h, i } of saltCols) {
            const saltName = h.replace(/^salt_/, '').replace(/_ton$/, '');
            row[saltName] = parseFloat(cols[i]) || 0;
          }
          rows.push(row);
          dds.push({ day: dayVal, date: dateIdx >= 0 ? cols[dateIdx] : undefined });
        }
        setDayDates(dds);
        // Only keep salts with at least one nonzero value
        const nonzero = saltCols
          .map(({ h }) => h.replace(/^salt_/, '').replace(/_ton$/, ''))
          .filter((s) => rows.some((r) => Math.abs(r[s]) > 1e-12));
        setSaltNames(nonzero);
        setData(rows);
      })
      .catch((e) => {
        // 404 = los CSV por-poza de esta ejecución no están en este backend
        // (la DB de ejecuciones es compartida, pero los archivos son por-máquina).
        const status = (e as { response?: { status?: number } })?.response?.status;
        setErr(status === 404 ? t('dynres_files_not_local') : String(e));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPond, executionId, run_tag, stage]);

  const { mode: xMode, fmtX, xAxisProps, chartMinWidth } = useDayDateAxis(dayDates);
  const xLabel = xMode === 'date' ? t('dynres_axis_date') : t('dynres_axis_day');

  return (
    <div className="card p-3 mb-4">
      <h4 className="text-sm font-semibold mb-2">{t('salts_per_pond_chart')}</h4>
      <div className="flex gap-2 mb-2 items-center text-xs">
        <label>{t('tbl_pond')}:</label>
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
          ({saltNames.length} {t('dynres_salts_nonzero')})
        </span>
      </div>
      {loading && <p className="text-xs">{t('loading')}…</p>}
      {err && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{t('error')}: {err}</p>}
      {!loading && !err && data.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dynres_no_salt_data')}
        </p>
      )}
      {!loading && data.length > 0 && (
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} label={{ value: xLabel, position: 'insideBottom', offset: -2 }} />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
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
        </ResponsiveContainer></ScrollableChart>
      )}
    </div>
  );
}

const ENC_COMPOSITION_SPECIES = ['Li+', 'Mg++', 'H2O', 'K+', 'SO4--'];

export function ChartsEncalado({ results }: { results: DynamicEncaladoResults }) {
  const t = useT();
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

  const dayDates = useMemo(
    () => results.daily_series.map((r) => ({ day: r.day, date: (r as { date?: string }).date })),
    [results.daily_series],
  );
  const { fmtX, xAxisProps, chartMinWidth } = useDayDateAxis(dayDates);

  return (
    <div>
      {/* Li% */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('dynres_enc_li_out')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={liData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
            <Line type="monotone" dataKey="li_pct" name="Li%" stroke={CHART_COLORS[0]} dot={false} />
          </LineChart>
        </ResponsiveContainer></ScrollableChart>
      </div>

      {/* Composición de salida */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('dynres_enc_composition_out')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={compData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis label={{ value: '%w/w', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
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
        </ResponsiveContainer></ScrollableChart>
      </div>

      {/* Sales precipitadas */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('dynres_enc_total_salts')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={saltData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
            <Line type="monotone" dataKey="salt" name={t('dynres_total_salts_line')} stroke={CHART_COLORS[4]} dot={false} />
          </LineChart>
        </ResponsiveContainer></ScrollableChart>
      </div>

      {/* Consumo de reactivos */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('reagent_consumption')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
            <Legend />
            <Line type="monotone" dataKey="lechada" name={t('dynres_lime_milk')} stroke={CHART_COLORS[0]} dot={false} />
            <Line type="monotone" dataKey="cacl2" name={t('dynres_cacl2_solution')} stroke={CHART_COLORS[1]} dot={false} />
          </LineChart>
        </ResponsiveContainer></ScrollableChart>
      </div>

      {/* Flujo de salida */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('flow_out')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={flowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis label={{ value: 't/d', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
            <Line type="monotone" dataKey="flow" name={t('dynres_flow_out_line')} stroke={CHART_COLORS[2]} dot={false} />
          </LineChart>
        </ResponsiveContainer></ScrollableChart>
      </div>

      {/* Ratio SO4/Mg */}
      <div className="card p-3 mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('so4_mg_ratio')}</h4>
        <ScrollableChart minWidth={chartMinWidth}><ResponsiveContainer width="100%" height={240}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis label={{ value: 'SO4/Mg', angle: -90, position: 'insideLeft' }} tickFormatter={fmtAxisEs} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
            <Line type="monotone" dataKey="ratio" name="SO4/Mg" stroke={CHART_COLORS[3]} dot={false} />
          </LineChart>
        </ResponsiveContainer></ScrollableChart>
      </div>
    </div>
  );
}

// ============================================================
// Files tab
// ============================================================
function FilesTab({ executionId, files }: { executionId: string; files: ExecutionFile[] }) {
  const t = useT();
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
          <th>{t('dynres_file')}</th>
          <th>{t('dynres_size')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.name}>
            <td className="font-mono text-xs">{f.name}</td>
            <td className="font-mono text-xs">{formatEs(f.size_bytes / 1024, 1)} KB</td>
            <td>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(f.name)}>
                {t('download')}
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
export default function DynamicResultsView({ executionId, results, files, snapshot }: Props) {
  const t = useT();
  useDecimals(); // subscribe so tables re-render when the global decimals change
  const [tab, setTab] = useState<ResultTabKey>('kpis');
  const chartsRef = useRef<HTMLDivElement>(null);
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
    { key: 'kpis', label: t('kpis'), visible: true },
    { key: 'tabla1', label: t('table_1_balance'), visible: !!cp },
    { key: 'tabla2', label: t('table_2_compositions'), visible: !!cp },
    { key: 'tabla3', label: t('table_3_salts'), visible: !!cp },
    { key: 'compacta', label: t('compact_table'), visible: !!cp },
    { key: 'graficos', label: t('charts'), visible: true },
    {
      key: 'encalado_detalle',
      label: t('dynres_tab_enc_detail'),
      visible: !!enc && !!enc.encalado_result_averaged,
    },
    { key: 'archivos', label: `${t('files')} (${files.length})`, visible: true },
  ];

  return (
    <XAxisModeProvider>
    <div>
      {/* Resultados parciales: la etapa se cortó, pero el backend conservó los días
          completos anteriores. Aviso muy visible — leer un promedio anual calculado
          sobre 137 de 1460 días como si fuera la corrida entera sería peor que no
          mostrar nada. Mismo criterio que el estático en ExecutionResultsPage. */}
      {results.partial && (
        <div
          className="mb-3 p-3 text-sm"
          style={{
            backgroundColor: '#fef3c7',
            color: 'var(--color-warning, #92400e)',
            borderRadius: 'var(--radius)',
            border: '1px solid #fbbf24',
          }}
          role="alert"
        >
          <strong>{t('execres_partial_title')}</strong>{' '}
          {results.days_completed != null && results.days_total != null
            ? `${results.days_completed}/${results.days_total} ${t('dynres_partial_days')}. `
            : ''}
          {t('dynres_partial_body')}
          {results.error_msg && (
            <span className="block mt-1 font-mono text-xs">{results.error_msg}</span>
          )}
        </div>
      )}

      {/* Scale factor control (Section 3.5) */}
      <div
        className="card p-3 mb-3 flex flex-wrap items-end gap-3"
        style={{ background: scaleFactor !== 1 ? '#fff8e1' : undefined }}
      >
        <div>
          <label className="label">{t('scale_factor_label')}</label>
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
          {t('apply')}
        </button>
        {scaleFactor !== 1 && (
          <button className="btn btn-outline btn-sm" onClick={resetScale}>
            {t('reset')} (1.0)
          </button>
        )}
        <p className="text-xs flex-1" style={{ color: 'var(--color-text-secondary)' }}>
          {t('scale_factor_hint')}
          {scaleFactor !== 1 && (
            <span className="font-mono ml-2">{t('applied')}: ×{scaleFactor}</span>
          )}
        </p>
        <DecimalsSelect />
        <button
          className="btn btn-primary btn-sm"
          onClick={() =>
            downloadDynamicResultsExcel(
              scaledResults,
              `resultados_${scaledResults.stage}_${scaledResults.run_tag || 'run'}.xlsx`,
              snapshot,
            )
          }
          title={t('export_excel_hint')}
        >
          {t('download_excel')}
        </button>
      </div>

      <div className="flex gap-0 border-b mb-4" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.filter((tb) => tb.visible).map((tb) => (
          <button
            key={tb.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tb.key ? 'border-current' : 'border-transparent'
            }`}
            style={{
              color: tab === tb.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: tab === tb.key ? 'var(--color-primary)' : 'transparent',
            }}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'kpis' && <KpiCards results={results} />}
      {tab === 'tabla1' && cp && (
        <>
          <WellBrineFeedTable snapshot={snapshot} mode="dynamic" />
          <Tabla1 results={cp} />
        </>
      )}
      {tab === 'tabla2' && cp && <Tabla2 results={cp} />}
      {tab === 'tabla3' && cp && <Tabla3 results={cp} />}
      {tab === 'compacta' && cp && <TablaCompacta results={cp} />}
      {tab === 'graficos' && (
        <>
          <div className="flex justify-between items-center mb-3">
            <div className="flex gap-4 items-center">
              <DayDateToggle labels={{ day: t('chart_view_days'), date: t('chart_view_dates') }} />
              <DayStepSelect label={t('chart_x_step')} autoLabel={t('chart_x_step_auto')} />
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                downloadChartsZip(
                  chartsRef.current,
                  `graficos_${(results as { run_tag?: string }).run_tag ?? 'run'}`,
                )
              }
            >
              {t('download_charts')}
            </button>
          </div>
          <div ref={chartsRef}>
            {cp && <ChartsCascadePostliming results={cp} executionId={executionId} />}
            {enc && <ChartsEncalado results={enc} />}
          </div>
        </>
      )}
      {tab === 'encalado_detalle' && enc && enc.encalado_result_averaged && (
        <div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            {t('dynres_enc_detail_pre')}{' '}
            <span className="font-mono">{enc.n_days_averaged ?? 0}</span> {t('dynres_enc_detail_post')}
          </p>
          <EncaladoResultPanel
            stageLabel={t('stage_reagent_plant')}
            result={enc.encalado_result_averaged as Record<string, unknown>}
            temperature_C={enc.encalado_temperature_C}
          />
        </div>
      )}
      {tab === 'archivos' && <FilesTab executionId={executionId} files={files} />}
    </div>
    </XAxisModeProvider>
  );
}
