/* ============================================================
   Excel import/export of DynamicConfig
   One sheet per parameter block — all sheets optional on import.
   Mirrors the pattern of configExcel.ts for the static model.
   ============================================================ */

import * as XLSX from 'xlsx';
import type {
  DynamicConfig,
  DynamicEncaladoParams,
  DynamicPondConfig,
  DynamicPostlimingParams,
  DynamicPostlimingPondConfig,
  SaltFactor,
} from '../types';
import { BRINE_SPECIES_ORDER } from '../types';

const SHEET = {
  readme: 'Instrucciones',
  simulation: 'Simulacion',
  brine: 'Salmuera',
  preconPonds: 'Pozas Precon',
  preconFactors: 'Factores Precon',
  climate: 'Clima',
  encalado: 'Encalado',
  encaladoFactors: 'Factores Encalado',
  postlimingPonds: 'Pozas Postliming',
  postlimingParams: 'Postliming Params',
  postlimingFactors: 'Factores Postliming',
} as const;

const PRECON_PONDS_HEADER = [
  'name',
  'number',
  'area_design_m2',
  'pond_factor',
  'entrainment_pct',
  'leakage_mm_day',
  'dilution_frac',
  'target_height_m',
  'control_mode',
  'apply_berm_factor',
  'is_terminal_buffer',
  'target_outflow_t_day',
  'utilization',
  'height_floor_m',
  'h_arranque_m',
  'max_height_m',
];

const POSTLIMING_PONDS_HEADER = [
  'name',
  'designation',
  'area_m2',
  'control_mode',
  'buffer_height_m',
  'target_height_m',
  'height_floor_m',
  'evap_factor',
  'leakage_mm_d',
  'entrainment_pct',
  'dilution_frac',
  'pond_factor',
];

const ENCALADO_FIELDS: (keyof DynamicEncaladoParams)[] = [
  'availability_days_year',
  'temperature_C',
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
  'use_CaCl2_threshold',
  'use_CaCl2_threshold_basis',
  'abort_on_aqsol_fail_pct',
  'max_iter_fn',
  'fn_tolerance',
];

const POSTLIMING_PARAM_FIELDS: (keyof DynamicPostlimingParams)[] = [
  'n_days_max',
  'temperature_C',
  'abort_on_aqsol_fail_pct',
  'validation_window_days',
  'salts_allowed',
];

// =========================================================
// Helpers
// =========================================================

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toOptNum(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = toNum(v, NaN);
  return Number.isFinite(n) ? n : null;
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

// =========================================================
// Build sheets (write)
// =========================================================

function readmeSheet(): XLSX.WorkSheet {
  const rows = [
    ['Plantilla de Configuracion DINAMICA — AdInfinitum'],
    [],
    ['Hoja', 'Descripcion'],
    [SHEET.simulation, 'n_days, start_date, y modulacion de flujo de la cascada.'],
    [SHEET.brine, 'Salmuera inicial: 17 especies (ton/dia). No borre ni renombre especies.'],
    [SHEET.preconPonds, 'Pozas Pz1-Pz7. Incluye control_mode (ALTURA/FLUJO_FIJO) y campos especificos.'],
    [SHEET.preconFactors, 'Factores de inhibicion preconcentracion: 137 sales (dll_index, name, factor).'],
    [SHEET.climate, 'Serie climatica diaria: day, evap_mm_day, temp_C. Una fila por dia.'],
    [SHEET.encalado, 'Parametros encalado dinamico (clave/valor). use_CaCl2 acepta TRUE/FALSE.'],
    [SHEET.encaladoFactors, 'Factores de inhibicion encalado: 137 sales (dll_index, name, factor).'],
    [SHEET.postlimingPonds, 'Pozas Pz10-Pz18. control_mode CASCADE/BUFFER/FLUJO_FIJO.'],
    [SHEET.postlimingParams, 'Parametros postliming + listas (validation_window y salts_allowed coma-separadas).'],
    [SHEET.postlimingFactors, 'Factores de inhibicion postliming: 137 sales.'],
    [],
    ['Notas'],
    ['- Las hojas no presentes en el archivo se ignoran al importar.'],
    ['- Los nombres de columna (primera fila) deben mantenerse exactos.'],
    ['- Los valores numericos aceptan punto o coma decimal.'],
    ['- Celdas vacias en campos opcionales se interpretan como null.'],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function simulationSheet(cfg: DynamicConfig): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['parametro', 'valor']];
  rows.push(['n_days', cfg.simulation.n_days]);
  rows.push(['start_date', cfg.simulation.start_date]);
  rows.push(['average_flow_ton_day', cfg.precon.average_flow_ton_day]);
  rows.push(['max_flow_ton_day', cfg.precon.max_flow_ton_day]);
  rows.push(['flow_modulation', cfg.precon.flow_modulation]);
  rows.push(['n_days_consecutive_regime', cfg.precon.n_days_consecutive_regime]);
  return XLSX.utils.aoa_to_sheet(rows);
}

function brineSheet(brine: Record<string, number>): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['Especie', 'Valor (ton/dia)']];
  for (const sp of BRINE_SPECIES_ORDER) {
    rows.push([sp, brine[sp] ?? 0]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function preconPondsSheet(ponds: DynamicPondConfig[]): XLSX.WorkSheet {
  const rows: (string | number | boolean | null)[][] = [PRECON_PONDS_HEADER];
  ponds.forEach((p) => {
    rows.push([
      p.name,
      p.number,
      p.area_design_m2,
      p.pond_factor,
      p.entrainment_pct,
      p.leakage_mm_day,
      p.dilution_frac,
      p.target_height_m,
      p.control_mode,
      p.apply_berm_factor,
      p.is_terminal_buffer,
      p.target_outflow_t_day,
      p.utilization,
      p.height_floor_m,
      p.h_arranque_m,
      p.max_height_m,
    ]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function postlimingPondsSheet(ponds: DynamicPostlimingPondConfig[]): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [POSTLIMING_PONDS_HEADER];
  ponds.forEach((p) => {
    rows.push([
      p.name,
      p.designation,
      p.area_m2,
      p.control_mode,
      p.buffer_height_m,
      p.target_height_m,
      p.height_floor_m,
      p.evap_factor,
      p.leakage_mm_d,
      p.entrainment_pct,
      p.dilution_frac,
      p.pond_factor,
    ]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function climateSheet(climate: DynamicConfig['climate']): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['day', 'evap_mm_day', 'temp_C']];
  rows.push([`# series_start_date=${climate.series_start_date}`, '', '']);
  const n = climate.evaporation_mm_day.length;
  for (let i = 0; i < n; i++) {
    rows.push([i, climate.evaporation_mm_day[i], climate.temperature_C[i]]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function encaladoSheet(cfg: DynamicEncaladoParams): XLSX.WorkSheet {
  const rows: (string | number | boolean | null)[][] = [['parametro', 'valor']];
  for (const key of ENCALADO_FIELDS) {
    const v = cfg[key];
    rows.push([key, v === undefined ? null : (v as string | number | boolean | null)]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function postlimingParamsSheet(p: DynamicPostlimingParams): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [['parametro', 'valor']];
  rows.push(['n_days_max', p.n_days_max]);
  rows.push(['temperature_C', p.temperature_C]);
  rows.push(['abort_on_aqsol_fail_pct', p.abort_on_aqsol_fail_pct]);
  rows.push(['validation_window_days', p.validation_window_days.join(',')]);
  rows.push(['salts_allowed', p.salts_allowed.join(',')]);
  return XLSX.utils.aoa_to_sheet(rows);
}

function factorsSheet(factors: SaltFactor[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['dll_index', 'name', 'precipitation_factor']];
  factors.forEach((f) => rows.push([f.dll_index, f.name, f.precipitation_factor]));
  return XLSX.utils.aoa_to_sheet(rows);
}

// =========================================================
// Build workbook + download
// =========================================================

export function buildDynamicWorkbook(cfg: DynamicConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, readmeSheet(), SHEET.readme);
  XLSX.utils.book_append_sheet(wb, simulationSheet(cfg), SHEET.simulation);
  XLSX.utils.book_append_sheet(wb, brineSheet(cfg.brine), SHEET.brine);
  XLSX.utils.book_append_sheet(wb, preconPondsSheet(cfg.precon.ponds), SHEET.preconPonds);
  XLSX.utils.book_append_sheet(wb, factorsSheet(cfg.precon.factors ?? []), SHEET.preconFactors);
  XLSX.utils.book_append_sheet(wb, climateSheet(cfg.climate), SHEET.climate);
  XLSX.utils.book_append_sheet(wb, encaladoSheet(cfg.encalado.config), SHEET.encalado);
  XLSX.utils.book_append_sheet(wb, factorsSheet(cfg.encalado.factors), SHEET.encaladoFactors);
  XLSX.utils.book_append_sheet(wb, postlimingPondsSheet(cfg.postliming.ponds), SHEET.postlimingPonds);
  XLSX.utils.book_append_sheet(wb, postlimingParamsSheet(cfg.postliming.config), SHEET.postlimingParams);
  XLSX.utils.book_append_sheet(wb, factorsSheet(cfg.postliming.factors), SHEET.postlimingFactors);
  return wb;
}

export function downloadDynamicExcel(cfg: DynamicConfig, filename: string): void {
  const wb = buildDynamicWorkbook(cfg);
  XLSX.writeFile(wb, filename);
}

// =========================================================
// Parse sheets (read)
// =========================================================

interface ParsedDynamic {
  simulation?: Partial<DynamicConfig['simulation']>;
  precon_meta?: Partial<Pick<DynamicConfig['precon'], 'average_flow_ton_day' | 'max_flow_ton_day' | 'flow_modulation' | 'n_days_consecutive_regime'>>;
  brine?: Record<string, number>;
  precon_ponds?: DynamicPondConfig[];
  precon_factors?: SaltFactor[];
  climate?: DynamicConfig['climate'];
  encalado_config?: DynamicEncaladoParams;
  encalado_factors?: SaltFactor[];
  postliming_ponds?: DynamicPostlimingPondConfig[];
  postliming_config?: DynamicPostlimingParams;
  postliming_factors?: SaltFactor[];
}

function parseSimulation(ws: XLSX.WorkSheet): {
  simulation: Partial<DynamicConfig['simulation']>;
  precon_meta: Partial<Pick<DynamicConfig['precon'], 'average_flow_ton_day' | 'max_flow_ton_day' | 'flow_modulation' | 'n_days_consecutive_regime'>>;
} {
  const rows = sheetToRows(ws);
  const sim: Partial<DynamicConfig['simulation']> = {};
  const meta: Partial<Pick<DynamicConfig['precon'], 'average_flow_ton_day' | 'max_flow_ton_day' | 'flow_modulation' | 'n_days_consecutive_regime'>> = {};
  rows.forEach((r) => {
    const key = String(r['parametro'] ?? r['Parametro'] ?? '').trim();
    const raw = r['valor'] ?? r['Valor'];
    if (!key) return;
    switch (key) {
      case 'n_days':
        sim.n_days = toNum(raw);
        break;
      case 'start_date':
        sim.start_date = String(raw).trim();
        break;
      case 'average_flow_ton_day':
        meta.average_flow_ton_day = toNum(raw);
        break;
      case 'max_flow_ton_day':
        meta.max_flow_ton_day = toNum(raw);
        break;
      case 'flow_modulation': {
        const v = String(raw).trim();
        if (v === 'seasonal' || v === 'constant_until_regime') {
          meta.flow_modulation = v;
        }
        break;
      }
      case 'n_days_consecutive_regime':
        meta.n_days_consecutive_regime = toNum(raw);
        break;
    }
  });
  return { simulation: sim, precon_meta: meta };
}

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

function parsePreconPonds(ws: XLSX.WorkSheet): DynamicPondConfig[] {
  const rows = sheetToRows(ws);
  return rows
    .filter((r) => String(r['name'] ?? '').trim() !== '')
    .map((r) => {
      const cm = String(r['control_mode'] ?? 'ALTURA').trim();
      return {
        name: String(r['name']),
        number: toNum(r['number']),
        area_design_m2: toNum(r['area_design_m2']),
        pond_factor: toNum(r['pond_factor'], 0.7),
        entrainment_pct: toNum(r['entrainment_pct'], 10),
        leakage_mm_day: toNum(r['leakage_mm_day'], 0.03),
        dilution_frac: toNum(r['dilution_frac'], 0.005),
        target_height_m: toOptNum(r['target_height_m']),
        max_height_m: toOptNum(r['max_height_m']),
        is_terminal_buffer: toBool(r['is_terminal_buffer']),
        apply_berm_factor: toBool(r['apply_berm_factor']),
        control_mode: cm === 'FLUJO_FIJO' ? 'FLUJO_FIJO' : 'ALTURA',
        target_outflow_t_day: toOptNum(r['target_outflow_t_day']),
        utilization: toNum(r['utilization'], 1.0),
        height_floor_m: toOptNum(r['height_floor_m']),
        h_arranque_m: toNum(r['h_arranque_m'], 0),
      };
    });
}

function parsePostlimingPonds(ws: XLSX.WorkSheet): DynamicPostlimingPondConfig[] {
  const rows = sheetToRows(ws);
  return rows
    .filter((r) => String(r['name'] ?? '').trim() !== '')
    .map((r) => {
      const cm = String(r['control_mode'] ?? 'CASCADE').trim();
      const validCm: DynamicPostlimingPondConfig['control_mode'] =
        cm === 'BUFFER' || cm === 'FLUJO_FIJO' ? cm : 'CASCADE';
      return {
        name: String(r['name']),
        designation: r['designation'] ? String(r['designation']) : null,
        area_m2: toNum(r['area_m2']),
        control_mode: validCm,
        buffer_height_m: toOptNum(r['buffer_height_m']),
        target_height_m: toNum(r['target_height_m'], 0.20),
        height_floor_m: toNum(r['height_floor_m'], 0.10),
        evap_factor: toNum(r['evap_factor'], 1.0),
        leakage_mm_d: toNum(r['leakage_mm_d'], 0.03),
        entrainment_pct: toNum(r['entrainment_pct'], 20.0),
        dilution_frac: toNum(r['dilution_frac'], 0.005),
        pond_factor: toNum(r['pond_factor'], 0.7),
      };
    });
}

function parseClimate(ws: XLSX.WorkSheet, existing: DynamicConfig['climate']): DynamicConfig['climate'] {
  const rows = sheetToRows(ws);
  let startDate = existing.series_start_date;
  const evap: number[] = [];
  const temp: number[] = [];
  rows.forEach((r) => {
    const dayRaw = String(r['day'] ?? '').trim();
    // Allow a header annotation row like '# series_start_date=2024-01-01'
    if (dayRaw.startsWith('#')) {
      const m = dayRaw.match(/series_start_date=([\d-]+)/);
      if (m) startDate = m[1];
      return;
    }
    if (dayRaw === '') return;
    evap.push(toNum(r['evap_mm_day'] ?? r['evap']));
    temp.push(toNum(r['temp_C'] ?? r['temperature_C']));
  });
  return { series_start_date: startDate, evaporation_mm_day: evap, temperature_C: temp };
}

function parseEncalado(ws: XLSX.WorkSheet): DynamicEncaladoParams {
  const rows = sheetToRows(ws);
  const out: Record<string, unknown> = {};
  rows.forEach((r) => {
    const key = String(r['parametro'] ?? r['Parametro'] ?? '').trim();
    if (!key) return;
    const raw = r['valor'] ?? r['Valor'];
    if (key === 'use_CaCl2') out[key] = toBool(raw);
    else if (key === 'use_CaCl2_threshold') out[key] = toOptNum(raw);
    else if (key === 'use_CaCl2_threshold_basis') out[key] = String(raw ?? '').trim() || 'feed_raw_so4_mg';
    else if (key === 'max_iter_fn') out[key] = Math.round(toNum(raw, 10));
    else out[key] = toNum(raw);
  });
  return out as unknown as DynamicEncaladoParams;
}

function parsePostlimingParams(ws: XLSX.WorkSheet): DynamicPostlimingParams {
  const rows = sheetToRows(ws);
  const out: Partial<DynamicPostlimingParams> = {};
  rows.forEach((r) => {
    const key = String(r['parametro'] ?? r['Parametro'] ?? '').trim();
    if (!key) return;
    const raw = r['valor'] ?? r['Valor'];
    switch (key) {
      case 'n_days_max':
        out.n_days_max = toNum(raw);
        break;
      case 'temperature_C':
        out.temperature_C = toOptNum(raw);
        break;
      case 'abort_on_aqsol_fail_pct':
        out.abort_on_aqsol_fail_pct = toNum(raw);
        break;
      case 'validation_window_days':
        out.validation_window_days = String(raw)
          .split(',')
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));
        break;
      case 'salts_allowed':
        out.salts_allowed = String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
    }
  });
  return {
    n_days_max: out.n_days_max ?? 1460,
    temperature_C: out.temperature_C ?? 5.3,
    abort_on_aqsol_fail_pct: out.abort_on_aqsol_fail_pct ?? 5.0,
    validation_window_days: out.validation_window_days ?? [1095, 1460],
    salts_allowed: out.salts_allowed ?? [],
  };
}

function parseFactors(ws: XLSX.WorkSheet): SaltFactor[] {
  const rows = sheetToRows(ws);
  return rows
    .filter((r) => String(r['name'] ?? '').trim() !== '')
    .map((r) => ({
      dll_index: toNum(r['dll_index']),
      name: String(r['name']),
      precipitation_factor: toNum(r['precipitation_factor'], 1),
    }));
}

// =========================================================
// Parse workbook
// =========================================================

export async function parseDynamicWorkbookFile(
  file: File,
  baseConfig: DynamicConfig,
): Promise<ParsedDynamic> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const out: ParsedDynamic = {};
  const get = (name: string) => wb.Sheets[name];

  if (get(SHEET.simulation)) {
    const s = parseSimulation(get(SHEET.simulation));
    out.simulation = s.simulation;
    out.precon_meta = s.precon_meta;
  }
  if (get(SHEET.brine)) out.brine = parseBrine(get(SHEET.brine));
  if (get(SHEET.preconPonds)) out.precon_ponds = parsePreconPonds(get(SHEET.preconPonds));
  if (get(SHEET.preconFactors)) out.precon_factors = parseFactors(get(SHEET.preconFactors));
  if (get(SHEET.climate)) out.climate = parseClimate(get(SHEET.climate), baseConfig.climate);
  if (get(SHEET.encalado)) out.encalado_config = parseEncalado(get(SHEET.encalado));
  if (get(SHEET.encaladoFactors)) out.encalado_factors = parseFactors(get(SHEET.encaladoFactors));
  if (get(SHEET.postlimingPonds))
    out.postliming_ponds = parsePostlimingPonds(get(SHEET.postlimingPonds));
  if (get(SHEET.postlimingParams))
    out.postliming_config = parsePostlimingParams(get(SHEET.postlimingParams));
  if (get(SHEET.postlimingFactors))
    out.postliming_factors = parseFactors(get(SHEET.postlimingFactors));

  return out;
}

// =========================================================
// Merge parsed result into a base config (only present sections)
// =========================================================

export function applyParsedToConfig(
  base: DynamicConfig,
  parsed: ParsedDynamic,
): { next: DynamicConfig; applied: string[] } {
  const next: DynamicConfig = {
    ...base,
    precon: { ...base.precon },
    encalado: { ...base.encalado },
    postliming: { ...base.postliming },
  };
  const applied: string[] = [];

  if (parsed.simulation) {
    next.simulation = { ...base.simulation, ...parsed.simulation };
    applied.push('simulacion');
  }
  if (parsed.precon_meta) {
    next.precon = { ...next.precon, ...parsed.precon_meta };
    applied.push('precon meta');
  }
  if (parsed.brine) {
    next.brine = parsed.brine;
    applied.push('salmuera');
  }
  if (parsed.precon_ponds) {
    next.precon = { ...next.precon, ponds: parsed.precon_ponds };
    applied.push('pozas precon');
  }
  if (parsed.precon_factors) {
    next.precon = { ...next.precon, factors: parsed.precon_factors };
    applied.push('factores precon');
  }
  if (parsed.climate) {
    next.climate = parsed.climate;
    applied.push('clima');
  }
  if (parsed.encalado_config) {
    next.encalado = { ...next.encalado, config: parsed.encalado_config };
    applied.push('encalado');
  }
  if (parsed.encalado_factors) {
    next.encalado = { ...next.encalado, factors: parsed.encalado_factors };
    applied.push('factores encalado');
  }
  if (parsed.postliming_ponds) {
    next.postliming = { ...next.postliming, ponds: parsed.postliming_ponds };
    applied.push('pozas postliming');
  }
  if (parsed.postliming_config) {
    next.postliming = { ...next.postliming, config: parsed.postliming_config };
    applied.push('postliming params');
  }
  if (parsed.postliming_factors) {
    next.postliming = { ...next.postliming, factors: parsed.postliming_factors };
    applied.push('factores postliming');
  }

  return { next, applied };
}
