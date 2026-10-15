import { describe, expect, it } from 'vitest';
import { describeSection } from '../../src/f6/InputParameters';
import { pdfFileName } from '../../src/f6/PrintReportPage';
import { pdfBlocks } from '../../src/utils/pdfReport';
import type { DictionaryEntry } from '../../src/services/apiV2';

const e = (key: string, label: string, extra: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
  key, entity: key.split('.')[0], field: key.split('.').pop()!, category: 'model', data_type: 'number', label,
  required: false, time_variable: false, ui_order: 0, ...extra } as DictionaryEntry);

const palabras = { general: 'Generales', startDate: 'Inicio', days: 'días', average: 'promedio' };

describe('parámetros de entrada del reporte', () => {
  it('campos sueltos, tablas de pozas, composición y la serie resumida, con etiquetas del diccionario', () => {
    const dic = [
      e('kind', 'Tipo', { data_type: 'string' }), e('feed_source', 'Alimentación', { data_type: 'enum' }),
      { ...e('feed_source.data', 'Datos'), category: 'enum', parent_key: 'feed_source', field: 'data' } as DictionaryEntry,
      e('ponds', 'Pozas', { data_type: 'array' }), e('ponds.area_m2', 'Área', { unit: 'm2' }),
      e('series', 'Serie diaria', { data_type: 'object' }), e('series.temperature_C', 'Temperatura', { unit: '°C' }),
    ];
    const bloques = describeSection({
      kind: 'precon_dynamic', feed_source: 'data', composition_mode: 'fixed', pond_params_mode: 'fixed',
      brine_composition_pct: { 'Li+': 0.15, H2O: 80 },
      ponds: [{ name: 'P1', area_m2: 1000.123456 }, { name: 'P2', area_m2: 2000 }],
      series: { series_start_date: '2024-01-01', temperature_C: [10, 20, null], evaporation_mm_d: [] },
    }, dic, palabras);
    const generales = bloques.find((b) => b.title === 'Generales');
    expect(generales?.kind === 'fields' && generales.rows).toContainEqual(['Alimentación', 'Datos']);
    const pozas = bloques.find((b) => b.title === 'Pozas');
    expect(pozas).toEqual({ kind: 'table', title: 'Pozas', columns: ['Área (m2)', 'name'],
      rows: [['1000.1235', 'P1'], ['2000', 'P2']] });
    const serie = bloques.find((b) => b.title === 'Serie diaria');
    expect(serie?.kind === 'fields' && serie.rows).toEqual([
      ['Inicio', '2024-01-01'], ['días', '3'], ['Temperatura (°C) · promedio', '15']]);
    expect(bloques.find((b) => b.title === 'brine_composition_pct')?.kind).toBe('fields');
  });

  it('lo que no aplica no sale (como al guardar)', () => {
    const b = describeSection({ kind: 'precon_dynamic', feed_source: 'execution', scenarios: [{ label: 'E1' }],
      pond_params_mode: 'fixed', pond_param_changes: [{ pond: 'P1' }] }, [], palabras);
    expect(b.map((x) => x.title)).not.toContain('scenarios');
    expect(b.map((x) => x.title)).not.toContain('pond_param_changes');
  });
});

describe('PDF', () => {
  it('nombre fijo del archivo', () => {
    expect(pdfFileName('Salar Norte / 2026', false)).toBe('reporte_estatico_Salar_Norte_2026.pdf');
    expect(pdfFileName('X', true, true)).toBe('reporte_dinamico_cadena_X.pdf');
  });
  it('captura los bloques de más afuera y salta lo que no se imprime', () => {
    document.body.innerHTML = `<div id="c"><div class="no-print"><div class="pdf-block" id="x"></div></div>
      <section class="pdf-block" id="a"><div class="pdf-block" id="anidado"></div></section>
      <div><div class="pdf-block" id="b"></div></div></div>`;
    expect(pdfBlocks(document.getElementById('c')!).map((b) => b.id)).toEqual(['a', 'b']);
    document.body.innerHTML = '<div id="v"></div>';
    expect(pdfBlocks(document.getElementById('v')!).map((b) => b.id)).toEqual(['v']);
  });
});
