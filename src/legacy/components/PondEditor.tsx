import React from 'react';
import type { PondConfig } from '../types';
import { useT } from '../../i18n/LanguageContext';
import { formatEs } from '../../utils/numberFormat';
import Tip from './common/Tip';

interface Props {
  value: PondConfig[];
  onChange: (ponds: PondConfig[]) => void;
  readOnly?: boolean;
  label?: string;
}

const DEFAULT_POND: Omit<PondConfig, 'name' | 'number'> = {
  area_design_m2: 10000,
  pond_factor: 0.7,
  entrainment_pct: 10.0,
  leakage_mm_day: 0.03,
  dilution_frac: 0.005,
};

export default function PondEditor({ value, onChange, readOnly = false, label }: Props) {
  const t = useT();
  const addPond = () => {
    const num = value.length + 1;
    const pond: PondConfig = {
      name: `${t('pond_default_name')} ${num}`,
      number: num,
      ...DEFAULT_POND,
    };
    onChange([...value, pond]);
  };

  const removePond = (index: number) => {
    const updated = value
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, number: i + 1 }));
    onChange(updated);
  };

  const updatePond = (index: number, field: keyof PondConfig, val: string | number) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  return (
    <div>
      {label && (
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          {label}
        </h4>
      )}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>{t('name')}</th>
              <th>{t('pond_area_m2')}<Tip text={t('dyncfg_tip_process_area')} /></th>
              <th>{t('pond_factor')}<Tip text={t('dyncfg_tip_pond_factor')} /></th>
              <th>{t('pond_entrainment_pct')}<Tip text={t('dyncfg_tip_entrainment')} /></th>
              <th>{t('pond_leakage_mm_d')}<Tip text={t('dyncfg_tip_leakage')} /></th>
              <th>{t('pond_dilution_frac')}<Tip text={t('dyncfg_tip_dilution')} /></th>
              {!readOnly && <th className="w-20">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {value.map((pond, i) => (
              <tr key={i}>
                <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {pond.number}
                </td>
                <td>
                  {readOnly ? (
                    <span className="text-sm">{pond.name}</span>
                  ) : (
                    <input
                      type="text"
                      className="input w-28"
                      value={pond.name}
                      onChange={(e) => updatePond(i, 'name', e.target.value)}
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{formatEs(pond.area_design_m2, 0)}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-28"
                      min={0}
                      step={100}
                      value={pond.area_design_m2}
                      onChange={(e) => updatePond(i, 'area_design_m2', parseFloat(e.target.value) || 0)}
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{pond.pond_factor}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-20"
                      min={0}
                      max={1}
                      step={0.01}
                      value={pond.pond_factor}
                      onChange={(e) => updatePond(i, 'pond_factor', parseFloat(e.target.value) || 0)}
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{pond.entrainment_pct}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-20"
                      min={0}
                      max={100}
                      step={0.1}
                      value={pond.entrainment_pct}
                      onChange={(e) => updatePond(i, 'entrainment_pct', parseFloat(e.target.value) || 0)}
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{pond.leakage_mm_day}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-20"
                      min={0}
                      step={0.001}
                      value={pond.leakage_mm_day}
                      onChange={(e) => updatePond(i, 'leakage_mm_day', parseFloat(e.target.value) || 0)}
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{pond.dilution_frac}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-20"
                      min={0}
                      max={1}
                      step={0.001}
                      value={pond.dilution_frac}
                      onChange={(e) => updatePond(i, 'dilution_frac', parseFloat(e.target.value) || 0)}
                    />
                  )}
                </td>
                {!readOnly && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removePond(i)}
                    >
                      {t('delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button
          type="button"
          className="btn btn-outline btn-sm mt-3"
          onClick={addPond}
        >
          {t('pond_add')}
        </button>
      )}
    </div>
  );
}
