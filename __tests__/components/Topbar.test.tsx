import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Topbar from '../../src/components/common/Topbar';
import { setTrail } from '../../src/components/common/trail';

const ver = (path: string) => render(<MemoryRouter initialEntries={[path]}><Topbar /></MemoryRouter>);

describe('miga de pan con nombres', () => {
  it('usa los nombres que declara la página, no el UUID', () => {
    const path = '/projects/8ff179a6-1111-2222-3333-444455556666/sections/precon_dynamic';
    ver(path);
    act(() => setTrail(path, [
      { label: 'Proyectos', path: '/projects' },
      { label: 'Galán — dinámico', path: '/projects/8ff179a6-1111-2222-3333-444455556666' },
      { label: 'Preconcentración · dinámico' }]));
    expect(screen.getByRole('link', { name: 'Galán — dinámico' })).toBeTruthy();
    expect(screen.getByText('Preconcentración · dinámico')).toBeTruthy();
    expect(screen.queryByText(/8ff179a6/)).toBeNull();
    expect(screen.queryByText('precon_dynamic')).toBeNull();
  });
  it('sin nombres declarados, la de siempre', () => {
    ver('/users');
    expect(screen.getByText('Usuarios')).toBeTruthy();
  });
});
