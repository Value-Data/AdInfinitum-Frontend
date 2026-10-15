/* Humo: la página de una ejecución de la versión anterior dibuja una del estático y
   dos del dinámico (con la cadena) con datos reales recortados. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/services/api', async () => ({
  default: { get: (await import('./legacyHarness')).fakeGet },
}));
vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getAqsolCatalogV2: vi.fn(async () => {
    throw new Error('sin catálogo');
  }),
}));

import { renderAndWalk, store } from './legacyHarness';
import { clearLegacyCache } from '../../src/legacy/api';
import type { LegacyExecutionDetail } from '../../src/legacy/apiTypes';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import LegacyExecutionsSection from '../../src/legacy/LegacyExecutionsSection';
import staticPrecon from './fixtures/static_precon.json';
import dynCascade from './fixtures/dynamic_cascade.json';
import dynEncalado from './fixtures/dynamic_encalado.json';

const fx = (o: unknown) => o as LegacyExecutionDetail;

beforeEach(() => {
  localStorage.setItem('adinf_language', 'es');
  clearLegacyCache();
  store.clear();
  for (const e of [staticPrecon, dynCascade, dynEncalado]) store.set(fx(e).id, fx(e));
});
afterEach(() => store.clear());

describe('ejecución de la versión anterior', () => {
  it('estático: banner de solo lectura y la página de resultados de antes', async () => {
    const { error, text, excel, excelError } = await renderAndWalk(fx(staticPrecon).id);
    expect(error).toBeNull();
    expect(excelError).toBeNull();
    expect(excel).toBeGreaterThan(0);
    expect(text).toContain('Ejecución de la versión anterior — solo lectura');
    expect(text).toContain('Solo Preconcentracion');
  }, 30000);

  it('dinámico: vista de resultados de antes, con todas sus pestañas', async () => {
    const { error, text, excel, excelError } = await renderAndWalk(fx(dynCascade).id);
    expect(error).toBeNull();
    expect(excelError).toBeNull();
    expect(excel).toBe(1);
    expect(text).toContain('solo lectura');
    expect(text).toContain('Preconcentración (Pz1-Pz7)');
  }, 30000);

  it('dinámico encadenado: abre la cadena con la etapa anterior', async () => {
    const { error, text } = await renderAndWalk(fx(dynEncalado).id);
    expect(error).toBeNull();
    expect(text).toContain('Planta de Reactivos (Pz8-Pz9)');
  }, 30000);

  it('una ejecución que no existe muestra el aviso, no se cae', async () => {
    const { error, text } = await renderAndWalk('no-existe');
    expect(error).toBeNull();
    expect(text).toContain('Ejecución no encontrada');
  }, 30000);
});

describe('sección del proyecto', () => {
  const renderSection = (projectId: string) =>
    render(
      <LanguageProvider>
        <MemoryRouter>
          <LegacyExecutionsSection projectId={projectId} projectName="P" isAdmin={false} />
        </MemoryRouter>
      </LanguageProvider>,
    );

  it('lista las ejecuciones anteriores del proyecto', async () => {
    renderSection('p-1');
    await waitFor(() => expect(screen.getByText('Ejecuciones anteriores (versión antigua)')).toBeTruthy());
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('no se muestra si el proyecto no tiene', async () => {
    const { container } = renderSection('otro');
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toBe('');
  });
});
