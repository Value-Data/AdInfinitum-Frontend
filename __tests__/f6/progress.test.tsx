/* Avance de las ejecuciones en la lista y aviso de "sin latido" (cambios finales, puntos 2 y 13). */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const datos = vi.hoisted(() => ({
  lista: [] as Record<string, unknown>[],
  detalle: {} as Record<string, unknown>,
  estado: {} as Record<string, unknown>,
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
vi.mock('../../src/f6/ConfigPanel', () => ({ default: () => null, InventoryBadge: () => null }));
vi.mock('../../src/f6/LaunchPanel', () => ({ default: () => null }));
vi.mock('../../src/legacy/LegacyExecutionsSection', () => ({ default: () => null }));
vi.mock('../../src/services/api', async (orig) => ({
  ...(await orig<typeof import('../../src/services/api')>()),
  listExecutionFiles: vi.fn(async () => []),
}));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getProjectV2: vi.fn(async () => ({ id: 'p1', name: 'Proyecto A', description: null, aqsol_version: '027',
    my_role: 'operador', capabilities: ['view_results', 'view_config', 'view_logs', 'launch', 'cancel'] })),
  getSectionStates: vi.fn(async () => []),
  listExecutions: vi.fn(async () => datos.lista),
  getExecutionDetail: vi.fn(async () => datos.detalle),
  getExecutionStatusV2: vi.fn(async () => datos.estado),
  getChain: vi.fn(async () => ({ executions: [] })),
  getExecutionLog: vi.fn(async () => ({ source: null, lines: [] })),
}));

import ProjectPage from '../../src/f6/ProjectPage';
import ExecutionPage from '../../src/f6/ExecutionPage';
import { progressText, runProgress } from '../../src/f6/common';
import { TRANSLATIONS, type TranslationKey } from '../../src/i18n/translations';

const t = (k: TranslationKey) => TRANSLATIONS[k].es;

const fila = (o: Record<string, unknown>) => ({
  project_id: 'p1', has_partial_results: false, run_tag: 'r1', created_by: 'u1',
  created_at: '2026-10-25T10:00:00', started_at: '2026-10-25T10:00:05', completed_at: null,
  n_days: null, last_completed_day: null, progress_day: null,
  scenarios_total: null, scenarios_done: null, heartbeat_stale: false, ...o,
});

const dinCorriendo = fila({ id: 'din', execution_type: 'dynamic_precon', status: 'running',
  n_days: 365, last_completed_day: null, progress_day: 120 });
const estCorriendo = fila({ id: 'est', execution_type: 'static_full', status: 'running',
  scenarios_total: 4, scenarios_done: 1 });
const dinTerminada = fila({ id: 'fin', execution_type: 'dynamic_precon', status: 'completed',
  n_days: 365, last_completed_day: 365, progress_day: 365, completed_at: '2026-10-25T11:00:00' });
const enCola = fila({ id: 'cola', execution_type: 'dynamic_precon', status: 'pending', n_days: 365 });

describe('texto de avance', () => {
  it('dinámico corriendo: "día X de N" con progress_day', () => {
    expect(progressText(dinCorriendo, t)).toBe('día 120 de 365');
  });
  it('estático corriendo: el escenario que va (terminados + 1) de n', () => {
    expect(progressText(estCorriendo, t)).toBe('escenario 2 de 4');
    expect(progressText({ ...estCorriendo, scenarios_done: 0 }, t)).toBe('escenario 1 de 4');
    // Todos terminados pero aún guardando: no se pasa del total.
    expect(progressText({ ...estCorriendo, scenarios_done: 4 }, t)).toBe('escenario 4 de 4');
    expect(runProgress({ ...estCorriendo, scenarios_done: 4 })).toMatchObject({ done: 4, total: 4 });
  });
  it('terminada: los días completos, como antes; el estático sin días, "–"', () => {
    expect(progressText(dinTerminada, t)).toBe('365/365');
    expect(progressText({ ...estCorriendo, status: 'completed', scenarios_done: 4 }, t)).toBe('–');
    expect(progressText({ ...dinTerminada, status: 'failed', last_completed_day: 137 }, t)).toBe('137/365');
  });
  it('en cola: esperando al trabajador; corriendo sin avance aún: día 0', () => {
    expect(progressText(enCola, t)).toBe('esperando al trabajador');
    expect(progressText({ ...dinCorriendo, progress_day: null }, t)).toBe('día 0 de 365');
    // Estático de antes, sin conteo de escenarios.
    expect(progressText({ ...estCorriendo, scenarios_total: null, scenarios_done: null }, t)).toBe('–');
  });
});

describe('la lista de ejecuciones del proyecto', () => {
  const ver = () => render(
    <MemoryRouter initialEntries={['/projects/p1?tab=executions']}>
      <Routes><Route path="/projects/:id" element={<ProjectPage />} /></Routes>
    </MemoryRouter>);

  it('muestra el avance de cada fila y la insignia "sin latido" solo donde corresponde', async () => {
    datos.lista = [{ ...dinCorriendo, heartbeat_stale: true }, estCorriendo, dinTerminada, enCola];
    ver();
    const din = await screen.findByTestId('execution-row-din');
    expect(within(din).getByTestId('execution-progress')).toHaveTextContent('día 120 de 365');
    expect(within(din).getByTestId('heartbeat-badge')).toHaveTextContent('Sin latido');

    const est = screen.getByTestId('execution-row-est');
    expect(within(est).getByTestId('execution-progress')).toHaveTextContent('escenario 2 de 4');
    expect(within(est).queryByTestId('heartbeat-badge')).toBeNull();

    expect(within(screen.getByTestId('execution-row-fin')).getByTestId('execution-progress'))
      .toHaveTextContent('365/365');
    expect(within(screen.getByTestId('execution-row-cola')).getByTestId('execution-progress'))
      .toHaveTextContent('esperando al trabajador');
    expect(screen.getAllByTestId('heartbeat-badge')).toHaveLength(1);
  });
});

describe('la página de la ejecución', () => {
  const ver = () => render(
    <MemoryRouter initialEntries={['/executions/din']}>
      <Routes><Route path="/executions/:id" element={<ExecutionPage />} /></Routes>
    </MemoryRouter>);
  const detalle = (o: Record<string, unknown>) => ({ ...dinCorriendo, sections: [], scenarios: [],
    last_completed_day: 0, upload_status: null, ...o });

  it('sin latido: el aviso a la vista, con hace cuánto latió el trabajador', async () => {
    const hace = new Date(Date.now() - 20 * 60 * 1000).toISOString().replace('Z', '');
    datos.detalle = detalle({ heartbeat_stale: true });
    datos.estado = { id: 'din', status: 'running', heartbeat_at: hace, heartbeat_stale: true };
    ver();
    const aviso = await screen.findByTestId('heartbeat-banner');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('Sin latido del trabajador');
    expect(aviso).toHaveTextContent(/revise el trabajador o cancele la ejecución/);
    expect(await within(aviso).findByText(/Último latido hace 20 min/)).toBeInTheDocument();
  });

  it('sin latido y sin ninguno registrado: lo dice', async () => {
    datos.detalle = detalle({ heartbeat_stale: true });
    datos.estado = { id: 'din', status: 'running', heartbeat_at: null, heartbeat_stale: true };
    ver();
    const aviso = await screen.findByTestId('heartbeat-banner');
    expect(await within(aviso).findByText(/no ha registrado ningún latido/)).toBeInTheDocument();
  });

  it('con latido: sin aviso, y el avance "día X de N"', async () => {
    datos.detalle = detalle({ heartbeat_stale: false });
    datos.estado = { id: 'din', status: 'running', heartbeat_at: new Date().toISOString(), heartbeat_stale: false };
    ver();
    expect(await screen.findByTestId('execution-progress')).toHaveTextContent('Corriendo (día 120 de 365)');
    expect(screen.queryByTestId('heartbeat-banner')).toBeNull();
  });

  it('estático corriendo: "escenario k de n" y la barra con los terminados', async () => {
    datos.detalle = detalle({ id: 'est', execution_type: 'static_full', n_days: null, progress_day: null,
      scenarios_total: 4, scenarios_done: 1 });
    datos.estado = { id: 'est', status: 'running', heartbeat_at: null, heartbeat_stale: false };
    ver();
    expect(await screen.findByTestId('execution-progress')).toHaveTextContent('Corriendo (escenario 2 de 4)');
    const barra = screen.getByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '1');
    expect(barra).toHaveAttribute('aria-valuemax', '4');
    expect(screen.queryByTestId('heartbeat-banner')).toBeNull();
  });
});
