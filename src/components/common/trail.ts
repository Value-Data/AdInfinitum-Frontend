/**
 * La miga de pan con nombres: cada página declara el camino de su ruta (proyecto,
 * ejecución, sección) y la barra superior lo muestra en vez de los UUID.
 */
import { useEffect, useSyncExternalStore } from 'react';

export interface TrailItem { label: string; path?: string }

let actual: { path: string; items: TrailItem[] } | null = null;
const oyentes = new Set<() => void>();

export function setTrail(path: string, items: TrailItem[]): void {
  actual = { path, items };
  oyentes.forEach((f) => f());
}

export function useTrail(path: string): TrailItem[] | null {
  const v = useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => actual);
  return v && v.path === path ? v.items : null;
}

/** Declara el camino de la página mientras está montada (se ignora si falta un nombre). */
export function usePageTrail(path: string, items: (TrailItem | null)[]): void {
  const listo = items.every(Boolean);
  const clave = JSON.stringify(items);
  useEffect(() => {
    if (listo) setTrail(path, items as TrailItem[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, clave, listo]);
}
