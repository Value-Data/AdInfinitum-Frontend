/* Arnés para renderizar la página de una ejecución de la versión anterior con la API
   falsa: `fakeGet` responde los endpoints de `/legacy-executions` desde `store`.

   Cada archivo de test hace:
     vi.mock('../../src/services/api', async () =>
       ({ default: { get: (await import('./legacyHarness')).fakeGet } }));
*/
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import { DecimalsProvider } from '../../src/context/DecimalsContext';
import type { LegacyExecutionDetail } from '../../src/legacy/apiTypes';

export const store = new Map<string, LegacyExecutionDetail>();

export async function fakeGet(url: string): Promise<{ data: unknown }> {
  const m = url.match(/^\/legacy-executions\/([^/]+)(\/files)?(\/.*)?$/);
  if (m) {
    const exec = store.get(decodeURIComponent(m[1]));
    if (!exec) throw Object.assign(new Error('404'), { response: { status: 404 } });
    if (m[3]) return { data: new Blob(['x']) };
    if (m[2]) {
      const files = (exec.results as { files?: { name: string; size_bytes: number }[] } | null)?.files;
      return { data: Array.isArray(files) ? files : [] };
    }
    return { data: exec };
  }
  const p = url.match(/^\/projects\/([^/]+)\/legacy-executions$/);
  if (p) return { data: [...store.values()].filter((e) => e.project_id === p[1]) };
  throw Object.assign(new Error(`sin mock: ${url}`), { response: { status: 404 } });
}

// recharts mide con ResizeObserver, que jsdom no trae.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;

// Las descargas (Excel) terminan en URL.createObjectURL: se cuentan los Blob creados.
export const blobs: Blob[] = [];
URL.createObjectURL = ((b: Blob) => {
  blobs.push(b);
  return 'blob:test';
}) as typeof URL.createObjectURL;
URL.revokeObjectURL = () => {};
// El click del <a download> navegaría (jsdom no lo implementa).
HTMLAnchorElement.prototype.click = function click() {};

class Boundary extends React.Component<
  { onError: (e: Error) => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? <div data-testid="render-crash" /> : this.props.children;
  }
}

/** Renderiza `/legacy-executions/:id`, recorre todas sus pestañas (y la cadena, si
 *  hay) y devuelve el primer error de render, o null. */
export async function renderAndWalk(
  id: string,
): Promise<{ error: Error | null; text: string; excel: number; excelError: Error | null }> {
  const { default: LegacyExecutionPage } = await import('../../src/legacy/LegacyExecutionPage');
  let error: Error | null = null;
  let excelError: Error | null = null;
  let excel = 0;
  const onError = (e: Error) => {
    error ??= e;
  };
  const view = render(
    <LanguageProvider>
      <DecimalsProvider>
        <MemoryRouter initialEntries={[`/legacy-executions/${id}`]}>
          <Boundary onError={onError}>
            <Routes>
              <Route path="/legacy-executions/:id" element={<LegacyExecutionPage />} />
            </Routes>
          </Boundary>
        </MemoryRouter>
      </DecimalsProvider>
    </LanguageProvider>,
  );
  try {
    await waitFor(
      () => {
        if (error) return;
        expect(screen.getByTestId('legacy-banner')).toBeTruthy();
        expect(document.querySelector('.animate-spin')).toBeNull();
      },
      { timeout: 10000 },
    );
    const clickAll = async () => {
      const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-legacy-tab]'));
      for (const b of tabs) {
        if (error) return;
        await act(async () => {
          fireEvent.click(b);
        });
      }
    };
    // Descarga a Excel de la pantalla (la de antes): los errores de un onClick no
    // pasan por el boundary, llegan como evento `error` de la ventana.
    const antes = blobs.length;
    const onWinError = (ev: ErrorEvent) => {
      excelError ??= ev.error ?? new Error(ev.message);
      ev.preventDefault();
    };
    window.addEventListener('error', onWinError);
    for (const b of screen.queryAllByRole('button').filter((x) => x.textContent?.includes('Descargar Excel'))) {
      await act(async () => {
        fireEvent.click(b);
      });
    }
    window.removeEventListener('error', onWinError);
    excel = blobs.length - antes;
    await clickAll();
    const cadena = screen.queryAllByRole('button').find((b) => b.textContent === 'Cadena');
    if (cadena && !error) {
      await act(async () => {
        fireEvent.click(cadena);
      });
      await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull(), { timeout: 10000 });
      await clickAll();
    }
  } catch (e) {
    error ??= e as Error;
  }
  const text = view.container.textContent ?? '';
  view.unmount();
  return { error, text, excel, excelError };
}
