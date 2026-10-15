import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildSchema, cleanPayload, initialStateRows, initialStatesForSave, isEmptyInitialState, issuePond,
  pasteInitialStates,
} from '../../src/f6/sectionModel';
import { InitialStatesEditor } from '../../src/f6/SectionEditorPage';
import type { DictionaryEntry, ValidationIssue } from '../../src/services/apiV2';

function campo(field: string, data_type: string, extra: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    key: `initial_states.${field}`, entity: 'initial_states', field, category: 'model', data_type,
    label: field, required: false, time_variable: false, section_kinds: ['precon_dynamic'], ...extra,
  };
}

// Las entradas del diccionario de `initial_states`, en el orden del schema.
const DICCIONARIO: DictionaryEntry[] = [
  { key: 'initial_states', entity: 'section', field: 'initial_states', category: 'model', data_type: 'list',
    label: 'Estado inicial', required: false, time_variable: false },
  campo('pond', 'string', { ui_order: 1, label: 'Poza' }),
  campo('brine_mass_t', 'number', { ui_order: 2, unit: 't', label: 'Masa' }),
  campo('height_m', 'number', { ui_order: 3, unit: 'm', label: 'Altura' }),
  campo('density_kg_m3', 'number', { ui_order: 4, unit: 'kg/m3', label: 'Densidad' }),
  campo('water_activity', 'number', { ui_order: 5, label: 'aw' }),
  campo('species_mass_t', 'map', { ui_order: 6, unit: 't', label: 'Masas' }),
  campo('salt_accumulated_t', 'number', { ui_order: 7, unit: 't' }),
  campo('entrainment_accumulated_t', 'number', { ui_order: 8, unit: 't' }),
  campo('outflow_started', 'boolean', { ui_order: 9 }),
  campo('at_operating_level', 'boolean', { ui_order: 10 }),
];
const schema = buildSchema(DICCIONARIO);
const COLUMNAS = schema.children('initial_states').filter((e) => e.data_type !== 'map' && e.field !== 'pond');
const ESPECIES = ['H2O', 'Li+'];
const POZAS = [{ name: 'Hx1' }, { name: 'Hx2' }, { name: 'Hx3' }];

describe('estado inicial de las pozas: modelo', () => {
  it('una fila por poza en su orden, con lo cargado; lo de pozas que ya no están queda al final', () => {
    const filas = initialStateRows(POZAS, [
      { pond: 'hx2', brine_mass_t: 10 }, { pond: 'Vieja', brine_mass_t: 5 }]);
    expect(filas.map((f) => f.pond)).toEqual(['Hx1', 'Hx2', 'Hx3', 'Vieja']);
    expect(filas[1].brine_mass_t).toBe(10);
    expect(filas.map(isEmptyInitialState)).toEqual([true, false, true, false]);
  });

  it('una fila vacía (o solo con casillas sin marcar) no se guarda: la poza arranca vacía', () => {
    expect(isEmptyInitialState({ pond: 'Hx1', outflow_started: false, species_mass_t: null })).toBe(true);
    expect(isEmptyInitialState({ pond: 'Hx1', outflow_started: true })).toBe(false);
    expect(isEmptyInitialState({ pond: 'Hx1', species_mass_t: { 'Li+': 1 } })).toBe(false);
    const payload = {
      kind: 'precon_dynamic', ponds: POZAS,
      initial_states: [{ pond: 'Hx1' }, { pond: 'Hx2', brine_mass_t: 3 }, { pond: 'Hx3', outflow_started: false }],
    };
    expect(cleanPayload(payload).initial_states).toEqual([{ pond: 'Hx2', brine_mass_t: 3 }]);
    // Sin estados cargados la lista va vacía (todas arrancan vacías).
    expect(cleanPayload({ kind: 'precon_dynamic', initial_states: [{ pond: 'Hx1' }] }).initial_states).toEqual([]);
  });

  it('pegar desde Excel: con la poza primero se ubica por nombre; sin ella, en orden', () => {
    const filas = initialStateRows(POZAS, []);
    // Columnas: masa, altura, densidad, aw, sal, impregnación, arrancó, en nivel, y las especies.
    const porNombre = pasteInitialStates(filas, [
      ['hx3', '1.000,5', '0,4', '1225', '0.75', '', '', 'x', '', '900', '0,01']], COLUMNAS, ESPECIES);
    expect(porNombre[2]).toEqual({
      pond: 'Hx3', brine_mass_t: 1000.5, height_m: 0.4, density_kg_m3: 1225, water_activity: 0.75,
      outflow_started: true, species_mass_t: { H2O: 900, 'Li+': 0.01 },
    });
    expect(isEmptyInitialState(porNombre[0])).toBe(true);

    const enOrden = pasteInitialStates(filas, [['10', '0.1', '1200', '0.8'], ['20', '0.2', '1210', '0.7']],
      COLUMNAS, ESPECIES);
    expect(enOrden.map((f) => f.brine_mass_t)).toEqual([10, 20, undefined]);
    // Más filas que pozas: las que sobran no se agregan.
    expect(pasteInitialStates(filas, [['1'], ['2'], ['3'], ['4']], COLUMNAS, ESPECIES)).toHaveLength(3);
  });

  it('el problema de validación se ubica por la poza (etiqueta o fila en lo guardado)', () => {
    const guardados = initialStatesForSave([{ pond: 'Hx1' }, { pond: 'Hx2', brine_mass_t: 1 }]);
    const issue = (row: number | null, row_label: string | null): ValidationIssue => (
      { section: 'precon_dynamic', field: 'initial_states.height_m', code: 'x', message: 'm', row, row_label });
    expect(issuePond(issue(null, 'HX2'), guardados)).toBe('hx2');
    expect(issuePond(issue(1, null), guardados)).toBe('hx2');
  });
});

function Editor({ inicial, issues = [] }: { inicial: Record<string, unknown>[]; issues?: ValidationIssue[] }) {
  const [estados, setEstados] = useState(inicial);
  return (
    <>
      <InitialStatesEditor schema={schema} species={ESPECIES} issues={issues}
                           payload={{ kind: 'precon_dynamic', ponds: POZAS, initial_states: estados }}
                           onChange={setEstados} />
      <pre data-testid="enviado">{JSON.stringify(initialStatesForSave(estados))}</pre>
    </>
  );
}

describe('estado inicial de las pozas: tabla', () => {
  it('muestra una fila por poza con las etiquetas del diccionario y una columna por especie', () => {
    render(<Editor inicial={[{ pond: 'Hx2', brine_mass_t: 10, height_m: 0.4, density_kg_m3: 1225,
      water_activity: 0.75, species_mass_t: { H2O: 9 } }]} />);
    expect(screen.getByTestId('initial-states-count').textContent).toContain('1/3');
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Masa (t)')).toBeTruthy();
    expect(screen.getByText('Li+ (t)')).toBeTruthy();
    expect(screen.getByTestId('initial-state-row-1').textContent).toContain('vacía');
    expect((screen.getByTestId('initial-state-2-sp-H2O') as HTMLInputElement).value).toBe('9');
  });

  it('cargar una celda llena la poza; vaciarla la deja arrancar vacía', () => {
    render(<Editor inicial={[]} />);
    const celda = screen.getByTestId('initial-state-3-brine_mass_t');
    fireEvent.change(celda, { target: { value: '1.234,5' } });
    fireEvent.blur(celda);
    expect(JSON.parse(screen.getByTestId('enviado').textContent!)).toEqual([{ pond: 'Hx3', brine_mass_t: 1234.5 }]);
    fireEvent.click(screen.getAllByLabelText('Vaciar la poza')[2]);
    expect(JSON.parse(screen.getByTestId('enviado').textContent!)).toEqual([]);
  });

  it('pegar desde Excel por nombre de poza', () => {
    const { container } = render(<Editor inicial={[]} />);
    fireEvent.click(screen.getByText('Pegar filas'));
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'Hx1\t100\t0,5\t1220\t0,74\t\t\t\t\t90\t0,2' } });
    fireEvent.click(screen.getByText('Aplicar'));
    expect(JSON.parse(screen.getByTestId('enviado').textContent!)).toEqual([{
      pond: 'Hx1', brine_mass_t: 100, height_m: 0.5, density_kg_m3: 1220, water_activity: 0.74,
      species_mass_t: { H2O: 90, 'Li+': 0.2 },
    }]);
  });

  it('marca la celda con el problema de la poza', () => {
    render(<Editor inicial={[{ pond: 'Hx2', brine_mass_t: 10 }]}
                   issues={[{ section: 'precon_dynamic', field: 'initial_states.height_m', code: 'missing',
                              message: 'Falta la altura', row: 1, row_label: null }]} />);
    expect(screen.getByTestId('initial-state-2-height_m').getAttribute('title')).toBe('Falta la altura');
    expect(screen.getByTestId('initial-state-1-height_m').getAttribute('title')).toBeNull();
  });
});
