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

/** Filas de especie de la hoja Salmuera, sin la fila del caudal total. */
function especies(cfg: Parameters<typeof buildWorkbook>[0]) {
  return hoja(cfg, 'Salmuera').filter(
    (r) => !String(r['Especie'] ?? '').toLowerCase().startsWith('flujo total'),
  );
}

describe('Excel de config estatica — especies segun la base de catalogo', () => {
  it('sin species explicitas exporta las 17 de la 027', () => {
    const filas = especies({ brine: BRINE });
    expect(filas).toHaveLength(17);
    expect(filas.map((r) => r['Especie'])).not.toContain('Ba++');
  });

  it('con el catalogo 066 exporta las 23, incluidas las nuevas', () => {
    const filas = especies({ brine: BRINE, species: ESPECIES_066 });
    expect(filas).toHaveLength(23);
    const nombres = filas.map((r) => r['Especie']);
    for (const nueva of ['Ba++', 'Sr++', 'NO3-', 'NH4+']) {
      expect(nombres).toContain(nueva);
    }
  });

  it('las especies sin valor salen en cero, no ausentes', () => {
    const filas = especies({ brine: BRINE, species: ESPECIES_066 });
    const sr = filas.find((r) => r['Especie'] === 'Sr++')!;
    expect(Number(sr['%w/w'])).toBe(0);
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

/**
 * Caso reportado: se marcan 15 sales con factor 1 en el Excel (base 066) y al importar
 * solo quedan 7 — exactamente las de indice <= 155. El importador armaba el array con
 * largo fijo 156 y descartaba en silencio todo indice mayor.
 */
const INDICES_REPORTADOS = [
  5, 32, 83, 85, 125, 154, 155, 156, 160, 161, 162, 199, 200, 203, 237,
];

function hojaFactores(indices: number[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['indice', 'sal', 'factor']];
  for (let i = 0; i < 242; i++) {
    rows.push([i, `Sal ${i}`, indices.includes(i) ? 1 : 1e9]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

async function importar(faktorLength?: number) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaFactores(INDICES_REPORTADOS), 'Factores Precon');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return parseWorkbookFile(fakeFile(buf), faktorLength);
}

describe('Excel de config estatica — factores mas alla del indice 155', () => {
  it('con largo 267 (base 066) sobreviven las 15 sales habilitadas', async () => {
    const parsed = await importar(267);
    // Solo el rango de sales reales (0..241). Las posiciones 242..266 son padding del
    // Faktor y parseFaktor las deja en 1 por defecto, igual que 137..155 en la 027.
    const habilitadas = parsed.precon_faktor!
      .slice(0, 242)
      .map((v, i) => [i, v] as const)
      .filter(([, v]) => v === 1)
      .map(([i]) => i);
    expect(habilitadas).toEqual(INDICES_REPORTADOS);
    expect(parsed.precon_faktor).toHaveLength(267);
  });

  it('reproduce el bug con el largo viejo: solo quedan las de indice <= 155', async () => {
    const parsed = await importar(156);
    const habilitadas = parsed.precon_faktor!.slice(0, 242).filter((v) => v === 1).length;
    expect(habilitadas).toBe(7);
  });
});
