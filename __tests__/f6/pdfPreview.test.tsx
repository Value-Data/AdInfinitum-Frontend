import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PdfPreview } from '../../src/f6/PdfPreview';

describe('vista previa por páginas', () => {
  it('pide el PDF al abrirla y lo muestra en el visor', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:vista');
    URL.revokeObjectURL = vi.fn();
    const load = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
    render(<PdfPreview load={load} />);
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Vista previa/ }));
    await waitFor(() => expect(screen.getByTitle('pdf-preview').getAttribute('src')).toBe('blob:vista'));
    expect(load).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar vista previa/ }));
    expect(screen.queryByTitle('pdf-preview')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista');
  });
  it('si el PDF falla, lo dice', async () => {
    render(<PdfPreview load={async () => { throw new Error('boom'); }} />);
    fireEvent.click(screen.getByRole('button', { name: /Vista previa/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/boom/));
  });
});
