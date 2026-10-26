/**
 * Cambios finales, puntos 8, 21 y 22: lo que el editor manda al backend y cómo lee los
 * valores por defecto del diccionario. Funciones puras de `sectionModel`.
 */
import { describe, expect, it } from 'vitest';
import {
  cleanPayload, computedPurity, defaultOf, isDefaultValue, isEmptyComposition, isInerts, isWaterOnly,
  reagentsForSave, splitIssues, tagIssues, takesDefaultWhenEmpty,
} from '../../src/f6/sectionModel';
import type { DictionaryEntry, ValidationIssue } from '../../src/services/apiV2';

function campo(key: string, data_type: string, default_value: string | null): DictionaryEntry {
  return { key, entity: 'plant', field: key.split('.').pop()!, category: 'model', data_type, label: key,
           required: false, time_variable: false, read_only: false, default_value };
}

describe('valores por defecto del diccionario (punto 21)', () => {
  it('el diccionario los trae como texto: se leen con el tipo del campo', () => {
    expect(defaultOf(campo('plant.plant_temperature_C', 'number', '15.0'))).toBe(15);
    expect(defaultOf(campo('plant.dilution_frac', 'number', '0.01'))).toBe(0.01);
    expect(defaultOf(campo('plant.cake_wash_displacement', 'boolean', 'true'))).toBe(true);
    expect(defaultOf(campo('ponds.use_salt_volume', 'boolean', 'false'))).toBe(false);
    expect(defaultOf(campo('pond_params_mode', 'enum', 'fixed'))).toBe('fixed');
    expect(defaultOf(campo('plant.cacl2_min_so4_mg_ratio', 'number', null))).toBeUndefined();
  });

  it('15 es el default "15.0"; otro valor no; un default "nada" (0, falso) no se marca', () => {
    const temp = campo('plant.plant_temperature_C', 'number', '15.0');
    expect(isDefaultValue(temp, 15)).toBe(true);
    expect(isDefaultValue(temp, 15.5)).toBe(false);
    expect(isDefaultValue(campo('ponds.initial_salt_layer_m', 'number', '0.0'), 0)).toBe(false);
    expect(isDefaultValue(campo('ponds.use_salt_volume', 'boolean', 'false'), false)).toBe(false);
  });

  it('un campo vacío con default documentado lo toma (el backend avisa)', () => {
    const dil = campo('plant.dilution_frac', 'number', '0.01');
    expect(takesDefaultWhenEmpty(dil, null)).toBe(true);
    expect(takesDefaultWhenEmpty(dil, undefined)).toBe(true);
    expect(takesDefaultWhenEmpty(dil, 0.02)).toBe(false);
    expect(takesDefaultWhenEmpty(campo('plant.cacl2_min_so4_mg_ratio', 'number', null), null)).toBe(false);
  });

  it('vaciar un campo con default se manda como null (ni se borra ni se omite)', () => {
    const p = { kind: 'liming_static', feed_source: 'execution', note: null,
                plant: { dilution_frac: null, plant_temperature_C: 15, cacl2_min_so4_mg_ratio: null } };
    const out = cleanPayload(p) as { note: unknown; plant: Record<string, unknown> };
    expect(out.plant).toHaveProperty('dilution_frac', null);
    expect(out.plant).toHaveProperty('cacl2_min_so4_mg_ratio', null);
    expect(out).toHaveProperty('note', null);
    // Y en JSON también va el null.
    expect(JSON.parse(JSON.stringify(out)).plant.dilution_frac).toBeNull();
  });
});

describe('fichas de reactivos (punto 8)', () => {
  it('la pureza es 1 − Σ impurezas; sin impurezas, 1', () => {
    expect(computedPurity([{ species: 'inertes', frac: 0.167, destination: 'cake' }])).toBeCloseTo(0.833, 12);
    expect(computedPurity([{ frac: 0.0425 }, { frac: 0.005 }, { frac: 0.0003 }, { frac: 0.0028 }])).toBeCloseTo(0.9494, 12);
    expect(computedPurity([])).toBe(1);
    expect(computedPurity(undefined)).toBe(1);
    // Una fila a medio llenar (sin fracción) no cuenta.
    expect(computedPurity([{ species: 'NaCl' }])).toBe(1);
  });

  it('«inertes» se reconoce sin mayúsculas ni espacios', () => {
    expect(isInerts('inertes')).toBe(true);
    expect(isInerts(' Inertes ')).toBe(true);
    expect(isInerts('NaCl')).toBe(false);
    expect(isInerts(undefined)).toBe(false);
  });

  it('no se manda la pureza (la calcula el backend) y la línea de inertes va a la torta', () => {
    const reactivos = {
      'Ca(OH)2': { purity_frac: 0.833, impurities: [{ species: 'Inertes', frac: 0.167, destination: 'liquid' }] },
      NaOH: { purity_frac: 1, impurities: [] },
      CaCl2: { impurities: [{ species: 'NaCl', frac: 0.0425, destination: 'cake' }] },
    };
    expect(reagentsForSave(reactivos)).toEqual({
      'Ca(OH)2': { impurities: [{ species: 'Inertes', frac: 0.167, destination: 'cake' }] },
      NaOH: { impurities: [] },
      CaCl2: { impurities: [{ species: 'NaCl', frac: 0.0425, destination: 'cake' }] },
    });
  });

  it('cleanPayload deja las fichas sin pureza (una pureza vieja agregaría inertes)', () => {
    // Se borró la línea de inertes de la cal: si se mandara la pureza 0,833 el backend
    // volvería a agregar inertes 0,167.
    const p = { kind: 'liming_dynamic', feed_source: 'execution',
                plant: { reagents: { 'Ca(OH)2': { purity_frac: 0.833, impurities: [] } } } };
    const plant = (cleanPayload(p) as { plant: { reagents: Record<string, Record<string, unknown>> } }).plant;
    expect(plant.reagents['Ca(OH)2']).toEqual({ impurities: [] });
    expect(plant.reagents['Ca(OH)2']).not.toHaveProperty('purity_frac');
  });
});

describe('medio de lavado (punto 22)', () => {
  it('vacío, o todo en 0, es vacío; agua 100 % es el valor por defecto', () => {
    expect(isEmptyComposition(null)).toBe(true);
    expect(isEmptyComposition({})).toBe(true);
    expect(isEmptyComposition({ H2O: 0, 'Li+': 0 })).toBe(true);
    expect(isEmptyComposition({ H2O: 100 })).toBe(false);
    expect(isWaterOnly({ H2O: 100, 'Li+': 0 })).toBe(true);
    expect(isWaterOnly({ H2O: 99, 'Na+': 1 })).toBe(false);
    expect(isWaterOnly(null)).toBe(false);
  });

  it('una tabla vaciada se manda null ({} sería un error); una cargada, tal cual', () => {
    const conLavado = (v: unknown) => (cleanPayload({ kind: 'liming_static', feed_source: 'execution',
      plant: { cake_wash_medium_pct: v } }) as { plant: Record<string, unknown> }).plant.cake_wash_medium_pct;
    expect(conLavado({})).toBeNull();
    expect(conLavado({ H2O: 0, 'Li+': 0 })).toBeNull();
    expect(conLavado(null)).toBeNull();
    expect(conLavado({ H2O: 95, 'Na+': 5 })).toEqual({ H2O: 95, 'Na+': 5 });
  });
});

describe('errores y avisos por separado', () => {
  const issue = (field: string, code: string): ValidationIssue => ({ section: 'liming_static', field, code,
    message: code, row: null, row_label: null });
  it('el informe se junta con la gravedad de cada problema', () => {
    const todos = tagIssues({ errors: [issue('plant.dilution_frac', 'range')],
                              warnings: [issue('plant.dilution_frac', 'default_applied')] });
    expect(todos.map((i) => [i.code, i.severity])).toEqual([['range', 'error'], ['default_applied', 'warning']]);
    const { errors, warnings } = splitIssues(todos);
    expect(errors.map((i) => i.code)).toEqual(['range']);
    expect(warnings.map((i) => i.code)).toEqual(['default_applied']);
    expect(tagIssues(null)).toEqual([]);
    // Sin gravedad (un problema suelto) cuenta como error.
    expect(splitIssues([issue('x', 'y')]).errors).toHaveLength(1);
  });
});
