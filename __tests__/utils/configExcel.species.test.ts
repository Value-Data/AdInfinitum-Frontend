import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, parseWorkbookFile } from '../../src/utils/configExcel';

/**
 * El Excel del estatico se armaba con una lista fija de 17 especies, asi que al poner
 * la config en base AQSOL066 la descarga seguia saliendo con las 17 y las nuevas no
 * se podian cargar por planilla.
 */

const ESPECIES_066 = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'Ba++', 'Sr++', 'NH3(aq)', 'NH4+',
  'NH2COO-', 'H+', 'Cl-', 'HSO4-', 'SO4--', 'NO3-', 'OH-', 'CO2(aq)', 'HCO3-',
  'CO3--', 'H3BO3', 'B4O7--', 'BO2-',
];

const BRINE = { H2O: 4672.86, 'Li+': 4.657, 'Ba++': 1.5, 'NO3-': 0.25 };

function fakeFile(buf: ArrayBuffer): File {
  // El File de jsdom no implementa arrayBuffer(), que es lo unico que usa el parser.
  return { arrayBuffer: async () => buf } as unknown as File;
}

function hoja(cfg: Parameters<typeof buildWorkbook>[0], nombre: string) {
  const wb = buildWorkbook(cfg);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nombre]);
}

describe('Excel de config estatica — especies segun la base de catalogo', () => {
  it('sin species explicitas exporta las 17 de la 027', () => {
    const filas = hoja({ brine: BRINE }, 'Salmuera');
    expect(filas).toHaveLength(17);
    expect(filas.map((r) => r['Especie'])).not.toContain('Ba++');
  });

  it('con el catalogo 066 exporta las 23, incluidas las nuevas', () => {
    const filas = hoja({ brine: BRINE, species: ESPECIES_066 }, 'Salmuera');
    expect(filas).toHaveLength(23);
    const nombres = filas.map((r) => r['Especie']);
    for (const nueva of ['Ba++', 'Sr++', 'NO3-', 'NH4+']) {
      expect(nombres).toContain(nueva);
    }
  });

  it('las especies sin valor salen en cero, no ausentes', () => {
    const filas = hoja({ brine: BRINE, species: ESPECIES_066 }, 'Salmuera');
    const sr = filas.find((r) => r['Especie'] === 'Sr++')!;
    expect(Number(sr['Valor (ton/dia)'])).toBe(0);
  });

  it('el round-trip conserva las especies nuevas', async () => {
    const wb = buildWorkbook({ brine: BRINE, species: ESPECIES_066 });
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const parsed = await parseWorkbookFile(fakeFile(buf));
    expect(parsed.brine!['Ba++']).toBeCloseTo(1.5, 6);
    expect(parsed.brine!['NO3-']).toBeCloseTo(0.25, 6);
    expect(Object.keys(parsed.brine!)).toHaveLength(23);
  });
});
