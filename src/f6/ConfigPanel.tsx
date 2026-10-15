/**
 * Configuración del proyecto en F4: el estado de sus secciones, el Excel de carga
 * (plantilla, export, import con revisión antes de guardar) y los parámetros de
 * reporte. Cada sección se edita en su propia pantalla.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiError, downloadTemplate, exportConfiguration, getReportParams, importConfiguration,
  listInventarioEscenarios, loadInventarioEscenario, saveBlob, updateReportParams,
  type EngineKind, type ExcelImportResult, type InventarioEscenario, type InventarioLoadResult,
  type Process, type ReportParams, type SectionKind, type SectionState, type ValidationIssue,
} from '../services/apiV2';
import { useLanguage, useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDateTime } from './common';
import { useLabels } from './labels';

const ETAPAS = ['precon', 'liming', 'postliming'] as const;

export function IssueList({ issues = [], kind }: {
  issues?: ValidationIssue[]; kind: 'error' | 'warning';
}) {
  if (issues.length === 0) return null;
  // El backend redacta el mensaje con la etiqueta del campo y la fila, en el idioma pedido.
  return (
    <ul className="text-sm list-disc pl-5" style={{ color: kind === 'error' ? '#b91c1c' : '#92400e' }}>
      {issues.map((i, n) => (
        <li key={`${i.field}-${i.row}-${n}`} title={i.field}>{i.message}</li>
      ))}
    </ul>
  );
}

/** Aviso de que una cascada arranca con las pozas cargadas (estado inicial de la sección). */
export function InventoryBadge({ n }: { n: number }) {
  const t = useT();
  return (
    <span className="text-xs px-2 py-0.5 border" data-testid="inventory-badge"
          title={t('f6_with_inventory_hint')} style={{ color: '#1e40af', borderColor: '#93c5fd' }}>
      {t('f6_with_inventory')} ({n})
    </span>
  );
}

function SectionCards({ projectId, sections, engine }: {
  projectId: string; sections: SectionState[]; engine: EngineKind;
}) {
  const t = useT();
  return (
    <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {ETAPAS.map((etapa) => {
        const kind = `${etapa}_${engine}` as SectionKind;
        const s = sections.find((x) => x.kind === kind);
        const vacia = !s?.latest_version_no;
        return (
          <div key={kind} className="card p-4" data-testid={`section-${kind}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">{t(`f6_stage_${etapa}` as never)}</span>
              <span className="text-xs px-2 py-0.5 border"
                    style={vacia ? { color: '#92400e', borderColor: '#fde68a' }
                                 : { color: '#166534', borderColor: '#86efac' }}>
                {vacia ? t('f6_section_empty') : `v${s?.latest_version_no}`}
              </span>
            </div>
            {!vacia && (
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {formatDateTime(s?.updated_at)}
                {s?.feed_source && etapa !== 'precon' && ` · ${t(`f6_feed_${s.feed_source}` as never)}`}
              </p>
            )}
            {!vacia && (s?.n_initial_states ?? 0) > 0 && (
              <p className="mb-2"><InventoryBadge n={s?.n_initial_states ?? 0} /></p>
            )}
            <Link to={`/projects/${projectId}/sections/${kind}`} className="btn btn-outline btn-sm">
              {vacia ? t('f6_configure') : t('f6_edit')}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function ExcelPanel({ projectId, engine, onSaved }: {
  projectId: string; engine: EngineKind; onSaved: () => void;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const [process, setProcess] = useState<Process>('full');
  const [feed, setFeed] = useState<'data' | 'execution'>('execution');
  const [modo, setModo] = useState<'fixed' | 'per_row'>('fixed');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [revision, setRevision] = useState<ExcelImportResult | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const correr = async (fn: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try { await fn(); } catch (err) { setError(apiError(err).message); } finally { setOcupado(false); }
  };

  const plantilla = () => correr(async () => {
    const b = await downloadTemplate(projectId, process, engine, lang,
      { feed_source: feed, composition_mode: modo });
    saveBlob(b, `plantilla_${process}_${engine}_${lang}.xlsx`);
  });
  const exportar = () => correr(async () => {
    const b = await exportConfiguration(projectId, process, engine, lang);
    saveBlob(b, `configuracion_${process}_${engine}_${lang}.xlsx`);
  });
  const revisar = (f: File) => correr(async () => {
    setArchivo(f);
    setRevision(await importConfiguration(projectId, f, false, lang));
  });
  const guardar = () => correr(async () => {
    if (!archivo) return;
    const r = await importConfiguration(projectId, archivo, true, lang);
    setRevision(r);
    if (r.saved) onSaved();
  });

  return (
    <div className="card p-4 mb-6">
      <h3 className="text-base font-semibold mb-3">{t('f6_excel_title')}</h3>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <label className="text-sm">
          <span className="label">{t('f6_process')}</span>
          <select className="input" value={process} onChange={(e) => setProcess(e.target.value as Process)}>
            <option value="full">{t('f6_process_full')}</option>
            {ETAPAS.map((e) => <option key={e} value={e}>{t(`f6_stage_${e}` as never)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">{t('f6_feed_source')}</span>
          <select className="input" value={feed} onChange={(e) => setFeed(e.target.value as 'data' | 'execution')}>
            <option value="execution">{t('f6_feed_execution')}</option>
            <option value="data">{t('f6_feed_data')}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">{t('f6_composition_mode')}</span>
          <select className="input" value={modo} onChange={(e) => setModo(e.target.value as 'fixed' | 'per_row')}>
            <option value="fixed">{t('f6_composition_fixed')}</option>
            <option value="per_row">{engine === 'static' ? t('f6_composition_per_scenario') : t('f6_composition_per_day')}</option>
          </select>
        </label>
        <button className="btn btn-outline" onClick={plantilla} disabled={ocupado}>{t('f6_download_template')}</button>
        <button className="btn btn-outline" onClick={exportar} disabled={ocupado}>{t('f6_export_config')}</button>
        <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={ocupado}>
          {t('f6_import_excel')}
        </button>
        <input ref={input} type="file" accept=".xlsx" className="hidden" data-testid="excel-file"
               onChange={(e) => { const f = e.target.files?.[0]; if (f) revisar(f); e.target.value = ''; }} />
        {ocupado && <LoadingSpinner size="sm" />}
      </div>
      {error && <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>}
      {revision && (
        <div className="mt-2" data-testid="import-review">
          <p className="text-sm mb-2">
            {revision.saved ? t('f6_import_saved') : revision.ok ? t('f6_import_ok') : t('f6_import_errors')}
          </p>
          {Object.entries(revision.sections).map(([kind, r]) => r && (
            <div key={kind} className="mb-2">
              <div className="text-sm font-semibold">
                {t(`f6_kind_${kind}` as never)}: {r.validation.ok ? '✓' : '✗'}
                {r.saved_version != null && ` → v${r.saved_version}`}
              </div>
              <IssueList issues={r.validation.errors} kind="error" />
              <IssueList issues={r.validation.warnings} kind="warning" />
            </div>
          ))}
          {revision.ok && !revision.saved && (
            <button className="btn btn-primary mt-2" onClick={guardar} disabled={ocupado}>
              {t('f6_import_save')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cargar un escenario de la entrega de Mariana: guarda su preconcentración dinámica
 * con el estado inicial de cada poza (el "modo con inventario" de antes). Después se
 * lanza como cualquier dinámico; la fecha de inicio y los días del escenario se
 * muestran para correrlo como la entrega.
 */
export function InventarioPanel({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [escenarios, setEscenarios] = useState<InventarioEscenario[]>([]);
  const [elegido, setElegido] = useState('');
  const [resultado, setResultado] = useState<InventarioLoadResult | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listInventarioEscenarios().then(setEscenarios).catch(() => setEscenarios([]));
  }, []);
  if (escenarios.length === 0) return null;
  const actual = escenarios.find((e) => e.path === elegido);
  const cargar = async () => {
    setOcupado(true);
    setError(null);
    setResultado(null);
    try {
      const r = await loadInventarioEscenario(projectId, elegido, lang);
      setResultado(r);
      if (r.saved) onSaved();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="card p-4 mb-6" data-testid="inventario-panel">
      <h3 className="text-base font-semibold mb-1">{t('f6_inventory_title')}</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_inventory_hint')}</p>
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <label className="text-sm" style={{ minWidth: 280 }}>
          <span className="label">{t('f6_inventory_choose')}</span>
          <select className="input" value={elegido} data-testid="inventario-select"
                  onChange={(e) => { setElegido(e.target.value); setResultado(null); setError(null); }}>
            <option value="">{t('f6_choose')}</option>
            {escenarios.map((e) => (
              <option key={e.path} value={e.path}>
                {e.nombre}{e.start_date ? ` · ${e.start_date}` : ''}{e.dias ? ` · ${e.dias} ${t('f6_days')}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={cargar} disabled={!elegido || ocupado}
                data-testid="inventario-load">
          {t('f6_inventory_load')}
        </button>
        {ocupado && <LoadingSpinner size="sm" />}
      </div>
      {actual?.descripcion && (
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{actual.descripcion}</p>
      )}
      {error && <p className="text-sm" style={{ color: '#b91c1c' }} data-testid="inventario-error">{error}</p>}
      {resultado && (
        <div className="mt-2" data-testid="inventario-result">
          <p className="text-sm mb-2">
            {resultado.saved
              ? `${t('f6_inventory_loaded')}: ${resultado.escenario} · ${resultado.n_initial_states} ${t('f6_initial_states_loaded')}`
              : t('f6_inventory_not_saved')}
          </p>
          {resultado.saved && resultado.start_date && (
            <p className="text-sm mb-2">
              {t('f6_inventory_launch_with')} {resultado.start_date}
              {resultado.days_max ? ` · ${resultado.days_max} ${t('f6_days')}` : ''}
            </p>
          )}
          {Object.entries(resultado.sections).map(([kind, r]) => (
            <div key={kind} className="mb-2">
              <div className="text-sm font-semibold">
                {t(`f6_kind_${kind}` as never)}: {r.validation.ok ? '✓' : '✗'}
                {r.saved_version != null && ` → v${r.saved_version}`}
              </div>
              <IssueList issues={r.validation.errors} kind="error" />
              <IssueList issues={r.validation.warnings} kind="warning" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportParamsCard({ projectId }: { projectId: string }) {
  const t = useT();
  const { label } = useLabels();
  const [p, setP] = useState<ReportParams | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { getReportParams(projectId).then(setP).catch(() => setP(null)); }, [projectId]);
  if (!p) return null;
  const campos: (keyof ReportParams)[] = ['precon_days_year', 'liming_days_year', 'postliming_days_year', 'scale_factor'];
  const guardar = async () => {
    try {
      setP(await updateReportParams(projectId, p));
      setAviso(t('f6_saved'));
    } catch (err) {
      setAviso(apiError(err).message);
    }
  };
  return (
    <div className="card p-4 mb-6">
      <h3 className="text-base font-semibold mb-1">{t('f6_report_params')}</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_report_params_hint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        {campos.map((c) => (
          <label key={c} className="text-sm">
            <span className="label">{label(`report_params.${c}`, c)}</span>
            <input type="number" step="any" className="input" style={{ width: 140 }} value={p[c]}
                   onChange={(e) => setP({ ...p, [c]: Number(e.target.value) })} />
          </label>
        ))}
        <button className="btn btn-primary" onClick={guardar}>{t('save')}</button>
        {aviso && <span className="text-sm">{aviso}</span>}
      </div>
    </div>
  );
}

export default function ConfigPanel({ projectId, sections, onChanged }: {
  projectId: string; sections: SectionState[]; onChanged: () => void;
}) {
  const t = useT();
  const [engine, setEngine] = useState<EngineKind>('dynamic');
  return (
    <div>
      <div className="flex gap-2 mb-4" role="tablist">
        {(['static', 'dynamic'] as EngineKind[]).map((e) => (
          <button key={e} role="tab" aria-selected={engine === e}
                  className={`btn ${engine === e ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEngine(e)}>
            {e === 'static' ? t('static_mode') : t('dynamic_mode')}
          </button>
        ))}
      </div>
      <SectionCards projectId={projectId} sections={sections} engine={engine} />
      {engine === 'dynamic' && <InventarioPanel projectId={projectId} onSaved={onChanged} />}
      <ExcelPanel projectId={projectId} engine={engine} onSaved={onChanged} />
      <ReportParamsCard projectId={projectId} />
    </div>
  );
}
