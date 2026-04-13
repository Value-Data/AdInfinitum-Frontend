import React from 'react';
import type { ExecutionStatus } from '../../types';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  status: ExecutionStatus | string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:
    'background-color: #fef3c7; color: #92400e; border-color: #fde68a',
  running:
    'background-color: #dbeafe; color: #1e40af; border-color: #93c5fd',
  completed:
    'background-color: #dcfce7; color: #166534; border-color: #86efac',
  failed:
    'background-color: #fee2e2; color: #991b1b; border-color: #fca5a5',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  running: 'En ejecucion',
  completed: 'Completada',
  failed: 'Error',
};

export default function StatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border"
      style={{
        ...Object.fromEntries(
          style.split(';').filter(Boolean).map((s) => {
            const [k, v] = s.split(':').map((x) => x.trim());
            const camelKey = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            return [camelKey, v];
          }),
        ),
        borderRadius: 'var(--radius)',
      }}
    >
      {status === 'running' && <LoadingSpinner size="sm" />}
      {label}
    </span>
  );
}
