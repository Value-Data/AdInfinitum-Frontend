import { describe, it, expect } from 'vitest';
import {
  asPercentBasis,
  isPercentBasis,
  normalizeToHundred,
  setSpeciesPercent,
  compositionClosure,
  buildBrineCompositionRows,
  sumValues,
} from '../../src/utils/brineComposition';

// Salmuera de referencia en t/d (configuración anterior, escala absoluta).
const BRINE_TD = {
  H2O: 29157,
  'Li+': 22,
  'Na+': 3850,
  'Cl-': 5968,
  'SO4--': 569,
};

describe('isPercentBasis — detección de configuraciones antiguas en t/d', () => {
  it('una salmuera en t/d NO es base porcentual', () => {
    expect(isPercentBasis(BRINE_TD)).toBe(false);
  });

  it('una composición que cierra en 100 sí lo es', () => {
    expect(isPercentBasis({ H2O: 72.89, 'Na+': 27.11 })).toBe(true);
  });

  it('una composición de laboratorio que no cierra exacto sigue siendo composición', () => {
    expect(isPercentBasis({ H2O: 72.89, 'Na+': 27.09 })).toBe(true); // suma 99,98
  });

  it('una composición a medio cargar (suma lejos de 100) NO se confunde con t/d', () => {
    // Regresión: bajar H2O de 74 a 60 deja la suma en ~86; con una ventana estrecha
    // esto se tomaba por t/d y renormalizaba a 100, borrando lo que el usuario tipeó.
    expect(isPercentBasis({ H2O: 60, 'Na+': 9.1, 'Cl-': 14.6, 'SO4--': 1.1 })).toBe(true);
    expect(isPercentBasis({ H2O: 130, 'Na+': 20 })).toBe(true); // pasado de 100 también
  });

  it('un dict vacío o en cero no es base porcentual', () => {
    expect(isPercentBasis({})).toBe(false);
    expect(isPercentBasis({ H2O: 0 })).toBe(false);
  });
});

describe('asPercentBasis — migración al vuelo, sin tocar lo tipeado', () => {
  it('convierte t/d a %w/w', () => {
    const pct = asPercentBasis(BRINE_TD);
    expect(sumValues(pct)).toBeCloseTo(100, 4);
    // H2O = 29157 / 39566 * 100
    expect(pct['H2O']).toBeCloseTo(73.6919, 3);
  });

  it('deja intacta una composición que no cierra en 100', () => {
    const libre = { H2O: 72.89, 'Na+': 27.09 };
    expect(asPercentBasis(libre)).toEqual(libre);
  });

  it('es idempotente', () => {
    const once = asPercentBasis(BRINE_TD);
    expect(asPercentBasis(once)).toEqual(once);
  });

  it('total 0 devuelve las mismas claves en cero, sin NaN', () => {
    expect(asPercentBasis({ H2O: 0, 'Li+': 0 })).toEqual({ H2O: 0, 'Li+': 0 });
  });
});

describe('setSpeciesPercent — entrada libre', () => {
  it('guarda exactamente el valor tipeado', () => {
    expect(setSpeciesPercent(BRINE_TD, 'Li+', 0.055)['Li+']).toBe(0.055);
  });

  it('NO toca las demás especies al editar una', () => {
    const base = asPercentBasis(BRINE_TD);
    const next = setSpeciesPercent(BRINE_TD, 'Li+', 0.08);
    for (const k of Object.keys(base)) {
      if (k !== 'Li+') expect(next[k]).toBe(base[k]);
    }
  });

  it('editar dos veces seguidas no arrastra deriva sobre lo ya fijado', () => {
    const a = setSpeciesPercent(BRINE_TD, 'Li+', 0.055);
    const b = setSpeciesPercent(a, 'Na+', 9.63);
    expect(b['Li+']).toBe(0.055); // exacto, no "cerca de"
    expect(b['Na+']).toBe(9.63);
  });

  it('un recorte grande sobrevive a la re-lectura de la tabla', () => {
    // Regresión del bug visto en el navegador: H2O 74 → 60 dejaba la suma en ~86 y el
    // siguiente render lo renormalizaba a 69,8 en vez de mostrar el aviso.
    const edited = setSpeciesPercent(BRINE_TD, 'H2O', 60);
    expect(edited['H2O']).toBe(60);
    // Re-leer (lo que hace cada render) debe devolver el 60 intacto.
    expect(asPercentBasis(edited)['H2O']).toBe(60);
    expect(compositionClosure(edited).closes).toBe(false);
  });

  it('clampea a [0, 100]', () => {
    expect(setSpeciesPercent(BRINE_TD, 'H2O', 150)['H2O']).toBe(100);
    expect(setSpeciesPercent(BRINE_TD, 'Li+', -5)['Li+']).toBe(0);
  });
});

describe('compositionClosure — aviso cuando no llega a 100', () => {
  it('marca cierre correcto en una composición exacta', () => {
    const c = compositionClosure({ H2O: 72.89, 'Na+': 27.11 });
    expect(c.closes).toBe(true);
    expect(c.delta).toBeCloseTo(0, 6);
  });

  it('avisa y reporta cuánto falta', () => {
    const c = compositionClosure({ H2O: 72.89, 'Na+': 27.09 });
    expect(c.closes).toBe(false);
    expect(c.sum).toBeCloseTo(99.98, 6);
    expect(c.delta).toBeCloseTo(-0.02, 6); // negativo = falta
  });

  it('avisa también cuando se pasa de 100', () => {
    const c = compositionClosure({ H2O: 72.89, 'Na+': 27.13 });
    expect(c.closes).toBe(false);
    expect(c.delta).toBeCloseTo(0.02, 6); // positivo = sobra
  });

  it('una config antigua en t/d se lee normalizada y cierra', () => {
    expect(compositionClosure(BRINE_TD).closes).toBe(true);
  });

  it('no dispara el aviso por ruido de punto flotante', () => {
    expect(compositionClosure({ a: 33.333333, b: 33.333333, c: 33.333334 }).closes).toBe(true);
  });
});

describe('normalizeToHundred — botón "Normalizar a 100"', () => {
  it('cierra una composición que venía desviada', () => {
    const fixed = normalizeToHundred({ H2O: 72.89, 'Na+': 27.09 });
    expect(sumValues(fixed)).toBeCloseTo(100, 4);
    expect(compositionClosure(fixed).closes).toBe(true);
  });

  it('conserva las proporciones relativas', () => {
    const before = { H2O: 72.89, 'Na+': 20.0, 'Cl-': 7.09 };
    const after = normalizeToHundred(before);
    expect(after['Na+'] / after['Cl-']).toBeCloseTo(before['Na+'] / before['Cl-'], 6);
  });
});

describe('buildBrineCompositionRows — masa derivada', () => {
  const ORDER = ['H2O', 'Li+', 'Na+', 'Cl-', 'SO4--'];

  it('la masa derivada suma el flujo total aunque los % no cierren', () => {
    const brine = { H2O: 72.89, 'Li+': 0.055, 'Na+': 27.0 }; // suma 99,945
    const { totalPct, totalMass } = buildBrineCompositionRows(brine, ORDER, 40000);
    expect(totalPct).toBeCloseTo(99.945, 4);
    expect(totalMass).toBeCloseTo(40000, 2); // se normaliza, igual que el motor
  });

  it('escala cada especie por el flujo: Li+ a 0,055 %w/w de 40.000 t/d ≈ 22 t/d', () => {
    const brine = normalizeToHundred(setSpeciesPercent(BRINE_TD, 'Li+', 0.055));
    const { rows } = buildBrineCompositionRows(brine, ORDER, 40000);
    expect(rows.find((r) => r.species === 'Li+')!.mass).toBeCloseTo(22, 1);
  });

  it('muestra en cero las especies del orden canónico ausentes del dict', () => {
    const { rows } = buildBrineCompositionRows({ H2O: 100 }, ORDER, 1000);
    const na = rows.find((r) => r.species === 'Na+')!;
    expect(na.pct).toBe(0);
    expect(na.mass).toBe(0);
    expect(rows).toHaveLength(ORDER.length);
  });

  it('incluye especies extra fuera del orden canónico', () => {
    const { rows, totalPct } = buildBrineCompositionRows({ H2O: 50, 'X-': 50 }, ['H2O'], 1000);
    expect(rows.map((r) => r.species)).toContain('X-');
    expect(totalPct).toBeCloseTo(100, 4);
  });

  it('flujo 0 o ausente no produce NaN', () => {
    const { rows, totalMass } = buildBrineCompositionRows(BRINE_TD, ORDER, 0);
    expect(rows.every((r) => Number.isFinite(r.mass))).toBe(true);
    expect(totalMass).toBe(0);
  });
});
