/**
 * Configuración del proyecto en F4: el estado de sus secciones, el Excel de carga
 * (plantilla, export, import con revisión antes de guardar) y los parámetros de
 * reporte. Cada sección se edita en su propia pantalla.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiError, downloadTemplate, exportConfiguration, getReportParams, importConfiguration,
  saveBlob, updateReportParams,
  type EngineKind, type ExcelImportResult, type PondParamsMode,
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
  const t = useT();
  if (issues.length === 0) return null;
  // El backend redacta el mensaje con la etiqueta del campo y la fila, en el idioma pedido.
  // Un aviso no impide guardar: va en ámbar y con su palabra (no solo el color).
  const aviso = kind === 'warning';
  return (
    <ul className="text-sm list-disc pl-5" data-kind={kind}
        style={{ color: aviso ? 'var(--color-warning-text)' : 'var(--color-danger-text)' }}>
      {issues.map((i, n) => (
        <li key={`${i.field}-${i.row}-${n}`} title={i.field} data-code={i.code}>
          {aviso && <span className="font-semibold">{t('f9_warning')}: </span>}
          {i.message}
        </li>
      ))}
    </ul>
  );
}

/** Aviso de que una cascada arranca con las pozas cargadas (estado inicial de la sección). */
export function InventoryBadge({ n }: { n: number }) {
  const t = useT();
  return (
    <span className="text-xs px-2 py-0.5 border" data-testid="inventory-badge"
          title={t('f6_with_inventory_hint')} style={{ color: 'var(--status-running-text)', borderColor: 'var(--status-running-border)' }}>
      {t('f6_with_inventory')} ({n})
    </span>
  );
}

function SectionCards({ projectId, sections, engine }: {
  projectId: string; sections: SectionState[]; engine: EngineKind;
}) {
  const t = useT();
  return (
    <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      {ETAPAS.map((etapa) => {
        const kind = `${etapa}_${engine}` as SectionKind;
        const s = sections.find((x) => x.kind === kind);
        const vacia = !s?.latest_version_no;
        return (
          <div key={kind} className="card p-4" data-testid={`section-${kind}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold">{t(`f6_stage_${etapa}` as never)}</span>
              <span className="text-xs px-2 py-0.5 border whitespace-nowrap shrink-0"
                    style={vacia ? { color: 'var(--status-pending-text)', borderColor: 'var(--status-pending-border)' }
                                 : { color: 'var(--status-done-text)', borderColor: 'var(--status-done-border)' }}>
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

export function ExcelPanel({ projectId, engine, onSaved }: {
  projectId: string; engine: EngineKind; onSaved: () => void;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const [process, setProcess] = useState<Process>('full');
  const [feed, setFeed] = useState<'data' | 'execution'>('execution');
  const [modo, setModo] = useState<'fixed' | 'per_row'>('fixed');
  // Punto 25: las cascadas del dinámico bajan la hoja "Cambios de pozas" solo con `by_date`.
  const [modoPozas, setModoPozas] = useState<PondParamsMode>('fixed');
  const conPozasDinamicas = engine === 'dynamic' && process !== 'liming';
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
    const b = await downloadTemplate(projectId, process, engine, lang, {
      feed_source: feed, composition_mode: modo,
      ...(conPozasDinamicas ? { pond_params_mode: modoPozas } : {}),
    });
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
        {conPozasDinamicas && (
          <label className="text-sm">
            <span className="label">{t('f9_pond_params_mode')}</span>
            <select className="input" value={modoPozas} data-testid="template-pond-params-mode"
                    onChange={(e) => setModoPozas(e.target.value as PondParamsMode)}>
              <option value="fixed">{t('f9_pond_params_fixed')}</option>
              <option value="by_date">{t('f9_pond_params_by_date')}</option>
            </select>
          </label>
        )}
        <button className="btn btn-outline" onClick={plantilla} disabled={ocupado}>{t('f6_download_template')}</button>
        <button className="btn btn-outline" onClick={exportar} disabled={ocupado}>{t('f6_export_config')}</button>
        <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={ocupado}>
          {t('f6_import_excel')}
        </button>
        <input ref={input} type="file" accept=".xlsx" className="hidden" data-testid="excel-file"
               onChange={(e) => { const f = e.target.files?.[0]; if (f) revisar(f); e.target.value = ''; }} />
        {ocupado && <LoadingSpinner size="sm" />}
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--color-danger-text)' }}>{error}</p>}
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
      <ExcelPanel projectId={projectId} engine={engine} onSaved={onChanged} />
      <ReportParamsCard projectId={projectId} />
    </div>
  );
}
