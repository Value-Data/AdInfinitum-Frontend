import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'gonzalo', role: 'user' },
    isAdmin: false,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import Sidebar from '../../src/components/common/Sidebar';

describe('Sidebar', () => {
  it('Inicio va primero y queda marcado en la portada', () => {
    render(<MemoryRouter initialEntries={['/inicio']}><Sidebar /></MemoryRouter>);
    const enlaces = screen.getAllByRole('link');
    expect(enlaces[0]).toHaveTextContent('Inicio');
    expect(enlaces[0]).toHaveAttribute('href', '/inicio');
    expect(enlaces[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /proyectos/i })).not.toHaveAttribute('aria-current');
  });
});

describe('Sidebar en tablet (franja de íconos)', () => {
  it('el botón abre el menú con los nombres a la vista y Escape lo cierra', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/inicio']}><Sidebar /></MemoryRouter>);
    const boton = screen.getByRole('button', { name: 'Abrir el menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    // En la franja el nombre queda solo para lectores de pantalla.
    expect(screen.getByText('Proyectos').className).toMatch(/sr-only/);
    await user.click(boton);
    expect(screen.getByRole('button', { name: 'Cerrar el menú' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Proyectos').className).not.toMatch(/sr-only/);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir el menú' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('elegir un destino cierra el menú abierto', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/inicio']}><Sidebar /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    await user.click(screen.getByRole('link', { name: /proyectos/i }));
    expect(screen.getByRole('button', { name: 'Abrir el menú' })).toHaveAttribute('aria-expanded', 'false');
  });
});
