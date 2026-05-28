/* ============================================================
   Post-execution scale factor (Section 3.5 of dynamic model doc)
   Multiplies flows / masses / salts / reagents by a factor.
   Does NOT scale compositions %w/w, heights, densities, water activity.
   ============================================================ */

import type {
  DynamicCascadeOrPostlimingResults,
  DynamicEncaladoResults,
  DynamicResults,
} from '../types';

/** Fields in daily_series (cascade/postliming) that scale with flow factor. */
const CP_DAILY_SCALE_KEYS = [
  'inflow_ton',
  'outflow_ton',
  'evaporation_ton',
  'salt_precipitated_ton',
  'mass_liquid_ton',
] as const;

/** Fields in annual_aggregates that scale. */
const ANNUAL_AGG_SCALE_KEYS = [
  'flow_in_t_d_avg',
  'flow_in_t_y',
  'flow_out_t_d_avg',
  'flow_out_t_y',
  'hold_up_delta_t',
  'evap_t_y',
  'seepage_t_y',
  'entrainment_t_y',
  'salt_t_y',
] as const;

/** KPIs that scale. */
const KPI_SCALE_KEYS = [
  'annual_li_production_ton',
  'li_in_t_year',
  'li_out_t_year',
  'flow_out_t_d_avg',
] as const;

/** Encalado daily_series fields that scale. */
const ENC_DAILY_SCALE_KEYS = [
  'feed_total_ton',
  'lechada_t_d',
  'cacl2_t_d',
  'flow_out_t_d',
] as const;

function mulRecord<T>(obj: T, keys: readonly string[], f: number): T {
  const out = { ...(obj as object) } as Record<string, unknown>;
  for (const k of keys) {
    const v = (obj as unknown as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v * f;
    }
  }
  return out as unknown as T;
}

function mulNumericDict(
  d: Record<string, number> | undefined,
  f: number,
): Record<string, number> {
  if (!d) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(d)) {
    out[k] = typeof v === 'number' && Number.isFinite(v) ? v * f : v;
  }
  return out;
}

/**
 * Apply a multiplicative factor to all flow-like quantities in a DynamicResults.
 * Returns a NEW object — original is untouched.
 */
export function scaleResults(
  results: DynamicResults,
  factor: number,
): DynamicResults {
  if (factor === 1) return results;

  if (results.stage === 'encalado') {
    return scaleEncalado(results, factor);
  }
  return scaleCascadeOrPostliming(results, factor);
}

function scaleCascadeOrPostliming(
  r: DynamicCascadeOrPostlimingResults,
  f: number,
): DynamicCascadeOrPostlimingResults {
  const scaled: DynamicCascadeOrPostlimingResults = {
    ...r,
    kpis: mulRecord(r.kpis, KPI_SCALE_KEYS, f),
    daily_series: {},
    annual_aggregates: {},
    annual_species_t_year: {},
    annual_salts_t_year: {},
    // %w/w + heights/aw/densities NOT scaled:
    annual_composition_pct: r.annual_composition_pct,
    annual_salts_pct: r.annual_salts_pct,
  };
  for (const name of r.pond_names) {
    scaled.daily_series[name] = (r.daily_series[name] || []).map((s) =>
      mulRecord(s, CP_DAILY_SCALE_KEYS, f),
    );
    scaled.annual_aggregates[name] = mulRecord(
      r.annual_aggregates[name] || ({} as never),
      ANNUAL_AGG_SCALE_KEYS,
      f,
    );
    scaled.annual_species_t_year[name] = mulNumericDict(
      r.annual_species_t_year[name],
      f,
    );
    scaled.annual_salts_t_year[name] = mulNumericDict(
      r.annual_salts_t_year[name],
      f,
    );
  }
  return scaled;
}

function scaleEncalado(
  r: DynamicEncaladoResults,
  f: number,
): DynamicEncaladoResults {
  return {
    ...r,
    kpis: mulRecord(r.kpis, KPI_SCALE_KEYS, f),
    daily_series: r.daily_series.map((row) =>
      mulRecord(row, ENC_DAILY_SCALE_KEYS, f),
    ),
    reagents_daily: r.reagents_daily.map((row) => ({
      ...row,
      lechada_t_d: row.lechada_t_d * f,
      cacl2_t_d: row.cacl2_t_d * f,
    })),
  };
}
