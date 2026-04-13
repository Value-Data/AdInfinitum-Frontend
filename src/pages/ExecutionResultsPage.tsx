import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ExecutionResult, SolverResult } from '../types';
import { getExecution, exportExecution } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import KPICards from '../components/KPICards';
import BalanceTable from '../components/BalanceTable';
import PropertiesTable from '../components/PropertiesTable';
import SaltsTable from '../components/SaltsTable';
import CompositionTable from '../components/CompositionTable';
import ResultCharts from '../components/ResultCharts';
import ParameterSnapshot from '../components/ParameterSnapshot';
import EncaladoResultPanel from '../components/EncaladoResultPanel';

type ResultTab =
  | 'resumen'
  | 'balance'
  | 'propiedades'
  | 'sales'
  | 'composicion'
  | 'graficos'
  | 'encalado'
  | 'parametros';

const TABS_FULL: { key: ResultTab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'balance', label: 'Balance' },
  { key: 'propiedades', label: 'Propiedades' },
  { key: 'sales', label: 'Sales' },
  { key: 'composicion', label: 'Composicion' },
  { key: 'graficos', label: 'Graficos' },
  { key: 'encalado', label: 'Encalado' },
  { key: 'parametros', label: 'Parametros' },
];

// A labeled stage: "Preconcentracion", "Post-liming", or "Dia 1 - Precon", etc.
interface StageData {
  label: string;
  result: SolverResult;
}

/**
 * Extract displayable stages from the raw results JSON.
 * Handles 3 cases:
 * 1. SolverResult directly (precon single day) — has "ponds" but no "precon"
 * 2. ProcesoCompletoResult (single day) — has "precon", "postliming"
 * 3. SimulacionDiariaResult (multi-day) — has "daily_results"
 */
function extractStages(results: Record<string, unknown>): StageData[] {
  const stages: StageData[] = [];

  // Case 3: Multi-day simulation
  const dailyResults = results.daily_results as Array<{
    day: number;
    date_label: string;
    temperature_C: number;
    evap_rate_mm_day: number;
    result: Record<string, unknown>;
  }> | undefined;

  if (dailyResults && Array.isArray(dailyResults)) {
    for (const dr of dailyResults) {
      const pc = dr.result;
      if (!pc) continue;
      const dayLabel = dr.date_label || `Dia ${dr.day + 1}`;

      if (pc.precon) {
        stages.push({
          label: `${dayLabel} — Preconcentracion`,
          result: pc.precon as SolverResult,
        });
      }
      if (pc.postliming) {
        stages.push({
          label: `${dayLabel} — Post-liming`,
          result: pc.postliming as SolverResult,
        });
      }
      // If the daily result itself is a direct SolverResult (precon-only multi-day)
      if (!pc.precon && !pc.postliming && (pc as Record<string, unknown>).ponds) {
        stages.push({
          label: `${dayLabel} — Preconcentracion`,
          result: pc as unknown as SolverResult,
        });
      }
    }
    return stages;
  }

  // Case 1: Direct SolverResult (has "ponds" but no "precon")
  if ('ponds' in results && !('precon' in results)) {
    stages.push({
      label: 'Preconcentracion',
      result: results as unknown as SolverResult,
    });
    return stages;
  }

  // Case 2: ProcesoCompletoResult (single day)
  if (results.precon) {
    stages.push({
      label: 'Preconcentracion',
      result: results.precon as SolverResult,
    });
  }
  if (results.postliming) {
    stages.push({
      label: 'Post-liming',
      result: results.postliming as SolverResult,
    });
  }

  return stages;
}

/** Build a summary table for multi-day results */
function DailySummaryTable({ dailyResults }: {
  dailyResults: Array<{
    day: number;
    date_label: string;
    temperature_C: number;
    evap_rate_mm_day: number;
    result: Record<string, unknown>;
  }>;
}) {
  return (
    <div className="card overflow-hidden mb-6">
      <h4 className="text-sm font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text)' }}>
        Resumen por dia
      </h4>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Temp (°C)</th>
              <th>Evap (mm/d)</th>
              <th>Li+ entrada</th>
              <th>Li+ salida</th>
              <th>Recovery %</th>
              <th>Evap total</th>
              <th>Sales total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {dailyResults.map((dr, i) => {
              const pc = dr.result || {};
              const precon = pc.precon as SolverResult | undefined;
              const postliming = pc.postliming as SolverResult | undefined;
              const lastStage = postliming || precon;
              const errorStage = pc.error_stage as string | undefined;

              return (
                <tr key={i}>
                  <td className="font-medium">{dr.date_label || `Dia ${dr.day + 1}`}</td>
                  <td className="font-mono text-sm">{dr.temperature_C?.toFixed(1)}</td>
                  <td className="font-mono text-sm">{dr.evap_rate_mm_day?.toFixed(3)}</td>
                  <td className="font-mono text-sm">{precon?.li_in?.toFixed(4) ?? '-'}</td>
                  <td className="font-mono text-sm">{lastStage?.li_out?.toFixed(4) ?? '-'}</td>
                  <td className="font-mono text-sm">{lastStage?.li_recovery_pct?.toFixed(2) ?? '-'}%</td>
                  <td className="font-mono text-sm">{lastStage?.total_evaporation?.toFixed(1) ?? '-'}</td>
                  <td className="font-mono text-sm">{lastStage?.total_salt?.toFixed(1) ?? '-'}</td>
                  <td>
                    {errorStage ? (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#fee2e2', color: 'var(--color-danger)' }}>
                        Error: {errorStage}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#dcfce7', color: 'var(--color-success)' }}>
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExecutionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ResultTab>('resumen');
  const [exporting, setExporting] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  const fetchExecution = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getExecution(id);
      setExecution(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExecution();
  }, [fetchExecution]);

  const handleExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const blob = await exportExecution(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ejecucion_${id.substring(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // handled
    } finally {
      setExporting(false);
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
      second: '2-digit',
    });
  };

  const getDuration = () => {
    if (!execution?.started_at || !execution?.completed_at) return '-';
    const start = new Date(execution.started_at).getTime();
    const end = new Date(execution.completed_at).getTime();
    const diffSec = Math.round((end - start) / 1000);
    if (diffSec < 60) return `${diffSec} segundos`;
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    return `${min}m ${sec}s`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="card p-8 text-center">
        <p style={{ color: 'var(--color-danger)' }}>Ejecucion no encontrada.</p>
      </div>
    );
  }

  const results = execution.results as Record<string, unknown> | null;
  const typeLabels: Record<string, string> = {
    proceso_completo: 'Proceso Completo',
    preconcentracion: 'Preconcentracion',
  };

  // Detect multi-day
  const dailyResults = results?.daily_results as Array<{
    day: number;
    date_label: string;
    temperature_C: number;
    evap_rate_mm_day: number;
    result: Record<string, unknown>;
  }> | undefined;
  const isMultiDay = dailyResults && Array.isArray(dailyResults) && dailyResults.length > 0;
  const numDays = isMultiDay ? dailyResults.length : 1;

  // For multi-day, show stages of the selected day. For single, show all stages.
  let stagesToShow: StageData[] = [];
  let encaladoData: Record<string, unknown> | null = null;

  if (results) {
    if (isMultiDay) {
      const dayResult = dailyResults[selectedDay]?.result;
      if (dayResult) {
        const fakeSingleDay = dayResult as Record<string, unknown>;
        if (fakeSingleDay.precon) {
          stagesToShow.push({ label: 'Preconcentracion', result: fakeSingleDay.precon as SolverResult });
        }
        if (fakeSingleDay.encalado) {
          encaladoData = fakeSingleDay.encalado as Record<string, unknown>;
        }
        if (fakeSingleDay.postliming) {
          stagesToShow.push({ label: 'Post-liming', result: fakeSingleDay.postliming as SolverResult });
        }
        // Direct solver result (precon-only multi-day)
        if (!fakeSingleDay.precon && !fakeSingleDay.postliming && 'ponds' in fakeSingleDay) {
          stagesToShow.push({ label: 'Preconcentracion', result: fakeSingleDay as unknown as SolverResult });
        }
      }
    } else {
      stagesToShow = extractStages(results);
      if (results.encalado) {
        encaladoData = results.encalado as Record<string, unknown>;
      }
    }
  }

  // Only show encalado tab if there's encalado data
  const TABS = TABS_FULL.filter(t => t.key !== 'encalado' || encaladoData != null);

  const renderStageResults = (
    renderFn: (label: string, result: SolverResult) => React.ReactNode,
  ) => {
    if (stagesToShow.length === 0) {
      return (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No hay datos disponibles para esta vista.
        </p>
      );
    }
    return (
      <>
        {stagesToShow.map((s, i) => (
          <div key={i} className="mb-6">
            {renderFn(s.label, s.result)}
          </div>
        ))}
      </>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="label">Tipo</span>
              <p className="text-sm font-medium">
                {typeLabels[execution.execution_type] || execution.execution_type}
              </p>
            </div>
            <div>
              <span className="label">Estado</span>
              <div className="mt-0.5">
                <StatusBadge status={execution.status} />
              </div>
            </div>
            {isMultiDay && (
              <div>
                <span className="label">Dias</span>
                <p className="text-sm font-mono">{numDays}</p>
              </div>
            )}
            <div>
              <span className="label">Creado</span>
              <p className="text-sm font-mono">{formatDate(execution.created_at)}</p>
            </div>
            <div>
              <span className="label">Inicio</span>
              <p className="text-sm font-mono">{formatDate(execution.started_at)}</p>
            </div>
            <div>
              <span className="label">Duracion</span>
              <p className="text-sm font-mono">{getDuration()}</p>
            </div>
          </div>

          {execution.status === 'completed' && (
            <button
              className="btn btn-outline"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <LoadingSpinner size="sm" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
              Descargar Excel
            </button>
          )}
        </div>

        {execution.error_message && (
          <div
            className="mt-3 p-3 text-sm"
            style={{
              backgroundColor: '#fee2e2',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius)',
            }}
          >
            <strong>Error:</strong> {execution.error_message}
          </div>
        )}
      </div>

      {/* Result Tabs */}
      {execution.status === 'completed' && results && (
        <>
          {/* Multi-day: summary table + day selector */}
          {isMultiDay && (
            <>
              <DailySummaryTable dailyResults={dailyResults} />

              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Ver detalle del dia:
                </span>
                <select
                  className="input"
                  style={{ width: 'auto' }}
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                >
                  {dailyResults.map((dr, i) => (
                    <option key={i} value={i}>
                      {dr.date_label || `Dia ${dr.day + 1}`} (T={dr.temperature_C}°C)
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div
            className="flex gap-0 border-b mb-6 overflow-x-auto"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key ? 'border-current' : 'border-transparent'
                }`}
                style={{
                  color:
                    activeTab === tab.key
                      ? 'var(--color-primary)'
                      : 'var(--color-text-secondary)',
                  borderColor:
                    activeTab === tab.key ? 'var(--color-primary)' : 'transparent',
                }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'resumen' &&
            renderStageResults((label, result) => (
              <KPICards stageLabel={label} result={result} />
            ))}

          {activeTab === 'balance' &&
            renderStageResults((label, result) => (
              <BalanceTable stageLabel={label} result={result} />
            ))}

          {activeTab === 'propiedades' &&
            renderStageResults((label, result) => (
              <PropertiesTable stageLabel={label} result={result} />
            ))}

          {activeTab === 'sales' &&
            renderStageResults((label, result) => (
              <SaltsTable stageLabel={label} result={result} />
            ))}

          {activeTab === 'composicion' &&
            renderStageResults((label, result) => (
              <CompositionTable stageLabel={label} result={result} />
            ))}

          {activeTab === 'graficos' &&
            renderStageResults((label, result) => (
              <ResultCharts stageLabel={label} result={result} />
            ))}

          {activeTab === 'encalado' && encaladoData && (
            <EncaladoResultPanel stageLabel="Encalado" result={encaladoData} />
          )}

          {activeTab === 'parametros' && execution.parameters_snapshot && (
            <ParameterSnapshot snapshot={execution.parameters_snapshot} />
          )}
        </>
      )}
    </div>
  );
}
