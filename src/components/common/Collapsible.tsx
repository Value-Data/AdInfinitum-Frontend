/**
 * Un bloque que se abre y se cierra: una tarjeta con `<details>/<summary>` nativos.
 *
 * El estado lo lleva React (`open` controlado): el clic en el título se intercepta para
 * que abrir/cerrar sea igual en todos los navegadores y en los tests. Si el navegador lo
 * abre solo (buscar en la página), `onToggle` lo sincroniza. Con `storageKey` recuerda
 * si quedó abierto en localStorage; si el almacenamiento no está disponible, se ignora.
 */
import React, { useEffect, useState } from 'react';

const PREFIJO = 'adinf.collapse.';

function leer(storageKey: string | undefined, porDefecto: boolean): boolean {
  if (!storageKey) return porDefecto;
  try {
    const v = localStorage.getItem(PREFIJO + storageKey);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // sin almacenamiento (modo privado, cuota): vale el de por defecto
  }
  return porDefecto;
}

function guardar(storageKey: string | undefined, abierto: boolean) {
  if (!storageKey) return;
  try {
    localStorage.setItem(PREFIJO + storageKey, abierto ? '1' : '0');
  } catch {
    // ídem: no recordar no rompe nada
  }
}

interface Props {
  title: React.ReactNode;
  /** Texto corto a la derecha del título, visible también cerrado ("12 especies · 3 ≠ 1"). */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  /** Clave para recordar abierto/cerrado; sin ella no se recuerda. */
  storageKey?: string;
  /** Cuando pasa a verdadero se abre (p. ej. hay errores de validación adentro). */
  forceOpen?: boolean;
  testId?: string;
  children: React.ReactNode;
}

export default function Collapsible({
  title, summary, defaultOpen = true, storageKey, forceOpen, testId, children,
}: Props) {
  const [abierto, setAbierto] = useState(() => leer(storageKey, defaultOpen));
  useEffect(() => { if (forceOpen) setAbierto(true); }, [forceOpen]);

  return (
    <details className="card mb-4" open={abierto} data-testid={testId}
             onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary
        className="flex items-center gap-2 p-3 cursor-pointer select-none list-none rounded
                   [&::-webkit-details-marker]:hidden hover:bg-primary-lighter
                   focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2
                   focus-visible:outline-primary"
        onClick={(e) => {
          e.preventDefault();
          setAbierto(!abierto);
          guardar(storageKey, !abierto);
        }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
             className={`h-4 w-4 shrink-0 text-text-secondary transition-transform duration-150 ease-out
                         motion-reduce:transition-none ${abierto ? 'rotate-90' : ''}`}>
          <path fillRule="evenodd" clipRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" />
        </svg>
        <span className="font-semibold text-sm">{title}</span>
        {summary != null && summary !== false && summary !== '' && (
          <span className="ml-auto pl-3 text-xs text-right text-text-secondary tabular-nums"
                data-testid={testId ? `${testId}-summary` : undefined}>
            {summary}
          </span>
        )}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
