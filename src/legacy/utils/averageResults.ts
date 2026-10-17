/* ============================================================
   Averaging helpers for multi-day executions.
   Every value = Σ (días válidos) / N (días válidos).
   ============================================================ */

import type { AQSOLResult, PondResult, SolverResult } from '../types';

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function avgNumber(vals: Array<number | null | undefined>): number {
  const valid = vals.filter(finite);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Sum-of-days / N (total valid days). Missing keys count as 0.
function avgDict(
  dicts: Array<Record<string, number> | null | undefined>,
  n: number,
): Record<string, number> {
  const keys = new Set<string>();
  for (const d of dicts) if (d) for (const k of Object.keys(d)) keys.add(k);
  const out: Record<string, number> = {};
  for (const k of keys) {
    let sum = 0;
    for (const d of dicts) {
      const v = d?.[k];
      if (finite(v)) sum += v;
    }
    out[k] = n > 0 ? sum / n : 0;
  }
  return out;
}

function avgArrayElementwise(
  arrs: Array<number[] | null | undefined>,
): number[] {
  const valid = arrs.filter((a): a is number[] => Array.isArray(a));
  if (valid.length === 0) return [];
  const len = Math.max(...valid.map((a) => a.length));
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const vals = valid.map((a) => a[i]).filter(finite);
    out.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  }
  return out;
}

function avgAQSOL(results: AQSOLResult[]): AQSOLResult {
  const n = results.length;
  return {
    eq_liquid_dll: avgArrayElementwise(results.map((r) => r.eq_liquid_dll)),
    eq_liquid: avgDict(
      results.map((r) => r.eq_liquid),
      n,
    ),
    phases_dll: avgArrayElementwise(results.map((r) => r.phases_dll)),
    precipitated_salts: avgDict(
      results.map((r) => r.precipitated_salts),
      n,
    ),
    total_solids_g: avgNumber(results.map((r) => r.total_solids_g)),
    saturation_indices: avgArrayElementwise(
      results.map((r) => r.saturation_indices),
    ),
    properties_raw: avgArrayElementwise(results.map((r) => r.properties_raw)),
    water_activity: avgNumber(results.map((r) => r.water_activity)),
    density_liquid: avgNumber(results.map((r) => r.density_liquid)),
    density_solid: avgNumber(results.map((r) => r.density_solid)),
    pH: avgNumber(results.map((r) => r.pH)),
    ionic_strength: avgNumber(results.map((r) => r.ionic_strength)),
    Cp_liquid: avgNumber(results.map((r) => r.Cp_liquid)),
    error_code: 0,
    timeout_remaining: 0,
  };
}

function avgPondAtIndex(ponds: PondResult[]): PondResult {
  const first = ponds[0];
  return {
    config: first.config,
    aqsol_result: avgAQSOL(ponds.map((p) => p.aqsol_result)),
    evaporation: avgNumber(ponds.map((p) => p.evaporation)),
    salt_precipitated: avgNumber(ponds.map((p) => p.salt_precipitated)),
    entrainment: avgNumber(ponds.map((p) => p.entrainment)),
    leakage: avgNumber(ponds.map((p) => p.leakage)),
    dilution: avgNumber(ponds.map((p) => p.dilution)),
    outlet_flow: avgNumber(ponds.map((p) => p.outlet_flow)),
    aqsol_input: avgArrayElementwise(ponds.map((p) => p.aqsol_input)),
    iterations: Math.round(avgNumber(ponds.map((p) => p.iterations))),
    converged: ponds.every((p) => p.converged),
  };
}

export function averageSolverResults(results: SolverResult[]): SolverResult {
  const nPonds = Math.min(...results.map((r) => r.ponds.length));
  const avgPonds: PondResult[] = [];
  for (let i = 0; i < nPonds; i++) {
    avgPonds.push(avgPondAtIndex(results.map((r) => r.ponds[i])));
  }
  return {
    initial_aqsol: avgAQSOL(results.map((r) => r.initial_aqsol)),
    ponds: avgPonds,
    total_evaporation: avgNumber(results.map((r) => r.total_evaporation)),
    total_salt: avgNumber(results.map((r) => r.total_salt)),
    total_entrainment: avgNumber(results.map((r) => r.total_entrainment)),
    total_leakage: avgNumber(results.map((r) => r.total_leakage)),
    final_outlet_flow: avgNumber(results.map((r) => r.final_outlet_flow)),
    li_in: avgNumber(results.map((r) => r.li_in)),
    li_out: avgNumber(results.map((r) => r.li_out)),
    li_recovery_pct: avgNumber(results.map((r) => r.li_recovery_pct)),
  };
}

// Average encalado: heterogeneous dict (numbers, dicts of numbers, nested AQSOL, etc.)
export function averageEncaladoResults(
  encs: Array<Record<string, unknown>>,
): Record<string, unknown> {
  if (encs.length === 0) return {};
  const n = encs.length;
  const allKeys = new Set<string>();
  for (const e of encs) for (const k of Object.keys(e)) allKeys.add(k);

  const out: Record<string, unknown> = {};
  for (const key of allKeys) {
    const vals = encs.map((e) => e[key]);
    const firstVal = vals.find((v) => v != null);

    if (finite(firstVal)) {
      out[key] = avgNumber(vals as Array<number | null | undefined>);
    } else if (typeof firstVal === 'boolean' || typeof firstVal === 'string') {
      out[key] = firstVal;
    } else if (Array.isArray(firstVal)) {
      out[key] = avgArrayElementwise(vals as Array<number[] | undefined>);
    } else if (firstVal && typeof firstVal === 'object') {
      const dicts = vals.filter(
        (v): v is Record<string, unknown> =>
          v != null && typeof v === 'object' && !Array.isArray(v),
      );
      const sampleKey = Object.keys(dicts[0] ?? {})[0];
      const sampleVal =
        sampleKey !== undefined ? (dicts[0] as Record<string, unknown>)[sampleKey] : undefined;
      if (finite(sampleVal)) {
        // numeric dict (composition, precipitated_salts, pct, etc.)
        out[key] = avgDict(dicts as Array<Record<string, number>>, n);
      } else {
        // nested object (e.g., aqsol1_result) — recurse
        out[key] = averageEncaladoResults(dicts);
      }
    } else {
      out[key] = firstVal ?? null;
    }
  }
  return out;
}

export function averageTemperatures(temps: Array<number | undefined>): number | undefined {
  const valid = temps.filter(finite);
  if (valid.length === 0) return undefined;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
