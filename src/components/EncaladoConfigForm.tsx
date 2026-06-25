import React, { useState } from 'react';
import type { EncaladoConfig } from '../types';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import Tip from './common/Tip';

const FIELD_TIPS: Partial<Record<keyof EncaladoConfig, TranslationKey>> = {
  temperature_C: 'dyncfg_tip_enc_temperature',
  use_CaCl2: 'dyncfg_tip_use_cacl2',
};

interface Props {
  value: EncaladoConfig;
  onChange: (config: EncaladoConfig) => void;
  readOnly?: boolean;
}

interface FieldDef {
  key: keyof EncaladoConfig;
  label: string;
  step: number;
  min?: number;
  max?: number;
  type?: 'number' | 'toggle';
}

interface SectionDef {
  title: string;
  key: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    title: 'encfg_section_general',
    key: 'general',
    fields: [
      { key: 'availability_days_year', label: 'encfg_availability_days_year', step: 0.5, min: 0, max: 365 },
      { key: 'temperature_C', label: 'encfg_temperature_C', step: 0.5, min: -10, max: 60 },
    ],
  },
  {
    title: 'encfg_section_paso0',
    key: 'paso0',
    fields: [
      { key: 'boron_removal_fraction', label: 'encfg_boron_removal_fraction', step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    title: 'encfg_section_paso1',
    key: 'paso1',
    fields: [
      { key: 'lime_excess_factor', label: 'encfg_lime_excess_factor', step: 0.01, min: 1 },
      { key: 'lime_slurry_conc', label: 'encfg_lime_slurry_conc', step: 0.01, min: 0, max: 1 },
      { key: 'lime_CaO_purity', label: 'encfg_lime_CaO_purity', step: 0.001, min: 0, max: 1 },
    ],
  },
  {
    title: 'encfg_section_paso2',
    key: 'paso2',
    fields: [
      { key: 'use_CaCl2', label: 'encfg_use_CaCl2', step: 0, type: 'toggle' },
      { key: 'CaCl2_SO4_factor', label: 'encfg_CaCl2_SO4_factor', step: 0.01, min: 0 },
      { key: 'CaCl2_sol_conc', label: 'encfg_CaCl2_sol_conc', step: 0.001, min: 0, max: 1 },
      { key: 'CaCl2_purity', label: 'encfg_CaCl2_purity', step: 0.0001, min: 0, max: 1 },
      { key: 'CaCl2_NaCl_fraction', label: 'encfg_CaCl2_NaCl_fraction', step: 0.0001, min: 0, max: 1 },
      { key: 'CaCl2_MgCl2_fraction', label: 'encfg_CaCl2_MgCl2_fraction', step: 0.0001, min: 0, max: 1 },
      { key: 'CaCl2_CaSO4_fraction', label: 'encfg_CaCl2_CaSO4_fraction', step: 0.0001, min: 0, max: 1 },
    ],
  },
  {
    title: 'encfg_section_paso3',
    key: 'paso3',
    fields: [
      { key: 'cake_retention', label: 'encfg_cake_retention', step: 0.01, min: 0, max: 1 },
      { key: 'cake_wash_ratio', label: 'encfg_cake_wash_ratio', step: 0.1, min: 0 },
      { key: 'cake_wash_recovery', label: 'encfg_cake_wash_recovery', step: 0.01, min: 0, max: 1 },
    ],
  },
];

export default function EncaladoConfigForm({ value, onChange, readOnly = false }: Props) {
  const t = useT();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    paso0: false,
    paso1: false,
    paso2: false,
    paso3: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFieldChange = (key: keyof EncaladoConfig, val: number | boolean) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-2">
      {SECTIONS.map((section) => (
        <div
          key={section.key}
          className="border"
          style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50"
            style={{ color: 'var(--color-text)' }}
            onClick={() => toggleSection(section.key)}
          >
            <span>{t(section.title as TranslationKey)}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${openSections[section.key] ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {openSections[section.key] && (
            <div className="px-3 pb-3 grid gap-3 grid-cols-1 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="label">
                    {t(field.label as TranslationKey)}
                    {FIELD_TIPS[field.key] && <Tip text={t(FIELD_TIPS[field.key] as TranslationKey)} />}
                  </label>
                  {field.type === 'toggle' ? (
                    readOnly ? (
                      <span className="text-sm font-mono">
                        {(value[field.key] as boolean) ? t('yes') : t('no')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 items-center transition-colors ${
                          value[field.key] ? '' : 'opacity-50'
                        }`}
                        style={{
                          backgroundColor: value[field.key]
                            ? 'var(--color-success)'
                            : 'var(--color-border)',
                          borderRadius: '9999px',
                        }}
                        onClick={() =>
                          handleFieldChange(field.key, !(value[field.key] as boolean))
                        }
                      >
                        <span
                          className={`inline-block h-4 w-4 bg-white transition-transform ${
                            value[field.key] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                          style={{ borderRadius: '9999px' }}
                        />
                      </button>
                    )
                  ) : readOnly ? (
                    <span className="font-mono text-sm">
                      {(value[field.key] as number).toFixed(4)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number"
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      value={value[field.key] as number}
                      onChange={(e) =>
                        handleFieldChange(field.key, parseFloat(e.target.value) || 0)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
