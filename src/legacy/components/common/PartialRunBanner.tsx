import React from 'react';
import type { DynamicPartialInfo } from '../../types';
import { useT } from '../../../i18n/LanguageContext';

/**
 * Aviso de corrida cortada: la ejecución falló, pero el backend conservó lo que
 * alcanzó a calcularse (`services/partial_rescue`).
 *
 * Va bien visible a propósito: leer un promedio calculado sobre 137 de 1460 días
 * como si fuera la corrida entera es peor que no mostrar nada. Lo comparten el modo
 * dinámico y el de inventario, que cuentan en días; el estático tiene su propia
 * versión en `ExecutionResultsPage` porque ahí la unidad es la poza.
 */
export default function PartialRunBanner({ results }: { results: DynamicPartialInfo }) {
  const t = useT();
  if (!results.partial) return null;

  return (
    <div
      className="mb-3 p-3 text-sm"
      style={{
        backgroundColor: '#fef3c7',
        color: 'var(--color-warning, #92400e)',
        borderRadius: 'var(--radius)',
        border: '1px solid #fbbf24',
      }}
      role="alert"
    >
      <strong>{t('execres_partial_title')}</strong>{' '}
      {results.days_completed != null && results.days_total != null
        ? `${results.days_completed}/${results.days_total} ${t('dynres_partial_days')}. `
        : ''}
      {t('dynres_partial_body')}
      {results.error_msg && (
        <span className="block mt-1 font-mono text-xs">{results.error_msg}</span>
      )}
    </div>
  );
}
