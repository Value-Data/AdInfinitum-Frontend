import { describe, it, expect } from 'vitest';
import { resolveWellBrineFeed } from '../../src/utils/wellBrineFeed';

/**
 * Caso reportado: la tabla "Masa ingreso salmuera de pozo" mostraba 100 t/d fijos.
 *
 * Al pasar la salmuera del estático a composición (%w/w) + caudal, esta utilidad seguía
 * tomando la SUMA del dict como caudal — que en base porcentual es 100 por definición.
 * El caudal ahora sale de `brine_total_flow`, y la suma solo se usa para los snapshots
 * anteriores a la migración 008, que sí venían en t/d.
 */

const BRINE_PCT = { H2O: 74, 'Li+': 0.1, 'Na+': 12.9, 'Cl-': 13 };

describe('resolveWellBrineFeed — estático con salmuera en %w/w', () => {
  it('toma el caudal de brine_total_flow, no la suma de porcentajes', () => {
    const feed = resolveWellBrineFeed(
      { brine: BRINE_PCT, brine_total_flow: 6307.62 },
      'static',
    )!;
    expect(feed.flow).toBeCloseTo(6307.62, 4);
    expect(feed.flow).not.toBe(100);
  });

  it('la masa de cada especie escala con el caudal', () => {
    const feed = resolveWellBrineFeed(
      { brine: BRINE_PCT, brine_total_flow: 1000 },
      'static',
    )!;
    const li = feed.rows.find((r) => r.species === 'Li+')!;
    expect(li.pct).toBeCloseTo(0.1, 6);
    expect(li.mass).toBeCloseTo(1, 6); // 0,1% de 1000
    const suma = feed.rows.reduce((s, r) => s + r.mass, 0);
    expect(suma).toBeCloseTo(1000, 6);
  });

  it('flowOverride manda sobre el caudal de la configuración', () => {
    const feed = resolveWellBrineFeed(
      { brine: BRINE_PCT, brine_total_flow: 1000 },
      'static',
      2500,
    )!;
    expect(feed.flow).toBe(2500);
    const li = feed.rows.find((r) => r.species === 'Li+')!;
    expect(li.mass).toBeCloseTo(2.5, 6);
  });

  it('snapshot anterior a la 008 (t/d, sin caudal) sigue usando la suma', () => {
    const feed = resolveWellBrineFeed(
      { brine: { H2O: 740, 'Li+': 1, 'Na+': 129, 'Cl-': 130 } },
      'static',
    )!;
    expect(feed.flow).toBeCloseTo(1000, 6);
    const li = feed.rows.find((r) => r.species === 'Li+')!;
    expect(li.pct).toBeCloseTo(0.1, 6);
    expect(li.mass).toBeCloseTo(1, 6);
  });

  it('un caudal en cero no se toma como válido: cae a la suma', () => {
    const feed = resolveWellBrineFeed(
      { brine: { H2O: 740, 'Li+': 1, 'Na+': 129, 'Cl-': 130 }, brine_total_flow: 0 },
      'static',
    )!;
    expect(feed.flow).toBeCloseTo(1000, 6);
  });
});
