import React, { useMemo } from 'react';
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
import type { SolverResult } from '../types';
import { useT } from '../i18n/LanguageContext';
import { useDayDateAxis, ScrollableChart } from '../utils/chartDateAxis';
import { formatEs } from '../utils/numberFormat';

const CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

// Ticks del eje Y con coma decimal.
const fmtAxisEs = (v: number | string): string =>
  typeof v === 'number' ? String(v).replace('.', ',') : String(v);

export interface StaticDailyResult {
  day: number;
  date_label: string;
  temperature_C: number;
  evap_rate_mm_day: number;
  // Un día que reventó viene sin resultado; el componente ya lo trata como vacío.
  result: Record<string, unknown> | null;
}

/**
 * Gráficos de serie temporal (por día) para el estático MULTI-DÍA. Reutiliza los
 * mismos valores por día que el "Resumen Diario" y los mismos controles de eje X
 * que el dinámico (toggle Días/Fechas + separación de días, vía el Context).
 */
export default function StaticDailyCharts({ dailyResults }: { dailyResults: StaticDailyResult[] }) {
  const t = useT();

  const data = useMemo(
    () =>
      dailyResults.map((dr) => {
        const pc = dr.result || {};
        const precon = pc.precon as SolverResult | undefined;
        const postliming = pc.postliming as SolverResult | undefined;
        const last = postliming || precon;
        return {
          day: dr.day + 1,
          date: dr.date_label,
          li_in: precon?.li_in ?? 0,
          li_out: last?.li_out ?? 0,
          recovery: last?.li_recovery_pct ?? 0,
          evap: last?.total_evaporation ?? 0,
          salt: last?.total_salt ?? 0,
          temp: dr.temperature_C,
          evap_rate: dr.evap_rate_mm_day,
        };
      }),
    [dailyResults],
  );

  const dayDates = useMemo(() => data.map((d) => ({ day: d.day, date: d.date })), [data]);
  const { fmtX, xAxisProps, chartMinWidth } = useDayDateAxis(dayDates);

  const chart = (
    title: string,
    ylabel: string,
    lines: Array<{ key: string; name: string }>,
  ) => (
    <div className="card p-3 mb-4">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <ScrollableChart minWidth={chartMinWidth}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis tickFormatter={fmtAxisEs} label={{ value: ylabel, angle: -90, position: 'insideLeft' }} />
            <Tooltip labelFormatter={fmtX} formatter={(v) => (typeof v === 'number' ? formatEs(v, 3) : v)} />
            <Legend />
            {lines.map((l, i) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ScrollableChart>
    </div>
  );

  return (
    <div>
      {chart(t('execres_recovery_pct'), '%', [{ key: 'recovery', name: t('execres_recovery_pct') }])}
      {chart('Li (ton/d)', 'ton/d', [
        { key: 'li_in', name: t('execres_li_in') },
        { key: 'li_out', name: t('execres_li_out') },
      ])}
      {chart(`${t('execres_evap_total')} / ${t('execres_salts_total')}`, 'ton/d', [
        { key: 'evap', name: t('execres_evap_total') },
        { key: 'salt', name: t('execres_salts_total') },
      ])}
      {chart(t('execres_daily_climate'), '', [
        { key: 'temp', name: t('schedule_temp_short') },
        { key: 'evap_rate', name: t('schedule_evap_short') },
      ])}
    </div>
  );
}
