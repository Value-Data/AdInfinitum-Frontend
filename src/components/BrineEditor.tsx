import React from 'react';
import { BRINE_SPECIES_ORDER } from '../types';
import { useT } from '../i18n/LanguageContext';
import { formatEs } from '../utils/numberFormat';
import Tip from './common/Tip';

interface Props {
  value: Record<string, number>;
  onChange: (brine: Record<string, number>) => void;
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
  readOnly = false,
  species,
}: Props) {
  const t = useT();
  const rows = species && species.length ? species : (BRINE_SPECIES_ORDER as string[]);
  const handleChange = (species: string, val: number) => {
    onChange({ ...value, [species]: val });
  };

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th className="w-32">{t('brine_aqueous_components')}<Tip text={t('dyncfg_tip_brine_species')} /></th>
            <th>{t('brine_value')}<Tip text={t('dyncfg_tip_brine_value')} /></th>
            <th className="w-20">{t('brine_unit')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((species) => (
            <tr key={species}>
              <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                {species}
              </td>
              <td>
                {readOnly ? (
                  <span className="font-mono text-sm">
                    {formatEs(value[species] ?? 0, 6)}
                  </span>
                ) : (
                  <input
                    type="number"
                    className="input input-number w-36"
                    step={0.0001}
                    min={0}
                    value={value[species] ?? 0}
                    onChange={(e) =>
                      handleChange(species, parseFloat(e.target.value) || 0)
                    }
                  />
                )}
              </td>
              <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {t('brine_unit_ton_day')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
