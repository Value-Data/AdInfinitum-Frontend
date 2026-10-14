/**
 * Lanzar una ejecución de F4 (los siete tipos). La pantalla solo arma el pedido; las
 * reglas las aplica el backend al lanzar y sus errores (`code` + mensaje) se muestran
 * tal cual. Acá se filtra lo que se ofrece para elegir: el origen es una ejecución de
 * la etapa anterior con resultados; una continuación es una ejecución del mismo tipo y
 * un día hasta su último día completo.
 */
import React, { useMemo, useState } from 'react';
import {
  apiError, EXECUTION_TYPES_V2, isDynamicType, launchExecution, SOURCE_OF,
  type ExecutionSummary, type ExecutionTypeV2, type LaunchRequest, type SectionState,
} from '../services/apiV2';
import { useT } from '../i18n/LanguageContext';
import { executionTypeLabel, formatDateTime } from './common';

const RUN_TAG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

/** Ejecuciones que pueden alimentar a `tipo`: la etapa anterior, terminada y con resultados. */
export function sourceCandidates(tipo: ExecutionTypeV2, ejecuciones: ExecutionSummary[]): ExecutionSummary[] {
  const anterior = SOURCE_OF[tipo];
  if (!anterior) return [];
  return ejecuciones.filter((e) => e.execution_type === anterior && (
    isDynamicType(anterior)
      ? e.status === 'completed' && e.upload_status === 'uploaded'
      : e.status === 'completed' || e.status === 'completed_with_errors'));
}

/** Ejecuciones desde cuyo estado se puede continuar: mismo tipo, con días completos guardados. */
export function continuationCandidates(tipo: ExecutionTypeV2, ejecuciones: ExecutionSummary[]): ExecutionSummary[] {
  if (tipo !== 'dynamic_precon' && tipo !== 'dynamic_postliming') return [];
  return ejecuciones.filter((e) => e.execution_type === tipo && (e.last_completed_day ?? 0) >= 1
    && e.upload_status === 'uploaded');
}

/** Si el tipo se alimenta de una ejecución anterior, según la sección guardada. */
export function needsSource(tipo: ExecutionTypeV2, secciones: SectionState[]): boolean {
  if (tipo === 'dynamic_liming' || tipo === 'dynamic_postliming') return true;
  if (tipo === 'static_liming' || tipo === 'static_postliming') {
    const kind = `${tipo.replace('static_', '')}_static`;
    return secciones.find((s) => s.kind === kind)?.feed_source === 'execution';
  }
  return false;
}

export function buildLaunchRequest(f: {
  tipo: ExecutionTypeV2; runTag: string; source: string; continuar: string; dia: string;
  inicio: string; dias: string; reintento: boolean; timeout: string;
}, secciones: SectionState[]): LaunchRequest {
  const req: LaunchRequest = { execution_type: f.tipo, run_tag: f.runTag || 'baseline' };
  if (needsSource(f.tipo, secciones) && f.source) req.source_execution_id = f.source;
  if (f.continuar) {
    req.initial_state_execution_id = f.continuar;
    req.initial_state_day = Number(f.dia);
  }
  if (f.tipo === 'dynamic_precon' && !f.continuar && f.inicio) req.start_date = f.inicio;
  if ((f.tipo === 'dynamic_precon' || f.tipo === 'dynamic_postliming') && f.dias) {
    req.n_days = Number(f.dias);
  }
  if (isDynamicType(f.tipo)) {
    req.temperature_retry = f.reintento;
    if (f.timeout) req.dll_timeout_s = Number(f.timeout);
  }
  return req;
}

export default function LaunchPanel({
  projectId, executions, sections, onLaunched,
}: {
  projectId: string;
  executions: ExecutionSummary[];
  sections: SectionState[];
  onLaunched: (e: ExecutionSummary) => void;
}) {
  const t = useT();
  const [tipo, setTipo] = useState<ExecutionTypeV2>('static_full');
  const [runTag, setRunTag] = useState('baseline');
  const [source, setSource] = useState('');
  const [continuar, setContinuar] = useState('');
  const [dia, setDia] = useState('');
  const [inicio, setInicio] = useState('');
  const [dias, setDias] = useState('');
  const [reintento, setReintento] = useState(false);
  const [timeout, setTimeoutS] = useState('300');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origenes = useMemo(() => sourceCandidates(tipo, executions), [tipo, executions]);
  const continuaciones = useMemo(() => continuationCandidates(tipo, executions), [tipo, executions]);
  const elegidaContinuacion = continuaciones.find((e) => e.id === continuar);
  const pideOrigen = needsSource(tipo, sections);
  const dinamico = isDynamicType(tipo);

  const cambiarTipo = (nuevo: ExecutionTypeV2) => {
    setTipo(nuevo);
    setSource('');
    setContinuar('');
    setDia('');
    setError(null);
  };

  const lanzar = async () => {
    if (!RUN_TAG.test(runTag)) { setError(t('f6_run_tag_invalid')); return; }
    setEnviando(true);
    setError(null);
    try {
      const e = await launchExecution(projectId, buildLaunchRequest(
        { tipo, runTag, source, continuar, dia, inicio, dias, reintento, timeout }, sections));
      onLaunched(e);
    } catch (err) {
      const e = apiError(err);
      setError(e.code ? `${e.message} (${e.code})` : e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card p-4 mb-4">
      <h3 className="text-base font-semibold mb-3">{t('f6_launch_title')}</h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        <label className="text-sm">
          <span className="label">{t('f6_execution_type')}</span>
          <select className="input" value={tipo} data-testid="launch-type"
                  onChange={(e) => cambiarTipo(e.target.value as ExecutionTypeV2)}>
            {EXECUTION_TYPES_V2.map((x) => <option key={x} value={x}>{executionTypeLabel(x, t)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">{t('f6_run_tag')}</span>
          <input className="input" value={runTag} onChange={(e) => setRunTag(e.target.value)} />
        </label>
        {pideOrigen && (
          <label className="text-sm">
            <span className="label">{t('f6_source')}</span>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}
                    data-testid="launch-source">
              <option value="">{origenes.length ? t('f6_choose') : t('f6_no_sources')}</option>
              {origenes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.run_tag} · {formatDateTime(e.created_at)} · {e.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
        {continuaciones.length > 0 && (
          <label className="text-sm">
            <span className="label">{t('f6_continue_from')}</span>
            <select className="input" value={continuar} onChange={(e) => { setContinuar(e.target.value); setDia(''); }}>
              <option value="">{t('f6_no_continuation')}</option>
              {continuaciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.run_tag} · {e.last_completed_day} {t('f6_days')} · {e.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
        {elegidaContinuacion && (
          <label className="text-sm">
            <span className="label">{t('f6_continue_day')}</span>
            <input type="number" className="input" min={1} max={elegidaContinuacion.last_completed_day ?? 1}
                   value={dia} onChange={(e) => setDia(e.target.value)} />
          </label>
        )}
        {tipo === 'dynamic_precon' && !continuar && (
          <label className="text-sm">
            <span className="label">{t('f6_start_date')}</span>
            <input type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
        )}
        {(tipo === 'dynamic_precon' || tipo === 'dynamic_postliming') && (
          <label className="text-sm">
            <span className="label">{t('f6_n_days')}{tipo === 'dynamic_postliming' ? ` (${t('f6_optional')})` : ''}</span>
            <input type="number" className="input" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />
          </label>
        )}
        {dinamico && (
          <>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input type="checkbox" checked={reintento} onChange={(e) => setReintento(e.target.checked)} />
              {t('f6_temperature_retry')}
            </label>
            <label className="text-sm">
              <span className="label">{t('f6_dll_timeout')}</span>
              <input type="number" className="input" min={1} value={timeout}
                     onChange={(e) => setTimeoutS(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {error && <p className="text-sm mt-3" style={{ color: '#b91c1c' }} data-testid="launch-error">{error}</p>}
      <div className="flex justify-end mt-3">
        <button className="btn btn-primary" onClick={lanzar} disabled={enviando}>
          {t('f6_launch')}
        </button>
      </div>
    </div>
  );
}
