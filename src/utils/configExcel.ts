/* ============================================================
   Excel import/export of ProjectConfig
   One sheet per parameter block — all sheets optional on import
   ============================================================ */

import * as XLSX from 'xlsx';
import type {
  PondConfig,
  EncaladoConfig,
  DailyScheduleItem,
} from '../types';
import { MAIN_SPECIES, TRACE_SPECIES } from '../types';

export interface ExcelConfig {
  brine?: Record<string, number>;
  precon_ponds?: PondConfig[];
  precon_faktor?: number[];
  encalado_config?: EncaladoConfig;
  encalado_faktor?: number[];
  postliming_ponds?: PondConfig[];
  postliming_faktor?: number[];
  daily_schedule?: DailyScheduleItem[];
}

const SHEET = {
  brine: 'Salmuera',
  preconPonds: 'Pozas Precon',
  preconFaktor: 'Factores Precon',
  encalado: 'Encalado',
  encaladoFaktor: 'Factores Encalado',
  postlimingPonds: 'Pozas Postliming',
  postlimingFaktor: 'Factores Postliming',
  schedule: 'Cronograma',
  readme: 'Instrucciones',
} as const;

const PONDS_HEADER = [
  'name',
  'number',
  'area_design_m2',
  'pond_factor',
  'entrainment_pct',
  'leakage_mm_day',
  'dilution_frac',
];

const ENCALADO_FIELDS: (keyof EncaladoConfig)[] = [
  'availability_days_year',
  'boron_removal_fraction',
  'lime_excess_factor',
  'lime_slurry_conc',
  'lime_CaO_purity',
  'CaCl2_SO4_factor',
  'CaCl2_sol_conc',
  'CaCl2_purity',
  'CaCl2_NaCl_fraction',
  'CaCl2_MgCl2_fraction',
  'CaCl2_CaSO4_fraction',
  'cake_retention',
  'cake_wash_ratio',
  'cake_wash_recovery',
  'use_CaCl2',
  'temperature_C',
];

const ALL_SPECIES = [...MAIN_SPECIES, ...TRACE_SPECIES];

/* -------- helpers -------- */

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes';
  }
  return false;
}

function sheetToRows(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
}

/* -------- build sheets (write) -------- */

function brineSheet(brine: Record<string, number> | undefined): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['Especie', 'Valor (ton/dia)']];
  for (const sp of ALL_SPECIES) {
    rows.push([sp, brine?.[sp] ?? 0]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function pondsSheet(ponds: PondConfig[] | undefined): XLSX.WorkSheet {
  const rows: (string | number)[][] = [PONDS_HEADER];
  (ponds ?? []).forEach((p) => {
    rows.push([
      p.name,
      p.number,
      p.area_design_m2,
      p.pond_factor,
      p.entrainment_pct,
      p.leakage_mm_day,
      p.dilution_frac,
    ]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function faktorSheet(factors: number[] | undefined, length = 156): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['indice', 'factor']];
  const arr = factors ?? [];
  for (let i = 0; i < Math.max(length, arr.length); i++) {
    rows.push([i, arr[i] ?? 1]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function encaladoSheet(cfg: EncaladoConfig | undefined): XLSX.WorkSheet {
  const rows: (string | number | boolean)[][] = [['parametro', 'valor']];
  for (const key of ENCALADO_FIELDS) {
    const v = cfg?.[key];
    rows.push([key, v === undefined ? '' : (v as string | number | boolean)]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function scheduleSheet(schedule: DailyScheduleItem[] | undefined): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['date_label', 'temperature_C', 'evap_rate']];
  (schedule ?? []).forEach((d) => {
    rows.push([d.date_label, d.temperature_C, d.evap_rate]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function readmeSheet(): XLSX.WorkSheet {
  const rows = [
    ['Plantilla de Configuracion — AdInfinitum'],
    [],
    ['Hoja', 'Descripcion'],
    [SHEET.brine, 'Salmuera inicial: 17 especies (ton/dia). No borre ni renombre especies.'],
    [SHEET.preconPonds, 'Pozas de preconcentracion. Agregue/elimine filas segun necesite.'],
    [SHEET.preconFaktor, 'Factor[156] de precipitacion preconcentracion (F<1 favorece, F=1 habilita, F>1 inhibe).'],
    [SHEET.encalado, 'Parametros de encalado (clave/valor). use_CaCl2 acepta TRUE/FALSE.'],
    [SHEET.encaladoFaktor, 'Factor[156] de precipitacion encalado.'],
    [SHEET.postlimingPonds, 'Pozas de post-liming.'],
    [SHEET.postlimingFaktor, 'Factor[156] de precipitacion post-liming.'],
    [SHEET.schedule, 'Cronograma diario: date_label, temperatura (C), evaporacion (mm/dia).'],
    [],
    ['Notas'],
    ['- Las hojas no presentes en el archivo se ignoran al importar.'],
    ['- Los nombres de columna (primera fila) deben mantenerse exactos.'],
    ['- Los valores numericos aceptan punto o coma decimal.'],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

/* -------- build workbook -------- */

export function buildWorkbook(cfg: ExcelConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, readmeSheet(), SHEET.readme);
  XLSX.utils.book_append_sheet(wb, brineSheet(cfg.brine), SHEET.brine);
  XLSX.utils.book_append_sheet(wb, pondsSheet(cfg.precon_ponds), SHEET.preconPonds);
  XLSX.utils.book_append_sheet(wb, faktorSheet(cfg.precon_faktor), SHEET.preconFaktor);
  XLSX.utils.book_append_sheet(wb, encaladoSheet(cfg.encalado_config), SHEET.encalado);
  XLSX.utils.book_append_sheet(wb, faktorSheet(cfg.encalado_faktor), SHEET.encaladoFaktor);
  XLSX.utils.book_append_sheet(wb, pondsSheet(cfg.postliming_ponds), SHEET.postlimingPonds);
  XLSX.utils.book_append_sheet(wb, faktorSheet(cfg.postliming_faktor), SHEET.postlimingFaktor);
  XLSX.utils.book_append_sheet(wb, scheduleSheet(cfg.daily_schedule), SHEET.schedule);
  return wb;
}

export function downloadExcel(cfg: ExcelConfig, filename: string): void {
  const wb = buildWorkbook(cfg);
  XLSX.writeFile(wb, filename);
}

/* -------- parse sheets (read) -------- */

function parseBrine(ws: XLSX.WorkSheet): Record<string, number> {
  const rows = sheetToRows(ws);
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    const name = String(r['Especie'] ?? r['especie'] ?? '').trim();
    if (!name) return;
    out[name] = toNum(r['Valor (ton/dia)'] ?? r['Valor'] ?? r['valor']);
  });
  return out;
}

function parsePonds(ws: XLSX.WorkSheet): PondConfig[] {
  const rows = sheetToRows(ws);
  return rows
    .filter((r) => String(r['name'] ?? '').trim() !== '')
    .map((r) => ({
      name: String(r['name']),
      number: toNum(r['number']),
      area_design_m2: toNum(r['area_design_m2']),
      pond_factor: toNum(r['pond_factor'], 0.7),
      entrainment_pct: toNum(r['entrainment_pct'], 10),
      leakage_mm_day: toNum(r['leakage_mm_day'], 0.03),
      dilution_frac: toNum(r['dilution_frac'], 0.005),
    }));
}

function parseFaktor(ws: XLSX.WorkSheet, length = 156): number[] {
  const rows = sheetToRows(ws);
  const arr = new Array<number>(length).fill(1);
  rows.forEach((r) => {
    const idx = toNum(r['indice'] ?? r['index'], -1);
    if (idx < 0 || idx >= length) return;
    arr[idx] = toNum(r['factor'], 1);
  });
  return arr;
}

function parseEncalado(ws: XLSX.WorkSheet): Partial<EncaladoConfig> {
  const rows = sheetToRows(ws);
  const out: Record<string, unknown> = {};
  rows.forEach((r) => {
    const key = String(r['parametro'] ?? r['Parametro'] ?? '').trim();
    if (!key) return;
    const raw = r['valor'] ?? r['Valor'];
    if (key === 'use_CaCl2') {
      out[key] = toBool(raw);
    } else {
      out[key] = toNum(raw);
    }
  });
  return out as Partial<EncaladoConfig>;
}

function parseSchedule(ws: XLSX.WorkSheet): DailyScheduleItem[] {
  const rows = sheetToRows(ws);
  return rows
    .filter((r) => String(r['date_label'] ?? '').trim() !== '')
    .map((r) => ({
      date_label: String(r['date_label']),
      temperature_C: toNum(r['temperature_C']),
      evap_rate: toNum(r['evap_rate']),
    }));
}

/* -------- parse workbook -------- */

export async function parseWorkbookFile(file: File): Promise<ExcelConfig> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const out: ExcelConfig = {};

  const get = (name: string) => wb.Sheets[name];

  if (get(SHEET.brine)) out.brine = parseBrine(get(SHEET.brine));
  if (get(SHEET.preconPonds)) out.precon_ponds = parsePonds(get(SHEET.preconPonds));
  if (get(SHEET.preconFaktor)) out.precon_faktor = parseFaktor(get(SHEET.preconFaktor));
  if (get(SHEET.encalado)) {
    out.encalado_config = parseEncalado(get(SHEET.encalado)) as EncaladoConfig;
  }
  if (get(SHEET.encaladoFaktor)) out.encalado_faktor = parseFaktor(get(SHEET.encaladoFaktor));
  if (get(SHEET.postlimingPonds)) out.postliming_ponds = parsePonds(get(SHEET.postlimingPonds));
  if (get(SHEET.postlimingFaktor))
    out.postliming_faktor = parseFaktor(get(SHEET.postlimingFaktor));
  if (get(SHEET.schedule)) out.daily_schedule = parseSchedule(get(SHEET.schedule));

  return out;
}
