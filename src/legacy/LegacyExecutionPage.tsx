/**
 * Una ejecución de la versión anterior, de solo lectura, con las pantallas de antes.
 *
 * El estático (preconcentración, proceso completo) usa la página de resultados de
 * antes tal cual; el dinámico, la vista de resultados del panel dinámico de antes y la
 * vista de cadena cuando la etapa se alimentó de otra. Las corridas del modo con
 * inventario de antes también se ven con la vista del dinámico, que oculta las
 * pestañas para las que no trae datos. Todo lee `GET /legacy-executions/{id}` vía `./api`.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { RunStatusBadge, formatDateTime } from '../f6/common';
import { getLegacyExecution, listExecutionFiles } from './api';
import type { LegacyExecutionDetail } from './apiTypes';
import type { DynamicResults, ExecutionFile } from './types';
import { LegacyBanner, isLegacyDynamic, legacyTypeLabel } from './labels';
import ExecutionResultsPage from './pages/ExecutionResultsPage';
import DynamicResultsView from './components/DynamicResultsView';
import DynamicChainView from './components/DynamicChainView';
import ExecutionFilesTable from './components/common/ExecutionFilesTable';

function DynamicBody({ exec, files }: { exec: LegacyExecutionDetail; files: ExecutionFile[] }) {
  const t = useT();
  const [chain, setChain] = useState(false);
  const results = exec.results as unknown as DynamicResults | null;
  const snapshot = exec.parameters_snapshot;
  if (!results) {
    return (
      <div className="card p-4">
        <p className="mb-3">{t('legacy_no_results')}</p>
        <ExecutionFilesTable executionId={exec.id} files={files} />
      </div>
    );
  }
  return (
    <div>
      {exec.source_execution_id && exec.status === 'completed' && (
        <div className="mb-3 flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => setChain((v) => !v)}
                  title={t('chain_root')}>
            {chain ? t('close') : t('chain')}
          </button>
        </div>
      )}
      {chain ? (
        <DynamicChainView rootExecutionId={exec.id} onClose={() => setChain(false)} />
      ) : (
        <div className="card p-4">
          <DynamicResultsView executionId={exec.id} results={results} files={files}
                              snapshot={snapshot} />
        </div>
      )}
    </div>
  );
}

export default function LegacyExecutionPage() {
  const { id = '' } = useParams<{ id: string }>();
  const t = useT();
  const [exec, setExec] = useState<LegacyExecutionDetail | null>(null);
  const [files, setFiles] = useState<ExecutionFile[]>([]);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let vivo = true;
    setEstado('loading');
    Promise.all([getLegacyExecution(id), listExecutionFiles(id).catch(() => [])])
      .then(([d, fs]) => {
        if (!vivo) return;
        setExec(d);
        setFiles(fs);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo) setEstado('error');
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  if (estado === 'loading') {
    return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }
  if (estado === 'error' || !exec) {
    return (
      <div>
        <LegacyBanner />
        <div className="card p-8 text-center" style={{ color: 'var(--color-danger)' }}>
          {t('legacy_not_found')}
        </div>
      </div>
    );
  }

  const dinamico = isLegacyDynamic(exec.execution_type);
  return (
    <div data-testid="legacy-execution-page">
      <LegacyBanner />
      {!dinamico && exec.deleted_at && (
        <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>
          {t('legacy_deleted')} · {formatDateTime(exec.deleted_at)}
        </p>
      )}
      {/* La página de resultados del estático trae su propio encabezado. */}
      {dinamico && (
      <>
      <div className="mb-4">
        <Link to={`/projects/${exec.project_id}?tab=executions`} className="text-sm"
              style={{ color: 'var(--color-primary)' }}>← {t('back')}</Link>
      </div>
      <div className="card p-4 mb-4 text-sm">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="text-lg font-semibold">{legacyTypeLabel(exec.execution_type, t)}</h2>
          <RunStatusBadge status={exec.status} />
          {exec.deleted_at && (
            <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
              {t('legacy_deleted')} · {formatDateTime(exec.deleted_at)}
            </span>
          )}
          <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {exec.id}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          <span>{t('f6_created')}: <span className="font-mono">{formatDateTime(exec.created_at)}</span></span>
          <span>{t('legacy_started')}: <span className="font-mono">{formatDateTime(exec.started_at)}</span></span>
          <span>{t('legacy_completed')}: <span className="font-mono">{formatDateTime(exec.completed_at)}</span></span>
          {(exec.created_by_username || exec.created_by) && (
            <span>{t('legacy_created_by')}: {exec.created_by_username || exec.created_by}</span>
          )}
          {exec.aqsol_version && <span>AQSOL {exec.aqsol_version}</span>}
          {exec.source_execution_id && (
            <span>
              {t('legacy_source')}:{' '}
              <Link to={`/legacy-executions/${exec.source_execution_id}`} className="font-mono"
                    style={{ color: 'var(--color-primary)' }}>
                {exec.source_execution_id.slice(0, 8)}
              </Link>
            </span>
          )}
        </div>
        {exec.status === 'interrupted' && (
          <p className="mt-2" style={{ color: 'var(--color-warning)' }}>{t('legacy_interrupted_note')}</p>
        )}
        {exec.error_message && (
          <p className="mt-2 font-mono text-xs whitespace-pre-wrap" style={{ color: 'var(--color-danger)' }}>
            {t('legacy_error')}: {exec.error_message}
          </p>
        )}
      </div>
      </>
      )}

      {dinamico ? (
        <DynamicBody exec={exec} files={files} />
      ) : (
        <>
          <ExecutionResultsPage />
          {files.length > 0 && (
            <div className="card p-4 mt-4">
              <h3 className="text-base font-semibold mb-2">{t('files')}</h3>
              <ExecutionFilesTable executionId={exec.id} files={files} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
