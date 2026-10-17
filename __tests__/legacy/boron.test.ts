import { describe, it, expect } from 'vitest';
import { boronFrom, BORON_FACTORS } from '../../src/legacy/utils/boron';

/**
 * mB = (PM_B/PM_H3BO3)·m_H3BO3 + (4·PM_B/PM_B4O7)·m_B4O7 + (PM_B/PM_BO2)·m_BO2
 * PM: B=10.811, H3BO3=61.83302, B4O7--=155.2398, BO2-=42.8098
 */
describe('boronFrom — masa de B derivada de las especies con boro', () => {
  it('1 mol de cada especie da el B estequiométrico', () => {
    // 1 mol H3BO3 (61.83302 g) => 1 átomo B => 10.811 g
    expect(boronFrom({ H3BO3: 61.83302 })).toBeCloseTo(10.811, 4);
    // 1 mol B4O7-- (155.2398 g) => 4 átomos B => 43.244 g
    expect(boronFrom({ 'B4O7--': 155.2398 })).toBeCloseTo(4 * 10.811, 4);
    // 1 mol BO2- (42.8098 g) => 1 átomo B => 10.811 g
    expect(boronFrom({ 'BO2-': 42.8098 })).toBeCloseTo(10.811, 4);
  });

  it('los factores coinciden con la fórmula', () => {
    expect(BORON_FACTORS['H3BO3']).toBeCloseTo(0.174842, 5);
    expect(BORON_FACTORS['B4O7--']).toBeCloseTo(0.278562, 5);
    expect(BORON_FACTORS['BO2-']).toBeCloseTo(0.252537, 5);
  });

  it('suma las contribuciones y es lineal', () => {
    const comp = { H3BO3: 10, 'B4O7--': 5, 'BO2-': 2 };
    const expected =
      BORON_FACTORS['H3BO3'] * 10 + BORON_FACTORS['B4O7--'] * 5 + BORON_FACTORS['BO2-'] * 2;
    expect(boronFrom(comp)).toBeCloseTo(expected, 8);
  });

  it('claves ausentes / null cuentan como 0', () => {
    expect(boronFrom({ Li: 5 })).toBe(0);
    expect(boronFrom({})).toBe(0);
    expect(boronFrom(null)).toBe(0);
    expect(boronFrom(undefined)).toBe(0);
  });
});
