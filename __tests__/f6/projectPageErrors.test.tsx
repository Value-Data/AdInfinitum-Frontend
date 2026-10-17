import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
vi.mock('../../src/f6/ConfigPanel', () => ({ default: () => <div>config</div> }));
vi.mock('../../src/f6/LaunchPanel', () => ({ default: () => null }));
vi.mock('../../src/legacy/LegacyExecutionsSection', () => ({ default: () => null }));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getProjectV2: vi.fn(async () => ({ id: 'p1', name: 'Galán', description: null, aqsol_version: '027' })),
  getSectionStates: vi.fn(async () => { throw new Error('secciones caídas'); }),
  listExecutions: vi.fn(async () => { throw new Error('ejecuciones caídas'); }),
}));

import ProjectPage from '../../src/f6/ProjectPage';

const ver = (tab = '') => render(
  <MemoryRouter initialEntries={[`/projects/p1${tab}`]}>
    <Routes><Route path="/projects/:id" element={<ProjectPage />} /></Routes>
  </MemoryRouter>);

describe('errores del proyecto a la vista', () => {
  it('si las secciones no cargan, lo dice', async () => {
    ver();
    expect((await screen.findByRole('alert')).textContent).toMatch(/secciones caídas/);
  });
  it('si las ejecuciones no cargan, lo dice (no "no hay ejecuciones")', async () => {
    ver('?tab=executions');
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' ')).toMatch(/ejecuciones caídas/);
  });
});
