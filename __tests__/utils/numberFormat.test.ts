import { describe, it, expect, afterEach } from 'vitest';
import { formatEs, fmtNum, setDecimalsOverride } from '../../src/utils/numberFormat';

/**
 * El separador decimal de TODO el display de resultados pasa por formatEs
 * (coma decimal, punto de miles). fmtNum lo usa. Estos tests fijan esa garantía.
 */
describe('formatEs — coma decimal, punto de miles', () => {
  it('decimal simple usa coma', () => {
    expect(formatEs(1.5, 2)).toBe('1,50');
    expect(formatEs(0.5, 3)).toBe('0,500');
  });

  it('separador de miles es punto', () => {
    expect(formatEs(1234.5, 2)).toBe('1.234,50');
    expect(formatEs(1234567.89, 2)).toBe('1.234.567,89');
    expect(formatEs(1000, 0)).toBe('1.000');
  });

  it('cero y sin decimales', () => {
    expect(formatEs(0, 2)).toBe('0,00');
    expect(formatEs(42, 0)).toBe('42');
  });

  it('negativos', () => {
    expect(formatEs(-0.5, 3)).toBe('-0,500');
    expect(formatEs(-1234.5, 1)).toBe('-1.234,5');
  });

  it('no produce "-0" (menos cero) al redondear a cero', () => {
    expect(formatEs(-0.001, 2)).toBe('0,00');
    expect(formatEs(-0.0000001, 4)).toBe('0,0000');
  });

  it('redondeo correcto (toFixed)', () => {
    expect(formatEs(2.345, 2)).toBe('2,35');
    expect(formatEs(0.001, 4)).toBe('0,0010');
  });

  it('el punto solo agrupa miles, la coma es el decimal', () => {
    expect(formatEs(1234.56, 2)).toBe('1.234,56'); // punto = miles, coma = decimal
    expect(formatEs(12.5, 1)).toBe('12,5'); // sin miles => sin punto
    expect(formatEs(12.5, 1).includes('.')).toBe(false);
    expect(formatEs(999.99, 2).includes('.')).toBe(false); // < 1000, sin agrupación
  });
});

describe('fmtNum — envuelve formatEs y respeta override', () => {
  afterEach(() => setDecimalsOverride(null));

  it('null / NaN => cadena vacía', () => {
    expect(fmtNum(null)).toBe('');
    expect(fmtNum(undefined)).toBe('');
    expect(fmtNum(Number.NaN)).toBe('');
  });

  it('usa coma decimal', () => {
    expect(fmtNum(3.14159, 2)).toBe('3,14');
    expect(fmtNum(12345.6, 1)).toBe('12.345,6');
  });

  it('el override global de decimales gana', () => {
    setDecimalsOverride(4);
    expect(fmtNum(1.5, 2)).toBe('1,5000');
    setDecimalsOverride(0);
    expect(fmtNum(1.5, 2)).toBe('2'); // 1.5 -> 2 con 0 decimales
  });
});
