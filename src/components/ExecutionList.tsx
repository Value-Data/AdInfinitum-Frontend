import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Execution } from '../types';
import {
  getExecutions,
  deleteExecution,
  getExecutionStatus,
} from '../services/api';
import StatusBadge from './common/StatusBadge';
import Modal from './common/Modal';
import LoadingSpinner from './common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

interface Props {
  projectId: string;
}

export default function ExecutionList({ projectId }: Props) {
  const t = useT();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchExecutions = useCallback(async () => {
    try {
      const data = await getExecutions(projectId);
      // Static mode list: show only static executions (exclude dynamic-model ones,
      // which have their own list inside the Dynamic mode panel).
      setExecutions(data.filter((e) => !e.execution_type.startsWith('modelo_dinamico_')));
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  // Poll running executions
  useEffect(() => {
    const runningIds = executions
      .filter((e) => e.status === 'running' || e.status === 'pending')
      .map((e) => e.id);

    if (runningIds.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      let needsRefresh = false;
      for (const id of runningIds) {
        try {
          const status = await getExecutionStatus(id);
          if (status.status === 'completed' || status.status === 'failed') {
            needsRefresh = true;
          }
        } catch {
          // ignore
        }
      }
      if (needsRefresh) {
        fetchExecutions();
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [executions, fetchExecutions]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExecution(deleteTarget);
      setDeleteTarget(null);
      fetchExecutions();
    } catch {
      // handled
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = (exec: Execution) => {
    if (!exec.started_at || !exec.completed_at) return '-';
    const start = new Date(exec.started_at).getTime();
    const end = new Date(exec.completed_at).getTime();
    const diffSec = Math.round((end - start) / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    return `${min}m ${sec}s`;
  };

  const typeLabels: Record<string, string> = {
    proceso_completo: t('runsim_proceso_completo'),
    preconcentracion: t('runsim_preconcentracion'),
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      {executions.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {t('execlist_empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('execlist_type')}</th>
                <th>{t('status')}</th>
                <th>{t('execlist_duration')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <tr
                  key={exec.id}
                  className="cursor-pointer"
                  onClick={() => {
                    // Una fallida con parciales también se abre: la página muestra el
                    // aviso y el tramo resuelto. Antes solo se llegaba escribiendo la URL.
                    if (exec.status === 'completed' || exec.has_partial_results) {
                      navigate(`/executions/${exec.id}`);
                    }
                  }}
                >
                  <td className="font-mono text-sm">{formatDate(exec.created_at)}</td>
                  <td className="text-sm">{typeLabels[exec.execution_type] || exec.execution_type}</td>
                  <td>
                    <StatusBadge status={exec.status} />
                  </td>
                  <td className="font-mono text-sm">{getDuration(exec)}</td>
                  <td>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {(exec.status === 'completed' || exec.has_partial_results) && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/executions/${exec.id}`)}
                          title={exec.has_partial_results ? t('execres_partial_title') : undefined}
                        >
                          {exec.has_partial_results ? `${t('view')} (${t('execres_partial')})` : t('view')}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(exec.id)}
                        >
                          {t('delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('execlist_confirm_delete_title')}
      >
        <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
          {t('execlist_confirm_delete_msg')}
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
            {t('cancel')}
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            {t('delete')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
