/** Piezas chicas compartidas por las pantallas de F6. */
import React from 'react';
import type { TranslationKey } from '../i18n/translations';
import { useT } from '../i18n/LanguageContext';

const ESTILOS: Record<string, React.CSSProperties> = {
  pending: { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' },
  running: { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
  completed: { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#86efac' },
  completed_with_errors: { backgroundColor: '#fef9c3', color: '#854d0e', borderColor: '#fde047' },
  failed: { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
  cancelled: { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' },
};

/** Los seis estados de una ejecución de F4. */
export function RunStatusBadge({ status }: { status: string }) {
  const t = useT();
  const clave = `f6_status_${status}` as TranslationKey;
  let texto: string = status;
  try {
    const v = t(clave);
    if (v && v !== clave) texto = v;
  } catch {
    // estado desconocido: se muestra tal cual
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border"
          style={ESTILOS[status] ?? ESTILOS.pending} data-testid="run-status">
      {texto}
    </span>
  );
}

export function executionTypeLabel(tipo: string, t: (k: TranslationKey) => string): string {
  const clave = `f6_type_${tipo}` as TranslationKey;
  const v = t(clave);
  return v && v !== clave ? v : tipo;
}

/** "2024-01-23" → "23-01-2024". */
export function dmy(iso: unknown): string {
  const m = typeof iso === 'string' ? iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso ?? '');
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '–';
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : `${s}Z`);
  return d.toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit' });
}
