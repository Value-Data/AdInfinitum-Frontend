import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Collapsible from '../../src/components/common/Collapsible';

const bloque = () => screen.getByTestId('bloque') as HTMLDetailsElement;
const titulo = () => screen.getByText('Composición');

function Bloque(props: Partial<React.ComponentProps<typeof Collapsible>>) {
  return (
    <Collapsible title="Composición" testId="bloque" {...props}>
      <input aria-label="Li+" />
    </Collapsible>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Collapsible', () => {
  it('abre y cierra al hacer clic en el título; el contenido sigue en la página', () => {
    render(<Bloque />);
    expect(bloque().open).toBe(true);
    fireEvent.click(titulo());
    expect(bloque().open).toBe(false);
    expect(screen.getByLabelText('Li+')).toBeTruthy();
    fireEvent.click(titulo());
    expect(bloque().open).toBe(true);
  });

  it('defaultOpen=false parte cerrado y muestra el resumen igual', () => {
    render(<Bloque defaultOpen={false} summary="12 especies · 3 distintos de 1" />);
    expect(bloque().open).toBe(false);
    expect(screen.getByTestId('bloque-summary').textContent).toBe('12 especies · 3 distintos de 1');
  });

  it('con storageKey recuerda si quedó abierto o cerrado', () => {
    const { unmount } = render(<Bloque storageKey="section.precon_dynamic.factors" />);
    fireEvent.click(titulo());
    expect(localStorage.getItem('adinf.collapse.section.precon_dynamic.factors')).toBe('0');
    unmount();
    render(<Bloque storageKey="section.precon_dynamic.factors" />);
    expect(bloque().open).toBe(false);
  });

  it('lo recordado manda sobre defaultOpen', () => {
    localStorage.setItem('adinf.collapse.k', '1');
    render(<Bloque storageKey="k" defaultOpen={false} />);
    expect(bloque().open).toBe(true);
  });

  it('si el almacenamiento falla, usa el de por defecto y se sigue pudiendo abrir y cerrar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    render(<Bloque storageKey="k" defaultOpen={false} />);
    expect(bloque().open).toBe(false);
    fireEvent.click(titulo());
    expect(bloque().open).toBe(true);
  });

  it('forceOpen abre un bloque cerrado (p. ej. con errores adentro)', () => {
    const { rerender } = render(<Bloque defaultOpen={false} />);
    expect(bloque().open).toBe(false);
    rerender(<Bloque defaultOpen={false} forceOpen />);
    expect(bloque().open).toBe(true);
  });
});
