import { useCallback, useEffect, useState } from 'react';
import type { ExecutionResult } from '../types';
import { getExecution } from '../services/api';

export function useExecution(executionId: string | undefined) {
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!executionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getExecution(executionId);
      setExecution(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ejecucion');
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { execution, loading, error, refresh };
}
