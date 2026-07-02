/* ============================================================
   Client-side Excel export of DYNAMIC model results.
   Produces tabular sheets (KPIs, annual balance, compositions, salts)
   plus time-series sheets ready to graph (X = day, one column per pond /
   per metric). Mirrors the static exporter and reuses its encalado sheet.
   ============================================================ */

import * as XLSX from 'xlsx';
import type {
  DynamicResults,
  DynamicCascadeOrPostlimingResults,
  DynamicEncaladoResults,
} from '../types';
import { buildEncaladoSheet } from './exportExecutionExcel';
import { displayPondName } from './dynamicDisplayNames';
import { formatDMY } from './chartDateAxis';
import { boronFrom } from './boron';

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Sheet';
}

function addSheet(wb: XLSX.WorkBook, name: string, aoa: unknown[][]): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  let n = safeSheetName(name);
  let i = 2;
  while (wb.SheetNames.includes(n)) {
    const suffix = ` (${i})`;
    n = safeSheetName(name).slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  XLSX.utils.book_append_sheet(wb, ws, n);
}

function num(v: unknown): number | string {
  return typeof v === 'number' && Number.isFinite(v) ? v : '';
}

function kpisSheet(kpis: Record<string, unknown>): unknown[][] {
  const aoa: unknown[][] = [['KPI', 'Valor']];
  for (const [k, v] of Object.entries(kpis)) aoa.push([k, num(v)]);
  return aoa;
}

// ---- Pivot a per-pond daily metric into a chart-ready time series ----
// rows = days, columns = [Día, ...pondNames]; value = state[metric] for that day.
function seriesSheet(
  r: DynamicCascadeOrPostlimingResults,
  metric: string,
): unknown[][] {
  const dayMap = new Map<number, Record<string, number>>();
  const dayToDate = new Map<number, string>();
  for (const name of r.pond_names) {
    for (const s of r.daily_series[name] || []) {
      if (!dayMap.has(s.day)) dayMap.set(s.day, {});
      const rec = s as unknown as Record<string, unknown>;
      dayMap.get(s.day)![name] = (rec[metric] as number) ?? 0;
      if (!dayToDate.has(s.day) && rec.date) dayToDate.set(s.day, formatDMY(rec.date as string));
    }
  }
  const days = Array.from(dayMap.keys()).sort((a, b) => a - b);
  // Columna Fecha (dd-mm-aaaa) junto al Día para graficar por fecha.
  const aoa: unknown[][] = [['Día', 'Fecha', ...r.pond_names.map(displayPondName)]];
  for (const d of days) {
    const row = dayMap.get(d)!;
    aoa.push([d, dayToDate.get(d) ?? '', ...r.pond_names.map((nm) => num(row[nm]))]);
  }
  return aoa;
}

function buildCascadeSheets(wb: XLSX.WorkBook, r: DynamicCascadeOrPostlimingResults): void {
  addSheet(wb, 'KPIs', kpisSheet(r.kpis as unknown as Record<string, unknown>));

  // --- Annual balance per pond ---
  const balCols: { key: string; label: string }[] = [
    { key: 'area_m2', label: 'Área m²' },
    { key: 'flow_in_t_d_avg', label: 'Flujo in t/d' },
    { key: 'flow_in_t_y', label: 'Flujo in t/y' },
    { key: 'evap_t_y', label: 'Evap t/y' },
    { key: 'evap_mm_d_avg', label: 'Evap mm/d' },
    { key: 'flow_out_t_d_avg', label: 'Flujo out t/d' },
    { key: 'flow_out_t_y', label: 'Flujo out t/y' },
    { key: 'seepage_t_y', label: 'Seepage t/y' },
    { key: 'entrainment_t_y', label: 'Impregnación t/y' },
    { key: 'entrainment_pct_avg', label: 'Impregnación %' },
    { key: 'salt_t_y', label: 'Sales t/y' },
    { key: 'density_avg', label: 'Densidad' },
    { key: 'water_activity_avg', label: 'aw' },
  ];
  const bal: unknown[][] = [['Poza', ...balCols.map((c) => c.label)]];
  for (const name of r.pond_names) {
    const a = (r.annual_aggregates[name] || {}) as unknown as Record<string, number>;
    bal.push([displayPondName(name), ...balCols.map((c) => num(a[c.key]))]);
  }
  addSheet(wb, 'Balance anual', bal);

  // --- Compositions & salts (tables) ---
  const compTable = (
    src: Record<string, Record<string, number>>,
    cols: string[],
    addBoron = false,
  ): unknown[][] => {
    const header = ['Poza', ...cols];
    if (addBoron) header.push('B');
    const aoa: unknown[][] = [header];
    for (const name of r.pond_names) {
      const row = src[name] || {};
      const vals: unknown[] = cols.map((c) => num(row[c]));
      if (addBoron) vals.push(num(boronFrom(row)));
      aoa.push([displayPondName(name), ...vals]);
    }
    return aoa;
  };
  addSheet(wb, 'Composición %w_w', compTable(r.annual_composition_pct, r.table_species, true));
  addSheet(wb, 'Composición t año', compTable(r.annual_species_t_year, r.table_species, true));
  addSheet(wb, 'Sales t año', compTable(r.annual_salts_t_year, r.main_salts));
  addSheet(wb, 'Sales %w_w', compTable(r.annual_salts_pct, r.main_salts));

  // --- Time series (ready to graph: X = day, one column per pond) ---
  addSheet(wb, 'Serie Flujo entrada', seriesSheet(r, 'inflow_ton'));
  addSheet(wb, 'Serie Altura', seriesSheet(r, 'height_m'));
  addSheet(wb, 'Serie Li%', seriesSheet(r, 'li_pct'));
  addSheet(wb, 'Serie Sales precip', seriesSheet(r, 'salt_precipitated_ton'));
  for (const sp of r.default_chart_species) {
    addSheet(wb, `Serie ${sp}`, seriesSheet(r, `${sp}_pct`));
  }
}

function buildEncaladoSheets(wb: XLSX.WorkBook, r: DynamicEncaladoResults): void {
  addSheet(wb, 'KPIs', kpisSheet(r.kpis as unknown as Record<string, unknown>));

  // --- Daily time series (ready to graph: X = Día / Fecha) ---
  const rows = (r.daily_series || []) as unknown as Record<string, unknown>[];
  // Collect any %w/w composition keys present in the rows.
  const pctKeys = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (k.endsWith('_pct') && k !== 'li_pct') pctKeys.add(k);
    }
  }
  const pctCols = Array.from(pctKeys).sort();
  const header = [
    'Día', 'Fecha', 'Tiene feed', 'Feed total (ton)', 'SO4/Mg feed',
    'CaCl2 aplicado', 'AQSOL falló', 'Lechada (t/d)', 'CaCl2 (t/d)',
    'Flujo salida (t/d)', 'Li%', 'Sales precip (ton)', ...pctCols,
  ];
  const series: unknown[][] = [header];
  for (const row of rows) {
    series.push([
      num(row.day), row.date ?? '', row.has_feed ? 'sí' : 'no',
      num(row.feed_total_ton), num(row.so4_mg_ratio_feed),
      row.cacl2_applied ? 'sí' : 'no', row.aqsol_failed ? 'sí' : 'no',
      num(row.lechada_t_d), num(row.cacl2_t_d), num(row.flow_out_t_d),
      num(row.li_pct), num(row.salt_precipitated_ton),
      ...pctCols.map((k) => num(row[k])),
    ]);
  }
  addSheet(wb, 'Serie diaria', series);

  // --- Daily reagents ---
  const reag: unknown[][] = [['Día', 'Fecha', 'Lechada (t/d)', 'CaCl2 (t/d)']];
  for (const row of r.reagents_daily || []) {
    reag.push([num(row.day), row.date ?? '', num(row.lechada_t_d), num(row.cacl2_t_d)]);
  }
  addSheet(wb, 'Reactivos diarios', reag);

  // --- Averaged static-shaped encalado detail (reuses the static builder) ---
  if (r.encalado_result_averaged) {
    addSheet(wb, 'Detalle (promedio)', buildEncaladoSheet(r.encalado_result_averaged as Record<string, unknown>));
  }
}

/** Build the workbook and trigger a download. */
export function downloadDynamicResultsExcel(results: DynamicResults, filename: string): void {
  const wb = XLSX.utils.book_new();
  if (results.stage === 'encalado') {
    buildEncaladoSheets(wb, results);
  } else {
    buildCascadeSheets(wb, results);
  }
  const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arr], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
