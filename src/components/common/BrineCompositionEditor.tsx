import React from 'react';
import {
  buildBrineCompositionRows,
  compositionClosure,
  normalizeToHundred,
  setSpeciesPercent,
} from '../../utils/brineComposition';
import { BRINE_SPECIES_ORDER } from '../../types';
import { formatEs } from '../../utils/numberFormat';
import { useT } from '../../i18n/LanguageContext';
import Tip from './Tip';

/**
 * Tabla de la salmuera de pozo: composición en %w/w editable, con el t/d de cada
 * especie derivado del caudal total.
 *
 * Estaba dentro de `DynamicConfigEditor`. Se movió acá para que el modo con
 * inventario muestre exactamente la misma tabla —con sus tips, el cierre en 100% y
 * el botón de normalizar— en vez de una versión propia más pobre.
 */


// =========================================================
// Collapsible section (same look as static project detail)
// =========================================================
// =========================================================
// Brine — composición en %w/w + masa t/d derivada del flujo total.
//
// El motor normaliza el brine y toma el caudal de precon.average_flow_ton_day, así que
// la entrada es una composición, no un flujo. Entrada libre: no se reescala lo tipeado;
// si no cierra en 100 se avisa y se ofrece normalizar.
// =========================================================
export default function BrineCompositionEditor({
  value,
  onChange,
  totalFlow,
  species,
}: {
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  totalFlow: number;
  /**
   * Especies a mostrar, servidas por el catálogo de la base AQSOL de la config
   * (17 en la 027, 23 en la 066). Si no se pasa —catálogo aún cargando o caído—
   * cae al orden canónico de la 027, igual que el BrineEditor del estático.
   */
  species?: string[];
}) {
  const t = useT();
  const { rows, totalPct, totalMass } = buildBrineCompositionRows(
    value,
    species && species.length ? species : (BRINE_SPECIES_ORDER as unknown as string[]),
    totalFlow,
  );
  const closure = compositionClosure(value);

  const handleChange = (sp: string, v: number) => onChange(setSpeciesPercent(value, sp, v));

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <span className="text-sm font-semibold">
          {t('dyncfg_brine_total_flow')}:{' '}
          <span className="font-mono">{formatEs(totalFlow, 0)}</span> t/d
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dyncfg_brine_flow_hint')}
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
              <Tip text={t('dyncfg_tip_brine_pct')} />
            </th>
            {/* Sin ancho fijo: absorbe el resto para quedar junto al input, no en el borde. */}
            <th>
              t/d
              <Tip text={t('dyncfg_tip_brine_mass')} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.species}>
              <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                {r.species}
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-36"
                  step={0.000001}
                  min={0}
                  max={100}
                  value={r.pct}
                  onChange={(e) => handleChange(r.species, parseFloat(e.target.value) || 0)}
                />
              </td>
              <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {formatEs(r.mass, 0)}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td>Total</td>
            <td
              className="font-mono text-sm"
              style={{ color: closure.closes ? undefined : 'var(--color-danger)' }}
            >
              {formatEs(totalPct, 4)}
            </td>
            <td className="font-mono text-xs">{formatEs(totalMass, 0)}</td>
          </tr>
        </tbody>
      </table>

      {!closure.closes && (
        <div
          className="mt-2 p-2 rounded text-xs"
          style={{
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning)',
          }}
          role="alert"
        >
          <div className="font-semibold" style={{ color: 'var(--color-danger)' }}>
            ⚠ {t('dyncfg_brine_not_closing')} —{' '}
            {closure.delta < 0 ? t('dyncfg_brine_missing') : t('dyncfg_brine_excess')}{' '}
            {formatEs(Math.abs(closure.delta), 4)} %w/w.
          </div>
          <div className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {t('dyncfg_brine_engine_note')}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm mt-2"
            onClick={() => onChange(normalizeToHundred(value))}
          >
            {t('dyncfg_brine_normalize')}
          </button>
        </div>
      )}
    </div>
  );
}