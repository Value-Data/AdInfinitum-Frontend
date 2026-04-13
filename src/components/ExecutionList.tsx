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

interface Props {
  projectId: string;
}

export default function ExecutionList({ projectId }: Props) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchExecutions = useCallback(async () => {
    try {
      const data = await getExecutions(projectId);
      setExecutions(data);
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
    proceso_completo: 'Proceso Completo',
    preconcentracion: 'Preconcentracion',
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
          No hay ejecuciones registradas para este proyecto.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Duracion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <tr
                  key={exec.id}
                  className="cursor-pointer"
                  onClick={() => {
                    if (exec.status === 'completed') {
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
                      {exec.status === 'completed' && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/executions/${exec.id}`)}
                        >
                          Ver
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(exec.id)}
                        >
                          Eliminar
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
        title="Confirmar eliminacion"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
          Esta seguro de que desea eliminar esta ejecucion? Esta accion no se puede deshacer.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
