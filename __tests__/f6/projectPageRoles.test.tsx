import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const proyecto = vi.hoisted(() => ({ actual: {} as Record<string, unknown> }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
vi.mock('../../src/f6/ConfigPanel', () => ({ default: () => <div>config</div> }));
vi.mock('../../src/f6/LaunchPanel', () => ({ default: () => <div>lanzar</div> }));
vi.mock('../../src/legacy/LegacyExecutionsSection', () => ({ default: () => <div>antes</div> }));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getProjectV2: vi.fn(async () => proyecto.actual),
  getSectionStates: vi.fn(async () => []),
  listExecutions: vi.fn(async () => []),
}));

import ProjectPage from '../../src/f6/ProjectPage';

const base = { id: 'p1', name: 'Proyecto A', description: null, aqsol_version: '027' };
const ver = (tab = '') => render(
  <MemoryRouter initialEntries={[`/projects/p1${tab}`]}>
    <Routes><Route path="/projects/:id" element={<ProjectPage />} /></Routes>
  </MemoryRouter>);

describe('el proyecto según el rol', () => {
  it('el cliente abre en ejecuciones, sin configuración, sin lanzar ni lo de antes', async () => {
    proyecto.actual = { ...base, my_role: 'cliente', capabilities: ['view_results'] };
    ver();
    expect(await screen.findByTestId('my-role')).toHaveTextContent('Cliente');
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.queryByText('config')).toBeNull();
    expect(screen.queryByText('lanzar')).toBeNull();
    expect(screen.queryByText('antes')).toBeNull();
  });
  it('el operador ve la configuración y puede lanzar', async () => {
    proyecto.actual = { ...base, my_role: 'operador',
      capabilities: ['view_results', 'view_config', 'view_legacy', 'view_logs', 'edit_config', 'launch', 'cancel'] };
    ver('?tab=executions');
    expect(await screen.findByText('lanzar')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(await screen.findByText('antes')).toBeInTheDocument();
  });
  it('el editor no ve Lanzar', async () => {
    proyecto.actual = { ...base, my_role: 'editor',
      capabilities: ['view_results', 'view_config', 'view_legacy', 'view_logs', 'edit_config'] };
    ver('?tab=executions');
    expect(await screen.findByTestId('my-role')).toHaveTextContent('Editor');
    expect(screen.queryByText('lanzar')).toBeNull();
  });
});
