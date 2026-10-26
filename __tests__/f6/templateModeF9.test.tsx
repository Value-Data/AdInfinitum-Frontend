/**
 * Plantilla de Excel (cambios finales, punto 25): las cascadas del dinámico eligen si los
 * parámetros de pozas son fijos (por defecto: sin hoja "Cambios de pozas") o por fecha.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ downloadTemplate: vi.fn(), saveBlob: vi.fn() }));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  downloadTemplate: (...a: unknown[]) => m.downloadTemplate(...a),
  saveBlob: (...a: unknown[]) => m.saveBlob(...a),
}));

import { ExcelPanel } from '../../src/f6/ConfigPanel';

const bajar = async () => {
  fireEvent.click(screen.getByText('Bajar plantilla'));
  await waitFor(() => expect(m.downloadTemplate).toHaveBeenCalled());
  return m.downloadTemplate.mock.calls.at(-1)!;
};
const proceso = () => screen.getAllByRole('combobox')[0];

beforeEach(() => {
  vi.clearAllMocks();
  m.downloadTemplate.mockResolvedValue(new Blob(['x']));
});

describe('modo de parámetros de pozas en la plantilla', () => {
  it('dinámico: por defecto fijos', async () => {
    render(<ExcelPanel projectId="p1" engine="dynamic" onSaved={() => undefined} />);
    expect((screen.getByTestId('template-pond-params-mode') as HTMLSelectElement).value).toBe('fixed');
    const [proyecto, proc, motor, , opts] = await bajar();
    expect([proyecto, proc, motor]).toEqual(['p1', 'full', 'dynamic']);
    expect(opts).toMatchObject({ pond_params_mode: 'fixed' });
  });

  it('dinámico por fecha: lo pide así (trae la hoja de cambios de pozas)', async () => {
    render(<ExcelPanel projectId="p1" engine="dynamic" onSaved={() => undefined} />);
    fireEvent.change(screen.getByTestId('template-pond-params-mode'), { target: { value: 'by_date' } });
    const [, , , , opts] = await bajar();
    expect(opts).toMatchObject({ pond_params_mode: 'by_date' });
  });

  it('la planta sola y el estático no tienen pozas por fecha: no se ofrece ni se manda', async () => {
    const { unmount } = render(<ExcelPanel projectId="p1" engine="dynamic" onSaved={() => undefined} />);
    fireEvent.change(proceso(), { target: { value: 'liming' } });
    expect(screen.queryByTestId('template-pond-params-mode')).toBeNull();
    let [, , , , opts] = await bajar();
    expect(opts).not.toHaveProperty('pond_params_mode');
    unmount();
    render(<ExcelPanel projectId="p1" engine="static" onSaved={() => undefined} />);
    expect(screen.queryByTestId('template-pond-params-mode')).toBeNull();
    [, , , , opts] = await bajar();
    expect(opts).not.toHaveProperty('pond_params_mode');
  });
});
