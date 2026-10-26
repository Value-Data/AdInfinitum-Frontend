/**
 * Avisos y errores por separado en las tablas del editor (cambios finales, punto 21): el
 * aviso `default_applied` de una fila (p. ej. el aprovechamiento de una poza de caudal fijo
 * que quedó vacío) se pinta en ámbar en su celda; un error, en rojo. Y la marca de default.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildSchema } from '../../src/f6/sectionModel';
import { KeyValueEditor, TableEditor } from '../../src/f6/SectionEditorPage';
import type { DictionaryEntry } from '../../src/services/apiV2';
import type { EditorIssue } from '../../src/f6/sectionModel';

const entrada = (field: string, data_type: string, extra: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
  key: `ponds.${field}`, entity: 'ponds', field, category: 'model', data_type, label: field, required: false,
  time_variable: false, read_only: false, ...extra,
});
const schema = buildSchema([
  { key: 'ponds', entity: 'section', field: 'ponds', category: 'model', data_type: 'list', label: 'Pozas',
    required: true, time_variable: false, read_only: false },
  entrada('name', 'string', { ui_order: 1, label: 'Nombre', required: true }),
  entrada('outflow_utilization_frac', 'number', { ui_order: 2, label: 'Aprovechamiento', default_value: '1.0' }),
  entrada('pond_factor', 'number', { ui_order: 3, label: 'Factor', required: true }),
]);
const issue = (field: string, row: number | null, severity: 'error' | 'warning', message: string): EditorIssue =>
  ({ section: 'precon_dynamic', field, code: severity === 'error' ? 'range' : 'default_applied', row,
     row_label: null, message, severity });
const celda = (fila: number, f: string) => screen.getByTestId(`cell-ponds-${fila}-${f}`) as HTMLInputElement;

describe('celdas de una tabla', () => {
  it('el aviso de una fila va en ámbar y con su palabra; el error, en rojo', () => {
    render(<TableEditor schema={schema} prefix="ponds" title="Pozas" species={[]} onChange={() => undefined}
                        rows={[{ name: 'P1', outflow_utilization_frac: 1, pond_factor: -1 }, { name: 'P2', pond_factor: 0.7 }]}
                        issues={[
                          issue('ponds.outflow_utilization_frac', 2, 'warning', 'Aprovechamiento [P2]: vacío; se usó 1.'),
                          issue('ponds.pond_factor', 1, 'error', 'Factor [P1]: fuera de rango.'),
                        ]} />);
    const aviso = celda(2, 'outflow_utilization_frac');
    expect(aviso.getAttribute('data-severity')).toBe('warning');
    expect(aviso.getAttribute('aria-invalid')).toBeNull();
    expect(aviso.getAttribute('title')).toBe('Aviso: Aprovechamiento [P2]: vacío; se usó 1.');
    const error = celda(1, 'pond_factor');
    expect(error.getAttribute('data-severity')).toBe('error');
    expect(error.getAttribute('aria-invalid')).toBe('true');
    expect(celda(1, 'outflow_utilization_frac').getAttribute('data-severity')).toBeNull();
  });

  it('el valor por defecto se marca; vacío dice cuál se usará', () => {
    render(<TableEditor schema={schema} prefix="ponds" title="Pozas" species={[]} onChange={() => undefined} issues={[]}
                        rows={[{ name: 'P1', outflow_utilization_frac: 1 }, { name: 'P2' }, { name: 'P3', outflow_utilization_frac: 0.8 }]} />);
    expect(celda(1, 'outflow_utilization_frac').getAttribute('data-default')).toBe('true');
    expect(celda(1, 'outflow_utilization_frac').className).toContain('italic');
    expect(celda(2, 'outflow_utilization_frac').getAttribute('data-default')).toBe('empty');
    expect(celda(2, 'outflow_utilization_frac').placeholder).toBe('1');
    expect(celda(3, 'outflow_utilization_frac').getAttribute('data-default')).toBeNull();
    // Un campo sin default documentado no se marca.
    expect(celda(2, 'pond_factor').getAttribute('data-default')).toBeNull();
  });
});

describe('bloque plegable especie | valor', () => {
  it('un aviso se cuenta como aviso y no abre el bloque a la fuerza', () => {
    render(<KeyValueEditor title="Lavado" testId="kv" field="plant.cake_wash_medium_pct" keys={['H2O']} unit="%p/p"
                           value={{ H2O: 100 }} defaultOpen={false} onChange={() => undefined}
                           issues={[issue('plant.cake_wash_medium_pct', null, 'warning', 'Medio de lavado: vacío; agua 100 %.')]} />);
    expect(screen.getByTestId('kv-summary').textContent).toContain('1 aviso');
    expect(screen.getByTestId('kv-summary').textContent).not.toContain('error');
    expect((screen.getByTestId('kv') as HTMLDetailsElement).open).toBe(false);
  });
});
