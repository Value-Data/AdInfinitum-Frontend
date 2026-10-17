/**
 * "Ejecuciones anteriores (versión antigua)" en la página del proyecto: las corridas
 * importadas de la versión anterior, de solo lectura. No se muestra si no hay.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pager, pageSlice } from '../f6/paging';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';
import { RunStatusBadge, formatDateTime } from '../f6/common';
import { duration } from '../f6/ProjectPage';
import { getLegacyExecutions } from './api';
import type { LegacyExecutionSummary } from './apiTypes';
import type { Execution } from './types';
import { isLegacyDynamic, legacyTypeLabel } from './labels';
import DynamicReportModal from './components/DynamicReportModal';

export default function LegacyExecutionsSection({
  projectId,
  projectName,
  isAdmin,
}: {
  projectId: string;
  projectName: string;
  isAdmin: boolean;
}) {
  const t = useT();
  const [rows, setRows] = useState<LegacyExecutionSummary[]>([]);
  const [borradas, setBorradas] = useState(false);
  const [hayAlguna, setHayAlguna] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    let vivo = true;
    getLegacyExecutions(projectId, borradas)
      .then((l) => {
        if (!vivo) return;
        setRows(l);
        if (l.length > 0) setHayAlguna(true);
      })
      .catch(() => {
        if (vivo) setRows([]);
      });
    return () => {
      vivo = false;
    };
  }, [projectId, borradas]);

  // El informe PDF del dinámico de antes elige etapas entre las ejecuciones del proyecto.
  const dinamicas = useMemo<Execution[]>(
    () =>
      rows
        .filter((r) => isLegacyDynamic(r.execution_type) && !r.deleted_at)
        .map((r) => ({
          id: r.id,
          project_id: r.project_id,
          execution_type: r.execution_type as Execution['execution_type'],
          status: r.status as Execution['status'],
          error_message: r.error_message,
          celery_task_id: null,
          source_execution_id: r.source_execution_id,
          started_at: r.started_at,
          completed_at: r.completed_at,
          created_by: r.created_by ?? '',
          created_at: r.created_at,
        })),
    [rows],
  );

  if (!hayAlguna) return null;

  return (
    <section className="mt-8" data-testid="legacy-executions">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold">{t('legacy_section_title')}</h3>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={borradas} onChange={(e) => setBorradas(e.target.checked)} />
              {t('legacy_show_deleted')}
            </label>
          )}
          {dinamicas.some((e) => e.status === 'completed') && (
            <button className="btn btn-outline btn-sm" onClick={() => setReportOpen(true)}
                    title={t('dynpanel_report_title')}>
              {t('dynpanel_generate_report')}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{t('legacy_section_hint')}</p>
      <div className="card overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th>{t('f6_execution_type')}</th>
              <th>{t('status')}</th>
              <th>{t('f6_created')}</th>
              <th>{t('f6_duration')}</th>
              <th>{t('files')}</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice(rows, pagina).items.map((e) => (
              <tr key={e.id} style={e.deleted_at ? { opacity: 0.6 } : undefined}>
                <td>
                  <Link to={`/legacy-executions/${e.id}`} style={{ color: 'var(--color-primary)' }}>
                    {legacyTypeLabel(e.execution_type, t)}
                  </Link>
                  {e.deleted_at && (
                    <span className="ml-2 text-xs" style={{ color: 'var(--color-danger)' }}>
                      ({t('legacy_deleted')})
                    </span>
                  )}
                </td>
                <td><RunStatusBadge status={e.status} /></td>
                <td className="font-mono">{formatDateTime(e.created_at)}</td>
                <td className="font-mono">{duration(e.started_at, e.completed_at)}</td>
                <td className="font-mono">{e.n_files || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager {...pageSlice(rows, pagina)} total={rows.length} onPage={setPagina} />
      </div>
      <DynamicReportModal open={reportOpen} onClose={() => setReportOpen(false)}
                          executions={dinamicas} projectName={projectName} />
    </section>
  );
}
