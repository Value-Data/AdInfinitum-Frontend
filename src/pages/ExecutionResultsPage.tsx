import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ExecutionResult, SolverResult } from '../types';
import { getExecution } from '../services/api';
import { exportExecutionToExcel } from '../utils/exportExecutionExcel';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import KPICards from '../components/KPICards';
import ResultCharts from '../components/ResultCharts';
import ParameterSnapshot from '../components/ParameterSnapshot';
import EncaladoResultPanel from '../components/EncaladoResultPanel';
import PondDetailBreakdown from '../components/PondDetailBreakdown';
import GlobalBalanceTable, {
  type GlobalStreamId,
  type GlobalStreamValues,
} from '../components/GlobalBalanceTable';
import {
  averageEncaladoResults,
  averageSolverResults,
  averageTemperatures,
} from '../utils/averageResults';

type ResultTab =
  | 'resumen'
  | 'global'
  | 'precon'
  | 'encalado'
  | 'postliming'
  | 'graficos'
  | 'parametros';

const TABS_FULL: { key: ResultTab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'global', label: 'Global' },
  { key: 'precon', label: 'Preconcentración' },
  { key: 'encalado', label: 'Encalado' },
  { key: 'postliming', label: 'Post-liming' },
  { key: 'graficos', label: 'Graficos' },
  { key: 'parametros', label: 'Parametros' },
];

// A labeled stage: "Preconcentracion", "Post-liming", or "Dia 1 - Precon", etc.
interface StageData {
  label: string;
  result: SolverResult;
  temperature_C?: number;
}

function extractSingleDayTemperature(
  parameters_snapshot: Record<string, unknown> | null | undefined,
): number | undefined {
  if (!parameters_snapshot) return undefined;
  const schedule = parameters_snapshot.daily_schedule as
    | Array<{ temperature_C?: number }>
    | undefined;
  if (!schedule || schedule.length === 0) return undefined;
  const selectedDays = parameters_snapshot.selected_days as number[] | undefined;
  const idx = selectedDays && selectedDays.length > 0 ? selectedDays[0] : 0;
  return schedule[idx]?.temperature_C ?? schedule[0]?.temperature_C;
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

/**
 * Best-effort mapping from the engine results (precon / encalado / postliming)
 * to the 16 P_2XXX/P_3XXX streams consumed by GlobalBalanceTable.
 * If the backend later ships a `results.streams` object with a full or partial
 * override, those values win (merged per-field).
 */
function buildGlobalStreams(
  precon: SolverResult | undefined,
  encalado: Record<string, unknown> | undefined,
  postliming: SolverResult | undefined,
  preconTemp: number | undefined,
  postlimingTemp: number | undefined,
  encaladoTemp: number | undefined,
  backendOverride?: Partial<Record<GlobalStreamId, GlobalStreamValues>>,
): Partial<Record<GlobalStreamId, GlobalStreamValues>> {
  const out: Partial<Record<GlobalStreamId, GlobalStreamValues>> = {};

  const num = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const sumBrine = (aq: { eq_liquid_dll?: number[] } | undefined): number | undefined => {
    if (!aq?.eq_liquid_dll || !Array.isArray(aq.eq_liquid_dll)) return undefined;
    return aq.eq_liquid_dll.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  };

  // --- Preconcentracion ---
  if (precon) {
    const wellField = sumBrine(precon.initial_aqsol as { eq_liquid_dll?: number[] } | undefined);
    const totalDilPrecon = (precon.ponds ?? []).reduce((a, p) => a + (p.dilution ?? 0), 0);

    out['2001'] = {
      total_mass_day: wellField,
      liquids_day: wellField,
      solids_day: 0,
      temperature: preconTemp,
    };
    out['2002'] = {
      total_mass_day: precon.total_salt + precon.total_entrainment,
      solids_day: precon.total_salt,
      liquids_day: precon.total_entrainment,
      temperature: preconTemp,
    };
    out['2003'] = {
      total_mass_day: precon.total_leakage,
      liquids_day: precon.total_leakage,
      solids_day: 0,
      temperature: preconTemp,
    };
    out['2004'] = {
      total_mass_day: precon.total_evaporation,
      liquids_day: precon.total_evaporation,
      solids_day: 0,
      temperature: preconTemp,
    };
    out['2005'] = {
      total_mass_day: totalDilPrecon,
      liquids_day: totalDilPrecon,
      solids_day: 0,
    };
    out['2006'] = {
      total_mass_day: precon.final_outlet_flow,
      liquids_day: precon.final_outlet_flow,
      solids_day: 0,
      temperature: preconTemp,
    };
  }

  // --- Encalado ---
  if (encalado) {
    const lime = num(encalado.lime_commercial);
    const cacl2 = num(encalado.CaCl2_commercial);
    const h2oSlurry = num(encalado.H2O_slurry);
    const h2oCaCl2 = num(encalado.H2O_CaCl2);
    const cakeWash = num(encalado.cake_wash_flow);
    // Water (2503) = P_2515 = H2O CaCl2 (P_2504) + H2O lechada (P_2508) + Cake wash (P_2514)
    const totalWater =
      h2oSlurry != null || h2oCaCl2 != null || cakeWash != null
        ? (h2oCaCl2 ?? 0) + (h2oSlurry ?? 0) + (cakeWash ?? 0)
        : undefined;
    const cacl2Dry =
      cacl2 != null && h2oCaCl2 != null ? Math.max(0, cacl2 - h2oCaCl2) : undefined;
    const solidsDry = num(encalado.total_solids_dry);
    const solidsWet =
      solidsDry != null || cakeWash != null ? (solidsDry ?? 0) + (cakeWash ?? 0) : undefined;

    out['2501'] = {
      total_mass_day: lime,
      solids_day: lime,
      liquids_day: 0,
      temperature: encaladoTemp,
    };
    out['2502'] = {
      total_mass_day: cacl2,
      solids_day: cacl2Dry,
      liquids_day: h2oCaCl2,
      temperature: encaladoTemp,
    };
    out['2503'] = {
      total_mass_day: totalWater,
      liquids_day: totalWater,
      solids_day: 0,
      temperature: encaladoTemp,
    };
    out['2504'] = {
      total_mass_day: solidsWet,
      solids_day: solidsDry,
      liquids_day: cakeWash,
      temperature: encaladoTemp,
    };
  }

  // --- Postliming ---
  if (postliming) {
    const inlet = sumBrine(postliming.initial_aqsol as { eq_liquid_dll?: number[] } | undefined);
    const totalDilPost = (postliming.ponds ?? []).reduce((a, p) => a + (p.dilution ?? 0), 0);

    out['3001'] = {
      total_mass_day: inlet,
      liquids_day: inlet,
      solids_day: 0,
      temperature: postlimingTemp,
    };
    out['3002'] = {
      total_mass_day: postliming.total_salt + postliming.total_entrainment,
      solids_day: postliming.total_salt,
      liquids_day: postliming.total_entrainment,
      temperature: postlimingTemp,
    };
    out['3003'] = {
      total_mass_day: postliming.total_leakage,
      liquids_day: postliming.total_leakage,
      solids_day: 0,
      temperature: postlimingTemp,
    };
    out['3004'] = {
      total_mass_day: postliming.total_evaporation,
      liquids_day: postliming.total_evaporation,
      solids_day: 0,
      temperature: postlimingTemp,
    };
    out['3005'] = {
      total_mass_day: totalDilPost,
      liquids_day: totalDilPost,
      solids_day: 0,
    };
    out['3006'] = {
      total_mass_day: postliming.final_outlet_flow,
      liquids_day: postliming.final_outlet_flow,
      solids_day: 0,
      temperature: postlimingTemp,
    };
  }

  // Backend override wins per-field
  if (backendOverride) {
    for (const [id, vals] of Object.entries(backendOverride)) {
      const key = id as GlobalStreamId;
      out[key] = { ...(out[key] ?? {}), ...(vals ?? {}) };
    }
  }

  return out;
}

export default function ExecutionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ResultTab>('resumen');
  const [exporting, setExporting] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [viewMode, setViewMode] = useState<'day' | 'average'>('average');

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

  const handleExport = () => {
    if (!execution || !id) return;
    setExporting(true);
    try {
      const blob = exportExecutionToExcel({
        execution,
        stages: stagesToShow,
        encalado: encaladoData,
        streams: streamsForExport,
        isMultiDay: !!isMultiDay,
        viewMode,
        validDaysCount: nValid,
        dailyResults: isMultiDay ? dailyResults : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix =
        isMultiDay && viewMode === 'average'
          ? '_promedio'
          : isMultiDay
            ? `_dia${selectedDay + 1}`
            : '';
      a.download = `ejecucion_${id.substring(0, 8)}${suffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  // For multi-day, show stages of the selected day OR averaged across valid days.
  // For single, show all stages.
  let stagesToShow: StageData[] = [];
  let encaladoData: Record<string, unknown> | null = null;

  // Valid days (no error_stage) used as the denominator for averaging.
  const validDays = isMultiDay
    ? dailyResults.filter((dr) => !(dr.result as { error_stage?: string })?.error_stage)
    : [];
  const nValid = validDays.length;
  const labelSuffix =
    isMultiDay && viewMode === 'average' ? ` (promedio de ${nValid} día${nValid === 1 ? '' : 's'})` : '';

  if (results) {
    if (isMultiDay) {
      if (viewMode === 'average' && nValid > 0) {
        const preconArr = validDays
          .map((dr) => (dr.result as Record<string, unknown>).precon as SolverResult | undefined)
          .filter((p): p is SolverResult => p != null);
        const postArr = validDays
          .map((dr) => (dr.result as Record<string, unknown>).postliming as SolverResult | undefined)
          .filter((p): p is SolverResult => p != null);
        const encArr = validDays
          .map((dr) => (dr.result as Record<string, unknown>).encalado as Record<string, unknown> | undefined)
          .filter((e): e is Record<string, unknown> => e != null);
        const directPreconArr = validDays
          .map((dr) => dr.result as unknown as SolverResult)
          .filter(
            (r) =>
              r &&
              !(r as unknown as { precon?: unknown }).precon &&
              !(r as unknown as { postliming?: unknown }).postliming &&
              Array.isArray((r as unknown as { ponds?: unknown }).ponds),
          );
        const avgTemp = averageTemperatures(validDays.map((dr) => dr.temperature_C));

        if (preconArr.length > 0) {
          stagesToShow.push({
            label: `Preconcentracion${labelSuffix}`,
            result: averageSolverResults(preconArr),
            temperature_C: avgTemp,
          });
        }
        if (encArr.length > 0) {
          encaladoData = averageEncaladoResults(encArr);
        }
        if (postArr.length > 0) {
          stagesToShow.push({
            label: `Post-liming${labelSuffix}`,
            result: averageSolverResults(postArr),
            temperature_C: avgTemp,
          });
        }
        if (preconArr.length === 0 && postArr.length === 0 && directPreconArr.length > 0) {
          stagesToShow.push({
            label: `Preconcentracion${labelSuffix}`,
            result: averageSolverResults(directPreconArr),
            temperature_C: avgTemp,
          });
        }
      } else {
        const dayResult = dailyResults[selectedDay]?.result;
        const dayTemp = dailyResults[selectedDay]?.temperature_C;
        if (dayResult) {
          const fakeSingleDay = dayResult as Record<string, unknown>;
          if (fakeSingleDay.precon) {
            stagesToShow.push({ label: 'Preconcentracion', result: fakeSingleDay.precon as SolverResult, temperature_C: dayTemp });
          }
          if (fakeSingleDay.encalado) {
            encaladoData = fakeSingleDay.encalado as Record<string, unknown>;
          }
          if (fakeSingleDay.postliming) {
            stagesToShow.push({ label: 'Post-liming', result: fakeSingleDay.postliming as SolverResult, temperature_C: dayTemp });
          }
          // Direct solver result (precon-only multi-day)
          if (!fakeSingleDay.precon && !fakeSingleDay.postliming && 'ponds' in fakeSingleDay) {
            stagesToShow.push({ label: 'Preconcentracion', result: fakeSingleDay as unknown as SolverResult, temperature_C: dayTemp });
          }
        }
      }
    } else {
      stagesToShow = extractStages(results);
      const singleTemp = extractSingleDayTemperature(execution.parameters_snapshot);
      stagesToShow = stagesToShow.map(s => ({ ...s, temperature_C: singleTemp }));
      if (results.encalado) {
        encaladoData = results.encalado as Record<string, unknown>;
      }
    }
  }

  // Build the 16-stream payload once (shared by Global tab render + Excel export).
  const streamsForExport: Partial<Record<GlobalStreamId, GlobalStreamValues>> = (() => {
    let precon: SolverResult | undefined;
    let postliming: SolverResult | undefined;
    let encalado: Record<string, unknown> | undefined;
    let preconTemp: number | undefined;
    let postlimingTemp: number | undefined;

    // A "direct" SolverResult is precon-only (has `ponds`, no `precon`/`postliming` wrapper).
    const asDirectPrecon = (r: Record<string, unknown> | undefined): SolverResult | undefined =>
      r && !r.precon && !r.postliming && Array.isArray((r as { ponds?: unknown }).ponds)
        ? (r as unknown as SolverResult)
        : undefined;

    if (isMultiDay && dailyResults) {
      if (viewMode === 'average' && nValid > 0) {
        const preconArr = validDays
          .map((dr) => (dr.result as Record<string, unknown>).precon as SolverResult | undefined)
          .filter((p): p is SolverResult => p != null);
        const postArr = validDays
          .map((dr) => (dr.result as Record<string, unknown>).postliming as SolverResult | undefined)
          .filter((p): p is SolverResult => p != null);
        const encArr = validDays
          .map((dr) => (dr.result as Record<string, unknown>).encalado as Record<string, unknown> | undefined)
          .filter((e): e is Record<string, unknown> => e != null);
        const directPreconArr = validDays
          .map((dr) => asDirectPrecon(dr.result as Record<string, unknown> | undefined))
          .filter((p): p is SolverResult => p != null);
        precon =
          preconArr.length > 0
            ? averageSolverResults(preconArr)
            : directPreconArr.length > 0
              ? averageSolverResults(directPreconArr)
              : undefined;
        postliming = postArr.length > 0 ? averageSolverResults(postArr) : undefined;
        encalado = encArr.length > 0 ? averageEncaladoResults(encArr) : undefined;
        const avgTemp = averageTemperatures(validDays.map((dr) => dr.temperature_C));
        preconTemp = avgTemp;
        postlimingTemp = avgTemp;
      } else {
        const dr = dailyResults[selectedDay];
        const day = dr?.result as Record<string, unknown> | undefined;
        precon = (day?.precon as SolverResult | undefined) ?? asDirectPrecon(day);
        encalado = day?.encalado as Record<string, unknown> | undefined;
        postliming = day?.postliming as SolverResult | undefined;
        preconTemp = dr?.temperature_C;
        postlimingTemp = dr?.temperature_C;
      }
    } else if (results) {
      precon = (results.precon as SolverResult | undefined) ?? asDirectPrecon(results);
      encalado = results.encalado as Record<string, unknown> | undefined;
      postliming = results.postliming as SolverResult | undefined;
      const singleTemp = extractSingleDayTemperature(execution.parameters_snapshot);
      preconTemp = singleTemp;
      postlimingTemp = singleTemp;
    }

    const encaladoTemp =
      ((execution.parameters_snapshot?.encalado_config as Record<string, unknown> | undefined)
        ?.temperature_C as number | undefined) ?? undefined;

    const backendStreams =
      (results as Record<string, unknown> | null | undefined)?.streams as
        | Partial<Record<GlobalStreamId, GlobalStreamValues>>
        | undefined;

    return buildGlobalStreams(
      precon,
      encalado,
      postliming,
      preconTemp,
      postlimingTemp,
      encaladoTemp,
      backendStreams,
    );
  })();

  // Hide tabs that have no data to show
  const hasPrecon = stagesToShow.some(s => s.label.toLowerCase().includes('precon'));
  const hasPostliming = stagesToShow.some(s => s.label.toLowerCase().includes('post'));
  const TABS = TABS_FULL.filter((t) => {
    if (t.key === 'encalado') return encaladoData != null;
    if (t.key === 'precon') return hasPrecon;
    if (t.key === 'postliming') return hasPostliming;
    return true;
  });

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
          {/* Multi-day: summary table + view mode toggle + day selector */}
          {isMultiDay && (
            <>
              <DailySummaryTable dailyResults={dailyResults} />

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Ver:
                </span>
                <div
                  className="inline-flex"
                  style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--color-border)' }}
                >
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor:
                        viewMode === 'average' ? 'var(--color-primary)' : 'transparent',
                      color:
                        viewMode === 'average' ? '#fff' : 'var(--color-text-secondary)',
                    }}
                    onClick={() => setViewMode('average')}
                  >
                    Promedio ({nValid} {nValid === 1 ? 'día' : 'días'})
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor:
                        viewMode === 'day' ? 'var(--color-primary)' : 'transparent',
                      color:
                        viewMode === 'day' ? '#fff' : 'var(--color-text-secondary)',
                      borderLeft: '1px solid var(--color-border)',
                    }}
                    onClick={() => setViewMode('day')}
                  >
                    Día específico
                  </button>
                </div>

                {viewMode === 'day' && (
                  <>
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Día:
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
                  </>
                )}
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

          {activeTab === 'global' && (() => {
            const snap = execution.parameters_snapshot ?? {};
            const encCfg = snap.encalado_config as Record<string, unknown> | undefined;
            const preconDaysYear = (snap.precon_days_year as number | undefined) ?? 365;
            const encaladoDaysYear =
              (snap.encalado_days_year as number | undefined) ??
              (encCfg?.availability_days_year as number | undefined) ??
              328.5;
            const postlimingDaysYear = (snap.postliming_days_year as number | undefined) ?? 365;
            return (
              <GlobalBalanceTable
                streams={streamsForExport}
                preconDaysYear={preconDaysYear}
                encaladoDaysYear={encaladoDaysYear}
                postlimingDaysYear={postlimingDaysYear}
              />
            );
          })()}

          {activeTab === 'precon' && (() => {
            const preconStages = stagesToShow.filter(s =>
              s.label.toLowerCase().includes('precon'),
            );
            if (preconStages.length === 0) {
              return (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No hay datos de preconcentración para esta ejecución.
                </p>
              );
            }
            return (
              <>
                {preconStages.map((s, i) => (
                  <div key={i} className="mb-6">
                    <PondDetailBreakdown
                      stageLabel={s.label}
                      result={s.result}
                      temperature_C={s.temperature_C}
                    />
                  </div>
                ))}
              </>
            );
          })()}

          {activeTab === 'postliming' && (() => {
            const postStages = stagesToShow.filter(s =>
              s.label.toLowerCase().includes('post'),
            );
            if (postStages.length === 0) {
              return (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No hay datos de post-liming para esta ejecución.
                </p>
              );
            }
            return (
              <>
                {postStages.map((s, i) => (
                  <div key={i} className="mb-6">
                    <PondDetailBreakdown
                      stageLabel={s.label}
                      result={s.result}
                      temperature_C={s.temperature_C}
                    />
                  </div>
                ))}
              </>
            );
          })()}

          {activeTab === 'graficos' &&
            renderStageResults((label, result) => (
              <ResultCharts stageLabel={label} result={result} />
            ))}

          {activeTab === 'encalado' && encaladoData && (
            <EncaladoResultPanel
              stageLabel="Encalado"
              result={encaladoData}
              temperature_C={
                ((execution.parameters_snapshot?.encalado_config as Record<string, unknown> | undefined)
                  ?.temperature_C as number | undefined) ?? undefined
              }
            />
          )}

          {activeTab === 'parametros' && execution.parameters_snapshot && (
            <ParameterSnapshot snapshot={execution.parameters_snapshot} />
          )}
        </>
      )}
    </div>
  );
}
