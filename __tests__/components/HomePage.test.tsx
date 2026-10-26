/**
 * La portada (/inicio): entrada al módulo de simulación, módulos según lo que el rol
 * permite y proyectos recientes con sus tres estados (cargando, error, vacío).
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Project } from '../../src/types';

let mockIsAdmin = false;

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'gonzalo', role: mockIsAdmin ? 'admin' : 'user' },
    isAdmin: mockIsAdmin,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/services/api', () => ({ getProjects: vi.fn() }));

import HomePage, { recientes } from '../../src/pages/HomePage';
import { getProjects } from '../../src/services/api';

const LECTOR = ['view_config', 'view_legacy', 'view_logs', 'view_results'];
const CLIENTE = ['view_results'];

function proyecto(n: number, extra: Partial<Project> = {}): Project {
  return {
    id: `p${n}`,
    name: `Salar ${n}`,
    description: null,
    client: n % 2 ? 'Minera Andina' : null,
    created_by: 'admin-id',
    created_at: '2026-01-01T10:00:00',
    // p7 es el más reciente, p1 el más antiguo.
    updated_at: `2026-0${n}-15T10:00:00`,
    last_execution_status: n === 7 ? 'completed' : null,
    aqsol_version: '027',
    my_role: 'lector',
    capabilities: LECTOR,
    ...extra,
  };
}

const ver = () => render(<MemoryRouter><HomePage /></MemoryRouter>);

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = false;
    sessionStorage.clear();
  });

  it('muestra el saludo, la entrada a la simulación y los 6 proyectos más recientes', async () => {
    vi.mocked(getProjects).mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map((n) => proyecto(n)));
    ver();

    expect(screen.getByRole('heading', { name: 'Hola, gonzalo' })).toBeInTheDocument();
    expect(screen.getByTestId('home-role')).toHaveTextContent('Usuario');
    expect(screen.getByRole('heading', { name: 'Simulación de pozas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute('href', '/projects');

    const recientesSec = screen.getByRole('region', { name: 'Proyectos recientes' });
    await waitFor(() => expect(within(recientesSec).getByText('Salar 7')).toBeInTheDocument());
    const enlaces = within(recientesSec).getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/projects/'));
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(
      ['/projects/p7', '/projects/p6', '/projects/p5', '/projects/p4', '/projects/p3', '/projects/p2']);
    expect(within(recientesSec).getByTestId('run-status')).toHaveTextContent('Completada');
    expect(within(recientesSec).getAllByText(/Minera Andina/).length).toBeGreaterThan(0);
  });

  it('el admin ve la tarjeta de Usuarios con enlace', async () => {
    mockIsAdmin = true;
    vi.mocked(getProjects).mockResolvedValue([proyecto(1, { my_role: 'admin' })]);
    ver();

    expect(screen.getByTestId('home-role')).toHaveTextContent('Administrador');
    expect(await screen.findByRole('link', { name: /administrar usuarios/i })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('heading', { name: 'Comparar corridas' })).toBeInTheDocument();
    // La tarjeta de Inventario (cargar escenario) se eliminó: ya no aparece para nadie.
    expect(screen.queryByRole('heading', { name: 'Inventario' })).toBeNull();
  });

  it('un lector ve Comparar (dónde está, sin enlace) pero no Usuarios', async () => {
    vi.mocked(getProjects).mockResolvedValue([proyecto(1)]);
    ver();

    expect(await screen.findByRole('heading', { name: 'Comparar corridas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inventario' })).toBeNull();
    expect(screen.getByText('Proyecto › Ejecución › Comparar')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).toBeNull();
    expect(screen.queryByRole('link', { name: /administrar usuarios/i })).toBeNull();
  });

  it('el cliente solo ve la entrada a la simulación y sus proyectos', async () => {
    vi.mocked(getProjects).mockResolvedValue([
      proyecto(1, { my_role: 'cliente', capabilities: CLIENTE }),
      proyecto(2, { my_role: 'cliente', capabilities: CLIENTE }),
    ]);
    ver();

    expect(await screen.findByText('Salar 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulación de pozas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Otros módulos' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Comparar corridas' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Inventario' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).toBeNull();
    expect(screen.getAllByText(/Cliente/).length).toBeGreaterThan(0);
  });

  it('un error de carga se ve como error y Reintentar vuelve a pedir', async () => {
    vi.mocked(getProjects)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce([proyecto(3)]);
    ver();

    expect(screen.getByTestId('home-recent-loading')).toBeInTheDocument();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudieron cargar los proyectos: Network Error');

    await userEvent.setup().click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Salar 3')).toBeInTheDocument();
    expect(getProjects).toHaveBeenCalledTimes(2);
  });

  it('sin proyectos lo dice (y al admin le ofrece ir a Proyectos)', async () => {
    mockIsAdmin = true;
    vi.mocked(getProjects).mockResolvedValue([]);
    ver();

    expect(await screen.findByText(/No hay proyectos creados/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Proyectos' })).toHaveAttribute('href', '/projects');
  });

  it('hace de bienvenida: el aviso de Proyectos no se repite en la sesión', async () => {
    sessionStorage.setItem('adinf_show_welcome', '1');
    vi.mocked(getProjects).mockResolvedValue([]);
    ver();

    await screen.findByText(/No tiene proyectos asignados/);
    expect(sessionStorage.getItem('adinf_show_welcome')).toBeNull();
    expect(sessionStorage.getItem('adinf_welcomed')).toBe('1');
  });
});

describe('recientes', () => {
  it('ordena por updated_at descendente sin mutar la lista y corta en n', () => {
    const lista = [proyecto(2), proyecto(5), proyecto(1)];
    expect(recientes(lista, 2).map((p) => p.id)).toEqual(['p5', 'p2']);
    expect(lista.map((p) => p.id)).toEqual(['p2', 'p5', 'p1']);
  });
});
