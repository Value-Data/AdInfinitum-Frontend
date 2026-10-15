import React from 'react';
import { BRINE_SPECIES_ORDER } from '../types';
import { useT } from '../../i18n/LanguageContext';
import { formatEs } from '../../utils/numberFormat';
import Tip from './common/Tip';

/**
 * Tolerancia de cierre de la composición. Debe coincidir con `PCT_TOLERANCE` de
 * backend/app/services/brine.py: si el editor deja pasar algo que el backend rechaza,
 * el usuario ve un 422 sin saber por qué.
 */
export const BRINE_PCT_TOLERANCE = 0.01;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function brinePercentSum(brine: Record<string, number>): number {
  return Object.values(brine || {}).reduce((s, v) => s + num(v), 0);
}

/** ¿La composición cierra en 100? Una salmuera vacía no cierra: es config incompleta. */
export function brineCloses(brine: Record<string, number>): boolean {
  const s = brinePercentSum(brine);
  return s > 0 && Math.abs(s - 100) <= BRINE_PCT_TOLERANCE;
}

interface Props {
  /** Composición en %w/w por especie. */
  value: Record<string, number>;
  onChange: (brine: Record<string, number>) => void;
  /** Caudal total de la salmuera, ton/d. Es la escala de la composición. */
  totalFlow: number;
  onTotalFlowChange?: (flow: number) => void;
  readOnly?: boolean;
  /**
   * Especies a mostrar, servidas por el catálogo de la versión de AQSOL en que está
   * expresada la config (17 en la 027, 23 en la 066). Si no se pasa, cae al orden
   * canónico de la 027 para no romper llamadas existentes.
   */
  species?: string[];
}

export default function BrineEditor({
  value,
  onChange,
  totalFlow,
  onTotalFlowChange,
  readOnly = false,
  species,
}: Props) {
  const t = useT();
  const rows = species && species.length ? species : (BRINE_SPECIES_ORDER as string[]);

  const handleChange = (sp: string, val: number) => {
    onChange({ ...value, [sp]: Math.min(100, Math.max(0, val)) });
  };

  const sum = brinePercentSum(value);
  const delta = sum - 100;
  const closes = brineCloses(value);
  const flow = num(totalFlow);

  // El ton/d se deriva con pct/100 × flujo, SIN normalizar por la suma real. Es
  // exactamente lo que hace el backend al ejecutar (services/brine.to_ton_day), así
  // que una composición abierta se ve abierta también en esta columna en vez de
  // quedar disimulada por un reescalado que el motor no va a aplicar.
  const massOf = (sp: string) => (num(value[sp]) / 100) * flow;
  const massSum = rows.reduce((s, sp) => s + massOf(sp), 0);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <label className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('dyncfg_brine_total_flow')}
          <Tip text={t('brine_tip_total_flow')} />
        </label>
        {readOnly ? (
          <span className="font-mono text-sm">{formatEs(flow, 4)}</span>
        ) : (
          <input
            type="number"
            className="input input-number w-40"
            step={0.0001}
            min={0}
            value={totalFlow ?? 0}
            onChange={(e) => onTotalFlowChange?.(parseFloat(e.target.value) || 0)}
          />
        )}
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {t('brine_unit_ton_day')}
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th className="w-32">
              {t('brine_aqueous_components')}
              <Tip text={t('dyncfg_tip_brine_species')} />
            </th>
            <th className="w-44">
              %w/w
              <Tip text={t('brine_tip_pct_static')} />
            </th>
            <th>
              {t('brine_unit_ton_day')}
              <Tip text={t('brine_tip_mass_static')} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sp) => (
            <tr key={sp}>
              <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                {sp}
              </td>
              <td>
                {readOnly ? (
                  <span className="font-mono text-sm">{formatEs(num(value[sp]), 6)}</span>
                ) : (
                  <input
                    type="number"
                    className="input input-number w-36"
                    step={0.000001}
                    min={0}
                    max={100}
                    value={value[sp] ?? 0}
                    onChange={(e) => handleChange(sp, parseFloat(e.target.value) || 0)}
                  />
                )}
              </td>
              <td
                className="font-mono text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {formatEs(massOf(sp), 6)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--color-border, #d1d5db)' }}>
            <td className="font-semibold">{t('brine_sum')}</td>
            <td
              className="font-mono text-sm font-semibold"
              style={{ color: closes ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              {formatEs(sum, 6)}
            </td>
            <td className="font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {formatEs(massSum, 6)}
            </td>
          </tr>
        </tfoot>
      </table>

      {!closes && (
        <div
          className="mt-2 text-sm"
          style={{ color: 'var(--color-danger)' }}
          role="alert"
        >
          {t('brine_sum_error')}{' '}
          {sum > 0 && (
            <span className="font-mono">
              ({delta > 0 ? '+' : ''}
              {formatEs(delta, 6)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
