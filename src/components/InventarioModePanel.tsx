import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Execution,
  ExecutionFile,
  InventarioConfig,
  InventarioEscenario,
  InventarioResultsWithPartial,
} from '../types';
import {
  createExecution,
  getExecution,
  getExecutions,
  getInventarioEscenarioExpandido,
  getInventarioEscenarios,
  getProject,
  getProjectConfig,
  listExecutionFiles,
  updateProjectConfig,
} from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import StatusBadge from './common/StatusBadge';
import InventarioConfigEditor from './InventarioConfigEditor';
import InventarioResultsView from './InventarioResultsView';
import { useT } from '../i18n/LanguageContext';
import {
  downloadInventarioExcel,
  parseInventarioWorkbookFile,
} from '../utils/inventarioConfigExcel';

/**
 * Panel del modo con inventario — el tercero, al lado del estático y el dinámico.
 *
 * Misma estructura que `DynamicModePanel`: pestañas Configuración y Ejecuciones,
 * lanzamiento con horizonte y tag, tabla de corridas y vista de resultados.
 *
 * La configuración se edita igual que en los otros modos: pozas que se agregan y
 * se quitan, alimentación, inventario inicial. Lo propio de acá es que se parte de
 * un **escenario** de la entrega —un conjunto ya validado de pozas, feed, clima,
 * factores e inventario— y se lo modifica desde ahí, en vez de armar todo de cero.
 *
 * Elegir otro escenario reemplaza lo editado: es cargar otro punto de partida.
 */

type Tab = 'config' | 'executions';

/** Las tres etapas del modo, en el orden en que se encadenan. */
type EtapaKey = 'inventario_precon' | 'inventario_encalado' | 'inventario_postliming';

/** De qué etapa se alimenta cada una. `null` = arranca la cadena. */
const FUENTE_DE: Record<EtapaKey, EtapaKey | null> = {
  inventario_precon: null,
  inventario_encalado: 'inventario_precon',
  inventario_postliming: 'inventario_encalado',
};

const NOMBRE_ETAPA: Record<EtapaKey, string> = {
  inventario_precon: 'Preconcentración',
  inventario_encalado: 'Encalado',
  inventario_postliming: 'Postliming',
};

interface Props {
  projectId: string;
  isAdmin: boolean;
}

export default function InventarioModePanel({ projectId, isAdmin }: Props) {
  const t = useT();
  const [escenarios, setEscenarios] = useState<InventarioEscenario[]>([]);
  // `config` es lo guardado y `draft` lo que se está editando; `dirty` los compara
  // igual que el panel del dinámico, para no lanzar con cambios sin guardar.
  const [config, setConfig] = useState<InventarioConfig | null>(null);
  const [draft, setDraft] = useState<InventarioConfig | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(isAdmin ? 'config' : 'executions');
  const [nDays, setNDays] = useState<number>(365);
  const [etapa, setEtapa] = useState<EtapaKey>('inventario_precon');
  const [fuenteId, setFuenteId] = useState<string>('');
  const [runTag, setRunTag] = useState<string>('baseline');
  const [projectName, setProjectName] = useState<string>('proyecto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const escenarioActual = escenarios.find((e) => e.path === draft?._path);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  const fetchAll = useCallback(async () => {
    try {
      const [escs, cfg, execs, proj] = await Promise.all([
        getInventarioEscenarios(),
        getProjectConfig(projectId).catch(() => null),
        getExecutions(projectId),
        getProject(projectId).catch(() => null),
      ]);
      setEscenarios(escs);
      // Un proyecto que ya editó su escenario trae los bloques adentro y se usa tal
      // cual. Uno que nunca lo tocó arranca del de referencia, ya expandido: el
      // editor necesita los datos, no las rutas a los archivos del motor.
      const guardadoCfg = (cfg?.inventario_config ?? null) as InventarioConfig | null;
      let inicial = guardadoCfg?.pozas
        ? guardadoCfg
        : await getInventarioEscenarioExpandido(guardadoCfg?._path);
      // Un escenario guardado antes de que el modo tuviera encalado y postliming no
      // trae esos bloques. Se completan con los del escenario expandido en vez de
      // dejar dos secciones vacías: la corrida ya usa esos valores igual.
      if (!inicial.encalado || !inicial.postliming) {
        const base = await getInventarioEscenarioExpandido(inicial._path);
        inicial = {
          ...inicial,
          encalado: inicial.encalado ?? base.encalado,
          postliming: inicial.postliming ?? base.postliming,
        };
      }
      setConfig(guardadoCfg?.pozas ? guardadoCfg : null);
      setDraft(inicial);
      setExecutions(execs);
      if (proj?.name) setProjectName(proj.name);
    } catch (e) {
      setMsg(`${t('error')}: ${String(e)}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Las corridas tardan; mientras haya alguna en curso se refresca la lista sola.
  useEffect(() => {
    const enCurso = executions.some((e) => e.status === 'pending' || e.status === 'running');
    if (!enCurso) return;
    const id = setTimeout(() => {
      getExecutions(projectId).then(setExecutions).catch(() => {});
    }, 4000);
    return () => clearTimeout(id);
  }, [executions, projectId]);

  const handleBajarExcel = () => {
    if (!draft) return;
    const safe = projectName.replace(/[^a-z0-9-_]+/gi, '_');
    downloadInventarioExcel(draft, `escenario_inventario_${safe}.xlsx`);
  };

  const handleImportarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;
    try {
      const { next, aplicadas } = await parseInventarioWorkbookFile(file, draft);
      if (aplicadas.length === 0) {
        setMsg(`${t('error')}: ${t('dynpanel_excel_no_sheets')}`);
        return;
      }
      setDraft(next);
      setMsg(`${t('invcfg_excel_imported')}: ${aplicadas.join(', ')}`);
    } catch (err) {
      setMsg(`${t('error')}: ${String(err)}`);
    }
  };

  const handleGuardar = async () => {
    if (!isAdmin || !draft) return;
    setSaving(true);
    setMsg(null);
    try {
      // Se guarda el escenario COMPLETO: el backend lo vuelca a los archivos que el
      // motor lee justo antes de correr. Guardar solo la ruta haría que las
      // ediciones se perdieran al releer el archivo original.
      await updateProjectConfig(projectId, { inventario_config: draft });
      setConfig(draft);
      setMsg(t('invmode_saved'));
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setMsg(`${t('error')}: ${detail || String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEscenario = async (path: string) => {
    setMsg(null);
    try {
      setDraft(await getInventarioEscenarioExpandido(path));
    } catch (e) {
      setMsg(`${t('error')}: ${String(e)}`);
    }
  };

  const handleLanzar = async () => {
    if (!isAdmin) return;
    if (dirty) {
      setMsg(t('dynpanel_unsaved_changes'));
      return;
    }
    setLaunching(true);
    setMsg(null);
    try {
      const necesitaFuente = FUENTE_DE[etapa] !== null;
      if (necesitaFuente && !fuenteId) {
        setMsg(t('dynpanel_select_source'));
        setLaunching(false);
        return;
      }
      const exec = await createExecution(projectId, {
        execution_type: etapa,
        n_days_override: nDays,
        run_tag: runTag,
        source_execution_id: necesitaFuente ? fuenteId : undefined,
      });
      setExecutions((prev) => [exec, ...prev]);
      setSelectedExecId(exec.id);
      setTab('executions');
      setMsg(t('dynpanel_queued'));
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setMsg(`${t('error')}: ${detail || t('dynpanel_launch_failed')}`);
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (escenarios.length === 0) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('invmode_engine_missing')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-0 border-b mb-4" style={{ borderColor: 'var(--color-border)' }}>
        {(isAdmin ? (['config', 'executions'] as Tab[]) : (['executions'] as Tab[])).map((k) => (
          <button
            key={k}
            className="px-4 py-2 text-sm"
            style={{
              borderBottom: tab === k ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === k ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === k ? 600 : 400,
            }}
            onClick={() => setTab(k)}
          >
            {k === 'config' ? t('configuration') : t('executions')}
          </button>
        ))}
      </div>

      {tab === 'config' && isAdmin && draft && (
        <div>
          {/* El escenario es el punto de partida: se elige uno y se edita desde ahí. */}
          <div className="card p-4 mb-3">
            <h3 className="text-base font-semibold mb-1">{t('invmode_scenario')}</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {t('invmode_scenario_hint')}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <select
                className="input"
                style={{ minWidth: 320 }}
                value={String(draft._path ?? '')}
                onChange={(e) => handleCambiarEscenario(e.target.value)}
              >
                {escenarios.map((e) => (
                  <option key={e.path} value={e.path}>
                    {e.con_inventario ? '● ' : '○ '}
                    {e.nombre}
                    {e.dias ? ` — ${e.dias} d` : ''}
                  </option>
                ))}
              </select>
              {escenarioActual && (
                <p className="text-xs flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {escenarioActual.descripcion}
                </p>
              )}
            </div>
          </div>

          <InventarioConfigEditor value={draft} onChange={setDraft} />

          <div className="card p-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={handleGuardar} disabled={saving || !dirty}>
              {saving ? <LoadingSpinner size="sm" /> : t('save')}
            </button>
            <button className="btn btn-outline" onClick={handleBajarExcel}>
              {t('invcfg_excel_download')}
            </button>
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              {t('invcfg_excel_import')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImportarExcel}
            />
            {dirty && (
              <span className="text-sm" style={{ color: 'var(--color-warning, #92400e)' }}>
                {t('invmode_unsaved')}
              </span>
            )}
          </div>
        </div>
      )}

      {tab === 'executions' && (
        <div>
          {isAdmin && (
            <div className="card p-4 mb-4">
              <h3 className="text-base font-semibold mb-3">{t('invmode_launch')}</h3>
              <div
                className="grid gap-3 mb-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
              >
                <div>
                  <label className="block text-xs font-medium mb-1">{t('invmode_stage')}</label>
                  <select
                    className="input w-full"
                    value={etapa}
                    onChange={(e) => {
                      setEtapa(e.target.value as EtapaKey);
                      setFuenteId('');
                    }}
                  >
                    {(Object.keys(FUENTE_DE) as EtapaKey[]).map((k) => (
                      <option key={k} value={k}>{NOMBRE_ETAPA[k]}</option>
                    ))}
                  </select>
                </div>
                {FUENTE_DE[etapa] && (
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('source_execution')}</label>
                    <select
                      className="input w-full"
                      value={fuenteId}
                      onChange={(e) => setFuenteId(e.target.value)}
                    >
                      <option value="">—</option>
                      {executions
                        .filter(
                          (e) =>
                            e.status === 'completed' &&
                            e.execution_type === FUENTE_DE[etapa],
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.id.slice(0, 8)} · {new Date(e.created_at).toLocaleDateString()}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1">{t('simulation_days')}</label>
                  <input
                    type="number"
                    className="input input-number w-full"
                    value={nDays}
                    min={1}
                    onChange={(e) => setNDays(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{t('tag')}</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={runTag}
                    onChange={(e) => setRunTag(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{t('invmode_scenario')}</label>
                  <div
                    className="input w-full truncate"
                    style={{ background: 'var(--color-bg)' }}
                    title={escenarioActual?.nombre}
                  >
                    {escenarioActual?.nombre ?? '—'}
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleLanzar} disabled={launching}>
                {launching ? t('launching') : t('invmode_launch')}
              </button>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                {t('invmode_launch_hint')}
              </p>
            </div>
          )}

          <div className="card p-4 mb-4 overflow-x-auto">
            <h3 className="text-base font-semibold mb-3">{t('executions')}</h3>
            {executions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('invmode_no_runs')}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left py-1">ID</th>
                    <th className="text-left">{t('invmode_stage')}</th>
                    <th className="text-left">{t('status')}</th>
                    <th className="text-left">{t('invmode_created')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {executions
                    .filter((e) => e.execution_type.startsWith('inventario_'))
                    .map((e) => (
                      <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="py-1.5 font-mono text-xs">{e.id.slice(0, 8)}</td>
                        <td className="text-xs">
                          {NOMBRE_ETAPA[e.execution_type as EtapaKey] ?? e.execution_type}
                        </td>
                        <td><StatusBadge status={e.status} /></td>
                        <td className="text-xs">{new Date(e.created_at).toLocaleString()}</td>
                        <td>
                          {(e.status === 'completed' || e.has_partial_results) && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setSelectedExecId(e.id)}
                              title={e.has_partial_results ? t('execres_partial_title') : undefined}
                            >
                              {e.has_partial_results
                                ? `${t('view')} (${t('execres_partial')})`
                                : t('view')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedExecId && (
            <ResultPanel
              executionId={selectedExecId}
              projectName={projectName}
              onClose={() => setSelectedExecId(null)}
            />
          )}
        </div>
      )}

      {msg && (
        <p
          className="text-sm mt-2"
          style={{
            color: msg.startsWith(t('error')) ? 'var(--color-danger)' : 'var(--color-success)',
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

function ResultPanel({
  executionId,
  projectName,
  onClose,
}: {
  executionId: string;
  projectName: string;
  onClose: () => void;
}) {
  const t = useT();
  const [results, setResults] = useState<InventarioResultsWithPartial | null>(null);
  // El snapshot alimenta la tabla "Masa ingreso salmuera de pozo" de la Tabla 1, igual
  // que en el dinámico: es la configuración con la que se corrió, no la actual.
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [files, setFiles] = useState<ExecutionFile[]>([]);
  const [estado, setEstado] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refetch, setRefetch] = useState(0);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    Promise.all([getExecution(executionId), listExecutionFiles(executionId).catch(() => [])])
      .then(([exec, fs]) => {
        if (!vivo) return;
        setEstado(exec.status);
        setResults((exec.results as unknown as InventarioResultsWithPartial | null) || null);
        setSnapshot(
          (exec.parameters_snapshot as Record<string, unknown> | null | undefined) ?? null,
        );
        setFiles(fs);
        // Una corrida en curso todavía no tiene resultados: se reintenta sola.
        if (exec.status === 'pending' || exec.status === 'running') {
          timer = setTimeout(() => vivo && setRefetch((k) => k + 1), 3000);
        }
      })
      .catch((e) => vivo && setErr(String(e)))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [executionId, refetch]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">
          {projectName} · <span className="font-mono text-xs">{executionId.slice(0, 8)}</span>
          {estado && estado !== 'completed' && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-warning)' }}>
              ({estado}…)
            </span>
          )}
        </h3>
        <button className="btn btn-outline btn-sm" onClick={onClose}>{t('close')}</button>
      </div>
      {loading ? (
        <LoadingSpinner size="md" />
      ) : err ? (
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      ) : !results ? (
        <p>{t('dynpanel_no_results_yet')}</p>
      ) : (
        <InventarioResultsView
          executionId={executionId}
          results={results}
          files={files}
          snapshot={snapshot}
        />
      )}
    </div>
  );
}
