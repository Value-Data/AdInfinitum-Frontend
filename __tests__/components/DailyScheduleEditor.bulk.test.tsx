import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DailyScheduleEditor from '../../src/components/DailyScheduleEditor';
import type { DailyScheduleItem } from '../../src/types';

/**
 * Borrado masivo del cronograma. La selección se guarda por índice, así que lo que hay
 * que fijar es que borre exactamente las filas marcadas —ni una corrida— y que la
 * selección no sobreviva a un cambio estructural: un índice guardado apunta a otra fila
 * después de un borrado.
 */

function hacerDias(n: number): DailyScheduleItem[] {
  return Array.from({ length: n }, (_, i) => ({
    date_label: `Dia ${i + 1}`,
    temperature_C: 20 + i,
    evap_rate: 5,
  }));
}

/** Envoltorio con estado: el editor es controlado, sin esto onChange no se refleja. */
function Editor({ inicial, onChange }: { inicial: DailyScheduleItem[]; onChange?: (v: DailyScheduleItem[]) => void }) {
  const [dias, setDias] = useState(inicial);
  return (
    <DailyScheduleEditor
      value={dias}
      onChange={(v) => {
        setDias(v);
        onChange?.(v);
      }}
    />
  );
}

const filaCheckboxes = () =>
  screen.getAllByRole('checkbox').filter((c) => c.getAttribute('aria-label')?.startsWith('Dia '));

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('DailyScheduleEditor — borrado masivo', () => {
  it('elimina solo las filas marcadas', () => {
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(5)} onChange={visto} />);

    const casillas = filaCheckboxes();
    fireEvent.click(casillas[1]); // Dia 2
    fireEvent.click(casillas[3]); // Dia 4
    fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionados \(2\)/ }));

    const resultado = visto.mock.calls.at(-1)![0] as DailyScheduleItem[];
    expect(resultado.map((d) => d.date_label)).toEqual(['Dia 1', 'Dia 3', 'Dia 5']);
  });

  it('el rango selecciona de una y borra el tramo completo', () => {
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(30)} onChange={visto} />);

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar rango' }));

    // 25 - 5 + 1 = 21 filas
    fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionados \(21\)/ }));

    const resultado = visto.mock.calls.at(-1)![0] as DailyScheduleItem[];
    expect(resultado).toHaveLength(9);
    expect(resultado.map((d) => d.date_label)).toEqual([
      'Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 26', 'Dia 27', 'Dia 28', 'Dia 29', 'Dia 30',
    ]);
  });

  it('el rango invertido (desde > hasta) se interpreta igual', () => {
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(10)} onChange={visto} />);

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar rango' }));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionados \(6\)/ }));

    const resultado = visto.mock.calls.at(-1)![0] as DailyScheduleItem[];
    expect(resultado.map((d) => d.date_label)).toEqual(['Dia 1', 'Dia 2', 'Dia 9', 'Dia 10']);
  });

  it('el rango se acumula: dos tramos separados en un solo borrado', () => {
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(10)} onChange={visto} />);

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar rango' }));

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar rango' }));

    fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionados \(4\)/ }));
    const resultado = visto.mock.calls.at(-1)![0] as DailyScheduleItem[];
    expect(resultado.map((d) => d.date_label)).toEqual([
      'Dia 3', 'Dia 4', 'Dia 5', 'Dia 6', 'Dia 7', 'Dia 8',
    ]);
  });

  it('un rango que se pasa del largo se recorta', () => {
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(5)} onChange={visto} />);

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar rango' }));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionados \(3\)/ }));

    const resultado = visto.mock.calls.at(-1)![0] as DailyScheduleItem[];
    expect(resultado.map((d) => d.date_label)).toEqual(['Dia 1', 'Dia 2']);
  });

  it('pide confirmacion y no borra nada si se cancela', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(5)} onChange={visto} />);

    fireEvent.click(filaCheckboxes()[0]);
    fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionados \(1\)/ }));

    expect(window.confirm).toHaveBeenCalled();
    expect(visto).not.toHaveBeenCalled();
  });

  it('el boton esta deshabilitado sin seleccion', () => {
    render(<Editor inicial={hacerDias(3)} />);
    expect(screen.getByRole('button', { name: /Eliminar seleccionados \(0\)/ })).toBeDisabled();
  });

  it('seleccionar todo marca las filas y vuelve a limpiarlas', () => {
    const visto = vi.fn();
    render(<Editor inicial={hacerDias(4)} onChange={visto} />);

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todo' }));
    expect(screen.getByRole('button', { name: /Eliminar seleccionados \(4\)/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar seleccion' }));
    expect(screen.getByRole('button', { name: /Eliminar seleccionados \(0\)/ })).toBeDisabled();
  });

  it('agregar un dia limpia la seleccion (los indices ya no valen)', () => {
    render(<Editor inicial={hacerDias(3)} />);

    fireEvent.click(filaCheckboxes()[0]);
    expect(screen.getByRole('button', { name: /Eliminar seleccionados \(1\)/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Agregar Dia/ }));
    expect(screen.getByRole('button', { name: /Eliminar seleccionados \(0\)/ })).toBeDisabled();
  });

  it('borrar una fila suelta tambien limpia la seleccion', () => {
    render(<Editor inicial={hacerDias(3)} />);

    fireEvent.click(filaCheckboxes()[2]);
    const filas = screen.getAllByRole('row');
    // Fila 1 del cuerpo (la 0 es el encabezado): su boton Eliminar.
    fireEvent.click(within(filas[1]).getByRole('button', { name: /Eliminar/ }));

    expect(screen.getByRole('button', { name: /Eliminar seleccionados \(0\)/ })).toBeDisabled();
  });
});
