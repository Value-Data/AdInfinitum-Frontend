import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildSchema, cleanPayload, initialStateForm, initialStateRows, initialStatesForSave, isEmptyInitialState, issuePond,
  pasteInitialStates, speciesSum, switchInitialStateForm,
} from '../../src/f6/sectionModel';
import { InitialStatesEditor } from '../../src/f6/SectionEditorPage';
import type { DictionaryEntry, ValidationIssue } from '../../src/services/apiV2';

function campo(field: string, data_type: string, extra: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    key: `initial_states.${field}`, entity: 'initial_states', field, category: 'model', data_type,
    label: field, required: false, time_variable: false, section_kinds: ['precon_dynamic'], ...extra,
  };
}

// Las entradas del diccionario de `initial_states` como las sirve el backend tras los
// cambios finales (punto 4): sin masa de salmuera, actividad de agua ni "en nivel de
// operación"; con la composición. Y la altura de arranque de las pozas, que dice qué es
// un buffer.
const DICCIONARIO: DictionaryEntry[] = [
  { key: 'initial_states', entity: 'section', field: 'initial_states', category: 'model', data_type: 'list',
    label: 'Estado inicial', required: false, time_variable: false },
  campo('pond', 'string', { ui_order: 1, label: 'Poza', required: true }),
  campo('species_mass_t', 'map', { ui_order: 2, unit: 't', label: 'Masas' }),
  campo('composition_pct', 'composition', { ui_order: 3, unit: '%p/p', label: 'Composición de la poza (%p/p)' }),
  campo('height_m', 'number', { ui_order: 4, unit: 'm', label: 'Altura' }),
  campo('density_kg_m3', 'number', { ui_order: 5, unit: 'kg/m3', label: 'Densidad' }),
  campo('salt_accumulated_t', 'number', { ui_order: 6, unit: 't', label: 'Sal acumulada' }),
  campo('entrainment_accumulated_t', 'number', { ui_order: 7, unit: 't', label: 'Impregnación acumulada' }),
  campo('outflow_started', 'boolean', { ui_order: 8, label: '¿La poza ya está entregando al inicio?' }),
  { key: 'ponds.startup_height_m', entity: 'ponds', field: 'startup_height_m', category: 'model',
    data_type: 'number', label: 'Altura de arranque', required: false, time_variable: false,
    visible_if: "pond_type != 'target_height'" },
];
const schema = buildSchema(DICCIONARIO);
const COLUMNAS = schema.children('initial_states')
  .filter((e) => !['map', 'composition'].includes(e.data_type) && e.field !== 'pond');
const ESPECIES = ['H2O', 'Li+'];
const POZAS = [
  { name: 'Hx1', pond_type: 'target_height' }, { name: 'Hx2', pond_type: 'fixed_flow' },
  { name: 'Hx3', pond_type: 'seasonal_flow' }];
const enviado = () => JSON.parse(screen.getByTestId('enviado').textContent!);

describe('estado inicial de las pozas: modelo', () => {
  it('una fila por poza en su orden, con lo cargado; lo de pozas que ya no están queda al final', () => {
    const filas = initialStateRows(POZAS, [
      { pond: 'hx2', species_mass_t: { H2O: 10 } }, { pond: 'Vieja', species_mass_t: { H2O: 5 } }]);
    expect(filas.map((f) => f.pond)).toEqual(['Hx1', 'Hx2', 'Hx3', 'Vieja']);
    expect(filas[1].species_mass_t).toEqual({ H2O: 10 });
    expect(filas.map(isEmptyInitialState)).toEqual([true, false, true, false]);
  });

  it('la forma va en los datos: composición si trae composition_pct (aunque vacío), si no toneladas', () => {
    expect(initialStateForm({ pond: 'Hx1' })).toBe('mass');
    expect(initialStateForm({ pond: 'Hx1', species_mass_t: { H2O: 1 } })).toBe('mass');
    expect(initialStateForm({ pond: 'Hx1', composition_pct: {} })).toBe('composition');
    // Cambiar de forma borra la otra: se manda una sola.
    const conToneladas = { pond: 'Hx2', species_mass_t: { H2O: 9 }, density_kg_m3: 1200 };
    expect(switchInitialStateForm(conToneladas, 'composition'))
      .toEqual({ pond: 'Hx2', composition_pct: {}, density_kg_m3: 1200 });
    expect(switchInitialStateForm({ pond: 'Hx2', composition_pct: { H2O: 70 }, height_m: 0.4 }, 'mass'))
      .toEqual({ pond: 'Hx2' });
  });

  it('al guardar: solo la forma de la fila, sin altura con toneladas, y outflow_started solo en buffers', () => {
    const guardado = initialStatesForSave([
      // Por altura: lo que diga outflow_started no aplica y no se manda.
      { pond: 'Hx1', species_mass_t: { H2O: 9 }, height_m: 0.4, outflow_started: true },
      // Un buffer: sí se manda.
      { pond: 'Hx2', composition_pct: { H2O: 80, 'Li+': 20 }, height_m: 0.5, species_mass_t: { H2O: 1 },
        outflow_started: true },
      // Solo con un aviso que no aplica: queda vacía y la poza arranca vacía.
      { pond: 'Hx3', composition_pct: {} },
    ], POZAS);
    expect(guardado).toEqual([
      { pond: 'Hx1', species_mass_t: { H2O: 9 } },
      { pond: 'Hx2', composition_pct: { H2O: 80, 'Li+': 20 }, height_m: 0.5, outflow_started: true },
    ]);
    // Un buffer cuyo tipo todavía no se eligió tampoco lo manda.
    expect(initialStatesForSave([{ pond: 'P', species_mass_t: { H2O: 1 }, outflow_started: true }],
      [{ name: 'P' }])).toEqual([{ pond: 'P', species_mass_t: { H2O: 1 } }]);
  });

  it('cleanPayload manda solo las pozas con estado cargado', () => {
    const payload = {
      kind: 'precon_dynamic', ponds: POZAS,
      initial_states: [{ pond: 'Hx1' }, { pond: 'Hx2', species_mass_t: { H2O: 3 } },
        { pond: 'Hx3', outflow_started: false }],
    };
    expect(cleanPayload(payload, schema).initial_states).toEqual([{ pond: 'Hx2', species_mass_t: { H2O: 3 } }]);
    // Sin estados cargados la lista va vacía (todas arrancan vacías).
    expect(cleanPayload({ kind: 'precon_dynamic', initial_states: [{ pond: 'Hx1' }] }).initial_states).toEqual([]);
  });

  it('pegar desde Excel: por nombre o en orden; los valores por especie van a la forma de la fila', () => {
    const filas = initialStateRows(POZAS, [{ pond: 'Hx3', composition_pct: {} }]);
    // Columnas: altura, densidad, sal, impregnación, arrancó, y las especies.
    const porNombre = pasteInitialStates(filas, [
      ['hx3', '0,4', '1225', '', '', 'x', '80', '20'],
      ['HX2', '0,9', '1210', '', '', '', '1.000,5', '0,01']], COLUMNAS, ESPECIES);
    expect(porNombre[2]).toEqual({
      pond: 'Hx3', composition_pct: { H2O: 80, 'Li+': 20 }, height_m: 0.4, density_kg_m3: 1225,
      outflow_started: true,
    });
    // En toneladas la altura no se toma: la calcula la app.
    expect(porNombre[1]).toEqual({ pond: 'Hx2', density_kg_m3: 1210, species_mass_t: { H2O: 1000.5, 'Li+': 0.01 } });
    expect(isEmptyInitialState(porNombre[0])).toBe(true);
    // Más filas que pozas: las que sobran no se agregan.
    expect(pasteInitialStates(filas, [['1'], ['2'], ['3'], ['4']], COLUMNAS, ESPECIES)).toHaveLength(3);
  });

  it('la suma por especie, en la forma de la fila', () => {
    expect(speciesSum({ pond: 'a', composition_pct: { H2O: 70, 'Li+': 29.5 } })).toBe(99.5);
    expect(speciesSum({ pond: 'a', species_mass_t: { H2O: 10, 'Li+': 2 } })).toBe(12);
    expect(speciesSum({ pond: 'a', composition_pct: {} })).toBeNull();
  });

  it('el problema de validación se ubica por la poza (etiqueta o fila en lo guardado)', () => {
    const guardados = initialStatesForSave([{ pond: 'Hx1' }, { pond: 'Hx2', species_mass_t: { H2O: 1 } }]);
    const issue = (row: number | null, row_label: string | null): ValidationIssue => (
      { section: 'precon_dynamic', field: 'initial_states.height_m', code: 'x', message: 'm', row, row_label });
    expect(issuePond(issue(null, 'HX2'), guardados)).toBe('hx2');
    expect(issuePond(issue(1, null), guardados)).toBe('hx2');
  });
});

function Editor({ inicial, issues = [] }: { inicial: Record<string, unknown>[]; issues?: ValidationIssue[] }) {
  const [estados, setEstados] = useState(inicial);
  const payload = { kind: 'precon_dynamic', ponds: POZAS, initial_states: estados };
  return (
    <>
      <InitialStatesEditor schema={schema} species={ESPECIES} issues={issues} payload={payload}
                           onChange={setEstados} />
      <pre data-testid="enviado">{JSON.stringify(cleanPayload(payload, schema).initial_states)}</pre>
    </>
  );
}

const escribir = (testId: string, valor: string) => {
  const celda = screen.getByTestId(testId);
  fireEvent.change(celda, { target: { value: valor } });
  fireEvent.blur(celda);
};

describe('estado inicial de las pozas: tabla', () => {
  it('una fila por poza con las etiquetas del diccionario, sin masa, actividad de agua ni nivel de operación', () => {
    render(<Editor inicial={[{ pond: 'Hx2', species_mass_t: { H2O: 9 }, density_kg_m3: 1225 }]} />);
    expect(screen.getByTestId('initial-states-count').textContent).toContain('1/3');
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Li+ (t)')).toBeTruthy();
    expect(screen.getByText('¿La poza ya está entregando al inicio?')).toBeTruthy();
    expect(screen.queryByText(/Masa de salmuera|Actividad de agua|nivel de operación/i)).toBeNull();
    expect(screen.queryByTestId('initial-state-2-brine_mass_t')).toBeNull();
    expect(screen.queryByTestId('initial-state-2-water_activity')).toBeNull();
    expect(screen.queryByTestId('initial-state-2-at_operating_level')).toBeNull();
    expect(screen.getByTestId('initial-state-row-1').textContent).toContain('vacía');
    expect((screen.getByTestId('initial-state-2-sp-H2O') as HTMLInputElement).value).toBe('9');
    // La densidad es opcional y lo dice.
    expect(screen.getByText('opcional')).toBeTruthy();
  });

  it('toneladas: la altura no se escribe (la calcula la app); composición: altura y %p/p con su suma', () => {
    render(<Editor inicial={[]} />);
    const altura = screen.getByTestId('initial-state-3-height_m');
    expect(altura.tagName).toBe('TD');
    expect(altura.textContent).toBe('la calcula la app');
    expect(altura.className).toContain('cell-na');

    // La altura es obligatoria en composición: la cabecera lo marca y la celda lo dice.
    expect(screen.getByTestId('initial-states-height-required').textContent).toContain('*');
    expect(screen.getByTestId('initial-states-height-required').textContent).toContain('obligatoria en composición');
    fireEvent.change(screen.getByTestId('initial-state-3-form'), { target: { value: 'composition' } });
    expect(screen.getByTestId('initial-state-row-3').getAttribute('data-form')).toBe('composition');
    expect(screen.getByTestId('initial-state-3-height_m').getAttribute('aria-required')).toBe('true');
    escribir('initial-state-3-height_m', '0,45');
    escribir('initial-state-3-sp-H2O', '80');
    escribir('initial-state-3-sp-Li+', '19,5');
    const suma = screen.getByTestId('initial-state-3-sum');
    expect(suma.textContent).toContain('99.5 %p/p');
    expect(suma.textContent).toContain('debe sumar 100');
    escribir('initial-state-3-sp-Li+', '20');
    expect(screen.getByTestId('initial-state-3-sum').textContent).not.toContain('debe sumar 100');
    expect(enviado()).toEqual([{ pond: 'Hx3', composition_pct: { H2O: 80, 'Li+': 20 }, height_m: 0.45 }]);
  });

  it('cambiar de forma manda solo la nueva', () => {
    render(<Editor inicial={[{ pond: 'Hx2', species_mass_t: { H2O: 900, 'Li+': 1 }, density_kg_m3: 1220 }]} />);
    expect(enviado()).toEqual([{ pond: 'Hx2', species_mass_t: { H2O: 900, 'Li+': 1 }, density_kg_m3: 1220 }]);
    fireEvent.change(screen.getByTestId('initial-state-2-form'), { target: { value: 'composition' } });
    escribir('initial-state-2-sp-H2O', '100');
    escribir('initial-state-2-height_m', '0,3');
    expect(enviado()).toEqual([{ pond: 'Hx2', composition_pct: { H2O: 100 }, density_kg_m3: 1220, height_m: 0.3 }]);
    // Y de vuelta a toneladas: sin composición ni altura.
    fireEvent.change(screen.getByTestId('initial-state-2-form'), { target: { value: 'mass' } });
    escribir('initial-state-2-sp-Li+', '2');
    expect(enviado()).toEqual([{ pond: 'Hx2', density_kg_m3: 1220, species_mass_t: { 'Li+': 2 } }]);
  });

  it('outflow_started: deshabilitado y gris en una poza por altura objetivo; editable en un buffer', () => {
    render(<Editor inicial={[{ pond: 'Hx1', species_mass_t: { H2O: 1 } }, { pond: 'Hx2', species_mass_t: { H2O: 1 } }]} />);
    const porAltura = screen.getByTestId('initial-state-1-outflow_started') as HTMLInputElement;
    expect(porAltura.disabled).toBe(true);
    expect(porAltura.getAttribute('title')).toMatch(/altura objetivo/);
    expect(document.getElementById(porAltura.getAttribute('aria-describedby') ?? '')?.textContent)
      .toBe(porAltura.getAttribute('title'));
    expect(screen.getByTestId('initial-state-1-outflow_started-td').className).toContain('cell-na');
    const buffer = screen.getByTestId('initial-state-2-outflow_started') as HTMLInputElement;
    expect(buffer.disabled).toBe(false);
    fireEvent.click(buffer);
    expect(enviado()).toEqual([{ pond: 'Hx1', species_mass_t: { H2O: 1 } },
      { pond: 'Hx2', species_mass_t: { H2O: 1 }, outflow_started: true }]);
  });

  it('cargar una celda llena la poza; vaciarla la deja arrancar vacía', () => {
    render(<Editor inicial={[]} />);
    escribir('initial-state-3-sp-H2O', '1.234,5');
    expect(enviado()).toEqual([{ pond: 'Hx3', species_mass_t: { H2O: 1234.5 } }]);
    fireEvent.click(screen.getAllByLabelText('Vaciar la poza')[2]);
    expect(enviado()).toEqual([]);
  });

  it('pegar desde Excel por nombre de poza', () => {
    const { container } = render(<Editor inicial={[]} />);
    fireEvent.click(screen.getByText('Pegar filas'));
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'Hx2\t\t1220\t\t\t\t90\t0,2' } });
    fireEvent.click(screen.getByText('Aplicar'));
    expect(enviado()).toEqual([{ pond: 'Hx2', density_kg_m3: 1220, species_mass_t: { H2O: 90, 'Li+': 0.2 } }]);
  });

  it('los errores del backend se ven en la fila de la poza: las dos formas, altura con toneladas, falta la altura', () => {
    const issue = (field: string, code: string, message: string, row: number, row_label: string): ValidationIssue => (
      { section: 'precon_dynamic', field, code, message, row, row_label });
    render(<Editor inicial={[{ pond: 'Hx1', species_mass_t: { H2O: 1 } },
      { pond: 'Hx2', composition_pct: { H2O: 100 } }, { pond: 'Hx3', species_mass_t: { H2O: 2 } }]}
                   issues={[
                     issue('initial_states', 'initial_state_both_forms', 'Hx1: trae las dos formas', 1, 'Hx1'),
                     issue('initial_states.height_m', 'required', 'Altura [Hx2]: falta el dato.', 2, 'Hx2'),
                     issue('initial_states.height_m', 'height_with_tonnes', 'Altura [Hx3]: no corresponde', 3, 'Hx3'),
                   ]} />);
    // La de toda la fila marca la forma y la poza.
    expect(screen.getByTestId('initial-state-1-form').getAttribute('title')).toBe('Hx1: trae las dos formas');
    expect(screen.getByTestId('initial-state-1-form').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('initial-state-row-1').querySelector('td')!.getAttribute('title'))
      .toBe('Hx1: trae las dos formas');
    expect(screen.getByTestId('initial-state-2-form').getAttribute('title')).toBeNull();
    // Falta la altura en composición: en su celda.
    expect(screen.getByTestId('initial-state-2-height_m').getAttribute('title')).toBe('Altura [Hx2]: falta el dato.');
    // Altura con toneladas (p. ej. de un Excel): en la celda calculada.
    expect(screen.getByTestId('initial-state-3-height_m').getAttribute('title')).toBe('Altura [Hx3]: no corresponde');
    // Y todos en la lista de la tabla.
    expect(screen.getByText('Hx1: trae las dos formas', { selector: 'li' })).toBeTruthy();
  });
});
