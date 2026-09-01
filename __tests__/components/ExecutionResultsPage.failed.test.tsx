/**
 * La vista de resultados tiene que abrir aunque falten resultados.
 *
 * Dos casos, los dos vistos en la app:
 *  - ejecución fallida entera: `results` en null, solo hay `error_message`;
 *  - ejecución multi-día "completada" donde UN día reventó: ese día viene con
 *    `result: null` dentro de `daily_results`. Este es el que rompía con
 *    "Cannot read properties of null (reading 'precon')": el día nulo pasaba el
 *    filtro de días válidos y el promedio lo desreferenciaba.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const SOLVER_RESULT = {
  initial_aqsol: { eq_liquid: { 'H2O': 500, 'Li+': 0.6 }, eq_liquid_dll: [500, 0.6] },
  ponds: [
    {
      config: { name: 'PC1', number: 1, area_design_m2: 1000, pond_factor: 0.7 },
      aqsol_result: {
        eq_liquid: { 'H2O': 480, 'Li+': 0.6 },
        eq_liquid_dll: [480, 0.6],
        precipitated_salts: { NaCl: 1.2 },
        total_solids_g: 1.2,
        density_liquid: 1.21,
        pH: 6.5,
        water_activity: 0.75,
      },
      evaporation: 20, salt_precipitated: 1.2, entrainment: 0.1, leakage: 0.01,
      dilution: 0.05, outlet_flow: 480, aqsol_input: [], iterations: 5, converged: true,
    },
  ],
  total_evaporation: 20, total_salt: 1.2, total_entrainment: 0.1, total_leakage: 0.01,
  final_outlet_flow: 480, li_in: 0.6, li_out: 0.58, li_recovery_pct: 96.7,
};

const SNAPSHOT = {
  aqsol_version: '066',
  brine: { 'H2O': 537.4, 'Li+': 0.6, 'Cl-': 128.1 },
  precon_ponds: [{ name: 'PC4', number: 4, area_design_m2: 1000 }],
  daily_schedule: [
    { date_label: 'Dia 1', temperature_C: 20, evap_rate: 7.72 },
    { date_label: 'Dia 2', temperature_C: 20, evap_rate: 7.72 },
  ],
};

const EJECUCION_FALLIDA = {
  id: 'exec-fallida',
  project_id: 'p1',
  execution_type: 'preconcentracion',
  status: 'failed',
  results: null,
  error_message:
    'AQSOLCalcError: Error de cálculo en el motor termodinámico — Poza 4 (PC4), iteración 1 de 200',
  parameters_snapshot: SNAPSHOT,
  started_at: '2026-08-10T23:14:07',
  completed_at: '2026-08-10T23:15:20',
  created_at: '2026-08-10T23:14:07',
};

// Multi-día donde el segundo día reventó: `result` en null, como lo guarda el backend.
const MULTIDIA_CON_DIA_NULO = {
  id: 'exec-multidia',
  project_id: 'p1',
  execution_type: 'preconcentracion',
  status: 'completed',
  results: {
    daily_results: [
      { day: 1, date_label: 'Dia 1', temperature_C: 20, evap_rate_mm_day: 7.72, result: SOLVER_RESULT },
      {
        day: 2, date_label: 'Dia 2', temperature_C: 8, evap_rate_mm_day: 10.71, result: null,
        error_msg: 'Error de cálculo en el motor termodinámico — Poza 4 (PC4), iteración 2 de 200',
      },
    ],
    aqsol: { version: 'AQSOL066', available: true },
  },
  error_message: null,
  parameters_snapshot: SNAPSHOT,
  started_at: '2026-08-10T23:20:00',
  completed_at: '2026-08-10T23:22:00',
  created_at: '2026-08-10T23:20:00',
};

let mockExecution: Record<string, unknown> = EJECUCION_FALLIDA;

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'admin', role: 'admin' },
    isAdmin: true,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/services/api', () => ({
  getExecution: vi.fn(() => Promise.resolve(mockExecution)),
  getAqsolCatalog: vi.fn(() =>
    Promise.resolve({
      version: 'AQSOL066',
      species: ['H2O', 'Li+', 'Cl-'],
      salts: [],
      n_aqueous: 25,
      n_salts: 242,
      faktor_length: 267,
    }),
  ),
}));

import ExecutionResultsPage from '../../src/pages/ExecutionResultsPage';

function renderPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/executions/${id}`]}>
      <Routes>
        <Route path="/executions/:id" element={<ExecutionResultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExecutionResultsPage — resultados incompletos', () => {
  it('ejecución fallida: muestra el mensaje de error en vez de romper', async () => {
    mockExecution = EJECUCION_FALLIDA;
    renderPage('exec-fallida');

    await waitFor(() => {
      expect(screen.getByText(/Poza 4 \(PC4\)/)).toBeInTheDocument();
    });
  });

  it('multi-día con un día nulo: abre y promedia solo los días con resultado', async () => {
    mockExecution = MULTIDIA_CON_DIA_NULO;
    renderPage('exec-multidia');

    // El promedio se calcula en el cuerpo del componente, antes de pintar: con el día
    // nulo contado como válido no llegaba a renderizar ni el encabezado.
    await waitFor(() => {
      expect(screen.getByText('AQSOL066')).toBeInTheDocument();
    });
    expect(screen.getByText('Completada')).toBeInTheDocument();
  });

  it('el resumen diario marca en rojo el día sin resultado, no como OK', async () => {
    mockExecution = MULTIDIA_CON_DIA_NULO;
    renderPage('exec-multidia');

    await waitFor(() => {
      expect(screen.getByText('AQSOL066')).toBeInTheDocument();
    });

    // Dos días: uno OK y uno con error. Antes los dos salían "OK" en verde, porque
    // `error_stage` se busca dentro del resultado y el día nulo no tiene resultado.
    const filas = screen.getAllByRole('row');
    const dia2 = filas.find((f) => f.textContent?.includes('Dia 2'));
    expect(dia2).toBeDefined();
    expect(dia2!.textContent).toMatch(/Error/);
    expect(dia2!.textContent).not.toMatch(/OK/);
  });
});
