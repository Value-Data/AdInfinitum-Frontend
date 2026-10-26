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

/**
 * Cuánto tardó (o lleva) una corrida: "1 h 05 min", "3 min 20 s". Las fechas del
 * backend vienen en UTC sin zona: se les agrega la Z.
 */
export function duration(desde?: string | null, hasta?: string | null, ahora = Date.now()): string {
  if (!desde) return '–';
  const t0 = Date.parse(desde.endsWith('Z') || desde.includes('+') ? desde : `${desde}Z`);
  const t1 = hasta ? Date.parse(hasta.endsWith('Z') || hasta.includes('+') ? hasta : `${hasta}Z`) : ahora;
  const s = Math.max(0, Math.round((t1 - t0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}

/** Lo que trae una ejecución sobre su avance (lista, detalle o estado). */
export interface ProgressSource {
  execution_type: string; status: string;
  n_days?: number | null; last_completed_day?: number | null; progress_day?: number | null;
  scenarios_total?: number | null; scenarios_done?: number | null;
}

/**
 * Avance de una corrida `running` (cambios finales, punto 2), o null si no aplica.
 * - Dinámico: `current` = día en curso (`progress_day`) de `n_days`.
 * - Estático: `scenarios_done` cuenta los escenarios terminados; `current` es el que
 *   va (terminados + 1, sin pasarse del total), igual que "día X" es el día en curso.
 * `done`/`total` son para la barra.
 */
export interface RunProgress { unit: 'days' | 'scenarios'; current: number; done: number; total: number }

export function runProgress(e: ProgressSource): RunProgress | null {
  if (e.status !== 'running') return null;
  if (e.execution_type.startsWith('dynamic_')) {
    if (!e.n_days) return null;
    const dia = Math.max(0, Math.min(e.progress_day ?? 0, e.n_days));
    return { unit: 'days', current: dia, done: dia, total: e.n_days };
  }
  if (!e.scenarios_total) return null;
  const hechos = Math.max(0, Math.min(e.scenarios_done ?? 0, e.scenarios_total));
  return { unit: 'scenarios', current: Math.min(hechos + 1, e.scenarios_total), done: hechos, total: e.scenarios_total };
}

/** "día 120 de 365" / "escenario 2 de 4". */
export function runProgressLabel(p: RunProgress, t: (k: TranslationKey) => string): string {
  return t(p.unit === 'days' ? 'f9_progress_day' : 'f9_progress_scenario')
    .replace('{x}', String(p.current)).replace('{n}', String(p.total));
}

/**
 * La celda de avance de la lista de ejecuciones: en cola, "día X de N" o
 * "escenario k de n" mientras corre y, al terminar, los días completos como siempre.
 */
export function progressText(e: ProgressSource, t: (k: TranslationKey) => string): string {
  if (e.status === 'pending') return t('f9_progress_waiting');
  const p = runProgress(e);
  if (p) return runProgressLabel(p, t);
  return e.n_days != null ? `${e.last_completed_day ?? 0}/${e.n_days}` : '–';
}

const ESTILO_SIN_LATIDO: React.CSSProperties = {
  backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)', color: 'var(--color-text)',
};

/** Insignia de la fila de la lista: corriendo sin latido del trabajador (punto 13). */
export function StaleHeartbeatBadge() {
  const t = useT();
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border"
          style={ESTILO_SIN_LATIDO} data-testid="heartbeat-badge"
          title={`${t('f9_heartbeat_stale_title')} ${t('f9_heartbeat_stale_body')}`}>
      {t('f9_heartbeat_badge')}
    </span>
  );
}

/**
 * Cuánto pasó, en minutos enteros: "20 min", "1 h 05 min". Para lo que se refresca con
 * cada consulta y no tiene por qué cambiar cada pocos segundos.
 */
export function elapsedMinutes(desde: string, ahora = Date.now()): string {
  const t0 = Date.parse(desde.endsWith('Z') || desde.includes('+') ? desde : `${desde}Z`);
  const min = Math.max(0, Math.floor((ahora - t0) / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : min < 1 ? '< 1 min' : `${m} min`;
}

/**
 * Aviso de la página de la ejecución: el backend la marca `heartbeat_stale` cuando
 * sigue `running` pero el trabajador lleva más de 15 min sin latir. `heartbeatAt`
 * (de `/status`) da el "hace cuánto"; sin él no se dice nada del tiempo.
 *
 * Solo el aviso es `role="alert"`, con un texto que no cambia: el lector de pantalla lo
 * anuncia una vez. El "hace cuánto" va fuera de esa región, en minutos, para que la
 * consulta de cada 5 s no lo vuelva a anunciar.
 */
export function StaleHeartbeatBanner({ stale, heartbeatAt, now }: {
  stale: boolean; heartbeatAt?: string | null; now?: number;
}) {
  const t = useT();
  if (!stale) return null;
  const cuando = heartbeatAt === undefined ? ''
    : heartbeatAt === null ? t('f9_heartbeat_never')
      : t('f9_heartbeat_ago').replace('{t}', elapsedMinutes(heartbeatAt, now));
  return (
    <div className="card p-3 mb-4 text-sm" data-testid="heartbeat-banner"
         style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
      <span role="alert">
        <strong>{t('f9_heartbeat_stale_title')}</strong> {t('f9_heartbeat_stale_body')}
      </span>
      {cuando && <span data-testid="heartbeat-ago"> {cuando}</span>}
    </div>
  );
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
