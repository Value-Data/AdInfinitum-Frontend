import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, parseWorkbookFile } from '../../src/utils/configExcel';

/**
 * La salmuera del estatico paso de 23 caudales sueltos a composicion (%w/w) + caudal
 * total, y el cronograma admite un caudal por dia. La plantilla Excel es la via de
 * carga masiva, asi que ambos tienen que sobrevivir el ida y vuelta — y una plantilla
 * antigua, escrita en ton/dia, tiene que seguir sirviendo.
 */

function fakeFile(buf: ArrayBuffer): File {
  return { arrayBuffer: async () => buf } as unknown as File;
}

async function roundTrip(cfg: Parameters<typeof buildWorkbook>[0]) {
  const wb = buildWorkbook(cfg);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return parseWorkbookFile(fakeFile(buf));
}

const BRINE_PCT = { H2O: 58.5, 'Li+': 0.5, 'Na+': 25.0, 'Cl-': 16.0 };
const TOTAL = 743.9852271;

describe('plantilla Excel — salmuera como composicion + caudal', () => {
  it('el caudal total sobrevive el ida y vuelta', async () => {
    const parsed = await roundTrip({ brine: BRINE_PCT, brine_total_flow: TOTAL });
    expect(parsed.brine_total_flow).toBeCloseTo(TOTAL, 6);
  });

  it('los porcentajes se conservan y siguen sumando 100', async () => {
    const parsed = await roundTrip({ brine: BRINE_PCT, brine_total_flow: TOTAL });
    expect(parsed.brine!['Li+']).toBeCloseTo(0.5, 6);
    expect(parsed.brine!['Na+']).toBeCloseTo(25.0, 6);
    const suma = Object.values(parsed.brine!).reduce((s, v) => s + v, 0);
    expect(suma).toBeCloseTo(100, 6);
  });

  it('la fila del caudal no entra como especie', async () => {
    const parsed = await roundTrip({ brine: BRINE_PCT, brine_total_flow: TOTAL });
    const claves = Object.keys(parsed.brine!).map((k) => k.toLowerCase());
    expect(claves.some((k) => k.startsWith('flujo total'))).toBe(false);
  });

  it('una plantilla antigua en ton/dia se convierte a composicion + caudal', async () => {
    // Hoja escrita con el formato anterior: caudal por especie, sin fila de total.
    const ws = XLSX.utils.aoa_to_sheet([
      ['Especie', 'Valor (ton/dia)'],
      ['H2O', 585],
      ['Li+', 5],
      ['Na+', 250],
      ['Cl-', 160],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salmuera');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const parsed = await parseWorkbookFile(fakeFile(buf));

    expect(parsed.brine_total_flow).toBeCloseTo(1000, 6);
    expect(parsed.brine!['Li+']).toBeCloseTo(0.5, 6);
    expect(parsed.brine!['H2O']).toBeCloseTo(58.5, 6);
    const suma = Object.values(parsed.brine!).reduce((s, v) => s + v, 0);
    expect(suma).toBeCloseTo(100, 6);
  });
});

describe('plantilla Excel — caudal por dia en el cronograma', () => {
  const SCHEDULE = [
    { date_label: 'D1', temperature_C: 20, evap_rate: 5, brine_total_flow: 700 },
    { date_label: 'D2', temperature_C: 21, evap_rate: 6, brine_total_flow: 1400 },
    { date_label: 'D3', temperature_C: 22, evap_rate: 7 }, // hereda el global
  ];

  it('conserva el caudal de cada dia', async () => {
    const parsed = await roundTrip({ daily_schedule: SCHEDULE });
    expect(parsed.daily_schedule![0].brine_total_flow).toBe(700);
    expect(parsed.daily_schedule![1].brine_total_flow).toBe(1400);
  });

  it('un dia sin caudal queda sin la clave, para heredar el global', async () => {
    const parsed = await roundTrip({ daily_schedule: SCHEDULE });
    expect(parsed.daily_schedule![2].brine_total_flow).toBeUndefined();
  });

  it('un cronograma sin la columna se importa igual', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['date_label', 'temperature_C', 'evap_rate'],
      ['D1', 20, 5],
      ['D2', 21, 6],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const parsed = await parseWorkbookFile(fakeFile(buf));

    expect(parsed.daily_schedule).toHaveLength(2);
    expect(parsed.daily_schedule![0].temperature_C).toBe(20);
    expect(parsed.daily_schedule![0].brine_total_flow).toBeUndefined();
  });
});
