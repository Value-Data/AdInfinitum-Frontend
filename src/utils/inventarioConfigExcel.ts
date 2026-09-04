/* ============================================================
   Import/export Excel del escenario del modo con inventario.
   Mismo patrón que configExcel.ts (estático) y dynamicConfigExcel.ts.
   ============================================================ */

import * as XLSX from 'xlsx';
import type { InventarioConfig, InventarioPond } from '../types';
import {
  SHEET as HOJA_DIN,
  encaladoSheet,
  factorsSheet,
  parseEncalado,
  parseFactors,
  parsePostlimingParams,
  parsePostlimingPonds,
  parseSequence,
  postlimingParamsSheet,
  postlimingPondsSheet,
  sequenceSheet,
} from './dynamicConfigExcel';

/**
 * Por qué existe
 * --------------
 * Dos bloques del escenario no se pueden editar a mano en una pantalla: el clima
 * son 365 días × 2 series y los factores son 137 sales. Y el inventario inicial
 * lleva la composición de 17 especies por poza, o sea otra tabla de 10×17. La
 * planilla es la forma razonable de tocar eso.
 *
 * El archivo es de ida y vuelta: lo que se baja se puede reimportar tal cual. Las
 * hojas que no estén en el archivo se ignoran al importar, así que se puede subir
 * una planilla con solo la hoja que se cambió.
 */

/**
 * Las hojas de encalado y postliming son **las mismas** que las de la plantilla del
 * modo dinámico —mismo nombre, mismas columnas, mismos parsers— porque esas dos
 * etapas son las mismas: la cadena de este modo las corre con esos motores. Reusar
 * los nombres además deja mover un bloque de una plantilla a la otra.
 */
const HOJA = {
  instrucciones: 'Instrucciones',
  simulacion: 'Simulacion',
  pozas: 'Pozas',
  feed: 'Alimentacion',
  inventario: 'Inventario inicial',
  clima: 'Clima',
  factores: 'Factores',
  encalado: HOJA_DIN.encalado,
  encaladoSecuencia: HOJA_DIN.encaladoSequence,
  encaladoFactores: HOJA_DIN.encaladoFactors,
  postlimingPozas: HOJA_DIN.postlimingPonds,
  postlimingParams: HOJA_DIN.postlimingParams,
  postlimingFactores: HOJA_DIN.postlimingFactors,
} as const;

// Columnas de la hoja de pozas, en el orden en que las escribe el motor.
const COLS_POZA = [
  'name',
  'number',
  'area_design_m2',
  'control_mode',
  'target_height_m',
  'max_height_m',
  'pond_factor',
  'entrainment_pct',
  'leakage_mm_day',
  'dilution_frac',
  'apply_berm_factor',
];

const COLS_INVENTARIO = ['height_m', 'mass_liquid_ton', 'density_kg_m3', 'water_activity'];

/** Magnitudes del inventario que NO se editan: se derivan o vienen del escenario.
 *
 * La masa liquida sale de la geometria (altura x area x densidad); densidad y
 * actividad de agua las trae el escenario. Se exportan igual —la planilla tiene que
 * poder reconstruir el escenario completo— pero al importar la masa se recalcula, no
 * se lee: si no, editarla en la planilla contradiria a la altura sin que nada avise.
 */
const MASA_DERIVADA = 'mass_liquid_ton';

function comoNumero(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function comoBooleano(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes';
}

/* -------- escritura -------- */

function hojaInstrucciones(cfg: InventarioConfig): XLSX.WorkSheet {
  const nPozas = (cfg.pozas ?? []).length;
  const nSales = Object.keys(cfg.factores ?? {}).length;
  const nClima = ((cfg.clima?.evaporation_mm_day as number[] | undefined) ?? []).length;
  return XLSX.utils.aoa_to_sheet([
    ['Plantilla del modo CON INVENTARIO — AdInfinitum'],
    [],
    ['Hoja', 'Descripcion'],
    [HOJA.simulacion, 'Fecha de inicio, horizonte y caudal de alimentacion (promedio y maximo).'],
    [HOJA.pozas, `Las ${nPozas} pozas de la cascada, en orden: cada una alimenta a la siguiente. Agregue o borre filas.`],
    [HOJA.feed, 'Composicion de la salmuera de pozo en %w/w (debe sumar 100). El caudal va en la hoja Simulacion.'],
    [HOJA.inventario, 'Estado inicial de cada poza: se EDITA la altura y el porcentaje de cada especie. mass_liquid_ton se recalcula al importar (altura x area x densidad) y densidad y actividad de agua vienen del escenario. Una poza sin fila arranca vacia.'],
    [HOJA.clima, `Año tipico: ${nClima} dias con evaporacion (mm/d) y temperatura (C).`],
    [HOJA.factores, `Factor de precipitacion por sal (${nSales}). >1 inhibe, =1 habilita, <1 favorece.`],
    [HOJA.encalado, 'Parametros del encalado (clave/valor). use_CaCl2 acepta TRUE/FALSE.'],
    [HOJA.encaladoSecuencia, 'Orden de dosificacion de reactivos del encalado.'],
    [HOJA.encaladoFactores, 'Factores de inhibicion del encalado (dll_index, name, factor).'],
    [HOJA.postlimingPozas, 'Pozas de post-liming. control_mode CASCADE/BUFFER/FLUJO_FIJO.'],
    [HOJA.postlimingParams, 'Parametros post-liming + listas (validation_window y salts_allowed coma-separadas).'],
    [HOJA.postlimingFactores, 'Factores de inhibicion de post-liming.'],
    [],
    ['Notas'],
    ['- Las hojas que no esten en el archivo se ignoran al importar.'],
    ['- Los nombres de columna (primera fila) deben mantenerse exactos.'],
    ['- Los valores numericos aceptan punto o coma decimal.'],
    ['- El nombre de la poza es la clave: liga la hoja Pozas con la de Inventario.'],
  ]);
}

function hojaSimulacion(cfg: InventarioConfig): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ['parametro', 'valor'],
    ['start_date', String(cfg.start_date ?? '')],
    ['days_max', cfg.days_max ?? ''],
    ['flowrate_tpd', cfg.feed?.flowrate_tpd ?? ''],
    ['max_flow_tpd', cfg.feed?.max_flow_tpd ?? ''],
  ]);
}

function hojaPozas(cfg: InventarioConfig): XLSX.WorkSheet {
  const filas: unknown[][] = [COLS_POZA];
  for (const p of cfg.pozas ?? []) {
    filas.push(COLS_POZA.map((c) => (p as Record<string, unknown>)[c] ?? ''));
  }
  return XLSX.utils.aoa_to_sheet(filas);
}

function hojaFeed(cfg: InventarioConfig): XLSX.WorkSheet {
  // Solo la composición: el caudal se edita en la hoja Simulacion, igual que en la
  // pantalla. Estaba en las dos y al importar ganaba la última, en silencio.
  const comp = (cfg.feed?.composicion_pp ?? {}) as Record<string, number>;
  const filas: unknown[][] = [['Especie', '%w/w']];
  for (const [sp, v] of Object.entries(comp)) filas.push([sp, v]);
  return XLSX.utils.aoa_to_sheet(filas);
}

function hojaInventario(cfg: InventarioConfig): XLSX.WorkSheet {
  const inv = (cfg.inventario ?? {}) as Record<string, Record<string, unknown>>;
  // Las especies salen de la primera poza sembrada: todas comparten catalogo.
  const especies = Object.keys(
    (Object.values(inv)[0]?.composition as Record<string, number> | undefined) ?? {},
  );
  const filas: unknown[][] = [['poza', ...COLS_INVENTARIO, ...especies]];
  for (const [poza, d] of Object.entries(inv)) {
    const comp = (d.composition ?? {}) as Record<string, number>;
    filas.push([
      poza,
      ...COLS_INVENTARIO.map((c) => d[c] ?? ''),
      ...especies.map((sp) => comp[sp] ?? 0),
    ]);
  }
  return XLSX.utils.aoa_to_sheet(filas);
}

function hojaClima(cfg: InventarioConfig): XLSX.WorkSheet {
  const clima = (cfg.clima ?? {}) as Record<string, unknown>;
  const evap = (clima.evaporation_mm_day as number[] | undefined) ?? [];
  const temp = (clima.temperature_C as number[] | undefined) ?? [];
  const doy = (clima.doy as string[] | undefined) ?? [];
  const filas: unknown[][] = [['doy', 'evaporation_mm_day', 'temperature_C']];
  for (let i = 0; i < evap.length; i++) {
    filas.push([doy[i] ?? i + 1, evap[i], temp[i]]);
  }
  return XLSX.utils.aoa_to_sheet(filas);
}

function hojaFactores(cfg: InventarioConfig): XLSX.WorkSheet {
  const filas: unknown[][] = [['sal', 'factor']];
  for (const [sal, v] of Object.entries(cfg.factores ?? {})) filas.push([sal, v]);
  return XLSX.utils.aoa_to_sheet(filas);
}

export function buildInventarioWorkbook(cfg: InventarioConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaInstrucciones(cfg), HOJA.instrucciones);
  XLSX.utils.book_append_sheet(wb, hojaSimulacion(cfg), HOJA.simulacion);
  XLSX.utils.book_append_sheet(wb, hojaPozas(cfg), HOJA.pozas);
  XLSX.utils.book_append_sheet(wb, hojaFeed(cfg), HOJA.feed);
  XLSX.utils.book_append_sheet(wb, hojaInventario(cfg), HOJA.inventario);
  XLSX.utils.book_append_sheet(wb, hojaClima(cfg), HOJA.clima);
  XLSX.utils.book_append_sheet(wb, hojaFactores(cfg), HOJA.factores);
  // Etapas 2 y 3: hojas idénticas a las de la plantilla del dinámico.
  if (cfg.encalado) {
    XLSX.utils.book_append_sheet(wb, encaladoSheet(cfg.encalado.config), HOJA.encalado);
    XLSX.utils.book_append_sheet(
      wb,
      sequenceSheet(cfg.encalado.config?.secuencia_dosificaciones ?? []),
      HOJA.encaladoSecuencia,
    );
    XLSX.utils.book_append_sheet(
      wb,
      factorsSheet(cfg.encalado.factors ?? [], undefined),
      HOJA.encaladoFactores,
    );
  }
  if (cfg.postliming) {
    XLSX.utils.book_append_sheet(
      wb,
      postlimingPondsSheet(cfg.postliming.ponds ?? []),
      HOJA.postlimingPozas,
    );
    XLSX.utils.book_append_sheet(
      wb,
      postlimingParamsSheet(cfg.postliming.config),
      HOJA.postlimingParams,
    );
    XLSX.utils.book_append_sheet(
      wb,
      factorsSheet(cfg.postliming.factors ?? [], undefined),
      HOJA.postlimingFactores,
    );
  }
  return wb;
}

export function downloadInventarioExcel(cfg: InventarioConfig, filename: string): void {
  XLSX.writeFile(buildInventarioWorkbook(cfg), filename);
}

/* -------- lectura -------- */

/**
 * Aplica sobre `base` lo que traiga el archivo. Devuelve el escenario nuevo y qué
 * hojas se aplicaron, para poder avisar cuáles se ignoraron.
 */
export function applyInventarioWorkbook(
  wb: XLSX.WorkBook,
  base: InventarioConfig,
): { next: InventarioConfig; aplicadas: string[] } {
  const next: InventarioConfig = { ...base };
  const aplicadas: string[] = [];
  const hoja = (n: string) => wb.Sheets[n];

  if (hoja(HOJA.simulacion)) {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja(HOJA.simulacion));
    const valores: Record<string, unknown> = {};
    for (const f of filas) valores[String(f['parametro'])] = f['valor'];
    if (valores.start_date) next.start_date = String(valores.start_date);
    const dias = comoNumero(valores.days_max);
    if (dias != null) next.days_max = dias;
    // El caudal vive en el bloque de alimentación aunque se edite acá, igual que en
    // la pantalla: es el mismo dato que consume el motor.
    const caudal = comoNumero(valores.flowrate_tpd);
    const caudalMax = comoNumero(valores.max_flow_tpd);
    if (caudal != null || caudalMax != null) {
      next.feed = {
        ...(base.feed ?? {}),
        ...(caudal != null ? { flowrate_tpd: caudal } : {}),
        ...(caudalMax != null ? { max_flow_tpd: caudalMax } : {}),
      };
    }
    aplicadas.push(HOJA.simulacion);
  }

  if (hoja(HOJA.pozas)) {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja(HOJA.pozas));
    const pozas: InventarioPond[] = filas
      .filter((f) => String(f['name'] ?? '').trim() !== '')
      .map((f, i) => ({
        name: String(f['name']),
        number: comoNumero(f['number']) ?? i + 1,
        area_design_m2: comoNumero(f['area_design_m2']) ?? 0,
        control_mode: (String(f['control_mode'] || 'ALTURA') as 'ALTURA' | 'FLUJO_FIJO'),
        target_height_m: comoNumero(f['target_height_m']),
        max_height_m: comoNumero(f['max_height_m']),
        pond_factor: comoNumero(f['pond_factor']),
        entrainment_pct: comoNumero(f['entrainment_pct']),
        leakage_mm_day: comoNumero(f['leakage_mm_day']),
        dilution_frac: comoNumero(f['dilution_frac']),
        apply_berm_factor: comoBooleano(f['apply_berm_factor']),
      }));
    if (pozas.length > 0) {
      next.pozas = pozas;
      aplicadas.push(HOJA.pozas);
    }
  }

  if (hoja(HOJA.feed)) {
    // Se recorre como matriz para no depender del header. Sigue aceptando una fila
    // `flowrate_tpd` porque las plantillas bajadas antes la traian aca.
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja(HOJA.feed), { header: 1 });
    const comp: Record<string, number> = {};
    let flujo: number | null = null;
    for (const fila of filas) {
      const clave = String(fila?.[0] ?? '').trim();
      if (clave === 'flowrate_tpd') flujo = comoNumero(fila?.[1]);
      else if (clave && clave !== 'campo' && clave !== 'Especie') {
        const v = comoNumero(fila?.[1]);
        if (v != null) comp[clave] = v;
      }
    }
    // Sobre `next.feed`, no sobre `base.feed`: la hoja Simulacion ya pudo haber
    // dejado el caudal ahí y partir del original lo borraría.
    next.feed = {
      ...(next.feed ?? {}),
      ...(flujo != null ? { flowrate_tpd: flujo } : {}),
      ...(Object.keys(comp).length > 0 ? { composicion_pp: comp } : {}),
    };
    aplicadas.push(HOJA.feed);
  }

  if (hoja(HOJA.inventario)) {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja(HOJA.inventario));
    const inv: Record<string, Record<string, unknown>> = {};
    for (const f of filas) {
      const poza = String(f['poza'] ?? '').trim();
      if (!poza) continue;
      const estado: Record<string, unknown> = {};
      for (const c of COLS_INVENTARIO) estado[c] = comoNumero(f[c]);
      // La masa se deriva de la altura contra el area de la poza, igual que en el
      // editor. Asi la planilla y la pantalla siguen la misma regla: la altura es la
      // entrada, la masa es consecuencia.
      const area = (next.pozas ?? []).find((x) => x.name === poza)?.area_design_m2;
      const altura = estado.height_m as number | null;
      const densidad = estado.density_kg_m3 as number | null;
      if (area && altura != null && densidad != null) {
        estado[MASA_DERIVADA] = (altura * area * densidad) / 1000;
      }
      const comp: Record<string, number> = {};
      for (const [k, v] of Object.entries(f)) {
        if (k === 'poza' || COLS_INVENTARIO.includes(k)) continue;
        const n = comoNumero(v);
        if (n != null) comp[k] = n;
      }
      if (Object.keys(comp).length > 0) estado.composition = comp;
      inv[poza] = estado;
    }
    next.inventario = inv;
    aplicadas.push(HOJA.inventario);
  }

  if (hoja(HOJA.clima)) {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja(HOJA.clima));
    const evap: number[] = [];
    const temp: number[] = [];
    const doy: string[] = [];
    for (const f of filas) {
      const e = comoNumero(f['evaporation_mm_day']);
      const tC = comoNumero(f['temperature_C']);
      if (e == null || tC == null) continue;
      evap.push(e);
      temp.push(tC);
      doy.push(String(f['doy'] ?? ''));
    }
    if (evap.length > 0) {
      next.clima = {
        ...(base.clima ?? {}),
        evaporation_mm_day: evap,
        temperature_C: temp,
        doy,
        n_days_cycle: evap.length,
      };
      aplicadas.push(HOJA.clima);
    }
  }

  if (hoja(HOJA.factores)) {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja(HOJA.factores));
    const f: Record<string, number> = {};
    for (const fila of filas) {
      const sal = String(fila['sal'] ?? '').trim();
      const v = comoNumero(fila['factor']);
      if (sal && v != null) f[sal] = v;
    }
    if (Object.keys(f).length > 0) {
      next.factores = f;
      aplicadas.push(HOJA.factores);
    }
  }

  // --- Etapas 2 y 3: se leen con los parsers de la plantilla del dinámico ---
  if (hoja(HOJA.encalado) || hoja(HOJA.encaladoSecuencia) || hoja(HOJA.encaladoFactores)) {
    const enc = { ...(base.encalado ?? { config: {}, factors: [] }) } as NonNullable<
      InventarioConfig['encalado']
    >;
    if (hoja(HOJA.encalado)) {
      enc.config = { ...enc.config, ...parseEncalado(hoja(HOJA.encalado)) };
      aplicadas.push(HOJA.encalado);
    }
    if (hoja(HOJA.encaladoSecuencia)) {
      enc.config = {
        ...enc.config,
        secuencia_dosificaciones: parseSequence(hoja(HOJA.encaladoSecuencia)),
      };
      aplicadas.push(HOJA.encaladoSecuencia);
    }
    if (hoja(HOJA.encaladoFactores)) {
      enc.factors = parseFactors(hoja(HOJA.encaladoFactores));
      aplicadas.push(HOJA.encaladoFactores);
    }
    next.encalado = enc;
  }

  if (
    hoja(HOJA.postlimingPozas) ||
    hoja(HOJA.postlimingParams) ||
    hoja(HOJA.postlimingFactores)
  ) {
    const pl = { ...(base.postliming ?? { config: {}, ponds: [], factors: [] }) } as NonNullable<
      InventarioConfig['postliming']
    >;
    if (hoja(HOJA.postlimingPozas)) {
      pl.ponds = parsePostlimingPonds(hoja(HOJA.postlimingPozas));
      aplicadas.push(HOJA.postlimingPozas);
    }
    if (hoja(HOJA.postlimingParams)) {
      pl.config = { ...pl.config, ...parsePostlimingParams(hoja(HOJA.postlimingParams)) };
      aplicadas.push(HOJA.postlimingParams);
    }
    if (hoja(HOJA.postlimingFactores)) {
      pl.factors = parseFactors(hoja(HOJA.postlimingFactores));
      aplicadas.push(HOJA.postlimingFactores);
    }
    next.postliming = pl;
  }

  return { next, aplicadas };
}

export async function parseInventarioWorkbookFile(
  file: File,
  base: InventarioConfig,
): Promise<{ next: InventarioConfig; aplicadas: string[] }> {
  const buf = await file.arrayBuffer();
  return applyInventarioWorkbook(XLSX.read(buf, { type: 'array' }), base);
}
