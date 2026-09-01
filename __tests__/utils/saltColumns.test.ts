import { describe, it, expect } from 'vitest';
import { saltColumnsFromHeader } from '../../src/components/DynamicResultsView';

/**
 * El grafico de sales por poza filtraba las columnas por prefijo `salt_` y sufijo
 * `_ton`, y con eso se llevaba puestos los dos agregados del dia que el runner escribe
 * con el mismo prefijo: los graficaba como dos sales llamadas "accumulated" y
 * "precipitated". El acumulado es un inventario monotono creciente, asi que aplastaba
 * la escala de las sales reales.
 */

// Encabezado real del CSV por poza (dynamic_runner._write_pond_csv), recortado.
const HEADER = [
  'day', 'date', 'height_m', 'mass_liquid_ton', 'density_kg_m3', 'water_activity',
  'evaporation_ton', 'leakage_ton', 'entrainment_ton',
  'salt_precipitated_ton', 'salt_accumulated_ton',
  'impregnation_accumulated_ton', 'inflow_ton', 'outflow_ton',
  'H2O_ton_day', 'Li+_ton_day',
  'salt_NaCl_ton', 'salt_KCl_ton', 'salt_CaSO4·2H2O_ton', 'salt_Na2SO4·10H2O_ton',
];

const nombres = (cols: { h: string }[]) =>
  cols.map(({ h }) => h.replace(/^salt_/, '').replace(/_ton$/, ''));

describe('columnas de sal del CSV por poza', () => {
  it('deja fuera el acumulado', () => {
    expect(nombres(saltColumnsFromHeader(HEADER))).not.toContain('accumulated');
  });

  it('deja fuera el total precipitado del dia', () => {
    // Es la suma de las demas series: graficarlo junto a ellas duplica la informacion.
    expect(nombres(saltColumnsFromHeader(HEADER))).not.toContain('precipitated');
  });

  it('conserva las sales reales, con su indice de columna', () => {
    const cols = saltColumnsFromHeader(HEADER);
    expect(nombres(cols)).toEqual(['NaCl', 'KCl', 'CaSO4·2H2O', 'Na2SO4·10H2O']);
    for (const { h, i } of cols) {
      expect(HEADER[i]).toBe(h);
    }
  });

  it('no toca columnas ajenas que terminan en _ton', () => {
    const cols = nombres(saltColumnsFromHeader(HEADER));
    expect(cols).not.toContain('impregnation_accumulated');
    expect(cols).not.toContain('inflow');
  });

  it('un CSV sin sales no devuelve nada', () => {
    expect(saltColumnsFromHeader(['day', 'salt_precipitated_ton', 'salt_accumulated_ton']))
      .toEqual([]);
  });
});
