import React from 'react';
import { render, screen } from '@testing-library/react';
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
