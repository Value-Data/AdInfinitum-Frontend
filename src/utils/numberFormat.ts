/* ============================================================
   Global display-decimals override.
   A single setting (persisted) lets the user choose how many decimals
   the result TABLES show, in both the static and dynamic models.
   `null` = "Auto" (each field keeps its own default precision).
   ============================================================ */

const STORAGE_KEY = 'adinf_decimals';

function readInitial(): number | null {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (v == null || v === 'auto') return null;
    const n = parseInt(v, 10);
    return Number.isInteger(n) && n >= 0 && n <= 8 ? n : null;
  } catch {
    return null;
  }
}

let _override: number | null = readInitial();

export function getDecimalsOverride(): number | null {
  return _override;
}

export function setDecimalsOverride(v: number | null): void {
  _override = v;
  try {
    localStorage.setItem(STORAGE_KEY, v == null ? 'auto' : String(v));
  } catch {
    // ignore (private mode, etc.)
  }
}

/**
 * Format a number using `defaultDecimals`, unless a global override is set
 * (in which case the override wins). Returns '' for null/NaN so callers can
 * apply their own fallback (e.g. `fmtNum(x, 2) || '-'`).
 */
export function fmtNum(value: number | null | undefined, defaultDecimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '';
  const d = _override == null ? defaultDecimals : _override;
  return (value as number).toFixed(d);
}
