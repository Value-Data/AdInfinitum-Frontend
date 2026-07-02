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
/**
 * Formatea un número con convención española: coma decimal y punto de miles.
 * Determinista (no depende de Intl/ICU) para que sea testeable y consistente.
 * Ej: formatEs(1234.5, 2) => "1.234,50" ; formatEs(-0.5, 3) => "-0,500".
 */
export function formatEs(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const dot = fixed.indexOf('.');
  const intPart = dot === -1 ? fixed : fixed.slice(0, dot);
  const decPart = dot === -1 ? '' : fixed.slice(dot + 1);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return sign + grouped + (decPart ? ',' + decPart : '');
}

export function fmtNum(value: number | null | undefined, defaultDecimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '';
  const d = _override == null ? defaultDecimals : _override;
  return formatEs(value as number, d);
}
