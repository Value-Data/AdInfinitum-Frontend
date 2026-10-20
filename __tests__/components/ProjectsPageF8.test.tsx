/**
 * F8: la lista de proyectos agrupada por cliente, sus filtros y la edición de
 * nombre, descripción y cliente (solo admin).
 */

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

let mockIsAdmin = true;

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'test', role: mockIsAdmin ? 'admin' : 'user' },
    isAdmin: mockIsAdmin,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const base = { created_by: 'a', created_at: '2026-01-15T10:00:00', updated_at: '2026-01-15T10:00:00',
               last_execution_status: null, aqsol_version: '027' };
const proyectos = [
  { ...base, id: 'p1', name: 'Pozas Norte', description: 'Fase 1', client: 'Alfa SpA' },
  { ...base, id: 'p2', name: 'Pozas Sur', description: null, client: 'Beta Ltda.' },
  { ...base, id: 'p3', name: 'Interno', description: 'Pruebas', client: null },
];

vi.mock('../../src/services/api', () => ({
  getProjects: vi.fn(() => Promise.resolve(proyectos)),
}));

const update = vi.fn();
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  updateProjectV2: (...a: unknown[]) => update(...a),
}));

import ProjectsPage from '../../src/pages/ProjectsPage';

const montar = () => render(<MemoryRouter><ProjectsPage /></MemoryRouter>);

describe('ProjectsPage F8', () => {
  beforeEach(() => {
    update.mockReset();
    mockIsAdmin = true;
    sessionStorage.setItem('adinf_welcomed', '1');
  });

  it('agrupa por cliente y deja los sin cliente al final', async () => {
    montar();
    await screen.findByText('Pozas Norte');
    const grupos = screen.getAllByTestId(/^client-group-/).map((g) => g.getAttribute('data-testid'));
    expect(grupos).toEqual(['client-group-Alfa SpA', 'client-group-Beta Ltda.', 'client-group-__sin_cliente__']);
    expect(within(screen.getByTestId('client-group-__sin_cliente__')).getByText('Sin cliente')).toBeInTheDocument();
  });

  it('filtra por texto y por cliente', async () => {
    montar();
    await screen.findByText('Pozas Norte');
    fireEvent.change(screen.getByTestId('project-filter'), { target: { value: 'pruebas' } });
    expect(screen.queryByText('Pozas Norte')).toBeNull();
    expect(screen.getByText('Interno')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('project-filter'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('client-filter'), { target: { value: 'Beta Ltda.' } });
    expect(screen.getByText('Pozas Sur')).toBeInTheDocument();
    expect(screen.queryByText('Interno')).toBeNull();

    fireEvent.change(screen.getByTestId('client-filter'), { target: { value: '__sin_cliente__' } });
    expect(screen.getByText('Interno')).toBeInTheDocument();
    expect(screen.queryByText('Pozas Sur')).toBeNull();
  });

  it('el admin edita nombre, descripción y cliente; vaciar manda null', async () => {
    update.mockResolvedValue({ ...proyectos[0], name: 'Nuevo' });
    montar();
    await screen.findByText('Pozas Norte');
    fireEvent.click(screen.getByLabelText('Acciones de Pozas Norte'));
    fireEvent.click(screen.getByTestId('edit-project-p1'));

    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: ' Nuevo ' } });
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('p1',
      { name: 'Nuevo', description: null, client: 'Alfa SpA' }));
  });

  it('quien no es admin no ve la edición', async () => {
    mockIsAdmin = false;
    montar();
    await screen.findByText('Pozas Norte');
    expect(screen.queryByTestId('edit-project-p1')).toBeNull();
    expect(screen.queryByLabelText(/Acciones de/)).toBeNull();
  });
});
