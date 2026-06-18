import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DynamicConfig,
  Execution,
  ExecutionFile,
  ExecutionType,
} from '../types';
import {
  createExecution,
  downloadExecutionFile,
  getExecution,
  getExecutions,
  getProject,
  getProjectConfig,
  getProjectConfigDefaults,
  listExecutionFiles,
  updateProjectConfig,
} from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import DynamicConfigEditor from './DynamicConfigEditor';
import DynamicResultsView from './DynamicResultsView';
import DynamicChainView from './DynamicChainView';
import DynamicReportModal from './DynamicReportModal';
import type { DynamicResults } from '../types';
import { useT } from '../i18n/LanguageContext';
import {
  applyParsedToConfig,
  downloadDynamicExcel,
  parseDynamicWorkbookFile,
} from '../utils/dynamicConfigExcel';

type StageKey = 'cascade' | 'encalado' | 'postliming';
type DynTabKey = 'config' | 'executions';

const STAGE_TO_TYPE: Record<StageKey, ExecutionType> = {
  cascade: 'modelo_dinamico_cascade',
  encalado: 'modelo_dinamico_encalado',
  postliming: 'modelo_dinamico_postliming',
};

const STAGE_LABEL: Record<StageKey, string> = {
  cascade: 'Cascade (Pz1-Pz7)',
  encalado: 'Encalado (Pz8-Pz9)',
  postliming: 'Postliming (Pz10-Pz18)',
};

const SOURCE_REQUIRED_FOR: Record<StageKey, ExecutionType | null> = {
  cascade: null,
  encalado: 'modelo_dinamico_cascade',
  postliming: 'modelo_dinamico_encalado',
};

export default function DynamicModePanel({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const t = useT();
  const [config, setConfig] = useState<DynamicConfig | null>(null);
  // Local edited copy of config (for Config tab)
  const [draftConfig, setDraftConfig] = useState<DynamicConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<StageKey>('cascade');
  const [sourceExecId, setSourceExecId] = useState<string>('');
  const [nDays, setNDays] = useState<number>(1460);
  const [runTag, setRunTag] = useState<string>('baseline');
  const [launching, setLaunching] = useState(false);
  const [activeTab, setActiveTab] = useState<DynTabKey>(isAdmin ? 'config' : 'executions');
  const [projectName, setProjectName] = useState<string>('proyecto');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chainRootId, setChainRootId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const cfg = await getProjectConfig(projectId);
      let dc = cfg.dynamic_config;
      // Auto-merge: if the stored config is missing fields added after creation
      // (e.g. precon.factors when the project predates Gap #1 schema), fetch
      // defaults and fill the holes. Marks dirty so the user can persist.
      let autoFilled = false;
      if (dc) {
        const needsFactors =
          !dc.precon?.factors?.length ||
          !dc.encalado?.factors?.length ||
          !dc.postliming?.factors?.length;
        if (needsFactors) {
          try {
            const defs = await getProjectConfigDefaults(projectId);
            const dd = defs.dynamic_config;
            dc = {
              ...dc,
              precon: {
                ...dc.precon,
                factors: dc.precon?.factors?.length ? dc.precon.factors : dd.precon.factors,
              },
              encalado: {
                ...dc.encalado,
                factors: dc.encalado?.factors?.length
                  ? dc.encalado.factors
                  : dd.encalado.factors,
              },
              postliming: {
                ...dc.postliming,
                factors: dc.postliming?.factors?.length
                  ? dc.postliming.factors
                  : dd.postliming.factors,
              },
            };
            autoFilled = true;
          } catch {
            // ignore — user can use "Cargar defaults" manually
          }
        }
      }
      // Coercion: flow_modulation always 'seasonal' (per project rule).
      if (dc?.precon && dc.precon.flow_modulation !== 'seasonal') {
        dc = {
          ...dc,
          precon: { ...dc.precon, flow_modulation: 'seasonal' },
        };
        autoFilled = true;
      }
      // Coercion: encalado dinamico siempre 365 dias/ano (operacion continua).
      if (dc?.encalado?.config && dc.encalado.config.availability_days_year !== 365) {
        dc = {
          ...dc,
          encalado: {
            ...dc.encalado,
            config: { ...dc.encalado.config, availability_days_year: 365 },
          },
        };
        autoFilled = true;
      }

      // v2: auto-fill missing fields (older configs predate v2 schema).
      if (dc?.encalado?.config) {
        const enc = dc.encalado.config as unknown as Record<string, unknown>;
        let migrated = false;
        const patched = { ...enc };
        // 3 V3 flags
        if (patched.use_filtrate_as_aqsol2_base === undefined) {
          patched.use_filtrate_as_aqsol2_base = true;
          migrated = true;
        }
        if (patched.use_fn_input_subtraction === undefined) {
          patched.use_fn_input_subtraction = false;
          migrated = true;
        }
        if (patched.include_cake_wash_in_output === undefined) {
          patched.include_cake_wash_in_output = false;
          migrated = true;
        }
        // secuencia_dosificaciones default V3
        const seq = patched.secuencia_dosificaciones as unknown[] | undefined;
        if (!Array.isArray(seq) || seq.length === 0) {
          patched.secuencia_dosificaciones = [
            { reactivo: 'Ca(OH)2', objetivo: 'Mg', factor_exceso: 1.17,
              concentracion_solucion: 0.25, enabled: true },
            { reactivo: 'CaCl2', objetivo: 'SO4', factor_exceso: 0.70,
              concentracion_solucion: 0.381, enabled: false },
          ];
          migrated = true;
        }
        if (migrated) {
          dc = {
            ...dc,
            encalado: {
              ...dc.encalado,
              config: patched as unknown as typeof dc.encalado.config,
            },
          };
          autoFilled = true;
        }
      }
      // v2 V4: postliming params auto-fill.
      if (dc?.postliming?.config) {
        const pl = dc.postliming.config as unknown as Record<string, unknown>;
        let migrated = false;
        const patched = { ...pl };
        if (patched.use_pz10_seasonal_modulation === undefined) {
          patched.use_pz10_seasonal_modulation = true;
          migrated = true;
        }
        if (patched.pz10_average_outflow_t_day === undefined) {
          patched.pz10_average_outflow_t_day = 718.8;
          migrated = true;
        }
        if (patched.apply_berm_factor === undefined) {
          patched.apply_berm_factor = false;
          migrated = true;
        }
        if (migrated) {
          dc = {
            ...dc,
            postliming: {
              ...dc.postliming,
              config: patched as unknown as typeof dc.postliming.config,
            },
          };
          autoFilled = true;
        }
      }
      setConfig(dc);
      setDraftConfig(dc);
      setDirty(autoFilled);
      if (autoFilled) {
        setSaveMsg('Config actualizado automáticamente (factores faltantes o modulación). Guardá para persistir.');
      }
      if (dc?.simulation?.n_days) {
        setNDays(dc.simulation.n_days);
      }
    } catch {
      setSaveMsg('Error al cargar config dinámica');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchExecutions = useCallback(async () => {
    try {
      const all = await getExecutions(projectId);
      const dyn = all.filter((e) =>
        e.execution_type.startsWith('modelo_dinamico_'),
      );
      setExecutions(dyn);
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    fetchConfig();
    fetchExecutions();
    getProject(projectId)
      .then((p) => setProjectName(p.name))
      .catch(() => undefined);
  }, [fetchConfig, fetchExecutions, projectId]);

  useEffect(() => {
    const hasActive = executions.some(
      (e) => e.status === 'pending' || e.status === 'running',
    );
    if (!hasActive) return;
    const t = setInterval(fetchExecutions, 4000);
    return () => clearInterval(t);
  }, [executions, fetchExecutions]);

  const handleLoadDefaults = async () => {
    if (!isAdmin) return;
    try {
      const defaults = await getProjectConfigDefaults(projectId);
      setDraftConfig(defaults.dynamic_config);
      setDirty(true);
      setSaveMsg('Defaults cargados en el editor. Pulsa "Guardar" para persistir.');
    } catch {
      setSaveMsg('Error al cargar defaults.');
    }
  };

  const handleSaveConfig = async () => {
    if (!isAdmin || !draftConfig) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateProjectConfig(projectId, { dynamic_config: draftConfig });
      setConfig(updated.dynamic_config);
      setDraftConfig(updated.dynamic_config);
      setDirty(false);
      setSaveMsg('Configuración dinámica guardada.');
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setSaveMsg(`Error: ${msg || 'No se pudo guardar'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDraft = () => {
    setDraftConfig(config);
    setDirty(false);
    setSaveMsg('Cambios descartados.');
  };

  const handleDownloadExcel = () => {
    if (!draftConfig) return;
    const safe = projectName.replace(/[^a-z0-9-_]+/gi, '_');
    downloadDynamicExcel(draftConfig, `config_dinamico_${safe}.xlsx`);
    setSaveMsg('Plantilla Excel descargada.');
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draftConfig) return;
    try {
      const parsed = await parseDynamicWorkbookFile(file, draftConfig);
      const { next, applied } = applyParsedToConfig(draftConfig, parsed);
      if (applied.length === 0) {
        setSaveMsg('Error: el archivo no contiene hojas reconocidas.');
        return;
      }
      setDraftConfig(next);
      setDirty(true);
      setSaveMsg(`Excel cargado (${applied.join(', ')}). Guarde para aplicar.`);
    } catch (err) {
      setSaveMsg(`Error al leer el Excel: ${(err as Error).message}`);
    }
  };

  const completedSources = executions.filter((e) => e.status === 'completed');
  const sourceCandidates = (() => {
    const expected = SOURCE_REQUIRED_FOR[activeStage];
    if (!expected) return [];
    return completedSources.filter((e) => e.execution_type === expected);
  })();

  const handleLaunch = async () => {
    if (!isAdmin) return;
    if (dirty) {
      setSaveMsg('Tienes cambios sin guardar en la configuración. Guarda o descarta antes de lanzar.');
      return;
    }
    const stageType = STAGE_TO_TYPE[activeStage];
    const needsSource = SOURCE_REQUIRED_FOR[activeStage] !== null;
    if (needsSource && !sourceExecId) {
      setSaveMsg('Selecciona una ejecución fuente.');
      return;
    }
    setLaunching(true);
    setSaveMsg(null);
    try {
      const exec = await createExecution(projectId, {
        execution_type: stageType,
        source_execution_id: needsSource ? sourceExecId : undefined,
        n_days_override: nDays,
        run_tag: runTag,
      });
      setExecutions((prev) => [exec, ...prev]);
      setSelectedExecId(exec.id);
      setSaveMsg(`Ejecución ${stageType} encolada.`);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setSaveMsg(`Error: ${msg || 'No se pudo lanzar'}`);
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

  if (!config) {
    return (
      <div className="card p-6 text-center">
        <p>El proyecto no tiene configuración dinámica.</p>
        {isAdmin && (
          <button className="btn btn-primary mt-3" onClick={handleLoadDefaults}>
            Inicializar con defaults
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs inside dynamic mode */}
      <div className="flex gap-0 border-b mb-4" style={{ borderColor: 'var(--color-border)' }}>
        {isAdmin && (
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'config' ? 'border-current' : 'border-transparent'
            }`}
            style={{
              color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === 'config' ? 'var(--color-primary)' : 'transparent',
            }}
            onClick={() => setActiveTab('config')}
          >
            {t('configuration')}{dirty ? ' •' : ''}
          </button>
        )}
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'executions' ? 'border-current' : 'border-transparent'
          }`}
          style={{
            color: activeTab === 'executions' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderColor: activeTab === 'executions' ? 'var(--color-primary)' : 'transparent',
          }}
          onClick={() => setActiveTab('executions')}
        >
          {t('executions')}
        </button>
      </div>

      {/* CONFIG TAB */}
      {activeTab === 'config' && isAdmin && draftConfig && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-base font-semibold">{t('dynamic_config_title')}</h3>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                className="hidden"
              />
              <button className="btn btn-outline btn-sm" onClick={handleDownloadExcel}>
                {t('download_excel')}
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleImportClick}>
                {t('upload_excel')}
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleLoadDefaults}>
                {t('load_defaults')}
              </button>
              {dirty && (
                <button className="btn btn-outline btn-sm" onClick={handleResetDraft}>
                  {t('discard_changes')}
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveConfig}
                disabled={!dirty || saving}
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
          {saveMsg && (
            <p
              className="text-sm mb-3"
              style={{
                color: saveMsg.startsWith('Error')
                  ? 'var(--color-danger)'
                  : 'var(--color-success)',
              }}
            >
              {saveMsg}
            </p>
          )}
          <DynamicConfigEditor
            value={draftConfig}
            onChange={(next) => {
              setDraftConfig(next);
              setDirty(true);
            }}
          />
        </div>
      )}

      {/* EXECUTIONS TAB */}
      {activeTab === 'executions' && (
        <div>
          {isAdmin && (
            <div className="card p-4 mb-4">
              <h3 className="text-base font-semibold mb-3">{t('launch_execution')}</h3>
              <div className="flex gap-2 mb-3 flex-wrap">
                {(Object.keys(STAGE_LABEL) as StageKey[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setActiveStage(s);
                      setSourceExecId('');
                    }}
                    className={`px-3 py-1.5 text-xs rounded border ${
                      activeStage === s ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
                    }`}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                {SOURCE_REQUIRED_FOR[activeStage] && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium mb-1">
                      {t('source')} ({SOURCE_REQUIRED_FOR[activeStage]?.replace('modelo_dinamico_', '')})
                    </label>
                    <select
                      className="input w-full"
                      value={sourceExecId}
                      onChange={(e) => setSourceExecId(e.target.value)}
                    >
                      <option value="">— elegir —</option>
                      {sourceCandidates.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.id.slice(0, 8)} · {new Date(e.created_at).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    {sourceCandidates.length === 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
                        No hay ejecuciones {SOURCE_REQUIRED_FOR[activeStage]?.replace('modelo_dinamico_', '')} completadas.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1">{t('simulation_days')}</label>
                  <input
                    type="number"
                    className="input input-number w-full"
                    value={nDays}
                    onChange={(e) => setNDays(parseInt(e.target.value) || 1)}
                    min={1}
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
              </div>
              <button className="btn btn-primary" onClick={handleLaunch} disabled={launching}>
                {launching ? t('launching') : `${t('launch_execution')}: ${STAGE_LABEL[activeStage]}`}
              </button>
              {saveMsg && (
                <p
                  className="text-sm mt-2"
                  style={{
                    color: saveMsg.startsWith('Error')
                      ? 'var(--color-danger)'
                      : 'var(--color-success)',
                  }}
                >
                  {saveMsg}
                </p>
              )}
              {dirty && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
                  Tienes cambios sin guardar en Configuración — guárdalos antes de lanzar.
                </p>
              )}
            </div>
          )}

          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-base font-semibold">{t('dynamic_executions')}</h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setReportOpen(true)}
                disabled={executions.filter((e) => e.status === 'completed').length === 0}
                title="Selecciona etapas y ejecuciones para generar un PDF"
              >
                Generar Reporte
              </button>
            </div>
            {executions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('no_executions_yet')}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <tr>
                    <th className="py-1">ID</th>
                    <th>{t('stage')}</th>
                    <th>{t('status')}</th>
                    <th>{t('date')}</th>
                    <th>{t('source')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {executions.map((e) => (
                    <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="py-1.5 font-mono text-xs">{e.id.slice(0, 8)}</td>
                      <td>{e.execution_type.replace('modelo_dinamico_', '')}</td>
                      <td>
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="text-xs">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="text-xs font-mono">
                        {e.source_execution_id ? e.source_execution_id.slice(0, 8) : '-'}
                      </td>
                      <td className="flex gap-1">
                        {e.status === 'completed' && (
                          <button className="btn btn-outline btn-sm" onClick={() => { setSelectedExecId(e.id); setChainRootId(null); }}>
                            {t('view')}
                          </button>
                        )}
                        {e.status === 'completed' && e.source_execution_id && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => { setChainRootId(e.id); setSelectedExecId(null); }}
                            title={t('chain_root')}
                          >
                            {t('chain')}
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
            <DynamicResultPanel
              executionId={selectedExecId}
              onClose={() => setSelectedExecId(null)}
            />
          )}
          {chainRootId && (
            <DynamicChainView
              rootExecutionId={chainRootId}
              onClose={() => setChainRootId(null)}
            />
          )}

          <DynamicReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            executions={executions}
            projectName={projectName}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'var(--color-warning)',
    running: 'var(--color-warning)',
    completed: 'var(--color-success)',
    failed: 'var(--color-danger)',
  };
  return (
    <span
      className="px-1.5 py-0.5 text-xs rounded border"
      style={{ color: colors[status] || 'inherit', borderColor: colors[status] || 'inherit' }}
    >
      {status}
    </span>
  );
}

function DynamicResultPanel({
  executionId,
  onClose,
}: {
  executionId: string;
  onClose: () => void;
}) {
  const t = useT();
  const [results, setResults] = useState<DynamicResults | null>(null);
  const [files, setFiles] = useState<ExecutionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<string>('');
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    let alive = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    setErr(null);

    const load = async () => {
      try {
        const [exec, fs] = await Promise.all([
          getExecution(executionId),
          listExecutionFiles(executionId).catch(() => []),
        ]);
        if (!alive) return;
        setExecStatus(exec.status);
        setResults((exec.results as unknown as DynamicResults | null) || null);
        setFiles(fs);
        // If execution still running/pending OR results not yet populated, retry in 2s.
        if (
          (exec.status === 'pending' || exec.status === 'running') ||
          (exec.status === 'completed' && !exec.results)
        ) {
          pollTimer = setTimeout(() => alive && setRefetchKey((k) => k + 1), 2000);
        }
      } catch (e) {
        if (alive) setErr(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [executionId, refetchKey]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">
          Resultados · <span className="font-mono text-xs">{executionId.slice(0, 8)}</span>
          {execStatus && execStatus !== 'completed' && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-warning)' }}>
              ({execStatus}…)
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => setRefetchKey((k) => k + 1)}>
            {t('refresh')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingSpinner size="md" />
      ) : err ? (
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      ) : !results ? (
        <div>
          <p>
            Sin resultados disponibles aún
            {execStatus === 'completed'
              ? ' (la ejecución completó pero el campo results llegó vacío).'
              : execStatus
              ? ` (estado: ${execStatus}, reintentando cada 2s…).`
              : '.'}
          </p>
        </div>
      ) : (
        <DynamicResultsView executionId={executionId} results={results} files={files} />
      )}
    </div>
  );
}
