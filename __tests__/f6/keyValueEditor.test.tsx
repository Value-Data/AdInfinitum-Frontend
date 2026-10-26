import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { KeyValueEditor, splitBlocks } from '../../src/f6/SectionEditorPage';
import type { ValidationIssue } from '../../src/services/apiV2';

type Valor = Record<string, unknown> | null;

function Editor({ inicial, keys, issues = [], ...props }: {
  inicial: Valor; keys: string[]; issues?: ValidationIssue[];
} & Partial<React.ComponentProps<typeof KeyValueEditor>>) {
  const [valor, setValor] = useState<Valor>(inicial);
  return (
    <>
      <KeyValueEditor title="Bloque" testId="kv" field="f" keys={keys} value={valor} issues={issues}
                      onChange={setValor} {...props} />
      <pre data-testid="valor">{JSON.stringify(valor)}</pre>
    </>
  );
}

const valor = () => JSON.parse(screen.getByTestId('valor').textContent!);
const fases = (n: number) => Array.from({ length: n }, (_, i) => `F${String(i + 1).padStart(3, '0')}`);

describe('bloques de la tabla especie | valor', () => {
  it('hasta 12 claves una tabla, hasta 40 dos, más tres; se leen hacia abajo', () => {
    expect(splitBlocks([])).toEqual([]);
    expect(splitBlocks(fases(12))).toHaveLength(1);
    expect(splitBlocks(fases(13)).map((b) => b.length)).toEqual([7, 6]);
    expect(splitBlocks(fases(40))).toHaveLength(2);
    expect(splitBlocks(fases(242)).map((b) => b.length)).toEqual([81, 81, 80]);
    expect(splitBlocks(fases(13))[0][0]).toBe('F001');
    expect(splitBlocks(fases(13))[1][0]).toBe('F008');
  });
});

describe('composición: una columna para la especie y otra para el valor', () => {
  it('una fila por especie con su valor, cabeceras Especie | Valor (unidad)', () => {
    render(<Editor keys={['H2O', 'Li+', 'Na+']} unit="%p/p" inicial={{ H2O: 90, 'Li+': 5 }} />);
    expect(screen.getByRole('columnheader', { name: 'Especie' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Valor (%p/p)' })).toBeTruthy();
    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['H2O', 'Li+', 'Na+']);
    expect((screen.getByLabelText('Li+ (%p/p)') as HTMLInputElement).value).toBe('5');
    // Los test ids de antes siguen.
    expect((screen.getByTestId('kv-H2O') as HTMLInputElement).value).toBe('90');
    expect(screen.getByTestId('kv-block')).toBeTruthy();
  });

  it('el total va en el resumen (visible cerrado) y Normalizar lleva a 100', () => {
    render(<Editor keys={['H2O', 'Li+']} unit="%p/p" inicial={{ H2O: 90, 'Li+': 5 }} />);
    expect(screen.getByTestId('kv-summary').textContent).toContain('Total 95.00 %');
    fireEvent.click(screen.getByTestId('kv-normalize'));
    expect(valor().H2O + valor()['Li+']).toBeCloseTo(100);
    expect(screen.getByTestId('kv-summary').textContent).toContain('Total 100.00 %');
  });

  it('editar una celda cambia solo esa especie', () => {
    render(<Editor keys={['H2O', 'Li+']} unit="%p/p" inicial={{ H2O: 90 }} />);
    const celda = screen.getByLabelText('Li+ (%p/p)');
    fireEvent.change(celda, { target: { value: '0,5' } });
    fireEvent.blur(celda);
    expect(valor()).toEqual({ H2O: 90, 'Li+': 0.5 });
  });
});

describe('factores de precipitación: fase | valor', () => {
  it('cabecera Fase, cuenta los distintos de 1 y los parte en bloques', () => {
    const keys = fases(30);
    render(<Editor keys={keys} neutral={1} keyKind="phase" inicial={{ F001: 2, F030: 0.5 }} />);
    expect(screen.getAllByRole('columnheader', { name: 'Fase' })).toHaveLength(2);
    expect(screen.getAllByTestId('kv-block')).toHaveLength(2);
    expect(screen.getAllByRole('rowheader')).toHaveLength(30);
    expect(screen.getByTestId('kv-summary').textContent).toBe('30 fases · 2 distintos de 1');
    // Sin cargar vale 1.
    expect((screen.getByTestId('kv-F002') as HTMLInputElement).value).toBe('1');
  });

  it('el filtro deja solo las filas pedidas; sin ninguna lo dice', () => {
    render(<Editor keys={fases(30)} neutral={1} keyKind="phase" inicial={{ F001: 2, F030: 0.5 }} />);
    fireEvent.change(screen.getByTestId('kv-filter'), { target: { value: 'gt' } });
    const filas = screen.getAllByRole('rowheader');
    expect(filas.map((th) => th.textContent)).toEqual(['F001']);
    expect(screen.getAllByTestId('kv-block')).toHaveLength(1);
    fireEvent.change(screen.getByTestId('kv-F001'), { target: { value: '1' } });
    fireEvent.blur(screen.getByTestId('kv-F001'));
    // Volver a 1 es no guardarlo; el filtro > 1 queda vacío y lo avisa.
    expect(valor()).toEqual({ F030: 0.5 });
    expect(screen.getByTestId('kv-empty').textContent).toBe('Ninguna con este filtro.');
  });

  it('una lista larga parte cerrada; con un error adentro se abre y lo cuenta', () => {
    const issue: ValidationIssue = { section: 'precon_dynamic', field: 'f', code: 'range', message: 'Factor negativo',
      row: null, row_label: null };
    const { rerender } = render(<KeyValueEditor title="Factores" testId="kv" field="f" keys={fases(242)} value={null}
                                                neutral={1} keyKind="phase" defaultOpen={false} issues={[]}
                                                onChange={() => undefined} />);
    const bloque = screen.getByTestId('kv') as HTMLDetailsElement;
    expect(bloque.open).toBe(false);
    expect(screen.getAllByTestId('kv-block')).toHaveLength(3);
    rerender(<KeyValueEditor title="Factores" testId="kv" field="f" keys={fases(242)} value={null}
                             neutral={1} keyKind="phase" defaultOpen={false} issues={[issue]}
                             onChange={() => undefined} />);
    expect(bloque.open).toBe(true);
    // Cambios finales: errores y avisos se cuentan por separado (antes "1 observación").
    expect(screen.getByTestId('kv-summary').textContent).toContain('1 error');
    expect(within(bloque).getByText('Factor negativo')).toBeTruthy();
  });
});
