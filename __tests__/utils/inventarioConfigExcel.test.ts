import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildInventarioWorkbook,
  parseInventarioWorkbookFile,
} from '../../src/utils/inventarioConfigExcel';
import type { InventarioConfig } from '../../src/types';

/**
 * La plantilla del modo con inventario tiene que ser de ida y vuelta: lo que se baja
 * se reimporta sin perder nada. Es la única forma de editar los bloques largos —365
 * días de clima, 137 sales, y la composición de 17 especies por poza.
 */

const CONFIG: InventarioConfig = {
  _path: 'data/mariana/escenario_v2_oper_inventario.json',
  start_date: '2026-04-21',
  days_max: 1095,
  target: { pond_name: 'Kx4', li_pct_target: 0.2407, band_rel: 0.02 },
  pozas: [
    {
      name: 'Hx1', number: 1, area_design_m2: 2613229.57, control_mode: 'ALTURA',
      target_height_m: 0.428, max_height_m: 1.32, leakage_mm_day: 0.05,
      dilution_frac: 0, apply_berm_factor: false,
      pond_factor: 0.7, entrainment_pct: 10,
    },
    {
      name: 'Kx4', number: 2, area_design_m2: 293504.33, control_mode: 'FLUJO_FIJO',
      target_height_m: 0.92, max_height_m: 1.1, leakage_mm_day: 0.05,
      dilution_frac: 0.01, apply_berm_factor: false,
    },
  ],
  feed: {
    flowrate_tpd: 71413.74,
    composicion_pp: { H2O: 72.07, 'Li+': 0.0279, 'Na+': 9.38, 'Cl-': 15.62 },
  },
  inventario: {
    Hx1: {
      height_m: 0.4279, mass_liquid_ton: 1370504.44, density_kg_m3: 1225.58,
      water_activity: 0.7462,
      composition: { H2O: 981747.65, 'Li+': 500.98, 'Na+': 124126.51 },
    },
  },
  clima: {
    _formato: 'anio_tipico_365',
    doy: ['01-01', '01-02', '01-03'],
    evaporation_mm_day: [10.0888, 10.0679, 10.0464],
    temperature_C: [11.9222, 11.9366, 11.9495],
  },
  factores: { NaCl: 1, LiCl: 100000000, 'CaSO4·2H2O': 1 },
};

function fakeFile(buf: ArrayBuffer): File {
  // El File de jsdom no implementa arrayBuffer(), que es lo unico que usa el parser.
  return { arrayBuffer: async () => buf } as unknown as File;
}

async function roundTrip(cfg: InventarioConfig) {
  const wb = buildInventarioWorkbook(cfg);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return parseInventarioWorkbookFile(fakeFile(buf), { _path: cfg._path });
}

describe('plantilla del modo con inventario', () => {
  it('trae una hoja por bloque editable', () => {
    const wb = buildInventarioWorkbook(CONFIG);
    expect(wb.SheetNames).toEqual([
      'Instrucciones', 'Simulacion', 'Pozas', 'Alimentacion',
      'Inventario inicial', 'Clima', 'Factores',
    ]);
  });

  it('el round-trip conserva las pozas con sus campos', async () => {
    const { next, aplicadas } = await roundTrip(CONFIG);
    expect(aplicadas).toContain('Pozas');
    expect(next.pozas).toHaveLength(2);
    const [hx1, kx4] = next.pozas!;
    expect(hx1.name).toBe('Hx1');
    expect(hx1.area_design_m2).toBeCloseTo(2613229.57, 2);
    expect(hx1.apply_berm_factor).toBe(false);
    expect(kx4.control_mode).toBe('FLUJO_FIJO');
    expect(kx4.dilution_frac).toBeCloseTo(0.01, 6);
    // Factor de poza e impregnación viajan en la planilla: sin ellos, exportar e
    // importar los perdía y la corrida cambiaba de resultado en silencio.
    expect(hx1.pond_factor).toBeCloseTo(0.7, 6);
    expect(hx1.entrainment_pct).toBeCloseTo(10, 6);
  });

  it('el round-trip conserva el inventario inicial, incluida la composicion', async () => {
    const { next } = await roundTrip(CONFIG);
    const hx1 = next.inventario!.Hx1;
    expect(hx1.height_m).toBeCloseTo(0.4279, 4);
    // La masa NO se conserva textual: se deriva de la altura contra el area de la
    // poza. Con los valores redondeados de este fixture da ~60 t de diferencia
    // contra la masa original, que es justamente la señal de que se recalculo.
    const area = next.pozas!.find((p) => p.name === 'Hx1')!.area_design_m2;
    expect(hx1.mass_liquid_ton).toBeCloseTo(
      ((hx1.height_m as number) * area * (hx1.density_kg_m3 as number)) / 1000,
      6,
    );
    const comp = hx1.composition as Record<string, number>;
    expect(comp['Li+']).toBeCloseTo(500.98, 2);
    expect(Object.keys(comp)).toHaveLength(3);
  });

  it('el round-trip conserva clima y factores', async () => {
    const { next } = await roundTrip(CONFIG);
    expect(next.clima!.evaporation_mm_day).toEqual([10.0888, 10.0679, 10.0464]);
    expect(next.clima!.temperature_C).toEqual([11.9222, 11.9366, 11.9495]);
    expect(next.clima!.n_days_cycle).toBe(3);
    expect(next.factores!.NaCl).toBe(1);
    expect(next.factores!['CaSO4·2H2O']).toBe(1);
    expect(next.factores!.LiCl).toBe(100000000);
  });

  it('el round-trip conserva simulacion y alimentacion', async () => {
    const { next } = await roundTrip(CONFIG);
    expect(next.start_date).toBe('2026-04-21');
    expect(next.days_max).toBe(1095);
    // El caudal viaja en la hoja Simulacion, junto al horizonte — igual que en la
    // plantilla del dinámico. En Alimentacion queda solo la composición.
    expect(next.feed!.flowrate_tpd).toBeCloseTo(71413.74, 2);
    expect(next.feed!.composicion_pp!['Cl-']).toBeCloseTo(15.62, 2);
  });

  it('el caudal esta una sola vez: en Simulacion, no tambien en Alimentacion', () => {
    // Estaba en las dos hojas y al importar ganaba la última en silencio, así que
    // editarlo en Simulacion no tenía efecto.
    const wb = buildInventarioWorkbook(CONFIG);
    const alim = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Alimentacion'], { header: 1 });
    expect(alim.some((f) => String(f?.[0]) === 'flowrate_tpd')).toBe(false);
    const sim = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Simulacion'], { header: 1 });
    expect(sim.some((f) => String(f?.[0]) === 'flowrate_tpd')).toBe(true);
  });

  it('una planilla con una sola hoja solo toca ese bloque', async () => {
    // Caso real: se baja la plantilla, se cambia solo el clima y se vuelve a subir.
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['doy', 'evaporation_mm_day', 'temperature_C'],
        ['01-01', 5.5, 8.1],
      ]),
      'Clima',
    );
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const { next, aplicadas } = await parseInventarioWorkbookFile(fakeFile(buf), CONFIG);
    expect(aplicadas).toEqual(['Clima']);
    expect(next.clima!.evaporation_mm_day).toEqual([5.5]);
    // Lo demas queda como estaba.
    expect(next.pozas).toHaveLength(2);
    expect(next.feed!.flowrate_tpd).toBeCloseTo(71413.74, 2);
  });

  it('la composicion del inventario viaja como columnas por especie', async () => {
    // Es lo que permite editar el porcentaje de cada componente por poza: una
    // columna por especie, no un blob opaco.
    const wb = buildInventarioWorkbook(CONFIG);
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets['Inventario inicial'],
    );
    expect(filas).toHaveLength(1);
    const hx1 = filas[0];
    expect(hx1['poza']).toBe('Hx1');
    // Las cuatro magnitudes de la poza, mas una columna por especie.
    for (const especie of ['H2O', 'Li+', 'Na+']) {
      expect(hx1).toHaveProperty(especie);
    }
    expect(Number(hx1['Li+'])).toBeCloseTo(500.98, 2);
  });

  it('al importar, la masa se recalcula desde la altura y no se lee de la celda', async () => {
    // La masa dejo de ser editable en pantalla: se deriva. Si la planilla la
    // aceptara tal cual, editarla ahi contradiria a la altura sin aviso.
    const wb = buildInventarioWorkbook(CONFIG);
    const hoja = wb.Sheets['Inventario inicial'];
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja);
    // Se falsea la masa a un valor absurdo, dejando la altura intacta.
    filas[0]['mass_liquid_ton'] = 999999999;
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(filas), 'Inventario inicial');
    XLSX.utils.book_append_sheet(wb2, wb.Sheets['Pozas'], 'Pozas');
    const buf = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' });

    const { next } = await parseInventarioWorkbookFile(fakeFile(buf), CONFIG);
    const hx1 = next.inventario!.Hx1;
    const area = next.pozas!.find((p) => p.name === 'Hx1')!.area_design_m2;
    const esperada = ((hx1.height_m as number) * area * (hx1.density_kg_m3 as number)) / 1000;
    expect(hx1.mass_liquid_ton).toBeCloseTo(esperada, 6);
    expect(hx1.mass_liquid_ton).not.toBe(999999999);
  });

  it('las filas sin nombre de poza se descartan', async () => {
    const wb = buildInventarioWorkbook(CONFIG);
    XLSX.utils.sheet_add_aoa(wb.Sheets['Pozas'], [['', '', '', '', '', '', '', '', '']], {
      origin: -1,
    });
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const { next } = await parseInventarioWorkbookFile(fakeFile(buf), CONFIG);
    expect(next.pozas).toHaveLength(2);
  });
});

describe('plantilla: etapas de encalado y postliming', () => {
  // La cadena del modo tiene tres etapas y la plantilla tiene que cubrirlas igual que
  // la del dinámico. Son literalmente las mismas hojas: mismo nombre y mismos parsers.
  const CON_ETAPAS: InventarioConfig = {
    ...CONFIG,
    encalado: {
      config: {
        temperature_C: 15,
        use_CaCl2: true,
        use_CaCl2_threshold: 4.5,
        boron_removal_fraction: 0.4,
        cake_retention: 0.56,
        cake_wash_ratio: 1,
        cake_wash_recovery: 0.35,
        secuencia_dosificaciones: [
          { reactivo: 'Ca(OH)2', objetivo: 'Mg', factor_exceso: 1.17,
            concentracion_solucion: 0.25, enabled: true },
          { reactivo: 'CaCl2', objetivo: 'SO4', factor_exceso: 0.7,
            concentracion_solucion: 0.381, enabled: false },
        ],
      } as never,
      factors: [{ dll_index: 0, name: 'NaCl', precipitation_factor: 1 }],
    },
    postliming: {
      config: {
        n_days_max: 1460,
        temperature_C: null,
        abort_on_aqsol_fail_pct: 5,
        validation_window_days: [1095, 1460],
        salts_allowed: ['NaCl', 'KCl'],
        use_pz10_seasonal_modulation: true,
        pz10_average_outflow_t_day: 718.8,
        apply_berm_factor: false,
      } as never,
      ponds: [
        {
          name: 'Pz10', designation: '1.8-A', area_m2: 56628, control_mode: 'BUFFER',
          buffer_height_m: 0.98, target_height_m: 0.2, height_floor_m: 0.1,
          evap_factor: 1, leakage_mm_d: 0.03, entrainment_pct: 20,
          dilution_frac: 0.005, pond_factor: 0.7,
        },
      ],
      factors: [{ dll_index: 0, name: 'NaCl', precipitation_factor: 1000 }],
    },
  };

  it('con las tres etapas cargadas trae una hoja por bloque, igual que el dinamico', () => {
    const wb = buildInventarioWorkbook(CON_ETAPAS);
    expect(wb.SheetNames).toEqual([
      'Instrucciones', 'Simulacion', 'Pozas', 'Alimentacion',
      'Inventario inicial', 'Clima', 'Factores',
      'Encalado', 'Secuencia Dosificaciones', 'Factores Encalado',
      'Pozas Postliming', 'Postliming Params', 'Factores Postliming',
    ]);
  });

  it('el round-trip conserva encalado y postliming', async () => {
    const { next, aplicadas } = await roundTrip(CON_ETAPAS);
    expect(aplicadas).toContain('Encalado');
    expect(aplicadas).toContain('Pozas Postliming');

    expect(next.encalado!.config.temperature_C).toBeCloseTo(15, 6);
    expect(next.encalado!.config.use_CaCl2).toBe(true);
    // La secuencia mantiene su orden: es lo que decide en qué paso entra cada reactivo.
    const seq = next.encalado!.config.secuencia_dosificaciones!;
    expect(seq.map((d) => d.reactivo)).toEqual(['Ca(OH)2', 'CaCl2']);
    expect(seq[1].enabled).toBe(false);
    expect(next.encalado!.factors[0].name).toBe('NaCl');

    expect(next.postliming!.ponds).toHaveLength(1);
    expect(next.postliming!.ponds[0].control_mode).toBe('BUFFER');
    expect(next.postliming!.ponds[0].area_m2).toBeCloseTo(56628, 2);
    expect(next.postliming!.config.salts_allowed).toEqual(['NaCl', 'KCl']);
    expect(next.postliming!.factors[0].precipitation_factor).toBe(1000);
  });

  it('una planilla sin esas hojas deja los bloques como estaban', async () => {
    // Se sube solo la hoja de clima: las etapas 2 y 3 no se tocan.
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['doy', 'evaporation_mm_day', 'temperature_C'],
        ['01-01', 5.5, 8.1],
      ]),
      'Clima',
    );
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const { next, aplicadas } = await parseInventarioWorkbookFile(fakeFile(buf), CON_ETAPAS);
    expect(aplicadas).toEqual(['Clima']);
    expect(next.encalado!.config.temperature_C).toBe(15);
    expect(next.postliming!.ponds).toHaveLength(1);
  });
});
