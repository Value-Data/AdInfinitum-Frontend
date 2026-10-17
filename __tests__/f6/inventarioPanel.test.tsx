import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  listInventarioEscenarios: vi.fn(async () => [
    { path: 'data/mariana/escenario_v2.json', nombre: 'escenario_v2', descripcion: 'v2', dias: 1825,
      start_date: '2026-04-21', con_inventario: true, loadable: true, reason: null },
    { path: 'data/mariana/escenario_v7_feed_71526.json', nombre: 'escenario_v7_feed_71526', descripcion: '',
      dias: 1095, start_date: '2026-04-21', con_inventario: true, loadable: false,
      reason: 'El escenario no trae el caudal de alimentación por día' },
  ]),
  getSection: vi.fn(async () => null),
  loadInventarioEscenario: vi.fn(async () => ({
    escenario: 'escenario_v2', ok: true, saved: true, start_date: '2026-04-21', days_max: 1825,
    descripcion: '', n_initial_states: 10,
    sections: { precon_dynamic: { validation: { ok: true, errors: [], warnings: [] }, saved_version: 3 } },
  })),
}));

import * as apiV2 from '../../src/services/apiV2';
import { InventarioPanel } from '../../src/f6/ConfigPanel';
import LaunchPanel from '../../src/f6/LaunchPanel';

describe('cargar escenario de inventario', () => {
  it('los escenarios que no se pueden cargar salen deshabilitados, con el motivo', async () => {
    render(<InventarioPanel projectId="p" aqsolVersion="027" onSaved={() => {}} />);
    const v7 = await screen.findByRole('option', { name: /escenario_v7_feed_71526/ }) as HTMLOptionElement;
    expect(v7.disabled).toBe(true);
    expect(v7.title).toContain('caudal');
    expect((screen.getByRole('option', { name: /escenario_v2 ·/ }) as HTMLOptionElement).disabled).toBe(false);
    expect(screen.getByTestId('inventario-not-loadable').textContent).toContain('caudal de alimentación');
  });

  it('en un proyecto de otra versión de AQSOL no se ofrece: solo la explicación', () => {
    vi.mocked(apiV2.listInventarioEscenarios).mockClear();
    render(<InventarioPanel projectId="p" aqsolVersion="066" onSaved={() => {}} />);
    expect(screen.getByTestId('inventario-other-version').textContent).toContain('AQSOL 066');
    expect(screen.queryByTestId('inventario-select')).toBeNull();
    expect(apiV2.listInventarioEscenarios).not.toHaveBeenCalled();
  });

  it('al cargar avisa la fecha y los días del escenario para precargar el lanzamiento', async () => {
    const onLoaded = vi.fn();
    const onSaved = vi.fn();
    render(<InventarioPanel projectId="p" aqsolVersion="027" onSaved={onSaved} onLoaded={onLoaded} />);
    fireEvent.change(await screen.findByTestId('inventario-select'),
      { target: { value: 'data/mariana/escenario_v2.json' } });
    fireEvent.click(screen.getByTestId('inventario-load'));
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith({ start_date: '2026-04-21', n_days: 1825 }));
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByTestId('inventario-result').textContent).toContain('precargados');
  });
});

describe('lanzar con la precarga del escenario', () => {
  it('queda elegida la precon dinámica con la fecha y los días del escenario, y se pueden cambiar', () => {
    render(<LaunchPanel projectId="p" executions={[]} sections={[]} onLaunched={() => {}}
                        defaults={{ start_date: '2026-04-21', n_days: 1825 }} />);
    expect((screen.getByTestId('launch-type') as HTMLSelectElement).value).toBe('dynamic_precon');
    const inicio = screen.getByTestId('launch-start') as HTMLInputElement;
    const dias = screen.getByTestId('launch-days') as HTMLInputElement;
    expect([inicio.value, dias.value]).toEqual(['2026-04-21', '1825']);
    fireEvent.change(dias, { target: { value: '10' } });
    expect(dias.value).toBe('10');
  });
});
