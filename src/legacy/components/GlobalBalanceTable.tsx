import React, { useMemo } from 'react';
import { useT } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { getDecimalsOverride, formatEs } from '../../utils/numberFormat';
import { useDecimals } from '../../context/DecimalsContext';

type Phase = 'PRECONCENTRACION' | 'ENCALADO' | 'POSTLIMING';

export type GlobalStreamId =
  | '2001' | '2002' | '2003' | '2004' | '2005' | '2006'
  | '2501' | '2502' | '2503' | '2504'
  | '3001' | '3002' | '3003' | '3004' | '3005' | '3006';

export interface GlobalStreamValues {
  total_mass_year?: number;
  total_mass_day?: number;
  solids_day?: number;
  liquids_day?: number;
  density?: number;
  moisture?: number;
  temperature?: number;
}

interface StreamFormula {
  add: GlobalStreamId[];
  sub?: GlobalStreamId[];
}

interface StreamDef {
  phase: Phase;
  name: string;
  type: 'base' | 'derived';
  formula?: StreamFormula;
}

const ANNUAL_HOURS = 7884;
const DAILY_HOURS = 24;
const DEFAULT_PONDS_DAYS_YEAR = 365; // pozas precon/postliming operan continuo
const DEFAULT_ENCALADO_DAYS_YEAR = 328.5; // disponibilidad por defecto de la planta

interface PhaseDays {
  PRECONCENTRACION: number;
  ENCALADO: number;
  POSTLIMING: number;
}

function daysForPhase(phase: Phase, days: PhaseDays): number {
  return days[phase];
}

const ADDITIVE_PROPS = [
  'total_mass_year',
  'total_mass_day',
  'solids_day',
  'liquids_day',
] as const;
type AdditiveProp = (typeof ADDITIVE_PROPS)[number];

const STREAM_DEFS: Record<GlobalStreamId, StreamDef> = {
  '2001': { phase: 'PRECONCENTRACION', name: 'gbal_2001', type: 'base' },
  '2002': {
    phase: 'PRECONCENTRACION',
    name: 'gbal_2002',
    type: 'base',
  },
  '2003': { phase: 'PRECONCENTRACION', name: 'gbal_2003', type: 'base' },
  '2004': { phase: 'PRECONCENTRACION', name: 'gbal_2004', type: 'base' },
  '2005': { phase: 'PRECONCENTRACION', name: 'gbal_2005', type: 'base' },
  '2006': {
    phase: 'PRECONCENTRACION',
    name: 'gbal_2006',
    type: 'derived',
    formula: { add: ['2001', '2005'], sub: ['2002', '2003', '2004'] },
  },
  '2501': { phase: 'ENCALADO', name: 'gbal_2501', type: 'base' },
  '2502': { phase: 'ENCALADO', name: 'gbal_2502', type: 'base' },
  '2503': { phase: 'ENCALADO', name: 'gbal_2503', type: 'base' },
  '2504': { phase: 'ENCALADO', name: 'gbal_2504', type: 'base' },
  '3001': { phase: 'POSTLIMING', name: 'gbal_3001', type: 'base' },
  '3002': { phase: 'POSTLIMING', name: 'gbal_3002', type: 'base' },
  '3003': { phase: 'POSTLIMING', name: 'gbal_3003', type: 'base' },
  '3004': { phase: 'POSTLIMING', name: 'gbal_3004', type: 'base' },
  '3005': { phase: 'POSTLIMING', name: 'gbal_3005', type: 'base' },
  '3006': {
    phase: 'POSTLIMING',
    name: 'gbal_3006',
    type: 'derived',
    formula: { add: ['3001', '3005'], sub: ['3002', '3003', '3004'] },
  },
};

const STREAM_ORDER: GlobalStreamId[] = [
  '2001', '2002', '2003', '2004', '2005', '2006',
  '2501', '2502', '2503', '2504',
  '3001', '3002', '3003', '3004', '3005', '3006',
];

const PHASE_GROUPS: Array<{ phase: Phase; label: string; ids: GlobalStreamId[] }> = [
  {
    phase: 'PRECONCENTRACION',
    label: 'gbal_phase_precon',
    ids: ['2001', '2002', '2003', '2004', '2005', '2006'],
  },
  {
    phase: 'ENCALADO',
    label: 'gbal_phase_encalado',
    ids: ['2501', '2502', '2503', '2504'],
  },
  {
    phase: 'POSTLIMING',
    label: 'gbal_phase_postliming',
    ids: ['3001', '3002', '3003', '3004', '3005', '3006'],
  },
];

// Evaluation order: bases first, then derived (only 2006 and 3006 are derived in this table)
const EVAL_ORDER: GlobalStreamId[] = [
  '2001', '2002', '2003', '2004', '2005',
  '2501', '2502', '2503', '2504',
  '3001', '3002', '3003', '3004', '3005',
  '2006', '3006',
];

function resolveStreams(
  input: Partial<Record<GlobalStreamId, GlobalStreamValues>>,
): Record<GlobalStreamId, GlobalStreamValues> {
  const out: Record<GlobalStreamId, GlobalStreamValues> = {} as Record<
    GlobalStreamId,
    GlobalStreamValues
  >;

  for (const id of EVAL_ORDER) {
    const def = STREAM_DEFS[id];
    const fromBackend = input[id] ?? {};
    const resolved: GlobalStreamValues = { ...fromBackend };

    if (def.type === 'derived' && def.formula) {
      for (const prop of ADDITIVE_PROPS) {
        if (resolved[prop] === undefined) {
          let sum = 0;
          let any = false;
          for (const src of def.formula.add) {
            const v = out[src]?.[prop];
            if (typeof v === 'number' && Number.isFinite(v)) {
              sum += v;
              any = true;
            }
          }
          for (const src of def.formula.sub ?? []) {
            const v = out[src]?.[prop];
            if (typeof v === 'number' && Number.isFinite(v)) {
              sum -= v;
              any = true;
            }
          }
          if (any) resolved[prop] = sum;
        }
      }
    }

    out[id] = resolved;
  }

  return out;
}

function formatValue(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  const _ov = getDecimalsOverride();
  if (_ov != null) return formatEs(v, _ov);
  if (v === 0) return '0';
  if (Math.abs(v) < 0.01) return v.toExponential(2).replace('.', ',');
  return formatEs(v, 2);
}

interface RowContext {
  stream: GlobalStreamValues;
  daysYear: number;
}

interface RowConfig {
  label: string;
  unit: string;
  dataKey?: AdditiveProp | 'density' | 'moisture' | 'temperature';
  kind?: 'constant' | 'highlight' | 'bold' | 'normal';
  /** Constant value; can depend on the stream's phase (e.g. day/year). */
  constant?: number | ((ctx: RowContext) => number);
  accessor?: (ctx: RowContext) => number | undefined;
}

const ROWS: RowConfig[] = [
  { label: 'gbal_row_hyear', unit: 'h/year', kind: 'constant', constant: ANNUAL_HOURS },
  { label: 'gbal_row_hday', unit: 'h/day', kind: 'constant', constant: DAILY_HOURS },
  { label: 'gbal_row_dayyear', unit: 'day/year', kind: 'constant', constant: ({ daysYear }) => daysYear },
  {
    label: 'gbal_row_total_mass',
    unit: 'ton/year',
    dataKey: 'total_mass_year',
    kind: 'highlight',
    accessor: ({ stream, daysYear }) =>
      stream.total_mass_year ??
      (stream.total_mass_day != null ? stream.total_mass_day * daysYear : undefined),
  },
  {
    label: 'gbal_row_total_mass',
    unit: 'ton/d',
    dataKey: 'total_mass_day',
    kind: 'bold',
    accessor: ({ stream }) => stream.total_mass_day,
  },
  { label: 'gbal_row_solids', unit: 'ton/d', dataKey: 'solids_day', accessor: ({ stream }) => stream.solids_day },
  { label: 'gbal_row_liquids', unit: 'ton/d', dataKey: 'liquids_day', accessor: ({ stream }) => stream.liquids_day },
  { label: 'gbal_row_density', unit: 'kg/m³', dataKey: 'density', accessor: ({ stream }) => stream.density },
  { label: 'gbal_row_moisture', unit: '%', dataKey: 'moisture', accessor: ({ stream }) => stream.moisture },
  { label: 'gbal_row_temperature', unit: '°C', dataKey: 'temperature', accessor: ({ stream }) => stream.temperature },
];

function buildFormulaTooltip(
  id: GlobalStreamId,
  resolved: Record<GlobalStreamId, GlobalStreamValues>,
  dataKey: AdditiveProp,
  daysYear: number,
): string | undefined {
  const def = STREAM_DEFS[id];
  if (def.type !== 'derived' || !def.formula) return undefined;

  const addPart = def.formula.add.join(' + ');
  const subPart =
    def.formula.sub && def.formula.sub.length > 0
      ? ' − ' + def.formula.sub.join(' − ')
      : '';
  const v = resolved[id]?.[dataKey];
  const shown =
    v ?? (dataKey === 'total_mass_year' && resolved[id]?.total_mass_day != null
      ? resolved[id].total_mass_day! * daysYear
      : undefined);
  const valPart = shown !== undefined ? ` = ${formatValue(shown)}` : '';
  return `${id} = ${addPart}${subPart}${valPart}`;
}

export interface GlobalBalanceTableProps {
  streams: Partial<Record<GlobalStreamId, GlobalStreamValues>>;
  title?: string;
  /** Operating days/year per phase. Defaults: 365 / 328.5 / 365. */
  preconDaysYear?: number;
  encaladoDaysYear?: number;
  postlimingDaysYear?: number;
}

export default function GlobalBalanceTable({
  streams,
  title,
  preconDaysYear = DEFAULT_PONDS_DAYS_YEAR,
  encaladoDaysYear = DEFAULT_ENCALADO_DAYS_YEAR,
  postlimingDaysYear = DEFAULT_PONDS_DAYS_YEAR,
}: GlobalBalanceTableProps) {
  const t = useT();
  useDecimals();
  const phaseDays: PhaseDays = {
    PRECONCENTRACION: preconDaysYear,
    ENCALADO: encaladoDaysYear,
    POSTLIMING: postlimingDaysYear,
  };
  const resolved = useMemo(() => resolveStreams(streams), [streams]);

  const surfaceBg = 'var(--color-surface)';
  const groupBg = 'var(--color-bg)';
  const highlightBg = '#f5f5f5';
  const borderCls = 'border border-solid';
  const borderColor = 'var(--color-border)';

  return (
    <div className="card overflow-hidden mb-4">
      <h5
        className="text-xs font-semibold uppercase tracking-wide px-4 pt-3 mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title ?? t('gbal_title')}
      </h5>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse tabular-nums" style={{ borderColor }}>
          <thead>
            {/* Phase grouping header */}
            <tr>
              <th
                rowSpan={3}
                className={`${borderCls} sticky left-0 z-20 text-left px-3 py-2 align-bottom`}
                style={{ backgroundColor: surfaceBg, borderColor, minWidth: '11rem' }}
              >
                {t('gbal_property')}
              </th>
              {PHASE_GROUPS.map((g) => (
                <th
                  key={g.phase}
                  colSpan={g.ids.length}
                  className={`${borderCls} text-center font-semibold px-2 py-1.5 text-xs uppercase tracking-wide`}
                  style={{ backgroundColor: groupBg, borderColor }}
                >
                  {t(g.label as TranslationKey)}
                </th>
              ))}
            </tr>
            {/* Stream ID row */}
            <tr>
              {STREAM_ORDER.map((id) => (
                <th
                  key={id}
                  className={`${borderCls} text-center font-bold px-2 py-1.5`}
                  style={{ backgroundColor: groupBg, borderColor }}
                >
                  {id}
                </th>
              ))}
            </tr>
            {/* Stream name row */}
            <tr>
              {STREAM_ORDER.map((id) => (
                <th
                  key={id}
                  className={`${borderCls} text-center italic px-2 py-1.5 text-xs font-normal`}
                  style={{ backgroundColor: surfaceBg, borderColor, maxWidth: '10rem' }}
                >
                  <span
                    className="block whitespace-normal break-words"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t(STREAM_DEFS[id].name as TranslationKey)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => {
              const rowBg = row.kind === 'highlight' ? highlightBg : undefined;
              const rowWeight = row.kind === 'bold' ? 'font-bold' : '';

              return (
                <tr key={idx} style={{ backgroundColor: rowBg }}>
                  <td
                    className={`${borderCls} sticky left-0 z-10 px-3 py-1.5 ${rowWeight}`}
                    style={{ backgroundColor: rowBg ?? surfaceBg, borderColor }}
                  >
                    <div>{t(row.label as TranslationKey)}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {row.unit}
                    </div>
                  </td>
                  {STREAM_ORDER.map((id) => {
                    const stream = resolved[id];
                    const phase = STREAM_DEFS[id].phase;
                    const daysYear = daysForPhase(phase, phaseDays);
                    const ctx: RowContext = { stream, daysYear };
                    let value: number | undefined;
                    if (row.kind === 'constant') {
                      value = typeof row.constant === 'function' ? row.constant(ctx) : row.constant;
                    } else if (row.accessor) {
                      value = row.accessor(ctx);
                    }
                    const isAdditiveRow =
                      row.dataKey != null &&
                      (ADDITIVE_PROPS as readonly string[]).includes(row.dataKey);
                    const tooltip =
                      isAdditiveRow && STREAM_DEFS[id].type === 'derived'
                        ? buildFormulaTooltip(id, resolved, row.dataKey as AdditiveProp, daysYear)
                        : undefined;
                    return (
                      <td
                        key={id}
                        className={`${borderCls} px-2 py-1.5 text-right ${rowWeight}`}
                        style={{ borderColor }}
                        title={tooltip}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs px-4 pb-3 mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        {t('gbal_footnote_derived')} <strong>2006</strong> = 2001 + 2005 − 2002 − 2003 − 2004 ·{' '}
        <strong>3006</strong> = 3001 + 3005 − 3002 − 3003 − 3004. {t('gbal_footnote_base')}{' '}
        <em>day/year</em>: {t('gbal_phase_precon')} = {preconDaysYear}, {t('gbal_phase_encalado')} = {encaladoDaysYear},
        {' '}{t('gbal_phase_postliming')} = {postlimingDaysYear} {t('gbal_footnote_configurable')}{' '}
        <em>total_mass_year</em>, {t('gbal_footnote_calc')} <em>total_mass_day × day/year</em> {t('gbal_footnote_byphase')}
      </p>
    </div>
  );
}
