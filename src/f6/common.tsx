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
  // Ejecuciones de la versión anterior que quedaron a medias.
  interrupted: { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' },
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

/** Lo que resolvió una ejecución que no terminó bien, o null si no hay nada parcial. */
export interface PartialInfo { unit: 'days' | 'scenarios'; done: number; total: number | null }

export function partialInfo(d: {
  execution_type: string; status: string; last_completed_day?: number | null; n_days?: number | null;
  scenarios?: { status?: unknown }[]; selected_scenarios?: number[];
}): PartialInfo | null {
  if (d.status === 'pending' || d.status === 'running' || d.status === 'completed') return null;
  if (d.execution_type.startsWith('dynamic_')) {
    const hechos = d.last_completed_day ?? 0;
    const total = d.n_days ?? null;
    return hechos >= 1 && (total === null || hechos < total) ? { unit: 'days', done: hechos, total } : null;
  }
  const escenarios = d.scenarios ?? [];
  if (escenarios.length === 0) return null;
  const ok = escenarios.filter((s) => s.status !== 'failed').length;
  const total = Math.max(escenarios.length, d.selected_scenarios?.length ?? 0);
  return ok >= 1 && ok < total ? { unit: 'scenarios', done: ok, total } : null;
}

/**
 * Aviso de corrida cortada, bien visible a propósito: leer un promedio de 137 de 1460
 * días como si fuera la corrida entera es peor que no mostrar nada.
 */
export function PartialRunBanner({ info }: { info: PartialInfo | null }) {
  const t = useT();
  if (!info) return null;
  const cuerpo = info.unit === 'days'
    ? `${t('f6_partial_days_pre')} 1–${info.done}${info.total ? ` ${t('f6_partial_of')} ${info.total}` : ''}. ${t('f6_partial_days_body')}`
    : `${info.done} ${t('f6_partial_of')} ${info.total} ${t('f6_partial_scenarios_body')}`;
  return (
    <div className="card p-3 mb-4 text-sm pdf-block" role="alert" data-testid="partial-banner"
         style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
      <strong>{t('f6_partial_title')}</strong> {cuerpo}
    </div>
  );
}
