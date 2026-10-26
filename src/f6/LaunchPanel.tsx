/**
 * Lanzar una ejecución de F4 (los siete tipos). La pantalla solo arma el pedido; las
 * reglas las aplica el backend al lanzar y sus errores (`code` + mensaje) se muestran
 * tal cual. Acá se filtra lo que se ofrece para elegir: el origen es una ejecución de
 * la etapa anterior con resultados; una continuación es una ejecución del mismo tipo y
 * un día hasta su último día completo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  apiError, EXECUTION_TYPES_V2, getSection, isDynamicType, launchExecution, SOURCE_OF,
  type ApiError, type ExecutionSummary, type ExecutionTypeV2, type LaunchRequest, type SectionState,
} from '../services/apiV2';
import { useT } from '../i18n/LanguageContext';
import { executionTypeLabel, formatDateTime } from './common';
import { InventoryBadge } from './ConfigPanel';

const RUN_TAG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

/** Etapas que usa cada tipo (como `SECTIONS_OF` de `app/services/execution_v2.py`). */
const STAGES_OF: Record<ExecutionTypeV2, string[]> = {
  static_full: ['precon', 'liming', 'postliming'], static_precon: ['precon'],
  static_liming: ['liming'], static_postliming: ['postliming'],
  dynamic_precon: ['precon'], dynamic_liming: ['liming'], dynamic_postliming: ['postliming'],
};

/** Si el proyecto tiene guardadas las secciones que usa el tipo (sin ellas el backend no lo lanza). */
export function typeConfigured(tipo: ExecutionTypeV2, secciones: SectionState[]): boolean {
  const motor = isDynamicType(tipo) ? 'dynamic' : 'static';
  return STAGES_OF[tipo].every((st) => Boolean(secciones.find((s) => s.kind === `${st}_${motor}`)?.latest_version_no));
}

/** El tipo que se ofrece primero: el primero que el proyecto puede correr (si ninguno, el de siempre). */
export function defaultLaunchType(secciones: SectionState[]): ExecutionTypeV2 {
  return EXECUTION_TYPES_V2.find((x) => typeConfigured(x, secciones)) ?? 'static_full';
}

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

/** La sección de la que una etapa encadenable toma su alimentación (planta o concentración). */
function feedSourceOf(tipo: ExecutionTypeV2, secciones: SectionState[]): SectionState['feed_source'] | undefined {
  const m = tipo.match(/^(static|dynamic)_(liming|postliming)$/);
  if (!m) return undefined;
  return secciones.find((s) => s.kind === `${m[2]}_${m[1]}`)?.feed_source;
}

/**
 * La planta o la concentración del dinámico alimentadas con los datos de su sección
 * (punto 7): no llevan origen y tienen sus propias fechas, como la precon.
 */
export function dynamicFromData(tipo: ExecutionTypeV2, secciones: SectionState[]): boolean {
  return (tipo === 'dynamic_liming' || tipo === 'dynamic_postliming') && feedSourceOf(tipo, secciones) === 'data';
}

/** Si el tipo se alimenta de una ejecución anterior, según la sección guardada. */
export function needsSource(tipo: ExecutionTypeV2, secciones: SectionState[]): boolean {
  // Del dinámico, sin sección guardada (o sin decir de dónde) se pide el origen, como siempre.
  if (tipo === 'dynamic_liming' || tipo === 'dynamic_postliming') return !dynamicFromData(tipo, secciones);
  if (tipo === 'static_liming' || tipo === 'static_postliming') {
    return feedSourceOf(tipo, secciones) === 'execution';
  }
  return false;
}

/** Si la corrida lleva su fecha de inicio (la precon y las etapas con datos, salvo una continuación). */
export function takesStartDate(tipo: ExecutionTypeV2, continuar: string, secciones: SectionState[]): boolean {
  return !continuar && (tipo === 'dynamic_precon' || dynamicFromData(tipo, secciones));
}

/** Si la corrida lleva sus días: obligatorios en la precon y con datos; opcionales en la
 * concentración alimentada por una ejecución (hasta los de su origen). */
export function takesNDays(tipo: ExecutionTypeV2, secciones: SectionState[]): 'required' | 'optional' | null {
  if (tipo === 'dynamic_precon' || dynamicFromData(tipo, secciones)) return 'required';
  return tipo === 'dynamic_postliming' ? 'optional' : null;
}

/** El mensaje de un error al lanzar, con su código y el campo si lo trae (`horizon`: la serie que no alcanza). */
export function launchErrorText(e: ApiError): string {
  const campo = typeof e.extra.field === 'string' && !e.message.includes(e.extra.field) ? ` · ${e.extra.field}` : '';
  return e.code ? `${e.message}${campo} (${e.code})` : `${e.message}${campo}`;
}

/**
 * Pozas que arrancan cargadas con el estado inicial de la sección (corrida con
 * inventario): solo en las cascadas del dinámico y si no se continúa otra ejecución
 * (una continuación toma el estado de esa ejecución). 0 = arrancan vacías.
 */
export function inventoryPonds(tipo: ExecutionTypeV2, continuar: string, secciones: SectionState[]): number {
  if (continuar) return 0;
  const kind = tipo === 'dynamic_precon' ? 'precon_dynamic'
    : tipo === 'dynamic_postliming' ? 'postliming_dynamic' : null;
  return kind ? (secciones.find((s) => s.kind === kind)?.n_initial_states ?? 0) : 0;
}

export function buildLaunchRequest(f: {
  tipo: ExecutionTypeV2; runTag: string; source: string; continuar: string; dia: string;
  inicio: string; dias: string; reintento: boolean; timeout: string; escenarios?: number[];
}, secciones: SectionState[]): LaunchRequest {
  const req: LaunchRequest = { execution_type: f.tipo, run_tag: f.runTag || 'baseline' };
  if (needsSource(f.tipo, secciones) && f.source) req.source_execution_id = f.source;
  if (f.continuar) {
    req.initial_state_execution_id = f.continuar;
    req.initial_state_day = Number(f.dia);
  }
  if (takesStartDate(f.tipo, f.continuar, secciones) && f.inicio) req.start_date = f.inicio;
  if (takesNDays(f.tipo, secciones) && f.dias) req.n_days = Number(f.dias);
  if (f.escenarios && f.escenarios.length) req.selected_scenarios = [...f.escenarios].sort((a, b) => a - b);
  if (isDynamicType(f.tipo)) {
    req.temperature_retry = f.reintento;
    if (f.timeout) req.dll_timeout_s = Number(f.timeout);
  }
  return req;
}

export default function LaunchPanel({
  projectId, executions, sections, sectionsLoaded = true, onLaunched,
}: {
  projectId: string;
  executions: ExecutionSummary[];
  sections: SectionState[];
  /** Si ya llegaron las secciones: antes (o si fallaron) no se marca ningún tipo como sin configurar. */
  sectionsLoaded?: boolean;
  onLaunched: (e: ExecutionSummary) => void;
}) {
  const t = useT();
  // Hasta que el usuario elige, el tipo sigue a las secciones (llegan después del panel).
  const [tipoElegido, setTipo] = useState<ExecutionTypeV2 | null>(null);
  const tipo = tipoElegido ?? defaultLaunchType(sections);
  const [runTag, setRunTag] = useState('baseline');
  const [source, setSource] = useState('');
  const [continuar, setContinuar] = useState('');
  const [dia, setDia] = useState('');
  const [inicio, setInicio] = useState('');
  const [dias, setDias] = useState('');
  const [reintento, setReintento] = useState(false);
  const [timeout, setTimeoutS] = useState('300');
  // Escenarios de la precon del estático, para correr solo algunos (vacío = todos).
  const [escenariosPrecon, setEscenariosPrecon] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<number[]>([]);
  // Sin precon del estático guardada no hay escenarios que pedir (el pedido daba 404).
  const conPrecon = typeConfigured('static_precon', sections);
  useEffect(() => {
    if ((tipo !== 'static_full' && tipo !== 'static_precon') || !conPrecon) { setEscenariosPrecon([]); return; }
    getSection(projectId, 'precon_static').then((s) => {
      const filas = ((s?.data as unknown as { scenarios?: { label: string }[] })?.scenarios) ?? [];
      setEscenariosPrecon(filas.map((f) => f.label));
    }).catch(() => setEscenariosPrecon([]));
  }, [tipo, projectId, conPrecon]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origenes = useMemo(() => sourceCandidates(tipo, executions), [tipo, executions]);
  const continuaciones = useMemo(() => continuationCandidates(tipo, executions), [tipo, executions]);
  const elegidaContinuacion = continuaciones.find((e) => e.id === continuar);
  const pideOrigen = needsSource(tipo, sections);
  const pideInicio = takesStartDate(tipo, continuar, sections);
  const pideDias = takesNDays(tipo, sections);
  const dinamico = isDynamicType(tipo);
  const conInventario = inventoryPonds(tipo, continuar, sections);

  const cambiarTipo = (nuevo: ExecutionTypeV2) => {
    setTipo(nuevo);
    setSource('');
    setContinuar('');
    setDia('');
    // Los escenarios elegidos son de la precon estática: no viajan a otro tipo.
    setElegidos([]);
    setError(null);
  };

  const lanzar = async () => {
    if (!RUN_TAG.test(runTag)) { setError(t('f6_run_tag_invalid')); return; }
    setEnviando(true);
    setError(null);
    try {
      const e = await launchExecution(projectId, buildLaunchRequest(
        { tipo, runTag, source, continuar, dia, inicio, dias, reintento, timeout, escenarios: elegidos }, sections));
      onLaunched(e);
    } catch (err) {
      setError(launchErrorText(apiError(err)));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card p-4 mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-base font-semibold">{t('f6_launch_title')}</h3>
        {conInventario > 0 && <InventoryBadge n={conInventario} />}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        <label className="text-sm">
          <span className="label">{t('f6_execution_type')}</span>
          <select className="input" value={tipo} data-testid="launch-type"
                  onChange={(e) => cambiarTipo(e.target.value as ExecutionTypeV2)}>
            {EXECUTION_TYPES_V2.map((x) => (
              <option key={x} value={x}>
                {executionTypeLabel(x, t)}
                {sectionsLoaded && !typeConfigured(x, sections) ? ` · ${t('f6_section_empty').toLowerCase()}` : ''}
              </option>
            ))}
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
        {pideInicio && (
          <label className="text-sm">
            <span className="label">{t('f6_start_date')}</span>
            <input type="date" className="input" value={inicio} data-testid="launch-start"
                   onChange={(e) => setInicio(e.target.value)} />
          </label>
        )}
        {pideDias && (
          <label className="text-sm">
            <span className="label">{t('f6_n_days')}{pideDias === 'optional' ? ` (${t('f6_optional')})` : ''}</span>
            <input type="number" className="input" min={1} value={dias} data-testid="launch-days"
                   onChange={(e) => setDias(e.target.value)} />
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
      {escenariosPrecon.length > 1 && (
        <div className="mt-3 text-sm" data-testid="launch-scenarios">
          <span className="label">{t('f6_scenarios_to_run')}</span>
          <div className="flex flex-wrap gap-3">
            {escenariosPrecon.map((nombre, i) => (
              <label key={i} className="flex items-center gap-1">
                <input type="checkbox" checked={elegidos.includes(i + 1)}
                       onChange={(e) => setElegidos(e.target.checked ? [...elegidos, i + 1]
                         : elegidos.filter((p) => p !== i + 1))} />
                {nombre}
              </label>
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_scenarios_all_hint')}</span>
        </div>
      )}
      {error && <p className="text-sm mt-3" style={{ color: 'var(--color-danger-text)' }} data-testid="launch-error">{error}</p>}
      <div className="flex justify-end mt-3">
        <button className="btn btn-primary" onClick={lanzar} disabled={enviando}>
          {t('f6_launch')}
        </button>
      </div>
    </div>
  );
}
