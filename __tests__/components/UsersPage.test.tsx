import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getProjects: vi.fn(),
  getUserAccesses: vi.fn(),
  setUserAccesses: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  getUserProjects: vi.fn(),
  setUserProjects: vi.fn(),
}));
vi.mock('../../src/services/api', () => api);

import UsersPage from '../../src/pages/UsersPage';

const usuario = { id: 'u1', username: 'ana', role: 'user', is_active: true,
  created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' };

beforeEach(() => {
  vi.clearAllMocks();
  api.getUsers.mockResolvedValue([usuario]);
  api.getProjects.mockResolvedValue([
    { id: 'p1', name: 'Proyecto A', description: null },
    { id: 'p2', name: 'Proyecto B', description: null },
  ]);
  api.setUserAccesses.mockResolvedValue([]);
});

async function abrir() {
  render(<MemoryRouter><UsersPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Asignar/ }));
  return screen.findByTestId('assign-accesses');
}

describe('asignar proyectos con rol', () => {
  it('muestra el rol actual de cada proyecto y guarda los cambios con su rol', async () => {
    api.getUserAccesses.mockResolvedValue([{ project_id: 'p1', role: 'cliente' }]);
    const modal = await abrir();
    const proyectoA = within(modal).getByLabelText('Proyecto A') as HTMLSelectElement;
    const proyectoB = within(modal).getByLabelText('Proyecto B') as HTMLSelectElement;
    expect(proyectoA.value).toBe('cliente');
    expect(proyectoB.value).toBe('');
    fireEvent.change(proyectoB, { target: { value: 'operador' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.setUserAccesses).toHaveBeenCalledWith('u1', [
      { project_id: 'p1', role: 'cliente' }, { project_id: 'p2', role: 'operador' }]));
  });

  it('si no se pudieron leer los accesos, no deja guardar (no los borra)', async () => {
    api.getUserAccesses.mockRejectedValue(new Error('Network Error'));
    const modal = await abrir();
    expect(within(modal).getByRole('alert')).toBeTruthy();
    expect((within(modal).getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.setUserAccesses).not.toHaveBeenCalled();
  });

  it('si falla al guardar, lo dice y deja el modal abierto', async () => {
    api.getUserAccesses.mockResolvedValue([]);
    api.setUserAccesses.mockRejectedValue(new Error('boom'));
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar' }));
    expect(await within(modal).findByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('assign-accesses')).toBeTruthy();
  });
});
