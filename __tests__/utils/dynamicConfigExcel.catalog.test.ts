import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildDynamicWorkbook,
  parseDynamicWorkbookFile,
} from '../../src/utils/dynamicConfigExcel';
import type {
  DynamicConfig,
  DynamicEncaladoParams,
  DynamicPostlimingParams,
  SaltFactor,
} from '../../src/types';

/**
 * La plantilla del dinamico se armaba con listas fijas (17 especies de la 027 y las
 * filas que ya tuviera la config), asi que al pasar la base a AQSOL066 el Excel seguia
 * saliendo con el catalogo viejo y las sales/especies nuevas no se podian cargar por
 * planilla. El estatico ya lo resolvia leyendo el catalogo — ver
 * configExcel.species.test.ts.
 */

const ESPECIES_066 = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'Ba++', 'Sr++', 'NH3(aq)', 'NH4+',
  'NH2COO-', 'H+', 'Cl-', 'HSO4-', 'SO4--', 'NO3-', 'OH-', 'CO2(aq)', 'HCO3-',
  'CO3--', 'H3BO3', 'B4O7--', 'BO2-',
];

// La misma sal cambia de dll_index entre bases: NaCl esta en 3 en la 027 y en 7 aca.
// Por eso el emparejado de la plantilla es por nombre, no por indice.
const SALES_066 = [
  { dll_index: 0, name: 'LiCl' },
  { dll_index: 7, name: 'NaCl' },
  { dll_index: 11, name: 'KCl' },
  { dll_index: 40, name: 'CaSO4·2H2O' },
  { dll_index: 200, name: 'Ba(NO3)2' },   // solo existe en la 066
  { dll_index: 201, name: 'SrSO4' },      // solo existe en la 066
];

const FACTORES_027: SaltFactor[] = [
  { dll_index: 0, name: 'LiCl', precipitation_factor: 1000 },
  { dll_index: 3, name: 'NaCl', precipitation_factor: 1 },
  { dll_index: 9, name: 'KCl', precipitation_factor: 1000 },
  { dll_index: 35, name: 'CaSO4·2H2O', precipitation_factor: 1000 },
];

const BRINE = { H2O: 94.5, 'Li+': 0.1, 'Na+': 3.2, 'Cl-': 2.2 };

function cfg(): DynamicConfig {
  return {
    aqsol_version: '027',
    brine: { ...BRINE },
    precon: {
      ponds: [],
      average_flow_ton_day: 6308,
      max_flow_ton_day: 9000,
      flow_modulation: 'seasonal',
      n_days_consecutive_regime: 0,
      factors: FACTORES_027,
    },
    climate: {
      series_start_date: '2024-01-01',
      evaporation_mm_day: [7.2],
      temperature_C: [5.3],
    },
    encalado: { config: {} as DynamicEncaladoParams, factors: FACTORES_027 },
    postliming: {
      config: {
        validation_window_days: [1095, 1460],
        salts_allowed: [],
      } as unknown as DynamicPostlimingParams,
      ponds: [],
      factors: FACTORES_027,
    },
    simulation: { n_days: 1460, start_date: '2024-01-23' },
  };
}

function fakeFile(buf: ArrayBuffer): File {
  // El File de jsdom no implementa arrayBuffer(), que es lo unico que usa el parser.
  return { arrayBuffer: async () => buf } as unknown as File;
}

function hoja(nombre: string, catalogo?: Parameters<typeof buildDynamicWorkbook>[1]) {
  const wb = buildDynamicWorkbook(cfg(), catalogo);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nombre]);
}

const CATALOGO_066 = { species: ESPECIES_066, salts: SALES_066 };

describe('Plantilla dinamica — especies segun la base de catalogo', () => {
  it('sin catalogo exporta las 17 de la 027', () => {
    const filas = hoja('Salmuera');
    expect(filas).toHaveLength(17);
    expect(filas.map((r) => r['Especie'])).not.toContain('Ba++');
  });

  it('con el catalogo 066 exporta las 23, incluidas las nuevas', () => {
    const filas = hoja('Salmuera', CATALOGO_066);
    expect(filas).toHaveLength(23);
    const nombres = filas.map((r) => r['Especie']);
    for (const nueva of ['Ba++', 'Sr++', 'NO3-', 'NH4+']) {
      expect(nombres).toContain(nueva);
    }
  });

  it('las especies sin valor salen en cero, no ausentes', () => {
    const filas = hoja('Salmuera', CATALOGO_066);
    expect(Number(filas.find((r) => r['Especie'] === 'Sr++')!['%w/w'])).toBe(0);
  });
});

describe('Plantilla dinamica — factores segun la base de catalogo', () => {
  it('sin catalogo exporta las filas que ya tiene la config', () => {
    const filas = hoja('Factores Precon');
    expect(filas).toHaveLength(FACTORES_027.length);
  });

  it('con el catalogo 066 exporta una fila por sal del catalogo', () => {
    for (const h of ['Factores Precon', 'Factores Encalado', 'Factores Postliming']) {
      expect(hoja(h, CATALOGO_066)).toHaveLength(SALES_066.length);
    }
  });

  it('empareja por nombre, no por indice: NaCl conserva su factor con el dll_index nuevo', () => {
    const filas = hoja('Factores Precon', CATALOGO_066);
    const nacl = filas.find((r) => r['name'] === 'NaCl')!;
    expect(Number(nacl['precipitation_factor'])).toBe(1);
    expect(Number(nacl['dll_index'])).toBe(7); // el de la 066, no el 3 de la 027
  });

  it('las sales nuevas heredan el factor mayoritario, no 1', () => {
    // 3 de 4 sales de la config estan inhibidas (1000): "inhibir todo salvo NaCl".
    // Sacar Ba(NO3)2 y SrSO4 en 1.0 invertiria esa intencion, y al reimportar la
    // plantilla ese 1.0 quedaria persistido. Es la regla del backend
    // (aqsol_migration.adapt_salt_factor_list).
    const filas = hoja('Factores Precon', CATALOGO_066);
    for (const nueva of ['Ba(NO3)2', 'SrSO4']) {
      expect(Number(filas.find((r) => r['name'] === nueva)!['precipitation_factor'])).toBe(1000);
    }
  });
});

describe('Plantilla dinamica — round-trip con base 066', () => {
  it('lo exportado con el catalogo 066 se reimporta completo', async () => {
    const wb = buildDynamicWorkbook(cfg(), CATALOGO_066);
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const parsed = await parseDynamicWorkbookFile(fakeFile(buf), cfg());

    expect(Object.keys(parsed.brine!)).toHaveLength(23);
    expect(parsed.brine!['Ba++']).toBe(0);
    expect(parsed.brine!['Na+']).toBeCloseTo(3.2, 6);

    expect(parsed.precon_factors).toHaveLength(SALES_066.length);
    const nacl = parsed.precon_factors!.find((f) => f.name === 'NaCl')!;
    expect(nacl.precipitation_factor).toBe(1);
    expect(nacl.dll_index).toBe(7);
    const nueva = parsed.precon_factors!.find((f) => f.name === 'SrSO4')!;
    expect(nueva.precipitation_factor).toBe(1000);
  });
});
