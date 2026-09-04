import { describe, it, expect } from 'vitest';

/**
 * La masa líquida del inventario inicial dejó de ser un campo que se tipea: se
 * deriva de la altura. Este test fija la identidad geométrica contra los datos
 * reales de la entrega, que es lo que habilita haber sacado masa, densidad y
 * actividad de agua de la tabla.
 *
 *     masa (t) = altura (m) × área (m²) × densidad (kg/m³) / 1000
 */

// Valores tal como vienen en warmstart_v2_20260420.json + ponds_mariana_v2.
const POZAS = [
  { name: 'Hx1', altura: 0.42791922909852703, area: 2613229.5652173916, densidad: 1225.5783495388894, masa: 1370504.4367863957 },
  { name: 'Hx2', altura: 0.3659965209313817, area: 2090583.4782608696, densidad: 1232.6704711134078, masa: 943173.22514256 },
  { name: 'Hx3', altura: 0.24033595689548956, area: 1672466.9565217393, densidad: 1241.720175807866, masa: 499114.32495538174 },
  { name: 'Hx4', altura: 0.23809416786198245, area: 1337973.9130434783, densidad: 1252.1268779394372, masa: 398882.27809648035 },
  { name: 'Hx5', altura: 0.17036717014137198, area: 1070379.1304347827, densidad: 1262.750286585903, masa: 230271.9392080134 },
  { name: 'Hx6', altura: 0.17731944749174422, area: 856303.4782608696, densidad: 1271.0726068149831, masa: 192998.72358078786 },
  { name: 'Kx1', altura: 0.2684368560751998, area: 573250.4347826088, densidad: 1268.414924945403, masa: 195185.64766263549 },
  { name: 'Kx2', altura: 0.3036308628717682, area: 458600.8695652174, densidad: 1266.919654499803, masa: 176412.70585684024 },
  { name: 'Kx3', altura: 0.21054934790716473, area: 366880, densidad: 1265.431856705448, masa: 97749.98547358447 },
  { name: 'Kx4', altura: 0.14995439506148378, area: 293504.347826087, densidad: 1264.3657277862749, masa: 55647.601903638555 },
];

function masaDesdeAltura(altura: number, area: number, densidad: number): number {
  return (altura * area * densidad) / 1000;
}

describe('masa líquida derivada de la altura', () => {
  it.each(POZAS)('$name: la identidad geométrica cierra', ({ altura, area, densidad, masa }) => {
    // Tolerancia relativa: son magnitudes de cientos de miles de toneladas.
    expect(masaDesdeAltura(altura, area, densidad) / masa).toBeCloseTo(1, 9);
  });

  it('subir la altura sube la masa en la misma proporción', () => {
    const { area, densidad } = POZAS[0];
    const base = masaDesdeAltura(0.4, area, densidad);
    expect(masaDesdeAltura(0.8, area, densidad) / base).toBeCloseTo(2, 12);
  });

  it('la composición se reescala conservando los porcentajes', () => {
    // Es lo que hace el editor al cambiar la altura: los % son del usuario, las
    // toneladas se recalculan contra la masa nueva.
    const comp = { H2O: 981747.65, 'Li+': 500.98, 'Na+': 124126.51 };
    const masaVieja = Object.values(comp).reduce((a, b) => a + b, 0);
    const pct = Object.fromEntries(
      Object.entries(comp).map(([sp, v]) => [sp, (v / masaVieja) * 100]),
    );
    const masaNueva = masaVieja * 1.5;
    const nuevo = Object.fromEntries(
      Object.entries(pct).map(([sp, v]) => [sp, (v / 100) * masaNueva]),
    );

    expect(Object.values(nuevo).reduce((a, b) => a + b, 0)).toBeCloseTo(masaNueva, 6);
    // El porcentaje de cada especie no se movió.
    for (const sp of Object.keys(comp)) {
      expect((nuevo[sp] / masaNueva) * 100).toBeCloseTo(pct[sp], 9);
    }
  });
});
