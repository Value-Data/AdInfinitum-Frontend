import { describe, expect, it } from 'vitest';
import { displayNumber, orderColumns } from '../../src/f6/SectionEditorPage';
import { chartLayout, seriesStyle } from '../../src/f6/chartData';
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
  it('una serie larga no se raleia: el gráfico se ensancha para alcanzar cada día', () => {
    const g = chartLayout(1460, 'auto', 'day');
    expect(g.minWidth).toBeGreaterThanOrEqual(1460 * 3);
    expect(g.interval).toBe('preserveStartEnd');
    expect(chartLayout(30, 'auto', 'day').minWidth).toBe(0);
  });
  it('el paso de días pone una marca cada N días y ensancha si son muchas', () => {
    const g = chartLayout(1460, 10, 'day');
    expect(g.interval).toBe(9);
    expect(g.angled).toBe(true);
    expect(g.minWidth).toBe(146 * 46);
    expect(chartLayout(100, 30, 'day')).toMatchObject({ interval: 29, angled: false });
  });
  it('para imprimir, al ancho de la página', () => {
    expect(chartLayout(1460, 10, 'date', true)).toMatchObject({ minWidth: 0, interval: 'preserveStartEnd' });
  });
  it('desde la 9ª serie, el color se repite con trazo cortado', () => {
    expect(seriesStyle(0).strokeDasharray).toBeUndefined();
    expect(seriesStyle(8)).toEqual({ stroke: seriesStyle(0).stroke, strokeDasharray: '6 3' });
  });
});

import { fillEmpty, normalizePct, seriesAverage } from '../../src/f6/SectionEditorPage';
import { duration } from '../../src/f6/ProjectPage';
import { buildLaunchRequest } from '../../src/f6/LaunchPanel';

describe('herramientas recuperadas de la versión anterior', () => {
  it('normalizar la composición a 100 sin cambiar proporciones', () => {
    const n = normalizePct({ H2O: 90, Li: 5, Na: 5.5 });
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(n.Li / n.Na).toBeCloseTo(5 / 5.5, 12);
  });
  it('promedio y relleno de una serie con días vacíos', () => {
    expect(seriesAverage([1, null, 3])).toBe(2);
    expect(seriesAverage([null])).toBeNull();
    expect(fillEmpty([1, null, 3], 7)).toEqual([1, 7, 3]);
  });
  it('duración de una corrida', () => {
    expect(duration('2026-10-14T10:00:00', '2026-10-14T11:05:30')).toBe('1 h 05 min');
    expect(duration('2026-10-14T10:00:00', '2026-10-14T10:03:20')).toBe('3 min 20 s');
    expect(duration(null, null)).toBe('–');
  });
  it('los escenarios elegidos van ordenados; ninguno = todos', () => {
    const base = { tipo: 'static_full' as const, runTag: 'r', source: '', continuar: '', dia: '',
                   inicio: '', dias: '', reintento: false, timeout: '300' };
    expect(buildLaunchRequest({ ...base, escenarios: [3, 1] }, []).selected_scenarios).toEqual([1, 3]);
    expect(buildLaunchRequest({ ...base, escenarios: [] }, []).selected_scenarios).toBeUndefined();
  });
});

import { tooltipOf } from '../../src/f6/SectionEditorPage';

describe('ayuda de cada campo', () => {
  it('descripción, ayuda extra, unidad con rango y nombre interno', () => {
    const t = tooltipOf({ key: 'ponds.dilution_frac', entity: 'ponds', field: 'dilution_frac', category: 'model',
      data_type: 'number', label: 'Dilución', description: 'Agua de dilución.', help_text: null,
      unit: 'frac', min_value: 0, max_value: 1, min_inclusive: true, max_inclusive: false,
      required: false, time_variable: true } as never);
    expect(t.split('\n')).toEqual(['Agua de dilución.', 'frac [0, 1)', 'ponds.dilution_frac']);
  });
});
