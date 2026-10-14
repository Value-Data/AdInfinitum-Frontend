import { describe, expect, it } from 'vitest';
import { displayNumber, orderColumns } from '../../src/f6/SectionEditorPage';
import { thin } from '../../src/f6/Charts';
import type { DictionaryEntry } from '../../src/services/apiV2';

const e = (field: string, ui_order: number): DictionaryEntry => ({
  key: `ponds.${field}`, entity: 'ponds', field, category: 'model', data_type: 'number', label: field,
  required: false, time_variable: false, ui_order });

describe('lo que se ve en el editor', () => {
  it('los números largos se ven con hasta 4 decimales', () => {
    expect(displayNumber(206536.1111111111)).toBe('206536.1111');
    expect(displayNumber(0.005)).toBe('0.005');
    expect(displayNumber(0.0000123456789)).toBe('0.000012');
    expect(displayNumber(10)).toBe('10');
  });

  it('nombre, tipo y área de la poza van primero', () => {
    const cols = [e('dilution_frac', 6), e('area_m2', 3), e('pond_type', 7), e('name', 1), e('designation', 2)];
    expect(orderColumns(cols).map((c) => c.field)).toEqual(
      ['name', 'designation', 'pond_type', 'area_m2', 'dilution_frac']);
  });
});

describe('gráficos', () => {
  it('una serie larga se raleia pero conserva el primer y el último día', () => {
    const filas = Array.from({ length: 1460 }, (_, i) => i);
    const r = thin(filas, 500);
    expect(r.length).toBeLessThanOrEqual(500);
    expect([r[0], r[r.length - 1]]).toEqual([0, 1459]);
    expect(thin([1, 2, 3], 500)).toEqual([1, 2, 3]);
  });
});
