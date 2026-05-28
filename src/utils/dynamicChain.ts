/* ============================================================
   Helpers to walk a dynamic execution chain and merge results
   into a unified cascade-style view for cross-stage comparison.
   ============================================================ */

import type {
  DynamicCascadeOrPostlimingResults,
  DynamicEncaladoResults,
  DynamicResults,
} from '../types';
import { getExecution } from '../services/api';
import { scaleResults } from './dynamicScale';

export interface StageFactors {
  precon: number;
  encalado: number;
  postliming: number;
}

export const DEFAULT_STAGE_FACTORS: StageFactors = {
  precon: 1,
  encalado: 1,
  postliming: 1,
};

export interface ChainData {
  /** Ordered chain: cascade → encalado → postliming (any may be missing). */
  stages: DynamicResults[];
  /** Cascade + postliming merged into one cascade-style results object (encalado excluded). */
  merged: DynamicCascadeOrPostlimingResults | null;
  /** Encalado stage extracted separately (it doesn't fit the cascade-pond shape). */
  encalado: DynamicEncaladoResults | null;
  /** IDs of the stages, ordered same as stages. */
  executionIds: string[];
}

/**
 * Walk back via source_execution_id and return the full chain in order
 * (cascade first, postliming last). Stages missing results are skipped.
 */
export async function fetchExecutionChain(rootId: string): Promise<ChainData> {
  const stages: DynamicResults[] = [];
  const executionIds: string[] = [];
  let id: string | null = rootId;
  // Walk upstream, then reverse to get cascade-first order.
  const visited: { id: string; results: DynamicResults | null }[] = [];
  let safety = 10;
  while (id && safety-- > 0) {
    const exec = await getExecution(id);
    visited.push({
      id: exec.id,
      results: (exec.results as unknown as DynamicResults | null) || null,
    });
    id = exec.source_execution_id;
  }
  visited.reverse();
  for (const v of visited) {
    if (v.results) {
      stages.push(v.results);
      executionIds.push(v.id);
    }
  }

  const encalado = stages.find((s): s is DynamicEncaladoResults => s.stage === 'encalado') || null;
  const merged = mergeCascadeAndPostliming(
    stages.filter(
      (s): s is DynamicCascadeOrPostlimingResults => s.stage !== 'encalado',
    ),
  );

  return { stages, merged, encalado, executionIds };
}

/**
 * Re-compute a ChainData using factor overrides per stage (precon / encalado / postliming).
 * Used for the "factor de escalado por proceso" feature.
 *
 * If both encalado and a cascade are present, inserts a synthetic "Pta Qca" row in
 * the merged annual_aggregates (Tabla 1) between cascade and postliming, representing
 * the nominal feed flow from cascade into encalado (doc Section 4).
 */
export function applyFactorsToChain(
  chain: ChainData,
  factors: StageFactors,
): ChainData {
  const stageFactor = (stage: DynamicResults['stage']): number => {
    if (stage === 'cascade') return factors.precon;
    if (stage === 'encalado') return factors.encalado;
    return factors.postliming;
  };
  const scaledStages = chain.stages.map((s) => scaleResults(s, stageFactor(s.stage)));
  const encalado =
    scaledStages.find((s): s is DynamicEncaladoResults => s.stage === 'encalado') || null;
  const cascade = scaledStages.find(
    (s): s is DynamicCascadeOrPostlimingResults => s.stage === 'cascade',
  );
  let merged = mergeCascadeAndPostliming(
    scaledStages.filter(
      (s): s is DynamicCascadeOrPostlimingResults => s.stage !== 'encalado',
    ),
  );
  if (merged && encalado && cascade) {
    merged = insertPtaQcaRow(merged, cascade, encalado);
  }
  return { ...chain, stages: scaledStages, merged, encalado };
}

/**
 * Inserts a synthetic "Pta Qca" pond row between cascade and postliming in the
 * merged annual_aggregates. Data sourced from cascade.feed_to_encalado_summary
 * and the last cascade pond's annual aggregates (density / aw / composition).
 */
function insertPtaQcaRow(
  merged: DynamicCascadeOrPostlimingResults,
  cascade: DynamicCascadeOrPostlimingResults,
  encalado: DynamicEncaladoResults,
): DynamicCascadeOrPostlimingResults {
  const cascadePondNames = new Set(cascade.pond_names);
  const lastCascadePond = cascade.pond_names[cascade.pond_names.length - 1];
  const lastAgg = cascade.annual_aggregates[lastCascadePond];
  const lastComp = cascade.annual_composition_pct[lastCascadePond] || {};
  const lastSpeciesTy = cascade.annual_species_t_year[lastCascadePond] || {};
  const feed = cascade.feed_to_encalado_summary;

  const ptaQcaName = 'Pta Qca';
  const flowOutDay = feed?.avg_flow_ton_day ?? encalado.kpis.flow_out_t_d_avg ?? 0;
  const flowOutY = flowOutDay * 365;

  // Splice "Pta Qca" after the last cascade pond, before any postliming pond.
  const newPondNames: string[] = [];
  for (const n of merged.pond_names) {
    newPondNames.push(n);
    if (n === lastCascadePond) newPondNames.push(ptaQcaName);
  }
  if (!newPondNames.includes(ptaQcaName)) {
    // Defensive: if cascade pond name didn't match (e.g. prefixed), append at end
    const idx = merged.pond_names.findIndex((n) => cascadePondNames.has(n) || n.endsWith(`/${lastCascadePond}`));
    if (idx >= 0) {
      newPondNames.splice(idx + 1, 0, ptaQcaName);
    } else {
      newPondNames.push(ptaQcaName);
    }
  }

  return {
    ...merged,
    pond_names: newPondNames,
    annual_aggregates: {
      ...merged.annual_aggregates,
      [ptaQcaName]: {
        area_m2: 0,
        flow_in_t_d_avg: flowOutDay,
        flow_in_t_y: flowOutY,
        flow_out_t_d_avg: flowOutDay,
        flow_out_t_y: flowOutY,
        hold_up_delta_t: 0,
        evap_t_y: 0,
        evap_mm_d_avg: 0,
        seepage_t_y: 0,
        entrainment_t_y: 0,
        entrainment_pct_avg: 0,
        salt_t_y: 0,
        density_avg: lastAgg?.density_avg ?? 0,
        water_activity_avg: lastAgg?.water_activity_avg ?? 0,
      },
    },
    annual_composition_pct: {
      ...merged.annual_composition_pct,
      [ptaQcaName]: lastComp,
    },
    annual_species_t_year: {
      ...merged.annual_species_t_year,
      [ptaQcaName]: Object.fromEntries(
        Object.entries(lastSpeciesTy).map(([k, v]) => [k, (v / (lastAgg?.flow_out_t_y || 1)) * flowOutY]),
      ),
    },
    annual_salts_t_year: {
      ...merged.annual_salts_t_year,
      [ptaQcaName]: { _total: 0 },
    },
    annual_salts_pct: {
      ...merged.annual_salts_pct,
      [ptaQcaName]: {},
    },
    daily_series: {
      ...merged.daily_series,
      [ptaQcaName]: [],
    },
  };
}

/**
 * Concatenate cascade + postliming results into one cascade-style object so the
 * same DynamicResultsView can render Tablas/Graphs across all pondes.
 *
 * Pond names are namespaced with a stage prefix to avoid collisions when both
 * stages happen to have ponds with the same name.
 */
function mergeCascadeAndPostliming(
  stages: DynamicCascadeOrPostlimingResults[],
): DynamicCascadeOrPostlimingResults | null {
  if (stages.length === 0) return null;
  if (stages.length === 1) return stages[0];

  const base = stages[0];
  const merged: DynamicCascadeOrPostlimingResults = {
    stage: 'cascade',
    run_tag: 'chain',
    n_days_sim: Math.max(...stages.map((s) => s.n_days_sim)),
    pond_names: [],
    table_species: base.table_species,
    default_chart_species: base.default_chart_species,
    main_salts: base.main_salts,
    annual_window: base.annual_window,
    kpis: stages[stages.length - 1].kpis, // last stage's KPIs as the "global" view
    daily_series: {},
    annual_aggregates: {},
    annual_composition_pct: {},
    annual_species_t_year: {},
    annual_salts_t_year: {},
    annual_salts_pct: {},
    output_dir: '',
    files: [],
  };

  for (const s of stages) {
    const prefix = s.stage === 'postliming' ? 'PL' : 'CSC';
    for (const name of s.pond_names) {
      // If the original name doesn't conflict use it; otherwise namespace.
      const finalName =
        merged.pond_names.includes(name) ? `${prefix}/${name}` : name;
      merged.pond_names.push(finalName);
      merged.daily_series[finalName] = s.daily_series[name] || [];
      merged.annual_aggregates[finalName] = s.annual_aggregates[name] || ({} as never);
      merged.annual_composition_pct[finalName] = s.annual_composition_pct[name] || {};
      merged.annual_species_t_year[finalName] = s.annual_species_t_year[name] || {};
      merged.annual_salts_t_year[finalName] = s.annual_salts_t_year[name] || {};
      merged.annual_salts_pct[finalName] = s.annual_salts_pct[name] || {};
    }
  }

  // KPIs: prefer global view = recovery from first cascade pond Li to last postliming pond Li
  const cascadeStage = stages.find((s) => s.stage === 'cascade');
  const postlimingStage = stages.find((s) => s.stage === 'postliming');
  if (cascadeStage && postlimingStage) {
    const firstPond = cascadeStage.pond_names[0];
    const lastPond = postlimingStage.pond_names[postlimingStage.pond_names.length - 1];
    const liIn =
      cascadeStage.annual_species_t_year[firstPond]?.['Li+'] ??
      cascadeStage.kpis.li_in_t_year ?? 0;
    const liOut =
      postlimingStage.annual_species_t_year[lastPond]?.['Li+'] ??
      postlimingStage.kpis.li_out_t_year ?? 0;
    const recovery = liIn > 1e-9 ? (liOut / liIn) * 100 : 0;
    merged.kpis = {
      ...postlimingStage.kpis,
      recovery_li_pct: Math.round(recovery * 1000) / 1000,
      annual_li_production_ton: liOut,
      li_in_t_year: liIn,
      li_out_t_year: liOut,
    };
  }

  return merged;
}
