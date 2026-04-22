import React, { useMemo } from 'react';

export type StreamId =
  | 'P_2501'
  | 'P_2502'
  | 'P_2504'
  | 'P_2505'
  | 'P_2506'
  | 'P_2508'
  | 'P_2509'
  | 'P_2511'
  | 'P_2514'
  | 'P_2515'
  | 'P_2516'
  | 'P_2517'
  | 'P_2518'
  | 'P_2519'
  | 'P_2520';

export interface StreamValues {
  total_mass_day?: number;
  solids?: number;
  liquids?: number;
  density?: number;
  moisture?: number;
  temperature?: number;
  ph?: number;
}

export interface SulfateRemovalTableProps {
  streams: Partial<Record<StreamId, StreamValues>>;
  title?: string;
}

type StreamType = 'base' | 'derived';

interface StreamFormula {
  add: StreamId[];
  sub?: StreamId[];
}

interface StreamDef {
  name: string;
  type: StreamType;
  formula?: StreamFormula;
}

const ANNUAL_HOURS = 7884;
const DAILY_HOURS = 24;
const YEARLY_DAYS = 328.5;

const ADDITIVE_PROPS = ['total_mass_day', 'solids', 'liquids'] as const;

const STREAM_DEFS: Record<StreamId, StreamDef> = {
  P_2501: { name: 'Preconcentrated brine', type: 'base' },
  P_2502: { name: 'Calcium chloride', type: 'base' },
  P_2504: { name: 'Water for CaCl2 solution', type: 'base' },
  P_2505: { name: 'CaCl2 solution', type: 'derived', formula: { add: ['P_2502', 'P_2504'] } },
  P_2506: { name: 'Lime', type: 'base' },
  P_2508: { name: 'Water for Lime milk', type: 'base' },
  P_2509: { name: 'Lime milk', type: 'derived', formula: { add: ['P_2506', 'P_2508'] } },
  P_2511: { name: 'Treated slurry', type: 'derived', formula: { add: ['P_2501', 'P_2505', 'P_2509'] } },
  P_2514: { name: 'Cake wash water', type: 'base' },
  P_2515: { name: 'Water feed', type: 'derived', formula: { add: ['P_2504', 'P_2508', 'P_2514'] } },
  P_2516: { name: 'Filtrated Solution', type: 'derived', formula: { add: ['P_2511'], sub: ['P_2518'] } },
  P_2517: { name: 'Cake wash solution', type: 'base' },
  P_2518: { name: 'Salts', type: 'base' },
  P_2519: { name: 'Total treated Brine', type: 'derived', formula: { add: ['P_2516', 'P_2517'] } },
  P_2520: { name: 'Salts to final disposition', type: 'base' },
};

// Display order (as specified)
const STREAM_ORDER: StreamId[] = [
  'P_2501', 'P_2502', 'P_2504', 'P_2505', 'P_2506', 'P_2508', 'P_2509',
  'P_2511', 'P_2514', 'P_2515', 'P_2516', 'P_2517', 'P_2518', 'P_2519', 'P_2520',
];

// Evaluation order — bases first, then derived respecting dependencies
const EVAL_ORDER: StreamId[] = [
  // bases
  'P_2501', 'P_2502', 'P_2504', 'P_2506', 'P_2508',
  'P_2514', 'P_2517', 'P_2518', 'P_2520',
  // derived level 1
  'P_2505', 'P_2509',
  // derived level 2 (depends on level 1)
  'P_2511', 'P_2515',
  // derived level 3 (depends on P_2511)
  'P_2516',
  // derived level 4 (depends on P_2516)
  'P_2519',
];

function resolveStreams(
  input: Partial<Record<StreamId, StreamValues>>,
): Record<StreamId, StreamValues> {
  const out: Record<StreamId, StreamValues> = {} as Record<StreamId, StreamValues>;

  for (const id of EVAL_ORDER) {
    const def = STREAM_DEFS[id];
    const fromBackend = input[id] ?? {};
    const resolved: StreamValues = { ...fromBackend };

    if (def.type === 'derived' && def.formula) {
      for (const prop of ADDITIVE_PROPS) {
        if (resolved[prop] === undefined) {
          let sum = 0;
          let anyContributor = false;
          for (const srcId of def.formula.add) {
            const srcVal = out[srcId]?.[prop];
            if (typeof srcVal === 'number' && !Number.isNaN(srcVal)) {
              sum += srcVal;
              anyContributor = true;
            }
          }
          for (const srcId of def.formula.sub ?? []) {
            const srcVal = out[srcId]?.[prop];
            if (typeof srcVal === 'number' && !Number.isNaN(srcVal)) {
              sum -= srcVal;
              anyContributor = true;
            }
          }
          if (anyContributor) resolved[prop] = sum;
        }
      }
    }

    out[id] = resolved;
  }

  return out;
}

function formatNum(v: number | undefined, digits = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  if (Math.abs(v) < 1e-3 && digits > 2) return v.toExponential(3);
  return v.toFixed(digits);
}

interface RowConfig {
  label: string;
  unit: string;
  digits?: number;
  getValue: (stream: StreamValues, id: StreamId) => number | undefined;
}

const ROWS: RowConfig[] = [
  { label: 'Annual oper', unit: 'h/year', digits: 0, getValue: () => ANNUAL_HOURS },
  { label: 'Daily operat', unit: 'h/day', digits: 0, getValue: () => DAILY_HOURS },
  { label: 'Year Operati', unit: 'day/year', digits: 1, getValue: () => YEARLY_DAYS },
  {
    label: 'Total Mass',
    unit: 't/año',
    digits: 1,
    getValue: (s) => (s.total_mass_day != null ? s.total_mass_day * YEARLY_DAYS : undefined),
  },
  {
    label: 'Total Mass',
    unit: 't/h',
    digits: 3,
    getValue: (s) => (s.total_mass_day != null ? s.total_mass_day / DAILY_HOURS : undefined),
  },
  { label: 'Total Mass', unit: 'ton/d', digits: 3, getValue: (s) => s.total_mass_day },
  { label: 'Solids', unit: 'ton/d', digits: 3, getValue: (s) => s.solids },
  { label: 'Liquids', unit: 'ton/d', digits: 3, getValue: (s) => s.liquids },
  { label: 'Density *', unit: 'kg/m³', digits: 2, getValue: (s) => s.density },
  { label: 'Moisture', unit: '%', digits: 2, getValue: (s) => s.moisture },
  { label: 'Temperature', unit: '°C', digits: 1, getValue: (s) => s.temperature },
  { label: 'pH', unit: '-', digits: 2, getValue: (s) => s.ph },
];

export default function SulfateRemovalTable({
  streams,
  title = 'Remoción de sulfatos (CaCl₂ + Cal) — Streams del proceso',
}: SulfateRemovalTableProps) {
  const resolved = useMemo(() => resolveStreams(streams), [streams]);

  return (
    <div className="card overflow-hidden mb-4">
      <h5
        className="text-xs font-semibold uppercase tracking-wide px-4 pt-3 mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h5>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10"
                style={{ backgroundColor: 'var(--color-surface)', minWidth: '10rem' }}
              >
                Propiedad
              </th>
              {STREAM_ORDER.map((id) => {
                const def = STREAM_DEFS[id];
                return (
                  <th key={id} className="whitespace-nowrap">
                    <div className="font-semibold">{id}</div>
                    <div
                      className="text-xs font-normal"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {def.name}
                    </div>
                    <div
                      className="text-xs font-normal italic"
                      style={{ color: def.type === 'derived' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                    >
                      {def.type === 'derived' ? 'derivado' : 'base'}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td
                  className="font-medium text-sm sticky left-0 z-10"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div>{row.label}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.unit}
                  </div>
                </td>
                {STREAM_ORDER.map((id) => {
                  const stream = resolved[id];
                  const v = row.getValue(stream, id);
                  return (
                    <td key={id} className="font-mono text-xs">
                      {formatNum(v, row.digits ?? 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs px-4 pb-3 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        * Propiedades no aditivas (Density, Moisture, Temperature, pH) en columnas derivadas solo se
        muestran si el backend las entrega. Las propiedades aditivas (Total Mass, Solids, Liquids)
        se calculan por suma element-wise siguiendo la fórmula del stream, salvo que el backend haya
        provisto un valor explícito (en cuyo caso se respeta).
      </p>
    </div>
  );
}
