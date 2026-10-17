/** Paginación en el cliente para listas largas (ejecuciones, ejecuciones antiguas). */
import React from 'react';

export const PAGE_SIZE = 20;

export function pageSlice<T>(items: T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { items: items.slice(p * size, p * size + size), page: p, pages };
}

export function Pager({ page, pages, total, size = PAGE_SIZE, onPage }: {
  page: number; pages: number; total: number; size?: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const desde = page * size;
  return (
    <div className="flex items-center justify-end gap-2 text-sm px-3 py-2" data-testid="pager">
      <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)}>‹</button>
      <span className="font-mono">{desde + 1}–{Math.min(desde + size, total)} / {total}</span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}
