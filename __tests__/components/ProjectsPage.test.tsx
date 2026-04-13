/**
 * Tests for ProjectsPage component.
 *
 * Verifies project list rendering and role-based visibility of the
 * "Nuevo Proyecto" button.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsAdmin = false;

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

vi.mock('../../src/services/api', () => ({
  getProjects: vi.fn().mockResolvedValue([
    {
      id: 'p1',
      name: 'Salar Alpha',
      description: 'Test project',
      created_by: 'admin-id',
      created_at: '2026-01-15T10:00:00',
      updated_at: '2026-01-16T10:00:00',
      last_execution_status: 'completed',
    },
    {
      id: 'p2',
      name: 'Salar Beta',
      description: null,
      created_by: 'admin-id',
      created_at: '2026-02-20T10:00:00',
      updated_at: '2026-02-21T10:00:00',
      last_execution_status: null,
    },
  ]),
  createProject: vi.fn(),
}));

import ProjectsPage from '../../src/pages/ProjectsPage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = false;
  });

  it('renders project list', async () => {
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Salar Alpha')).toBeInTheDocument();
      expect(screen.getByText('Salar Beta')).toBeInTheDocument();
    });
  });

  it('admin sees create button', async () => {
    mockIsAdmin = true;

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Salar Alpha')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /nuevo proyecto/i }),
    ).toBeInTheDocument();
  });

  it('user does not see create button', async () => {
    mockIsAdmin = false;

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Salar Alpha')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /nuevo proyecto/i }),
    ).not.toBeInTheDocument();
  });
});
