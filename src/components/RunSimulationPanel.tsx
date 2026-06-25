import React, { useState } from 'react';
import type { ExecutionType } from '../types';
import { createExecution } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import { useT } from '../i18n/LanguageContext';

interface Props {
  projectId: string;
  onExecutionCreated: () => void;
}

export default function RunSimulationPanel({ projectId, onExecutionCreated }: Props) {
  const t = useT();
  const [executionType, setExecutionType] = useState<ExecutionType>('proceso_completo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createExecution(projectId, {
        execution_type: executionType,
      });
      onExecutionCreated();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t('runsim_error');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="card p-4 mt-4"
      style={{ borderLeft: '3px solid var(--color-primary)' }}
    >
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        {t('runsim_title')}
      </h4>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label">{t('runsim_execution_type')}</label>
          <select
            className="input w-52"
            value={executionType}
            onChange={(e) => setExecutionType(e.target.value as ExecutionType)}
          >
            <option value="proceso_completo">{t('runsim_proceso_completo')}</option>
            <option value="preconcentracion">{t('runsim_preconcentracion')}</option>
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" />
              {t('runsim_running')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              {t('runsim_run')}
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
