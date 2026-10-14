import { describe, expect, it } from 'vitest';
import {
  addDays, buildSchema, cleanPayload, coerce, hiddenTopLevel, isVisible, issuesAt, parseNumber,
  parsePaste, seriesColumns,
} from '../../src/f6/sectionModel';
import type { DictionaryEntry } from '../../src/services/apiV2';

function entry(key: string, extra: Partial<DictionaryEntry> = {}): DictionaryEntry {
  const field = key.slice(key.lastIndexOf('.') + 1);
  return { key, entity: '', field, category: 'model', data_type: 'number', label: field,
           required: false, time_variable: false, ...extra };
}

describe('esquema de la sección desde el diccionario', () => {
  const schema = buildSchema([
    entry('ponds', { data_type: 'list', ui_order: 3 }),
    entry('note', { data_type: 'string', ui_order: 1 }),
    entry('ponds.area_m2', { ui_order: 2 }),
    entry('ponds.name', { data_type: 'string', ui_order: 1 }),
    entry('ponds.pond_type', { data_type: 'enum', ui_order: 3 }),
    entry('ponds.pond_type.fixed_flow', { category: 'enum', parent_key: 'ponds.pond_type', data_type: 'string',
                                          label: 'Buffer caudal fijo' }),
    entry('ponds.pond_type.target_height', { category: 'enum', parent_key: 'ponds.pond_type', data_type: 'string',
                                             label: 'Por altura objetivo' }),
  ]);

  it('da los hijos directos en orden, sin los valores de los enumerados', () => {
    expect(schema.children('').map((e) => e.key)).toEqual(['note', 'ponds']);
    expect(schema.children('ponds').map((e) => e.key)).toEqual(['ponds.name', 'ponds.area_m2', 'ponds.pond_type']);
    // Se elige por la etiqueta del diccionario; se guarda el código.
    expect(schema.enumValues('ponds.pond_type')).toEqual([
      { value: 'fixed_flow', label: 'Buffer caudal fijo' },
      { value: 'target_height', label: 'Por altura objetivo' }]);
  });
});

describe('visible_if', () => {
  it('entiende igualdad, desigualdad y booleanos', () => {
    expect(isVisible("pond_type == 'fixed_flow'", { pond_type: 'fixed_flow' })).toBe(true);
    expect(isVisible("pond_type == 'fixed_flow'", { pond_type: 'target_height' })).toBe(false);
    expect(isVisible("pond_type != 'fixed_flow'", { pond_type: 'target_height' })).toBe(true);
    expect(isVisible('use_salt_volume', { use_salt_volume: true })).toBe(true);
    expect(isVisible('use_salt_volume', {})).toBe(false);
    expect(isVisible(null, {})).toBe(true);
    expect(isVisible('algo raro(x)', {})).toBe(true);
  });
});

describe('números y pegado desde Excel', () => {
  it('admite coma decimal y separador de miles', () => {
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber(' ')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('separa por tabulador o por punto y coma', () => {
    expect(parsePaste('a\tb\r\nc\td\n')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(parsePaste('1;2,5\n')).toEqual([['1', '2,5']]);
  });

  it('convierte según el tipo del campo', () => {
    expect(coerce(entry('x'), '3,25')).toBe(3.25);
    expect(coerce(entry('x', { data_type: 'integer' }), '3,6')).toBe(4);
    expect(coerce(entry('x', { data_type: 'boolean' }), 'Sí')).toBe(true);
    expect(coerce(entry('x', { data_type: 'string' }), ' Pz1 ')).toBe('Pz1');
    expect(coerce(entry('x'), '')).toBeNull();
  });

  it('suma días a una fecha', () => {
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
  });
});

describe('lo que no aplica no se muestra ni se manda', () => {
  it('alimentación desde una ejecución: sin composición ni escenarios', () => {
    const p = { kind: 'postliming_static', feed_source: 'execution', composition_mode: 'fixed',
                brine_composition_pct: { H2O: 100 }, scenarios: [], ponds: [] };
    expect(hiddenTopLevel(p)).toEqual(new Set(['composition_mode', 'brine_composition_pct', 'scenarios', 'pond_param_changes']));
    expect(cleanPayload(p)).toEqual({ kind: 'postliming_static', feed_source: 'execution', ponds: [] });
  });

  it('el clima del postliming encadenado no lleva caudal', () => {
    expect(seriesColumns({ kind: 'postliming_dynamic', feed_source: 'execution' }))
      .toEqual(['evaporation_mm_d', 'temperature_C']);
    expect(seriesColumns({ kind: 'liming_dynamic', feed_source: 'data' })).toEqual(['brine_flow_t_d']);
  });

  it('una columna de serie entera vacía es una serie no cargada', () => {
    const p = { kind: 'precon_dynamic', composition_mode: 'fixed', pond_params_mode: 'fixed',
                series: { series_start_date: '2024-01-01', evaporation_mm_d: [1, 2],
                          temperature_C: [null, null], brine_flow_t_d: [10, null],
                          composition_pct_by_day: [{ H2O: 100 }, null] } };
    expect(cleanPayload(p).series).toEqual({ series_start_date: '2024-01-01',
      evaporation_mm_d: [1, 2], brine_flow_t_d: [10, null] });
  });
});

describe('problemas de validación por celda', () => {
  const issues = [
    { section: 'k', field: 'ponds.area_m2', row: 2, code: 'out_of_range', message: 'x' },
    { section: 'k', field: 'ponds', code: 'empty_list', message: 'y' },
  ];
  it('filtra por campo y fila', () => {
    expect(issuesAt(issues, 'ponds.area_m2', 2)).toHaveLength(1);
    expect(issuesAt(issues, 'ponds.area_m2', 1)).toHaveLength(0);
    expect(issuesAt(issues, 'ponds')).toHaveLength(1);
  });
});
