// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { labelWithUnit } from '../../src/f6/labels';

describe('etiqueta con su unidad, una sola vez', () => {
  it('agrega la unidad si la etiqueta no la trae', () => {
    expect(labelWithUnit('Evaporación', 't/d')).toBe('Evaporación (t/d)');
    expect(labelWithUnit('Nombre', '')).toBe('Nombre');
    expect(labelWithUnit('Nombre', null)).toBe('Nombre');
  });
  it('no la repite si la etiqueta ya la trae (m² = m2, mayúsculas, espacios)', () => {
    expect(labelWithUnit('Área de proceso (m²)', 'm2')).toBe('Área de proceso (m²)');
    expect(labelWithUnit('Impregnación (%)', '%')).toBe('Impregnación (%)');
    expect(labelWithUnit('Fugas (mm/d)', 'MM/D')).toBe('Fugas (mm/d)');
    expect(labelWithUnit('Densidad (kg/m³)', 'kg/m3')).toBe('Densidad (kg/m³)');
  });
});
