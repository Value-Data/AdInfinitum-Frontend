/**
 * Una ejecución de F4: su estado mientras corre (avance, latido, log, cancelar) y,
 * cuando tiene resultados, el reporte del backend (`/report`, `/chain/report`) y sus
 * archivos. El reporte se pide con el período y el factor de escala elegidos; el front
 * no recalcula nada.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePageTrail } from '../components/common/trail';
import {
  apiError, blobApiError, cancelExecution, getProjectV2, deleteExecutionV2, downloadChainReport, downloadChainReportPdf,
  downloadReport, downloadReportPdf, getChain, getChainReport,
  getExecutionDetail, getExecutionLog, getExecutionStatusV2, getReport, isDynamicType,
  reuploadExecution, saveBlob,
  type ExecutionDetail, type ExecutionStatus, type ReportQuery,
} from '../services/apiV2';
import { listExecutionFiles } from '../services/api';
import type { ChainSummary, LogTail, Report } from '../types/report';
import { isStaticReport } from '../types/report';
import type { ExecutionFile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage, useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DecimalsSelect from '../components/common/DecimalsSelect';
import ExecutionFilesTable from '../components/common/ExecutionFilesTable';
import { PartialRunBanner, RunStatusBadge, dmy, executionTypeLabel, partialInfo } from './common';
import ReportView from './ReportView';
import { InventoryBadge } from './ConfigPanel';
import { DailyCharts, ReportCharts } from './Charts';
import CompareExecutions from './CompareExecutions';
import { ChainDailyCharts } from './ChainDailyCharts';
import { canDo, executionTabs, parseTab, tabLabelKey, type ExecutionTab } from './executionTabs';

const ACTIVE = new Set(['pending', 'running']);
const POLL_MS = 5000;

export function hasResults(d: ExecutionDetail): boolean {
  if (isDynamicType(d.execution_type)) {
    return (d.last_completed_day ?? 0) >= 1 && d.upload_status === 'uploaded';
  }
  return (d.scenarios?.length ?? 0) > 0;
}

function ProgressBar({ day, total }: { day: number | null | undefined; total: number | null | undefined }) {
  if (!total || day == null) return null;
  const pct = Math.max(0, Math.min(100, (day / total) * 100));
  return (
    <div className="w-full h-2 rounded" style={{ background: 'var(--color-border)' }}
         role="progressbar" aria-valuenow={day} aria-valuemax={total}>
      <div className="h-2 rounded" style={{ width: `${pct}%`, background: 'var(--color-primary)' }} />
    </div>
  );
}

function LogPanel({ id, live }: { id: string; live: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<LogTail | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    let vivo = true;
    const leer = () => getExecutionLog(id, 300).then((l) => { if (vivo) setLog(l); })
      .catch(() => undefined);
    leer();
    const timer = live ? setInterval(leer, POLL_MS) : undefined;
    return () => { vivo = false; if (timer) clearInterval(timer); };
  }, [id, open, live]);
  return (
    <div className="card mb-4">
      <button className="w-full text-left px-3 py-2 text-sm font-semibold" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} {t('f6_log')}
      </button>
      {open && (
        <pre className="px-3 pb-3 text-xs overflow-auto" style={{ maxHeight: 360 }} data-testid="log">
          {log?.source == null ? t('f6_log_empty') : log.lines.join('\n')}
        </pre>
      )}
    </div>
  );
}

function ReportSection({ detail, chain, filesTab, compare }: {
  detail: ExecutionDetail; chain: ChainSummary | null; filesTab: React.ReactNode; compare: boolean;
}) {
  const t = useT();
  const [search, setSearch] = useSearchParams();
  const { lang } = useLanguage();
  const dinamico = isDynamicType(detail.execution_type);
  const conCadena = Boolean(chain && chain.executions.length > 1);
  const [verCadena, setVerCadena] = useState(false);
  const [q, setQ] = useState<ReportQuery>({});
  const [borrador, setBorrador] = useState<ReportQuery>({});
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [escenario, setEscenario] = useState(0);
  const [comparar, setComparar] = useState<string[]>([]);
  const tabs = executionTabs({ dynamic: dinamico, chain: verCadena, files: Boolean(filesTab), compare });
  const tab = parseTab(search.get('tab'), tabs);
  const irA = (k: ExecutionTab) => setSearch(k === 'results' ? {} : { tab: k }, { replace: true });

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    (verCadena ? getChainReport(detail.id, q) : getReport(detail.id, q))
      .then((r) => { if (vivo) setReport(r); })
      .catch((err) => { if (vivo) { setReport(null); setError(apiError(err).message); } })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [detail.id, q, verCadena]);

  const bajar = async () => {
    try {
      const b = verCadena ? await downloadChainReport(detail.id, lang, q)
        : await downloadReport(detail.id, lang, q);
      saveBlob(b, `reporte_${detail.id.slice(0, 8)}${verCadena ? '_cadena' : ''}.xlsx`);
    } catch (err) {
      setError((await blobApiError(err)).message);
    }
  };
  // El PDF que arma el servidor (mismos parámetros que el Excel); el de la vista de
  // impresión queda como alternativa en el navegador.
  const [pdfServidor, setPdfServidor] = useState(false);
  const bajarPdf = async () => {
    setPdfServidor(true);
    try {
      const b = verCadena ? await downloadChainReportPdf(detail.id, lang, q)
        : await downloadReportPdf(detail.id, lang, q);
      saveBlob(b, `reporte_${detail.id.slice(0, 8)}${verCadena ? '_cadena' : ''}.pdf`);
    } catch (err) {
      setError((await blobApiError(err)).message);
    } finally {
      setPdfServidor(false);
    }
  };

  return (
    <section className="mb-6">
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        {dinamico && (
          <>
            <label className="text-sm">
              <span className="label">{t('f6_period_start')}</span>
              <input type="date" className="input" value={borrador.period_start ?? ''}
                     onChange={(e) => setBorrador({ ...borrador, period_start: e.target.value || null })} />
            </label>
            <label className="text-sm">
              <span className="label">{t('f6_period_end')}</span>
              <input type="date" className="input" value={borrador.period_end ?? ''}
                     onChange={(e) => setBorrador({ ...borrador, period_end: e.target.value || null })} />
            </label>
          </>
        )}
        <label className="text-sm">
          <span className="label">{t('f6_scale_factor')}</span>
          <input type="number" step="any" min="0" className="input" style={{ width: 190 }}
                 value={borrador.scale_factor ?? ''}
                 placeholder={t('f6_project_value')}
                 onChange={(e) => setBorrador({ ...borrador,
                   scale_factor: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
        <button className="btn btn-primary" onClick={() => setQ(borrador)}>{t('f6_apply')}</button>
        {conCadena && (
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={verCadena} onChange={(e) => setVerCadena(e.target.checked)} />
            {t('f6_chain_report')}
          </label>
        )}
        <div className="flex-1" />
        <DecimalsSelect />
        <button className="btn btn-outline" onClick={bajar}>{t('f6_download_xlsx')}</button>
        <button className="btn btn-outline" onClick={bajarPdf} disabled={pdfServidor} data-testid="download-pdf-server">
          {pdfServidor ? t('f6_pdf_server_busy') : t('f6_download_pdf_server')}
        </button>
        <button className="btn btn-outline" data-testid="print-report"
                onClick={() => window.open(`/executions/${detail.id}/print?${new URLSearchParams(
                  Object.entries({ ...q, chain: verCadena ? '1' : '',
                    compare: verCadena ? '' : comparar.join(',') })
                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                    .map(([k, v]) => [k, String(v)])).toString()}`, '_blank')}>
          {t('f6_print_pdf')}
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mb-4 border-b" style={{ borderColor: 'var(--color-border)' }}
           role="tablist" data-testid="execution-tabs">
        {tabs.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k}
                  className={`px-3 py-2 text-sm ${tab === k ? 'font-semibold' : ''}`}
                  style={tab === k ? { borderBottom: '2px solid var(--color-primary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onClick={() => irA(k)}>
            {t(tabLabelKey(k, dinamico))}
          </button>
        ))}
      </div>
      {cargando && <LoadingSpinner />}
      {error && <div className="card p-3 mb-4 text-sm" style={{ borderColor: '#fca5a5' }}>{error}</div>}
      {report && !cargando && (
        <>
          {tab === 'results' && <ReportView report={report} scenario={escenario} onScenario={setEscenario} paged />}
          {tab === 'charts' && (
            <>
              {isStaticReport(report) && report.scenarios.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 mb-3" role="tablist">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_scenario')}:</span>
                  {report.scenarios.map((s, j) => (
                    <button key={s.index} role="tab" aria-selected={j === escenario}
                            className={`btn btn-sm ${j === escenario ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setEscenario(j)}>
                      {s.label}{s.status === 'failed' ? ' ⚠' : ''}
                    </button>
                  ))}
                </div>
              )}
              <ReportCharts report={report} scenario={escenario} paged />
            </>
          )}
          {tab === 'daily' && (verCadena && chain && 'period' in report
            ? <ChainDailyCharts chain={chain}
                                query={{ ...q, period_start: report.period.start, period_end: report.period.end }} />
            : <DailyCharts executionId={detail.id} query={q} />)}
          {tab === 'compare' && <CompareExecutions detail={detail} query={q} ids={comparar} onChange={setComparar} />}
        </>
      )}
      {tab === 'files' && filesTab}
    </section>
  );
}

function ChainStrip({ chain, current }: { chain: ChainSummary; current: string }) {
  const t = useT();
  return (
    <div className="card p-3 mb-4 text-sm flex flex-wrap items-center gap-2">
      <span className="font-semibold">{t('f6_chain')}:</span>
      {chain.executions.map((e, i) => (
        <React.Fragment key={e.id}>
          {i > 0 && <span>→</span>}
          {e.id === current ? (
            <span className="font-semibold">{t(`f6_stage_${e.stage}` as never)}</span>
          ) : (
            <Link to={`/executions/${e.id}`} style={{ color: 'var(--color-primary)' }}>
              {t(`f6_stage_${e.stage}` as never)}
            </Link>
          )}
          <RunStatusBadge status={e.status} />
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ExecutionPage() {
  const { id = '' } = useParams<{ id: string }>();
  const t = useT();
  const { isAdmin } = useAuth();
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [chain, setChain] = useState<ChainSummary | null>(null);
  const [files, setFiles] = useState<ExecutionFile[]>([]);
  const [estado, setEstado] = useState<ExecutionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const navigate = useNavigate();
  const [nombreProyecto, setNombreProyecto] = useState<string | null>(null);
  // Lo que el rol del usuario permite en el proyecto (el cliente no ve logs ni config).
  const [caps, setCaps] = useState<string[] | null>(null);
  useEffect(() => {
    if (detail?.project_id) {
      getProjectV2(detail.project_id)
        .then((p) => { setNombreProyecto(p.name); setCaps(p.capabilities ?? []); })
        .catch(() => undefined);
    }
  }, [detail?.project_id]);
  const loc = useLocation();
  usePageTrail(loc.pathname, [
    { label: t('topbar_projects'), path: '/projects' },
    detail && nombreProyecto ? { label: nombreProyecto, path: `/projects/${detail.project_id}?tab=executions` } : null,
    detail ? { label: `${executionTypeLabel(detail.execution_type, t)} · ${detail.run_tag}` } : null]);

  const cargar = useCallback(async () => {
    try {
      const d = await getExecutionDetail(id);
      setDetail(d);
      if (ACTIVE.has(d.status)) {
        // El avance día a día lo deja el proceso de la corrida en el estado.
        getExecutionStatusV2(id).then(setEstado).catch(() => undefined);
      }
      if (isDynamicType(d.execution_type)) {
        getChain(id).then(setChain).catch(() => setChain(null));
      }
    } catch (err) {
      setError(apiError(err).message);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  // Los archivos de salida (CSV, metadata, log del worker), también del estático; solo
  // si el rol puede verlos.
  const conArchivos = Boolean(detail && canDo(caps, 'view_logs') && (detail.upload_status === 'uploaded'
    || (!isDynamicType(detail.execution_type) && !ACTIVE.has(detail.status))));
  useEffect(() => {
    if (conArchivos) listExecutionFiles(id).then(setFiles).catch(() => setFiles([]));
  }, [id, conArchivos]);
  useEffect(() => {
    if (!detail || !ACTIVE.has(detail.status)) return undefined;
    const timer = setInterval(cargar, POLL_MS);
    return () => clearInterval(timer);
  }, [detail, cargar]);

  if (error) return <div className="card p-4">{error}</div>;
  if (!detail) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  const activa = ACTIVE.has(detail.status);
  const cancelar = async () => {
    try {
      await cancelExecution(id);
      setAviso(t('f6_cancel_requested'));
      cargar();
    } catch (err) {
      setAviso(apiError(err).message);
    }
  };
  const borrar = async () => {
    if (!confirmarBorrado) { setConfirmarBorrado(true); return; }
    try {
      await deleteExecutionV2(id);
      navigate(`/projects/${detail.project_id}?tab=executions`);
    } catch (err) {
      setAviso(apiError(err).message);
      setConfirmarBorrado(false);
    }
  };
  const motor = isDynamicType(detail.execution_type) ? 'dynamic' : 'static';
  const resubir = async () => {
    try {
      await reuploadExecution(id);
      setAviso(t('f6_reupload_done'));
      cargar();
    } catch (err) {
      setAviso(apiError(err).message);
    }
  };

  const conResultados = hasResults(detail);
  // El log y los archivos: en su pestaña cuando hay resultados; si no, a la vista.
  const archivos = (
    <>
      {conResultados && <LogPanel id={id} live={activa} />}
      {files.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-2">{t('files')}</h3>
          <div className="card overflow-x-auto"><ExecutionFilesTable executionId={id} files={files} /></div>
        </section>
      )}
    </>
  );

  return (
    <div>
      <div className="mb-4">
        <Link to={`/projects/${detail.project_id}?tab=executions`} className="text-sm" style={{ color: 'var(--color-primary)' }}>
          ← {t('back')}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h2 className="text-xl font-semibold">{executionTypeLabel(detail.execution_type, t)}</h2>
        <RunStatusBadge status={detail.status} />
        <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
          {detail.run_tag} · AQSOL {detail.aqsol_version ?? '–'}
        </span>
        <div className="flex-1" />
        {isAdmin && !activa && (
          <button className="btn btn-outline" onClick={borrar} data-testid="delete-execution"
                  style={confirmarBorrado ? { borderColor: '#dc2626', color: '#b91c1c' } : undefined}>
            {confirmarBorrado ? t('f6_delete_confirm') : t('delete')}
          </button>
        )}
      </div>
      <div className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        {detail.sections?.map((s, i) => (
          <React.Fragment key={s.section}>
            {i > 0 && ' · '}
            {canDo(caps, 'view_config') ? (
              <Link to={`/projects/${detail.project_id}/sections/${s.section}_${motor}?version=${s.version_no}`}
                    style={{ color: 'var(--color-primary)' }} title={t('f6_view_config_used')}>
                {t(`f6_stage_${s.section}` as never)} v{s.version_no}
              </Link>
            ) : <span>{t(`f6_stage_${s.section}` as never)} v{s.version_no}</span>}
            {/* Arrancó con las pozas cargadas (estado inicial de la sección: inventario). */}
            {Number(s.n_initial_states ?? 0) > 0 && (
              <span className="ml-2"><InventoryBadge n={Number(s.n_initial_states)} /></span>
            )}
          </React.Fragment>
        ))}
        {detail.start_date && ` · ${t('f6_start_date')}: ${dmy(detail.start_date)}`}
        {detail.n_days != null && ` · ${detail.n_days} ${t('f6_days')}`}
        {detail.source_execution_id && (
          <> · <Link to={`/executions/${detail.source_execution_id}`} style={{ color: 'var(--color-primary)' }}>
            {t('f6_source')}</Link></>
        )}
        {detail.uses_variable_params && ` · ${t('f6_variable_params')}`}
      </div>

      {aviso && <div className="card p-3 mb-4 text-sm">{aviso}</div>}

      {(activa || detail.error_message) && (
        <div className="card p-3 mb-4">
          {activa && (
            <div className="flex items-center gap-3 mb-2">
              <LoadingSpinner size="sm" />
              <span className="text-sm">
                {detail.status === 'pending' ? t('f6_waiting_worker') : t('f6_running')}
                {detail.n_days ? ` (${estado?.progress_day ?? 0}/${detail.n_days})` : ''}
              </span>
              <div className="flex-1" />
              {canDo(caps, 'cancel') && <button className="btn btn-outline" onClick={cancelar}>{t('cancel')}</button>}
            </div>
          )}
          {activa && <ProgressBar day={estado?.progress_day} total={detail.n_days} />}
          {detail.error_message && (
            <pre className="text-xs whitespace-pre-wrap mt-2">{detail.error_message.split('\n')[0]}</pre>
          )}
          {!activa && detail.last_completed_day != null && detail.status !== 'completed' && (
            <p className="text-sm mt-1">{t('f6_days_completed')}: {detail.last_completed_day}</p>
          )}
        </div>
      )}

      {detail.upload_status === 'failed' && (
        <div className="card p-3 mb-4 text-sm flex items-center gap-3" style={{ borderColor: '#fca5a5' }}>
          {t('f6_upload_failed')}
          {isAdmin && <button className="btn btn-outline" onClick={resubir}>{t('f6_reupload')}</button>}
        </div>
      )}

      {!conResultados && canDo(caps, 'view_logs') && <LogPanel id={id} live={activa} />}

      {chain && chain.executions.length > 1 && <ChainStrip chain={chain} current={id} />}

      {conResultados && <PartialRunBanner info={partialInfo(detail)} />}
      {conResultados ? <ReportSection detail={detail} chain={chain}
                                      filesTab={canDo(caps, 'view_logs') ? archivos : null}
                                      compare={canDo(caps, 'view_logs')} /> : (!activa && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_no_results')}</p>
      ))}

      {!conResultados && files.length > 0 && canDo(caps, 'view_logs') && archivos}
    </div>
  );
}
