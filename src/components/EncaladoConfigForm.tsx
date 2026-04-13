import React, { useState } from 'react';
import type { EncaladoConfig } from '../types';

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
    title: 'General',
    key: 'general',
    fields: [
      { key: 'availability_days_year', label: 'Dias disponibles/ano', step: 0.5, min: 0, max: 365 },
      { key: 'temperature_C', label: 'Temperatura (C)', step: 0.5, min: -10, max: 60 },
    ],
  },
  {
    title: 'Paso 0 - Remocion de Boro',
    key: 'paso0',
    fields: [
      { key: 'boron_removal_fraction', label: 'Fraccion de remocion de boro', step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    title: 'Paso 1 - Cal',
    key: 'paso1',
    fields: [
      { key: 'lime_excess_factor', label: 'Factor de exceso de cal', step: 0.01, min: 1 },
      { key: 'lime_slurry_conc', label: 'Conc. lechada de cal', step: 0.01, min: 0, max: 1 },
      { key: 'lime_CaO_purity', label: 'Pureza CaO', step: 0.001, min: 0, max: 1 },
    ],
  },
  {
    title: 'Paso 2 - CaCl2',
    key: 'paso2',
    fields: [
      { key: 'use_CaCl2', label: 'Usar CaCl2', step: 0, type: 'toggle' },
      { key: 'CaCl2_SO4_factor', label: 'Factor SO4 CaCl2', step: 0.01, min: 0 },
      { key: 'CaCl2_sol_conc', label: 'Conc. solucion CaCl2', step: 0.001, min: 0, max: 1 },
      { key: 'CaCl2_purity', label: 'Pureza CaCl2', step: 0.0001, min: 0, max: 1 },
      { key: 'CaCl2_NaCl_fraction', label: 'Fraccion NaCl en CaCl2', step: 0.0001, min: 0, max: 1 },
      { key: 'CaCl2_MgCl2_fraction', label: 'Fraccion MgCl2 en CaCl2', step: 0.0001, min: 0, max: 1 },
      { key: 'CaCl2_CaSO4_fraction', label: 'Fraccion CaSO4 en CaCl2', step: 0.0001, min: 0, max: 1 },
    ],
  },
  {
    title: 'Paso 3 - Torta/Lavado',
    key: 'paso3',
    fields: [
      { key: 'cake_retention', label: 'Retencion de torta', step: 0.01, min: 0, max: 1 },
      { key: 'cake_wash_ratio', label: 'Ratio de lavado', step: 0.1, min: 0 },
      { key: 'cake_wash_recovery', label: 'Recuperacion de lavado', step: 0.01, min: 0, max: 1 },
    ],
  },
];

export default function EncaladoConfigForm({ value, onChange, readOnly = false }: Props) {
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
            <span>{section.title}</span>
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
                  <label className="label">{field.label}</label>
                  {field.type === 'toggle' ? (
                    readOnly ? (
                      <span className="text-sm font-mono">
                        {(value[field.key] as boolean) ? 'Si' : 'No'}
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
