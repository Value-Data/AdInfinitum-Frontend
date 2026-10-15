import React from 'react';
import type { ExecutionFile, InventarioResultsWithPartial } from '../types';
import { useT } from '../../i18n/LanguageContext';
import DynamicResultsView from './DynamicResultsView';
import ExecutionFilesTable from './common/ExecutionFilesTable';

/**
 * Resultados del modo con inventario: **son los del modo dinámico**.
 *
 * Mismas pestañas (KPIs, Tabla 1 de balance, Tabla 2 de composiciones, Tabla 3 de
 * sales, tabla compacta, gráficos y archivos), mismo factor de escala, mismos
 * decimales y la misma descarga a Excel. El backend arma el resumen de las tres
 * etapas con el mismo `build_stage_summary`, así que no hay nada que adaptar.
 *
 * Este componente existe solo por las corridas anteriores al cambio de formato, que
 * guardaron un resumen propio del que no salen las tablas.
 */
export default function InventarioResultsView({
  executionId,
  results,
  files,
  snapshot,
}: {
  executionId: string;
  results: InventarioResultsWithPartial;
  files: ExecutionFile[];
  snapshot?: Record<string, unknown> | null;
}) {
  const t = useT();

  // Sin KPIs es una corrida del formato anterior: no hay agregados anuales ni
  // composición por día de dónde calcular las tablas. Se avisa y se dejan los
  // archivos, que sí están, en vez de mostrar una pantalla a medio llenar.
  if (!results.kpis) {
    return (
      <div>
        <div
          className="card p-3 mb-3 text-sm"
          style={{ backgroundColor: '#fef3c7', color: 'var(--color-warning, #92400e)' }}
          role="alert"
        >
          {t('invmode_legacy_results')}
        </div>
        <ExecutionFilesTable executionId={executionId} files={files} />
      </div>
    );
  }

  return (
    <DynamicResultsView
      executionId={executionId}
      results={results}
      files={files}
      snapshot={snapshot}
    />
  );
}
