/* ============================================================
   Client-side Excel export of an Execution.
   One sheet per UI tab: Resumen, Global, Preconcentracion,
   Encalado, Post-liming, Graficos, Parametros (+ Resumen Diario
   for multi-day). Uses whatever data is currently passed in,
   so it respects Promedio / Día específico view mode.
   ============================================================ */

import * as XLSX from 'xlsx';
import { boronFrom } from './boron';
import { buildWellBrineFeedAoa } from './wellBrineFeed';
import { speciesWithExtras } from './species';
import { readDailyResult, type DailyResultRow } from './dailyResult';
import type {
  ExecutionResult,
  PondResult,
  SolverResult,
} from '../types';
import type {
  GlobalStreamId,
  GlobalStreamValues,
} from '../components/GlobalBalanceTable';

interface StageData {
  label: string;
  result: SolverResult;
  temperature_C?: number;
}

export interface ExportInput {
  execution: ExecutionResult;
  stages: StageData[];
  encalado: Record<string, unknown> | null;
  streams: Partial<Record<GlobalStreamId, GlobalStreamValues>>;
  isMultiDay: boolean;
  viewMode: 'average' | 'day';
  validDaysCount: number;
  dailyResults?: DailyResultRow[];
  /**
   * Balance global resuelto por día. Lo arma la página, que es donde vive el mapeo de
   * resultados a las 16 corrientes; acá solo se vuelca. Solo en corridas multi-día.
   */
  dailyStreams?: Array<{
    day: number;
    date_label: string;
    streams: Partial<Record<GlobalStreamId, GlobalStreamValues>>;
  }>;
}

// Las especies a listar salen de utils/species.ts: orden canonico primero y despues
// cualquier otra que el motor haya devuelto (la 066 agrega Ba++, Sr++, NO3-, NH4+…).

// ------- sheet-name sanitisation (Excel rules) -------
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Sheet';
}

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  aoa: unknown[][],
): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const final = safeSheetName(name);
  // Avoid collisions (multiple "Preconcentracion" stages from different days)
  let n = final;
  let i = 2;
  while (wb.SheetNames.includes(n)) {
    const suffix = ` (${i})`;
    n = final.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  XLSX.utils.book_append_sheet(wb, ws, n);
}

// -------- Resumen sheet (KPIs per stage + encalado KPIs) --------
function buildResumenSheet(input: ExportInput): unknown[][] {
  const aoa: unknown[][] = [];
  aoa.push(['Ejecución', input.execution.id]);
  aoa.push(['Tipo', input.execution.execution_type]);
  aoa.push(['Estado', input.execution.status]);
  if (input.isMultiDay) {
    aoa.push([
      'Vista',
      input.viewMode === 'average'
        ? `Promedio (${input.validDaysCount} días válidos)`
        : 'Día específico',
    ]);
  }
  aoa.push([]);

  for (const s of input.stages) {
    aoa.push([s.label]);
    aoa.push(['Concepto', 'Valor', 'Unidad']);
    aoa.push(['Li+ entrada', s.result.li_in, 'ton/d']);
    aoa.push(['Li+ salida', s.result.li_out, 'ton/d']);
    aoa.push(['Recuperación Li', s.result.li_recovery_pct, '%']);
    aoa.push(['Flujo salida', s.result.final_outlet_flow, 'ton/d']);
    aoa.push(['Evaporación total', s.result.total_evaporation, 'ton/d']);
    aoa.push(['Sales totales', s.result.total_salt, 'ton/d']);
    aoa.push(['Entrainment total', s.result.total_entrainment, 'ton/d']);
    aoa.push(['Fugas totales', s.result.total_leakage, 'ton/d']);
    if (s.temperature_C != null) {
      aoa.push(['Temperatura', s.temperature_C, '°C']);
    }
    aoa.push([]);
  }

  if (input.encalado) {
    const r = input.encalado;
    const n = (k: string) => {
      const v = r[k];
      return typeof v === 'number' && Number.isFinite(v) ? v : '';
    };
    aoa.push(['Planta de Reactivos']);
    aoa.push(['Concepto', 'Valor', 'Unidad']);
    aoa.push(['Entrada (ajustada)', n('input_flow'), 'ton/d']);
    aoa.push(['Salida P2519', n('total_liquid_output'), 'ton/d']);
    aoa.push(['Salida ajustada', n('output_adjusted_flow'), 'ton/d']);
    aoa.push(['Sólidos secos', n('total_solids_dry'), 'ton/d']);
    aoa.push(['Sólidos húmedos', n('total_solids_wet'), 'ton/d']);
    aoa.push(['Sales AQSOL #1', n('solids_aqsol1'), 'ton/d']);
    aoa.push(['Sales AQSOL #2', n('solids_aqsol2'), 'ton/d']);
    aoa.push(['H3BO3 removido', n('H3BO3_removed'), 'ton/d']);
    aoa.push(['Lavado queque', n('cake_wash_flow'), 'ton/d']);
  }

  return aoa;
}

// -------- Global sheet (16-stream balance, mirror of GlobalBalanceTable) --------
const GLOBAL_STREAM_ORDER: GlobalStreamId[] = [
  '2001', '2002', '2003', '2004', '2005', '2006',
  '2501', '2502', '2503', '2504',
  '3001', '3002', '3003', '3004', '3005', '3006',
];
const GLOBAL_STREAM_NAMES: Record<GlobalStreamId, string> = {
  '2001': 'Well Field',
  '2002': 'Salts and entrainment from Preconcentration Pond',
  '2003': 'Leakage in Preconcentration Pond',
  '2004': 'Evaporation from Preconcentration Pond',
  '2005': 'Dilution Water for preconcentration Ponds',
  '2006': 'Brine Out from Preconcentration Pond',
  '2501': 'Lime',
  '2502': 'Calcium Chloride',
  '2503': 'Water',
  '2504': 'Liming Salts',
  '3001': 'After liming Brine',
  '3002': 'Salts Harvested from Postliming Pond',
  '3003': 'Leakage in PostLiming Pond',
  '3004': 'Evaporation from Postliming Pond',
  '3005': 'Dilution Water for Postliming Ponds',
  '3006': 'Brine Out from Postliming Pond',
};
const DEFAULT_PONDS_DAYS_YEAR = 365;
const DEFAULT_ENCALADO_DAYS_YEAR = 328.5;

interface PhaseDaysYear {
  precon: number;
  encalado: number;
  postliming: number;
}

function daysForGlobalStream(id: GlobalStreamId, days: PhaseDaysYear): number {
  if (id.startsWith('25')) return days.encalado;
  if (id.startsWith('30')) return days.postliming;
  return days.precon;
}

function buildGlobalSheet(input: ExportInput): unknown[][] {
  const { streams } = input;
  const snap = input.execution.parameters_snapshot ?? {};
  const encaladoCfg = snap.encalado_config as Record<string, unknown> | undefined;
  const days: PhaseDaysYear = {
    precon: (snap.precon_days_year as number | undefined) ?? DEFAULT_PONDS_DAYS_YEAR,
    encalado:
      (snap.encalado_days_year as number | undefined) ??
      (encaladoCfg?.availability_days_year as number | undefined) ??
      DEFAULT_ENCALADO_DAYS_YEAR,
    postliming: (snap.postliming_days_year as number | undefined) ?? DEFAULT_PONDS_DAYS_YEAR,
  };
  const aoa: unknown[][] = [];

  // Phase header
  const phaseRow: unknown[] = ['', ''];
  for (const id of GLOBAL_STREAM_ORDER) {
    const phase = id.startsWith('20')
      ? 'PRECONCENTRACION'
      : id.startsWith('25')
        ? 'ENCALADO'
        : 'POSTLIMING';
    phaseRow.push(phase);
  }
  aoa.push(phaseRow);

  // Stream IDs
  aoa.push(['ID', '', ...GLOBAL_STREAM_ORDER.map((id) => `P_${id}`)]);
  // Stream names
  aoa.push(['Nombre', '', ...GLOBAL_STREAM_ORDER.map((id) => GLOBAL_STREAM_NAMES[id])]);

  const pick = (id: GlobalStreamId, key: keyof GlobalStreamValues): number | string => {
    const v = streams[id]?.[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : '';
  };

  const derive = (id: GlobalStreamId, key: keyof GlobalStreamValues): number | string => {
    // Derived values for 2006 and 3006 (already resolved by the component,
    // but streams here is the raw input). Recompute if missing.
    const v = streams[id]?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (id === '2006') {
      const add = ['2001', '2005'] as GlobalStreamId[];
      const sub = ['2002', '2003', '2004'] as GlobalStreamId[];
      let s = 0;
      let any = false;
      for (const a of add) {
        const vv = streams[a]?.[key];
        if (typeof vv === 'number' && Number.isFinite(vv)) {
          s += vv;
          any = true;
        }
      }
      for (const a of sub) {
        const vv = streams[a]?.[key];
        if (typeof vv === 'number' && Number.isFinite(vv)) {
          s -= vv;
          any = true;
        }
      }
      return any ? s : '';
    }
    if (id === '3006') {
      const add = ['3001', '3005'] as GlobalStreamId[];
      const sub = ['3002', '3003', '3004'] as GlobalStreamId[];
      let s = 0;
      let any = false;
      for (const a of add) {
        const vv = streams[a]?.[key];
        if (typeof vv === 'number' && Number.isFinite(vv)) {
          s += vv;
          any = true;
        }
      }
      for (const a of sub) {
        const vv = streams[a]?.[key];
        if (typeof vv === 'number' && Number.isFinite(vv)) {
          s -= vv;
          any = true;
        }
      }
      return any ? s : '';
    }
    return '';
  };

  const valueRow = (
    label: string,
    unit: string,
    key: keyof GlobalStreamValues,
    multiplier = 1,
  ): unknown[] => [
    label,
    unit,
    ...GLOBAL_STREAM_ORDER.map((id) => {
      const v = derive(id, key);
      return typeof v === 'number' ? v * multiplier : '';
    }),
  ];

  aoa.push(['h/year', 'h/year', ...GLOBAL_STREAM_ORDER.map(() => 7884)]);
  aoa.push(['h/day', 'h/day', ...GLOBAL_STREAM_ORDER.map(() => 24)]);
  aoa.push([
    'day/year',
    'day/year',
    ...GLOBAL_STREAM_ORDER.map((id) => daysForGlobalStream(id, days)),
  ]);
  // Total Mass year = total_mass_day * day/year (per-phase)
  aoa.push([
    'Total Mass',
    'ton/year',
    ...GLOBAL_STREAM_ORDER.map((id) => {
      const y = streams[id]?.total_mass_year;
      if (typeof y === 'number' && Number.isFinite(y)) return y;
      const d = derive(id, 'total_mass_day');
      return typeof d === 'number' ? d * daysForGlobalStream(id, days) : '';
    }),
  ]);
  aoa.push(valueRow('Total Mass', 'ton/d', 'total_mass_day'));
  aoa.push(valueRow('Solids', 'ton/d', 'solids_day'));
  aoa.push(valueRow('Liquids', 'ton/d', 'liquids_day'));
  aoa.push(valueRow('Density', 'kg/m³', 'density'));
  aoa.push(valueRow('Moisture', '%', 'moisture'));
  aoa.push(valueRow('Temperature', '°C', 'temperature'));

  return aoa;
}

// -------- Per-stage pond detail (mirrors PondDetailBreakdown) --------
function buildPondDetailSheet(s: StageData): unknown[][] {
  const ponds = s.result.ponds || [];
  const aoa: unknown[][] = [];
  aoa.push([s.label]);
  if (s.temperature_C != null) {
    aoa.push(['Temperatura', s.temperature_C, '°C']);
  }
  aoa.push([]);

  const colLabels = ponds.map((p: PondResult, i: number) => {
    const cfg = p.config || ({} as PondResult['config']);
    const name = cfg.name || `Poza ${i + 1}`;
    return cfg.number != null ? `P${cfg.number} - ${name}` : name;
  });

  const aq = (p: PondResult): Record<string, unknown> =>
    (p.aqsol_result as unknown as Record<string, unknown>) || {};
  const cfg = (p: PondResult): Record<string, unknown> =>
    (p.config as unknown as Record<string, unknown>) || {};
  const num = (v: unknown): number | '' => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return '';
  };

  // Section 1: Metricas generales
  aoa.push(['METRICAS GENERALES']);
  aoa.push(['Métrica', ...colLabels]);
  aoa.push(['Sales precipitadas (ton/d)', ...ponds.map((p) => num(p.salt_precipitated))]);
  aoa.push(['Masa líquido impregnado (ton/d)', ...ponds.map((p) => num(p.entrainment))]);
  aoa.push(['Evaporación (ton/d)', ...ponds.map((p) => num(p.evaporation))]);
  aoa.push(['Infiltración (ton/d)', ...ponds.map((p) => num(p.leakage))]);
  aoa.push(['Dilución (ton/d)', ...ponds.map((p) => num(p.dilution))]);
  aoa.push(['Flujo salida (ton/d)', ...ponds.map((p) => num(p.outlet_flow))]);
  aoa.push(['Densidad líquida (kg/m³)', ...ponds.map((p) => num(aq(p).density_liquid))]);
  aoa.push(['Densidad sólida (kg/m³)', ...ponds.map((p) => num(aq(p).density_solid))]);
  aoa.push([
    'Temperatura (°C)',
    ...ponds.map(() => (s.temperature_C != null ? s.temperature_C : '')),
  ]);
  aoa.push(['pH', ...ponds.map((p) => num(aq(p).pH))]);
  aoa.push(['Actividad de agua (aw)', ...ponds.map((p) => num(aq(p).water_activity))]);
  aoa.push(['Fuerza iónica', ...ponds.map((p) => num(aq(p).ionic_strength))]);
  // El backend pre-multiplica por 1.08 para neutralizar el descuento de bermas del
  // motor; dividir acá devuelve el área configurada (= área de proceso). Se quitó la
  // fila "Área de diseño": con factor 1 no hay tal distinción.
  aoa.push([
    'Área de proceso (m²)',
    ...ponds.map((p) => {
      const a = num(cfg(p).area_design_m2);
      return typeof a === 'number' ? a / 1.08 : '';
    }),
  ]);
  aoa.push(['Iteraciones', ...ponds.map((p) => num(p.iterations))]);
  aoa.push([]);

  // Section 2: Composition
  aoa.push(['QUIMICA FLUJO DE TRASPASO (ton/d)']);
  aoa.push(['Especie', ...colLabels]);
  for (const sp of speciesWithExtras(ponds.map((p) => aq(p).eq_liquid as Record<string, number>))) {
    aoa.push([
      sp,
      ...ponds.map((p) => {
        const eq = (aq(p).eq_liquid as Record<string, number>) || {};
        return num(eq[sp] ?? 0);
      }),
    ]);
  }
  // Boro (B) derivado de H3BO3 + B4O7-- + BO2-.
  aoa.push([
    'B',
    ...ponds.map((p) => num(boronFrom((aq(p).eq_liquid as Record<string, number>) || {}))),
  ]);
  aoa.push([]);

  // Section 3: Precipitated salts (absolute + %w/w)
  const saltSet = new Set<string>();
  for (const p of ponds) {
    const salts = (aq(p).precipitated_salts as Record<string, number>) || {};
    for (const [k, v] of Object.entries(salts)) {
      if (typeof v === 'number' && v > 0) saltSet.add(k);
    }
  }
  const saltNames = Array.from(saltSet).sort();

  const totals = ponds.map((p) => {
    const salts = (aq(p).precipitated_salts as Record<string, number>) || {};
    return Object.values(salts).reduce(
      (acc: number, v) => acc + (typeof v === 'number' && v > 0 ? v : 0),
      0,
    );
  });

  if (saltNames.length > 0) {
    aoa.push(['COMPOSICION SALES PRECIPITADAS (ton/d)']);
    aoa.push(['Sal', ...colLabels]);
    for (const sname of saltNames) {
      aoa.push([
        sname,
        ...ponds.map((p) => {
          const salts = (aq(p).precipitated_salts as Record<string, number>) || {};
          return num(salts[sname] ?? 0);
        }),
      ]);
    }
    aoa.push([]);
    aoa.push(['COMPOSICION SALES PRECIPITADAS (%w/w)']);
    aoa.push(['Sal', ...colLabels]);
    for (const sname of saltNames) {
      aoa.push([
        sname,
        ...ponds.map((p, i) => {
          const salts = (aq(p).precipitated_salts as Record<string, number>) || {};
          const v = salts[sname] ?? 0;
          const t = totals[i];
          return t > 0 ? (v / t) * 100 : 0;
        }),
      ]);
    }
  }

  return aoa;
}

// -------- Encalado sheet --------
export function buildEncaladoSheet(enc: Record<string, unknown>): unknown[][] {
  const aoa: unknown[][] = [];
  const num = (k: string): number | '' => {
    const v = enc[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : '';
  };
  const dict = (k: string): Record<string, number> | null => {
    const v = enc[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, number>;
    }
    return null;
  };

  aoa.push(['FLUJOS POR PASO (ton/d)']);
  aoa.push(['Paso', 'Flujo']);
  aoa.push(['Entrada ajustada', num('input_flow')]);
  aoa.push(['Paso 0: post remoción H3BO3', num('step0_flow')]);
  aoa.push(['Paso 1: mezcla + cal', num('step1_flow')]);
  aoa.push(['Paso 1: filtrado AQSOL #1', num('filtrate1_flow')]);
  aoa.push(['Paso 2: filtrado AQSOL #2', num('filtrate2_flow')]);
  aoa.push(['Salida P2519 (+ lavado)', num('total_liquid_output')]);
  aoa.push(['Salida ajustada (@ 365 d/año)', num('output_adjusted_flow')]);
  aoa.push([]);

  aoa.push(['REACTIVOS (ton/d)']);
  aoa.push(['Concepto', 'Valor']);
  aoa.push(['OH- agregado', num('OH_added')]);
  aoa.push(['Ca++ agregado', num('Ca_added')]);
  aoa.push(['CaO puro', num('CaO_pure')]);
  aoa.push(['Cal comercial', num('lime_commercial')]);
  aoa.push(['SiO2 impurezas cal', num('SiO2_inert')]);
  aoa.push(['H2O lechada', num('H2O_slurry')]);
  aoa.push(['Ca++ del CaCl2', num('Ca_CaCl2')]);
  aoa.push(['Cl- del CaCl2', num('Cl_CaCl2')]);
  aoa.push(['CaCl2·1.4H2O puro', num('CaCl2_14H2O_pure')]);
  aoa.push(['CaCl2 comercial', num('CaCl2_commercial')]);
  aoa.push(['H2O solución CaCl2', num('H2O_CaCl2')]);
  aoa.push(['Lavado queque', num('cake_wash_flow')]);
  aoa.push(['Recuperado lavado', num('wash_recovered')]);
  aoa.push([]);

  // Precipitated salts (AQSOL #1 and #2)
  const s1 = dict('precipitated_salts_1');
  const s2 = dict('precipitated_salts_2');
  aoa.push(['SALES PRECIPITADAS (ton/d)']);
  const allSalts = new Set<string>();
  if (s1) Object.keys(s1).forEach((k) => allSalts.add(k));
  if (s2) Object.keys(s2).forEach((k) => allSalts.add(k));
  const saltsSorted = Array.from(allSalts).sort();
  aoa.push(['Sal', 'AQSOL #1', 'AQSOL #2']);
  for (const sname of saltsSorted) {
    aoa.push([
      sname,
      typeof s1?.[sname] === 'number' ? s1[sname] : '',
      typeof s2?.[sname] === 'number' ? s2[sname] : '',
    ]);
  }
  aoa.push(['TOTAL', num('solids_aqsol1'), num('solids_aqsol2')]);
  aoa.push([]);

  // Composition by step
  const compCols: Array<{ label: string; data: Record<string, number> | null }> = [
    { label: 'Entrada ajustada', data: dict('input_adjusted') },
    { label: 'Filtrado AQSOL#1', data: dict('filtrate1_composition') },
    { label: 'Filtrado AQSOL#2', data: dict('filtrate2_composition') },
    { label: 'Salida ajustada', data: dict('output_adjusted_composition') },
  ];
  aoa.push(['COMPOSICION POR ETAPA (ton/d)']);
  aoa.push(['Especie', ...compCols.map((c) => c.label)]);
  const species = speciesWithExtras(compCols.map((c) => c.data as Record<string, number>));
  for (const sp of species) {
    aoa.push([
      sp,
      ...compCols.map((c) => {
        const v = c.data?.[sp];
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
      }),
    ]);
  }
  // Boro (B) derivado de H3BO3 + B4O7-- + BO2-.
  aoa.push(['B', ...compCols.map((c) => boronFrom(c.data as Record<string, number> | undefined))]);
  aoa.push([]);

  // Thermodynamic properties
  const aq0 = dict('aqsol0_result');
  const aq1 = dict('aqsol1_result');
  const aq2 = dict('aqsol2_result');
  const propKeys: Array<[string, string]> = [
    ['Water activity (aw)', 'water_activity'],
    ['Densidad líquida (kg/m³)', 'density_liquid'],
    ['Densidad sólida (kg/m³)', 'density_solid'],
    ['pH', 'pH'],
    ['Fuerza iónica', 'ionic_strength'],
    ['Cp líquido (J/g/K)', 'Cp_liquid'],
    ['Sólidos totales (ton/d)', 'total_solids_g'],
  ];
  aoa.push(['PROPIEDADES TERMODINAMICAS']);
  aoa.push(['Propiedad', 'AQSOL #0', 'AQSOL #1', 'AQSOL #2']);
  const takeVal = (d: Record<string, number> | null, k: string): number | '' => {
    if (!d) return '';
    const v = d[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : '';
  };
  for (const [label, key] of propKeys) {
    aoa.push([label, takeVal(aq0, key), takeVal(aq1, key), takeVal(aq2, key)]);
  }

  return aoa;
}

// -------- Graficos data sheet --------
function buildGraficosSheet(stages: StageData[]): unknown[][] {
  const aoa: unknown[][] = [];
  const chartSpecies = ['Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'Cl-', 'SO4--', 'H3BO3'];

  for (const s of stages) {
    const ponds = s.result.ponds || [];
    const pondNames = ponds.map((p) => p.config?.name || `Poza ${p.config?.number ?? ''}`);

    aoa.push([s.label]);
    aoa.push(['Serie', ...pondNames]);

    for (const sp of chartSpecies) {
      aoa.push([
        sp,
        ...ponds.map((p) => {
          const eq = (p.aqsol_result?.eq_liquid as Record<string, number>) || {};
          return typeof eq[sp] === 'number' ? eq[sp] : 0;
        }),
      ]);
    }

    aoa.push([
      'Flujo salida (ton/d)',
      ...ponds.map((p) => (typeof p.outlet_flow === 'number' ? p.outlet_flow : 0)),
    ]);
    aoa.push([
      'Actividad de agua',
      ...ponds.map((p) =>
        typeof p.aqsol_result?.water_activity === 'number' ? p.aqsol_result.water_activity : 0,
      ),
    ]);
    aoa.push([
      'Densidad líquida (kg/m³)',
      ...ponds.map((p) =>
        typeof p.aqsol_result?.density_liquid === 'number' ? p.aqsol_result.density_liquid : 0,
      ),
    ]);
    aoa.push([
      'pH',
      ...ponds.map((p) => (typeof p.aqsol_result?.pH === 'number' ? p.aqsol_result.pH : 0)),
    ]);
    aoa.push([
      'Sales precipitadas total (ton/d)',
      ...ponds.map((p) => (typeof p.salt_precipitated === 'number' ? p.salt_precipitated : 0)),
    ]);

    // Salt-by-name evolution
    const saltSet = new Set<string>();
    for (const p of ponds) {
      const salts = (p.aqsol_result?.precipitated_salts as Record<string, number>) || {};
      for (const [k, v] of Object.entries(salts)) {
        if (typeof v === 'number' && v > 1e-9) saltSet.add(k);
      }
    }
    const saltNames = Array.from(saltSet).sort();
    if (saltNames.length > 0) {
      aoa.push([]);
      aoa.push([`Evolución por sal — ${s.label} (ton/d)`]);
      aoa.push(['Sal', ...pondNames]);
      for (const sname of saltNames) {
        aoa.push([
          sname,
          ...ponds.map((p) => {
            const salts = (p.aqsol_result?.precipitated_salts as Record<string, number>) || {};
            const v = salts[sname];
            return typeof v === 'number' ? v : 0;
          }),
        ]);
      }
    }

    aoa.push([]);
  }

  return aoa;
}

// -------- Resumen Diario (multi-day) --------
function buildResumenDiarioSheet(
  dailyResults: NonNullable<ExportInput['dailyResults']>,
): unknown[][] {
  const aoa: unknown[][] = [];
  aoa.push([
    'Día',
    'Fecha',
    'Temperatura (°C)',
    'Evaporación (mm/d)',
    'Li+ entrada',
    'Li+ salida',
    'Li Recovery (%)',
    'Evap total',
    'Sales total',
    'Estado',
    'Error',
  ]);
  for (const dr of dailyResults) {
    // readDailyResult resuelve las tres formas que puede tener un dia, incluida la de
    // solo preconcentracion, donde el resultado ES el SolverResult y no viene envuelto
    // en `precon`. Buscando `pc.precon` a mano, esas columnas salian todas vacias.
    const { precon, last, failed, error } = readDailyResult(dr);
    aoa.push([
      dr.day + 1,
      dr.date_label,
      dr.temperature_C,
      dr.evap_rate_mm_day,
      precon?.li_in ?? '',
      last?.li_out ?? '',
      last?.li_recovery_pct ?? '',
      last?.total_evaporation ?? '',
      last?.total_salt ?? '',
      failed ? 'Error' : 'OK',
      error ?? '',
    ]);
  }
  return aoa;
}

// -------- Hojas por dia (multi-dia) --------
//
// Las hojas Global y Preconcentracion muestran una sola foto: el promedio o el dia
// elegido en pantalla. Estas tres despliegan lo mismo para los 365 dias, en formato
// largo (una fila por dia y por corriente/poza) en vez de una hoja por dia, que con un
// anio entero daria 365 pestanas inmanejables.

function buildGlobalPorDiaSheet(
  dailyStreams: NonNullable<ExportInput['dailyStreams']>,
): unknown[][] {
  const aoa: unknown[][] = [[
    'Día', 'Fecha', 'ID', 'Corriente',
    'Masa total (ton/d)', 'Líquidos (ton/d)', 'Sólidos (ton/d)', 'Temperatura (°C)',
  ]];
  for (const d of dailyStreams) {
    for (const id of GLOBAL_STREAM_ORDER) {
      const v = d.streams[id];
      if (!v) continue;
      aoa.push([
        d.day + 1, d.date_label, `P_${id}`, GLOBAL_STREAM_NAMES[id],
        v.total_mass_day ?? '', v.liquids_day ?? '', v.solids_day ?? '', v.temperature ?? '',
      ]);
    }
  }
  return aoa;
}

/** Etapas con pozas de un día, etiquetadas para poder distinguirlas en la hoja. */
function etapasConPozas(dr: DailyResultRow): Array<{ etapa: string; result: SolverResult }> {
  const { precon, postliming } = readDailyResult(dr);
  const out: Array<{ etapa: string; result: SolverResult }> = [];
  if (precon) out.push({ etapa: 'Preconcentración', result: precon });
  if (postliming) out.push({ etapa: 'Post-liming', result: postliming });
  return out;
}

function nombrePoza(p: PondResult, i: number): string {
  const cfg = p.config || ({} as PondResult['config']);
  const name = cfg.name || `Poza ${i + 1}`;
  return cfg.number != null ? `P${cfg.number} - ${name}` : name;
}

function buildQuimicaPorDiaSheet(dailyResults: DailyResultRow[]): unknown[][] {
  // Las especies se resuelven sobre TODOS los dias: si un dia trae una que otro no,
  // la columna igual existe y queda en blanco donde no aplica.
  const fuentes: Array<Record<string, number> | undefined> = [];
  for (const dr of dailyResults) {
    for (const { result } of etapasConPozas(dr)) {
      for (const p of result.ponds || []) {
        fuentes.push((p.aqsol_result as unknown as Record<string, unknown>)?.eq_liquid as
          Record<string, number> | undefined);
      }
    }
  }
  const species = speciesWithExtras(fuentes);

  const aoa: unknown[][] = [['Día', 'Fecha', 'Etapa', 'Poza', ...species, 'B']];
  for (const dr of dailyResults) {
    for (const { etapa, result } of etapasConPozas(dr)) {
      (result.ponds || []).forEach((p, i) => {
        const eq = ((p.aqsol_result as unknown as Record<string, unknown>)?.eq_liquid ??
          {}) as Record<string, number>;
        aoa.push([
          dr.day + 1, dr.date_label, etapa, nombrePoza(p, i),
          ...species.map((sp) => eq[sp] ?? 0),
          boronFrom(eq),
        ]);
      });
    }
  }
  return aoa;
}

/** Sales que precipitan en algun punto de la corrida, en orden alfabetico. */
function salesDeLaCorrida(dailyResults: DailyResultRow[]): string[] {
  const set = new Set<string>();
  for (const dr of dailyResults) {
    for (const { result } of etapasConPozas(dr)) {
      for (const p of result.ponds || []) {
        const salts = ((p.aqsol_result as unknown as Record<string, unknown>)
          ?.precipitated_salts ?? {}) as Record<string, number>;
        for (const [name, v] of Object.entries(salts)) {
          if (typeof v === 'number' && v > 0) set.add(name);
        }
      }
    }
  }
  return Array.from(set).sort();
}

/** Total precipitado de una poza: el del motor si viene, si no la suma de las sales. */
function totalSolidos(p: PondResult): number {
  const aq = (p.aqsol_result as unknown as Record<string, unknown>) || {};
  const directo = aq.total_solids_g;
  if (typeof directo === 'number' && directo > 0) return directo;
  const salts = (aq.precipitated_salts ?? {}) as Record<string, number>;
  return Object.values(salts).reduce(
    (a, v) => a + (typeof v === 'number' && v > 0 ? v : 0),
    0,
  );
}

/**
 * Desglose de sales precipitadas por dia y poza. `pct` da la misma tabla en %w/w
 * sobre el total precipitado de esa poza en ese dia.
 *
 * En "Metricas por dia" solo esta el total; esto abre que sal es cada tonelada.
 */
function buildSalesPorDiaSheet(dailyResults: DailyResultRow[], pct: boolean): unknown[][] {
  const sales = salesDeLaCorrida(dailyResults);
  const aoa: unknown[][] = [[
    'Día', 'Fecha', 'Etapa', 'Poza',
    ...sales,
    pct ? 'Total (%)' : 'Total (ton/d)',
  ]];
  for (const dr of dailyResults) {
    for (const { etapa, result } of etapasConPozas(dr)) {
      (result.ponds || []).forEach((p, i) => {
        const salts = ((p.aqsol_result as unknown as Record<string, unknown>)
          ?.precipitated_salts ?? {}) as Record<string, number>;
        const total = totalSolidos(p);
        aoa.push([
          dr.day + 1, dr.date_label, etapa, nombrePoza(p, i),
          ...sales.map((s) => {
            const v = salts[s] ?? 0;
            if (!pct) return v;
            return total > 0 ? (v / total) * 100 : 0;
          }),
          pct ? (total > 0 ? 100 : 0) : total,
        ]);
      });
    }
  }
  return aoa;
}

function buildMetricasPorDiaSheet(dailyResults: DailyResultRow[]): unknown[][] {
  const num = (v: unknown): number | '' =>
    typeof v === 'number' && Number.isFinite(v) ? v : '';

  const aoa: unknown[][] = [[
    'Día', 'Fecha', 'Etapa', 'Poza', 'Temperatura (°C)', 'Evaporación (mm/d)',
    'Sales precipitadas (ton/d)', 'Masa líquido impregnado (ton/d)', 'Evaporación (ton/d)',
    'Infiltración (ton/d)', 'Dilución (ton/d)', 'Flujo salida (ton/d)',
    'Densidad líquida (kg/m³)', 'Densidad sólida (kg/m³)', 'pH', 'Actividad de agua (aw)',
    'Fuerza iónica', 'Iteraciones', 'Convergió',
  ]];
  for (const dr of dailyResults) {
    for (const { etapa, result } of etapasConPozas(dr)) {
      (result.ponds || []).forEach((p, i) => {
        const aq = (p.aqsol_result as unknown as Record<string, unknown>) || {};
        aoa.push([
          dr.day + 1, dr.date_label, etapa, nombrePoza(p, i),
          num(dr.temperature_C), num(dr.evap_rate_mm_day),
          num(p.salt_precipitated), num(p.entrainment), num(p.evaporation),
          num(p.leakage), num(p.dilution), num(p.outlet_flow),
          num(aq.density_liquid), num(aq.density_solid), num(aq.pH),
          num(aq.water_activity), num(aq.ionic_strength),
          num(p.iterations), p.converged ? 'Sí' : 'No',
        ]);
      });
    }
  }
  return aoa;
}

// -------- Parametros (flatten snapshot) --------
function buildParametrosSheet(snapshot: Record<string, unknown> | null): unknown[][] {
  const aoa: unknown[][] = [['Clave', 'Valor']];
  if (!snapshot) {
    aoa.push(['(sin snapshot de parámetros)', '']);
    return aoa;
  }
  const flatten = (obj: unknown, path: string): void => {
    if (obj == null) {
      aoa.push([path, '']);
      return;
    }
    if (typeof obj !== 'object') {
      aoa.push([path, obj as string | number | boolean]);
      return;
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        aoa.push([path, '[]']);
        return;
      }
      const allScalar = obj.every((v) => v == null || typeof v !== 'object');
      if (allScalar) {
        aoa.push([path, JSON.stringify(obj)]);
        return;
      }
      obj.forEach((v, i) => flatten(v, `${path}[${i}]`));
      return;
    }
    const entries = Object.entries(obj as Record<string, unknown>);
    for (const [k, v] of entries) {
      flatten(v, path ? `${path}.${k}` : k);
    }
  };
  flatten(snapshot, '');
  return aoa;
}

// ============================================================
// MAIN
// ============================================================
/**
 * Arma el workbook. Separado de la descarga para poder inspeccionarlo en los tests sin
 * pasar por Blob, que en jsdom no expone `arrayBuffer()`.
 */
export function buildExecutionWorkbook(input: ExportInput): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  addSheet(wb, 'Resumen', buildResumenSheet(input));
  addSheet(wb, 'Masa Ingreso', buildWellBrineFeedAoa(input.execution.parameters_snapshot ?? null, 'static'));
  addSheet(wb, 'Global', buildGlobalSheet(input));

  const preconStages = input.stages.filter((s) =>
    s.label.toLowerCase().includes('precon'),
  );
  const postStages = input.stages.filter((s) =>
    s.label.toLowerCase().includes('post'),
  );

  preconStages.forEach((s, i) => {
    const name = preconStages.length > 1 ? `Preconcentracion ${i + 1}` : 'Preconcentracion';
    addSheet(wb, name, buildPondDetailSheet(s));
  });

  if (input.encalado) {
    addSheet(wb, 'Planta de Reactivos', buildEncaladoSheet(input.encalado));
  }

  postStages.forEach((s, i) => {
    const name = postStages.length > 1 ? `Post-liming ${i + 1}` : 'Post-liming';
    addSheet(wb, name, buildPondDetailSheet(s));
  });

  if (input.stages.length > 0) {
    addSheet(wb, 'Graficos', buildGraficosSheet(input.stages));
  }

  if (input.isMultiDay && input.dailyResults) {
    addSheet(wb, 'Resumen Diario', buildResumenDiarioSheet(input.dailyResults));
    // Detalle completo dia por dia, no solo la foto de la vista actual.
    addSheet(wb, 'Metricas por dia', buildMetricasPorDiaSheet(input.dailyResults));
    addSheet(wb, 'Quimica por dia', buildQuimicaPorDiaSheet(input.dailyResults));
    addSheet(wb, 'Sales por dia', buildSalesPorDiaSheet(input.dailyResults, false));
    addSheet(wb, 'Sales por dia %', buildSalesPorDiaSheet(input.dailyResults, true));
    if (input.dailyStreams && input.dailyStreams.length > 0) {
      addSheet(wb, 'Global por dia', buildGlobalPorDiaSheet(input.dailyStreams));
    }
  }

  addSheet(
    wb,
    'Parametros',
    buildParametrosSheet(input.execution.parameters_snapshot ?? null),
  );

  return wb;
}

export function exportExecutionToExcel(input: ExportInput): Blob {
  const arrayBuffer = XLSX.write(buildExecutionWorkbook(input), {
    type: 'array',
    bookType: 'xlsx',
  });
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
