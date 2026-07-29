import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildDynamicWorkbook,
  parseDynamicWorkbookFile,
} from '../../src/utils/dynamicConfigExcel';
import { asPercentBasis } from '../../src/utils/brineComposition';
import type { DynamicConfig } from '../../src/types';

// Config mínima pero estructuralmente completa: buildDynamicWorkbook recorre todas las
// secciones, así que deben existir aunque vayan vacías.
const BRINE_TD = {
  H2O: 4672.86,
  'Li+': 4.657,
  'Na+': 574.37,
  'Cl-': 922.7,
  'SO4--': 70.4,
};

const CFG = {
  simulation: { n_days: 1460, start_date: '2024-01-23' },
  brine: { ...BRINE_TD },
  precon: {
    average_flow_ton_day: 6308,
    max_flow_ton_day: 9000,
    flow_modulation: 'seasonal',
    n_days_consecutive_regime: 0,
    ponds: [],
    factors: [],
  },
  climate: { evaporation_mm_day: [5.1, 5.2], temperature_C: [14, 15] },
  encalado: { config: { temperature_C: 15, secuencia_dosificaciones: [] }, factors: [] },
  postliming: {
    config: {
      feed_stream_name: 'alim_pz10',
      validation_window_days: [1096, 1460],
      salts_allowed: [],
    },
    ponds: [],
    factors: [],
  },
} as unknown as DynamicConfig;

/**
 * El File de jsdom no implementa arrayBuffer(), que es lo único que usa el parser.
 * Basta con un stub que lo exponga.
 */
function fakeFile(buf: ArrayBuffer): File {
  return { arrayBuffer: async () => buf } as unknown as File;
}

/** Serializa el workbook y lo reabre como haría el usuario al subir el archivo. */
async function roundTrip(cfg: DynamicConfig) {
  const wb = buildDynamicWorkbook(cfg);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return parseDynamicWorkbookFile(fakeFile(buf), cfg);
}

describe('Excel de config dinámica — salmuera en %w/w', () => {
  it('exporta la hoja Salmuera con encabezado %w/w y valores normalizados', () => {
    const wb = buildDynamicWorkbook(CFG);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Salmuera']);
    expect(Object.keys(rows[0])).toContain('%w/w');
    const h2o = rows.find((r) => r['Especie'] === 'H2O')!;
    expect(Number(h2o['%w/w'])).toBeCloseTo(asPercentBasis(BRINE_TD)['H2O'], 4);
  });

  it('el round-trip conserva la composición (regresión: devolvía todo en 0)', async () => {
    // El exportador pasó a '%w/w' pero parseBrine solo conocía 'Valor (ton/dia)',
    // así que reimportar un archivo recién exportado ponía cada especie en 0.
    const parsed = await roundTrip(CFG);
    expect(parsed.brine).toBeDefined();
    const expected = asPercentBasis(BRINE_TD);
    for (const sp of Object.keys(expected)) {
      expect(parsed.brine![sp]).toBeCloseTo(expected[sp], 4);
    }
    const total = Object.values(parsed.brine!).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 3);
    expect(total).toBeGreaterThan(0); // guard explícito contra el "todo en 0"
  });

  it('sigue aceptando plantillas anteriores con la columna Valor (ton/dia)', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Especie', 'Valor (ton/dia)'],
        ['H2O', 4672.86],
        ['Li+', 4.657],
      ]),
      'Salmuera',
    );
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const parsed = await parseDynamicWorkbookFile(fakeFile(buf), CFG);
    expect(parsed.brine!['H2O']).toBeCloseTo(4672.86, 2);
    // Se guarda en t/d tal cual; asPercentBasis lo convierte al mostrarlo.
    expect(asPercentBasis(parsed.brine!)['H2O']).toBeCloseTo(99.9, 1);
  });
});
