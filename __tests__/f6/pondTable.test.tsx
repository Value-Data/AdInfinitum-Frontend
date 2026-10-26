import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildSchema, cleanPayload } from '../../src/f6/sectionModel';
import { TableEditor } from '../../src/f6/SectionEditorPage';
import type { DictionaryEntry, ValidationIssue } from '../../src/services/apiV2';

function campo(field: string, data_type: string, extra: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    key: `ponds.${field}`, entity: 'ponds', field, category: 'model', data_type, label: field,
    required: false, time_variable: false, section_kinds: ['precon_dynamic'], ...extra,
  };
}

// La tabla de pozas del dinámico como la sirve el diccionario tras los cambios finales
// (punto 5): los cuatro del balance obligatorios y sin default, y lo del tipo de poza y
// el marco de alturas con su `visible_if`.
const DICCIONARIO: DictionaryEntry[] = [
  { key: 'ponds', entity: 'section', field: 'ponds', category: 'model', data_type: 'list', label: 'Pozas',
    required: true, time_variable: false },
  campo('name', 'string', { ui_order: 1, label: 'Nombre', required: true }),
  campo('area_m2', 'number', { ui_order: 3, unit: 'm2', label: 'Área', required: true }),
  campo('pond_factor', 'number', { ui_order: 4, label: 'Factor de poza', required: true }),
  campo('entrainment_pct', 'number', { ui_order: 5, unit: '%', label: 'Impregnación', required: true }),
  campo('leakage_mm_d', 'number', { ui_order: 6, unit: 'mm/d', label: 'Fugas', required: true }),
  campo('dilution_frac', 'number', { ui_order: 7, unit: 'frac', label: 'Dilución', required: true }),
  campo('pond_type', 'enum', { ui_order: 8, label: 'Tipo de poza', required: true }),
  { ...campo('pond_type.target_height', 'string', { label: 'Por altura objetivo' }), field: 'target_height',
    category: 'enum', parent_key: 'ponds.pond_type' },
  { ...campo('pond_type.fixed_flow', 'string', { label: 'Buffer caudal fijo' }), field: 'fixed_flow',
    category: 'enum', parent_key: 'ponds.pond_type' },
  campo('target_height_m', 'number', { ui_order: 9, unit: 'm', label: 'Altura objetivo',
    visible_if: "pond_type == 'target_height'" }),
  campo('height_floor_m', 'number', { ui_order: 10, unit: 'm', label: 'Altura piso' }),
  campo('startup_height_m', 'number', { ui_order: 11, unit: 'm', label: 'Altura de arranque',
    visible_if: "pond_type != 'target_height'" }),
  campo('target_outflow_t_d', 'number', { ui_order: 12, unit: 't/d', label: 'Caudal fijo',
    visible_if: "pond_type == 'fixed_flow'" }),
  campo('use_salt_volume', 'boolean', { ui_order: 15, label: 'Usar volumen de sal' }),
  campo('berm_height_m', 'number', { ui_order: 16, unit: 'm', label: 'Altura de berma', visible_if: 'use_salt_volume' }),
];
const schema = buildSchema(DICCIONARIO);

const ALTURA = { name: 'P1', area_m2: 1000, pond_factor: 0.7, entrainment_pct: 10, leakage_mm_d: 0.03,
  dilution_frac: 0, pond_type: 'target_height', target_height_m: 0.4, startup_height_m: 0.3, target_outflow_t_d: 50 };
const CAUDAL = { name: 'P2', area_m2: 2000, pond_factor: 0.7, entrainment_pct: 10, leakage_mm_d: 0.03,
  dilution_frac: 0.005, pond_type: 'fixed_flow', target_height_m: 0.2, height_floor_m: 0.3, startup_height_m: 0.5,
  target_outflow_t_d: 50, use_salt_volume: false, berm_height_m: 1.2 };

function Tabla({ inicial, issues = [] }: { inicial: Record<string, unknown>[]; issues?: ValidationIssue[] }) {
  const [filas, setFilas] = useState(inicial);
  return (
    <>
      <TableEditor schema={schema} prefix="ponds" title="Pozas" rows={filas} species={[]} issues={issues}
                   onChange={setFilas} />
      <pre data-testid="enviado">{JSON.stringify(cleanPayload({ kind: 'precon_dynamic', ponds: filas }, schema).ponds)}</pre>
    </>
  );
}
const enviado = () => JSON.parse(screen.getByTestId('enviado').textContent!);
const celda = (fila: number, field: string) => screen.getByTestId(`cell-ponds-${fila}-${field}`) as HTMLInputElement;
const td = (fila: number, field: string) => screen.getByTestId(`cell-ponds-${fila}-${field}-td`);

describe('tabla de pozas: lo que no aplica al tipo va gris, no oculto', () => {
  it('una columna que no aplica a ninguna fila se sigue viendo, con sus celdas grises', () => {
    // Las dos pozas son por altura: antes la columna del caudal fijo desaparecía.
    render(<Tabla inicial={[ALTURA, { ...ALTURA, name: 'P1b' }]} />);
    expect(screen.getByText('Caudal fijo (t/d)')).toBeTruthy();
    expect(screen.getByText('Altura de berma (m)')).toBeTruthy();
    for (const fila of [1, 2]) {
      expect(celda(fila, 'target_outflow_t_d').disabled).toBe(true);
      expect(td(fila, 'target_outflow_t_d').className).toContain('cell-na');
      expect(celda(fila, 'target_outflow_t_d').getAttribute('title')).toBe('No aplica a este tipo de poza');
      // El valor cargado no se muestra (no se manda).
      expect(celda(fila, 'target_outflow_t_d').value).toBe('');
      expect(celda(fila, 'startup_height_m').disabled).toBe(true);
      expect(celda(fila, 'target_height_m').disabled).toBe(false);
    }
  });

  it('cada fila según su tipo, y lo que no aplica no se manda', () => {
    render(<Tabla inicial={[ALTURA, CAUDAL]} />);
    expect(celda(1, 'target_height_m').disabled).toBe(false);
    expect(celda(2, 'target_height_m').disabled).toBe(true);
    expect(celda(2, 'startup_height_m').disabled).toBe(false);
    expect(celda(2, 'target_outflow_t_d').disabled).toBe(false);
    // El marco de alturas, con la misma regla: sin «usar volumen de sal», gris.
    expect(celda(2, 'berm_height_m').disabled).toBe(true);
    expect(celda(2, 'berm_height_m').getAttribute('title')).toBe('Solo aplica con «Usar volumen de sal» marcado');
    const [p1, p2] = enviado();
    expect(p1).not.toHaveProperty('startup_height_m');
    expect(p1).not.toHaveProperty('target_outflow_t_d');
    expect(p1.target_height_m).toBe(0.4);
    expect(p2).not.toHaveProperty('target_height_m');
    expect(p2).not.toHaveProperty('berm_height_m');
    expect(p2).toMatchObject({ height_floor_m: 0.3, startup_height_m: 0.5, target_outflow_t_d: 50, dilution_frac: 0.005 });
  });

  it('cambiar el tipo cambia lo que aplica; el valor guardado vuelve si se vuelve al tipo', () => {
    render(<Tabla inicial={[CAUDAL]} />);
    fireEvent.change(celda(1, 'pond_type'), { target: { value: 'target_height' } });
    expect(celda(1, 'target_outflow_t_d').disabled).toBe(true);
    expect(celda(1, 'target_height_m').disabled).toBe(false);
    expect(enviado()[0]).not.toHaveProperty('target_outflow_t_d');
    expect(enviado()[0].target_height_m).toBe(0.2);
    fireEvent.change(celda(1, 'pond_type'), { target: { value: 'fixed_flow' } });
    expect(celda(1, 'target_outflow_t_d').value).toBe('50');
    // Marcar el volumen de sal habilita el marco de alturas.
    fireEvent.click(celda(1, 'use_salt_volume'));
    expect(celda(1, 'berm_height_m').disabled).toBe(false);
    expect(enviado()[0].berm_height_m).toBe(1.2);
  });

  it('una fila nueva arranca vacía (sin valores por defecto) y lo del tipo espera a que se elija', () => {
    render(<Tabla inicial={[]} />);
    fireEvent.click(screen.getByText('Agregar'));
    for (const f of ['pond_factor', 'entrainment_pct', 'leakage_mm_d', 'dilution_frac', 'area_m2']) {
      expect(celda(1, f).value).toBe('');
      expect(celda(1, f).disabled).toBe(false);
    }
    // Sin tipo, ningún campo del tipo se puede llenar todavía.
    for (const f of ['target_height_m', 'startup_height_m', 'target_outflow_t_d']) {
      expect(celda(1, f).disabled).toBe(true);
      expect(celda(1, f).getAttribute('title')).toBe('Elija primero «Tipo de poza»');
    }
    expect(celda(1, 'height_floor_m').disabled).toBe(false);
    expect(enviado()).toEqual([{}]);
    // Los obligatorios se marcan en la cabecera.
    expect(screen.getByText('Factor de poza').textContent).toContain('*');
    expect(screen.getByText('Altura piso (m)').textContent).not.toContain('*');
  });

  it('el error «falta el dato» del backend se ve en su celda (campo y fila)', () => {
    render(<Tabla inicial={[ALTURA, { name: 'P2', area_m2: 5, pond_type: 'fixed_flow' }]}
                  issues={[{ section: 'precon_dynamic', field: 'ponds.pond_factor', code: 'required', row: 2,
                             row_label: 'P2', message: 'Factor de poza [P2]: falta el dato.' }]} />);
    expect(celda(2, 'pond_factor').getAttribute('title')).toBe('Factor de poza [P2]: falta el dato.');
    expect(celda(2, 'pond_factor').getAttribute('aria-invalid')).toBe('true');
    expect(celda(1, 'pond_factor').getAttribute('title')).not.toBe('Factor de poza [P2]: falta el dato.');
    expect(celda(2, 'leakage_mm_d').getAttribute('aria-invalid')).toBeNull();
  });
});
