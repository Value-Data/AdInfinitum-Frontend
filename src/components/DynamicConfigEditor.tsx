import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import { formatEs } from '../utils/numberFormat';
import {
  buildBrineCompositionRows,
  compositionClosure,
  normalizeToHundred,
  setSpeciesPercent,
} from '../utils/brineComposition';
import type { TranslationKey } from '../i18n/translations';
import type {
  DosificacionConfig,
  DosificacionObjetivo,
  DosificacionReactivo,
  DynamicConfig,
  DynamicEncaladoParams,
  DynamicPondConfig,
  DynamicPostlimingParams,
  DynamicPostlimingPondConfig,
  DynamicSimulation,
  SaltFactor,
} from '../types';
import { BRINE_SPECIES_ORDER } from '../types';

type Props = {
  value: DynamicConfig;
  onChange: (next: DynamicConfig) => void;
};

// =========================================================
// Tooltip helper — small info icon with native title tooltip.
// Customer-facing copy comes from DOC_PARAMETROS_UI_MODELO_DINAMICO.
// =========================================================
function Tip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 cursor-help select-none align-middle"
      style={{ color: 'var(--color-text-secondary)', fontSize: '0.75em' }}
      title={text}
      aria-label={text}
    >
      &#9432;
    </span>
  );
}

// =========================================================
// Collapsible section (same look as static project detail)
// =========================================================
function SectionHeader({
  title,
  tooltip,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  tooltip?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-3 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-gray-50"
        style={{ color: 'var(--color-text)' }}
        onClick={onToggle}
      >
        <span>
          {title}
          {tooltip && <Tip text={tooltip} />}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// =========================================================
// Brine — composición en %w/w + masa t/d derivada del flujo total.
//
// El motor normaliza el brine y toma el caudal de precon.average_flow_ton_day, así que
// la entrada es una composición, no un flujo. Entrada libre: no se reescala lo tipeado;
// si no cierra en 100 se avisa y se ofrece normalizar.
// =========================================================
function BrineSection({
  value,
  onChange,
  totalFlow,
}: {
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  totalFlow: number;
}) {
  const t = useT();
  const { rows, totalPct, totalMass } = buildBrineCompositionRows(
    value,
    BRINE_SPECIES_ORDER as unknown as string[],
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

// =========================================================
// Precon ponds — table same style as static PondEditor + extra columns
// =========================================================
const DEFAULT_PRECON_POND: Omit<DynamicPondConfig, 'name' | 'number'> = {
  area_design_m2: 10000,
  pond_factor: 0.7,
  entrainment_pct: 10.0,
  leakage_mm_day: 0.03,
  dilution_frac: 0.005,
  target_height_m: 0.20,
  max_height_m: null,
  is_terminal_buffer: false,
  apply_berm_factor: false, // §A: oculto en UI, forzado a false (su default de motor diverge)
  control_mode: 'ALTURA',
  target_outflow_t_day: null,
  utilization: 1.0,
  height_floor_m: null,
  h_arranque_m: 0.0,
};

function PreconPondsSection({
  ponds,
  onChange,
}: {
  ponds: DynamicPondConfig[];
  onChange: (next: DynamicPondConfig[]) => void;
}) {
  const t = useT();
  const updatePond = (idx: number, patch: Partial<DynamicPondConfig>) => {
    onChange(ponds.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addPond = () => {
    const num = ponds.length + 1;
    const pond: DynamicPondConfig = {
      ...DEFAULT_PRECON_POND,
      name: `1-${num}`,
      number: num,
    };
    onChange([...ponds, pond]);
  };

  const removePond = (idx: number) => {
    const updated = ponds
      .filter((_, i) => i !== idx)
      .map((p, i) => ({ ...p, number: i + 1 }));
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>{t('name')}</th>
            <th>
              {t('dyncfg_th_process_area')}
              <Tip text={t('dyncfg_tip_process_area')} />
            </th>
            <th>
              {t('pond_factor')}
              <Tip text={t('dyncfg_tip_pond_factor')} />
            </th>
            <th>
              {t('pond_entrainment_pct')}
              <Tip text={t('dyncfg_tip_entrainment')} />
            </th>
            <th>
              {t('pond_leakage_mm_d')}
              <Tip text={t('dyncfg_tip_leakage')} />
            </th>
            <th>
              {t('dilution_frac')}
              <Tip text={t('dyncfg_tip_dilution_precon')} />
            </th>
            <th>
              {t('dyncfg_th_target_h')}
              <Tip text={t('dyncfg_tip_target_h')} />
            </th>
            <th>
              {t('control_mode')}
              <Tip text={t('dyncfg_tip_control_precon')} />
            </th>
            <th>
              {t('dyncfg_th_flow_target')}
              <Tip text={t('dyncfg_tip_flow_target')} />
            </th>
            <th>
              {t('dyncfg_th_floor_h')}
              <Tip text={t('dyncfg_tip_floor_h')} />
            </th>
            <th>
              {t('dyncfg_th_startup_h')}
              <Tip text={t('dyncfg_tip_startup_h')} />
            </th>
            <th className="w-20">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {ponds.map((p, i) => (
            <tr key={i}>
              <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {p.number}
              </td>
              <td>
                <input
                  type="text"
                  className="input w-24"
                  value={p.name}
                  onChange={(e) => updatePond(i, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-28"
                  min={0}
                  step={100}
                  value={p.area_design_m2}
                  onChange={(e) =>
                    updatePond(i, { area_design_m2: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  min={0}
                  max={1}
                  step={0.01}
                  value={p.pond_factor}
                  onChange={(e) =>
                    updatePond(i, { pond_factor: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  min={0}
                  max={100}
                  step={0.1}
                  value={p.entrainment_pct}
                  onChange={(e) =>
                    updatePond(i, { entrainment_pct: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  min={0}
                  step={0.001}
                  value={p.leakage_mm_day}
                  onChange={(e) =>
                    updatePond(i, { leakage_mm_day: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  min={0}
                  max={1}
                  step={0.001}
                  value={p.dilution_frac}
                  onChange={(e) =>
                    updatePond(i, { dilution_frac: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  min={0}
                  step={0.01}
                  disabled={p.control_mode !== 'ALTURA'}
                  style={p.control_mode !== 'ALTURA' ? { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' } : undefined}
                  value={p.target_height_m ?? ''}
                  onChange={(e) =>
                    updatePond(i, {
                      target_height_m: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </td>
              <td>
                <select
                  className="input w-32"
                  value={p.control_mode}
                  onChange={(e) =>
                    updatePond(i, {
                      control_mode: e.target.value as DynamicPondConfig['control_mode'],
                    })
                  }
                >
                  <option value="ALTURA">{t('dyncfg_opt_by_height')}</option>
                  <option value="FLUJO_FIJO">{t('dyncfg_opt_buffer_fixed_flow')}</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-24"
                  step={0.01}
                  min={0}
                  disabled={p.control_mode !== 'FLUJO_FIJO'}
                  style={p.control_mode !== 'FLUJO_FIJO' ? { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' } : undefined}
                  value={p.target_outflow_t_day ?? ''}
                  onChange={(e) =>
                    updatePond(i, {
                      target_outflow_t_day: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  value={p.height_floor_m ?? ''}
                  onChange={(e) =>
                    updatePond(i, {
                      height_floor_m: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  disabled={p.control_mode !== 'FLUJO_FIJO'}
                  style={p.control_mode !== 'FLUJO_FIJO' ? { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' } : undefined}
                  value={p.h_arranque_m}
                  onChange={(e) =>
                    updatePond(i, { h_arranque_m: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removePond(i)}
                >
                  {t('delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline btn-sm mt-3" onClick={addPond}>
        {t('pond_add')}
      </button>
    </div>
  );
}

// =========================================================
// Postliming ponds — same style
// =========================================================
const DEFAULT_POSTLIMING_POND: Omit<DynamicPostlimingPondConfig, 'name'> = {
  designation: null,
  area_m2: 10000,
  control_mode: 'CASCADE',
  buffer_height_m: null,
  target_height_m: 0.20,
  height_floor_m: 0.10,
  evap_factor: 1.0,
  leakage_mm_d: 0.03,
  entrainment_pct: 20.0,
  dilution_frac: 0.005,
  pond_factor: 0.7,
};

function PostlimingPondsSection({
  ponds,
  onChange,
}: {
  ponds: DynamicPostlimingPondConfig[];
  onChange: (next: DynamicPostlimingPondConfig[]) => void;
}) {
  const t = useT();
  const updatePond = (idx: number, patch: Partial<DynamicPostlimingPondConfig>) => {
    onChange(ponds.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addPond = () => {
    const nextNum = 10 + ponds.length; // continue Pz10, Pz11, ...
    const newPond: DynamicPostlimingPondConfig = {
      ...DEFAULT_POSTLIMING_POND,
      name: `Pz${nextNum}`,
    };
    onChange([...ponds, newPond]);
  };

  const removePond = (idx: number) => {
    onChange(ponds.filter((_, i) => i !== idx));
  };

  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>{t('name')}</th>
            <th>
              {t('dyncfg_th_process_area')}
              <Tip text={t('dyncfg_tip_process_area')} />
            </th>
            <th>
              {t('control_mode')}
              <Tip text={t('dyncfg_tip_control_postliming')} />
            </th>
            <th>
              {t('dyncfg_th_startup_h')}
              <Tip text={t('dyncfg_tip_startup_h')} />
            </th>
            <th>
              {t('dyncfg_th_target_h')}
              <Tip text={t('dyncfg_tip_target_h')} />
            </th>
            <th>
              {t('dyncfg_th_floor_h')}
              <Tip text={t('dyncfg_tip_floor_h')} />
            </th>
            <th>
              {t('pond_leakage_mm_d')}
              <Tip text={t('dyncfg_tip_leakage')} />
            </th>
            <th>
              {t('pond_entrainment_pct')}
              <Tip text={t('dyncfg_tip_entrainment')} />
            </th>
            <th>
              {t('dilution_frac')}
              <Tip text={t('dyncfg_tip_dilution')} />
            </th>
            <th>
              {t('pond_factor')}
              <Tip text={t('dyncfg_tip_pond_factor')} />
            </th>
            <th className="w-20">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {ponds.map((p, i) => (
            <tr key={i}>
              <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                {p.name}
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-28"
                  min={0}
                  step={100}
                  value={p.area_m2}
                  onChange={(e) => updatePond(i, { area_m2: parseFloat(e.target.value) || 0 })}
                />
              </td>
              <td>
                <select
                  className="input w-32"
                  value={p.control_mode}
                  onChange={(e) =>
                    updatePond(i, {
                      control_mode: e.target.value as DynamicPostlimingPondConfig['control_mode'],
                    })
                  }
                >
                  <option value="CASCADE">{t('dyncfg_opt_by_height')}</option>
                  <option value="BUFFER">{t('dyncfg_opt_buffer_seasonal')}</option>
                  <option value="FLUJO_FIJO">{t('dyncfg_opt_buffer_fixed_flow')}</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  disabled={p.control_mode === 'CASCADE'}
                  style={p.control_mode === 'CASCADE' ? { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' } : undefined}
                  value={p.buffer_height_m ?? ''}
                  onChange={(e) =>
                    updatePond(i, {
                      buffer_height_m: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  disabled={p.control_mode !== 'CASCADE'}
                  style={p.control_mode !== 'CASCADE' ? { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' } : undefined}
                  value={p.target_height_m}
                  onChange={(e) =>
                    updatePond(i, { target_height_m: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  value={p.height_floor_m}
                  onChange={(e) =>
                    updatePond(i, { height_floor_m: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.001}
                  min={0}
                  value={p.leakage_mm_d}
                  onChange={(e) =>
                    updatePond(i, { leakage_mm_d: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.1}
                  min={0}
                  max={100}
                  value={p.entrainment_pct}
                  onChange={(e) =>
                    updatePond(i, { entrainment_pct: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.001}
                  min={0}
                  max={1}
                  value={p.dilution_frac}
                  onChange={(e) =>
                    updatePond(i, { dilution_frac: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  max={1}
                  value={p.pond_factor}
                  onChange={(e) =>
                    updatePond(i, { pond_factor: parseFloat(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removePond(i)}
                >
                  {t('delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline btn-sm mt-3" onClick={addPond}>
        {t('pond_add')}
      </button>
    </div>
  );
}

// =========================================================
// Encalado dynamic params — same look as static EncaladoConfigForm (nested expanders)
// =========================================================
interface EncFieldDef {
  key: keyof DynamicEncaladoParams;
  label: TranslationKey;
  step: number;
  min?: number;
  max?: number;
  type?: 'number' | 'toggle' | 'text';
  tooltip?: TranslationKey;
}
interface EncSectionDef {
  title: TranslationKey;
  key: string;
  fields: EncFieldDef[];
}
const ENC_SECTIONS: EncSectionDef[] = [
  {
    title: 'encfg_section_general',
    key: 'general',
    fields: [
      {
        key: 'temperature_C',
        label: 'dyncfg_enc_temperature',
        step: 0.5,
        min: -10,
        max: 60,
        tooltip: 'dyncfg_tip_enc_temperature',
      },
      {
        key: 'use_CaCl2',
        label: 'encfg_use_CaCl2',
        step: 0,
        type: 'toggle',
        tooltip: 'dyncfg_tip_use_cacl2',
      },
      {
        key: 'use_CaCl2_threshold',
        label: 'dyncfg_so4_mg_threshold',
        step: 0.1,
        min: 0,
        tooltip: 'dyncfg_tip_so4_mg_threshold',
      },
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
    title: 'torta_lavado',
    key: 'torta',
    fields: [
      { key: 'cake_retention', label: 'encfg_cake_retention', step: 0.01, min: 0, max: 1 },
      { key: 'cake_wash_ratio', label: 'encfg_cake_wash_ratio', step: 0.1, min: 0 },
      { key: 'cake_wash_recovery', label: 'encfg_cake_wash_recovery', step: 0.01, min: 0, max: 1 },
    ],
  },
];

// v2: catalog of 5 supported combinations.
const REACTIVOS_OPCIONES = ['Ca(OH)2', 'CaCl2', 'NaOH', 'Na2SO4'] as const;
const OBJETIVOS_OPCIONES = ['Mg', 'SO4', 'Ca'] as const;
const COMBINACIONES_VALIDAS = new Set([
  'Ca(OH)2/Mg', 'CaCl2/SO4', 'Ca(OH)2/SO4', 'NaOH/Mg', 'Na2SO4/Ca',
]);
const REACTIVO_DEFAULTS: Record<string, { factor: number; conc: number }> = {
  'Ca(OH)2': { factor: 1.17, conc: 0.25 },
  'CaCl2': { factor: 0.70, conc: 0.381 },
  'NaOH': { factor: 1.17, conc: 0.50 },
  'Na2SO4': { factor: 1.0, conc: 0.20 },
};

function EncaladoParamsSection({
  value,
  onChange,
}: {
  value: DynamicEncaladoParams;
  onChange: (v: DynamicEncaladoParams) => void;
}) {
  const t = useT();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    paso0: false,
    torta: false,
    secuencia: true,         // open by default — main editor
    flags_v3: false,
  });
  const toggle = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));
  const set = (patch: Partial<DynamicEncaladoParams>) => onChange({ ...value, ...patch });

  // --- v2: secuencia_dosificaciones handlers ---
  const seq = value.secuencia_dosificaciones ?? [];
  const updateDos = (idx: number, patch: Partial<DosificacionConfig>) => {
    const next = seq.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    set({ secuencia_dosificaciones: next });
  };
  const addDos = () => {
    const newDos: DosificacionConfig = {
      reactivo: 'Ca(OH)2',
      objetivo: 'Mg',
      factor_exceso: REACTIVO_DEFAULTS['Ca(OH)2'].factor,
      concentracion_solucion: REACTIVO_DEFAULTS['Ca(OH)2'].conc,
      enabled: true,
    };
    set({ secuencia_dosificaciones: [...seq, newDos] });
  };
  const removeDos = (idx: number) => {
    set({ secuencia_dosificaciones: seq.filter((_, i) => i !== idx) });
  };
  const moveDos = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= seq.length) return;
    const next = [...seq];
    [next[idx], next[target]] = [next[target], next[idx]];
    set({ secuencia_dosificaciones: next });
  };

  return (
    <div className="space-y-2">
      {/* Static sub-sections (General, Paso 0 boro, Torta) */}
      {ENC_SECTIONS.map((section) => (
        <div
          key={section.key}
          className="border"
          style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50"
            style={{ color: 'var(--color-text)' }}
            onClick={() => toggle(section.key)}
          >
            <span>{t(section.title)}</span>
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
                    {t(field.label)}
                    {field.tooltip && <Tip text={t(field.tooltip)} />}
                  </label>
                  {field.type === 'toggle' ? (
                    <button
                      type="button"
                      className="relative inline-flex h-6 w-11 items-center transition-colors"
                      style={{
                        backgroundColor: value[field.key]
                          ? 'var(--color-success)'
                          : 'var(--color-border)',
                        borderRadius: '9999px',
                      }}
                      onClick={() =>
                        set({ [field.key]: !value[field.key] } as Partial<DynamicEncaladoParams>)
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 bg-white transition-transform ${
                          value[field.key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                        style={{ borderRadius: '9999px' }}
                      />
                    </button>
                  ) : field.type === 'text' ? (
                    <input
                      type="text"
                      className="input"
                      value={(value[field.key] as string) ?? ''}
                      onChange={(e) =>
                        set({ [field.key]: e.target.value } as Partial<DynamicEncaladoParams>)
                      }
                    />
                  ) : (
                    <input
                      type="number"
                      className="input input-number"
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      value={(value[field.key] as number | null) ?? ''}
                      onChange={(e) =>
                        set({
                          [field.key]:
                            e.target.value === '' ? null : parseFloat(e.target.value),
                        } as Partial<DynamicEncaladoParams>)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* v2: Secuencia de dosificaciones (reactivo / objetivo / factor / conc / enabled / orden) */}
      <div
        className="border"
        style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50"
          onClick={() => toggle('secuencia')}
        >
          <span>{t('secuencia_dosificaciones')} ({seq.length})</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${openSections.secuencia ? 'rotate-90' : ''}`}
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
        {openSections.secuencia && (
          <div className="px-3 pb-3">
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              {t('dosing_order_note')}
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>{t('reactivo')}</th>
                    <th>{t('objetivo')}</th>
                    <th>{t('factor_exceso')}</th>
                    <th>{t('conc_solucion')}</th>
                    <th>{t('enabled')}</th>
                    <th className="w-28">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {seq.map((d, i) => {
                    const combo = `${d.reactivo}/${d.objetivo}`;
                    const valid = COMBINACIONES_VALIDAS.has(combo);
                    return (
                      <tr
                        key={i}
                        style={{ background: valid ? undefined : '#fff4f4' }}
                      >
                        <td
                          className="font-mono text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {i + 1}
                        </td>
                        <td>
                          <select
                            className="input w-32"
                            value={d.reactivo}
                            onChange={(e) => {
                              const newReactivo = e.target.value as DosificacionReactivo;
                              const defaults = REACTIVO_DEFAULTS[newReactivo];
                              updateDos(i, {
                                reactivo: newReactivo,
                                factor_exceso: defaults?.factor ?? d.factor_exceso,
                                concentracion_solucion: defaults?.conc ?? d.concentracion_solucion,
                              });
                            }}
                          >
                            {REACTIVOS_OPCIONES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="input w-24"
                            value={d.objetivo}
                            onChange={(e) =>
                              updateDos(i, { objetivo: e.target.value as DosificacionObjetivo })
                            }
                          >
                            {OBJETIVOS_OPCIONES.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input input-number w-24"
                            step={0.01}
                            min={0}
                            value={d.factor_exceso}
                            onChange={(e) =>
                              updateDos(i, {
                                factor_exceso: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input input-number w-24"
                            step={0.001}
                            min={0}
                            max={1}
                            value={d.concentracion_solucion}
                            onChange={(e) =>
                              updateDos(i, {
                                concentracion_solucion: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={d.enabled}
                            onChange={(e) => updateDos(i, { enabled: e.target.checked })}
                          />
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={i === 0}
                              onClick={() => moveDos(i, -1)}
                              title={t('dyncfg_move_up')}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={i === seq.length - 1}
                              onClick={() => moveDos(i, 1)}
                              title={t('dyncfg_move_down')}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => removeDos(i)}
                            >
                              X
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm mt-3"
              onClick={addDos}
            >
              {t('add_dosificacion')}
            </button>
            {seq.some((d) => !COMBINACIONES_VALIDAS.has(`${d.reactivo}/${d.objetivo}`)) && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-danger)' }}>
                {t('invalid_combos_warning')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* §A: Flags V3 (use_filtrate_as_aqsol2_base, use_fn_input_subtraction,
          include_cake_wash_in_output) ocultos de la UI — son decisiones internas del
          modelo validadas con Ad-Inf y el backend fuerza sus valores en cada corrida. */}
    </div>
  );
}

function FlagToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="relative inline-flex h-6 w-11 items-center transition-colors"
        style={{
          backgroundColor: value ? 'var(--color-success)' : 'var(--color-border)',
          borderRadius: '9999px',
        }}
        onClick={() => onChange(!value)}
      >
        <span
          className={`inline-block h-4 w-4 bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
          style={{ borderRadius: '9999px' }}
        />
      </button>
      <span className="text-xs">{label}</span>
    </div>
  );
}

// =========================================================
// Postliming params (no expanders — flat grid)
// =========================================================
function PostlimingParamsSection({
  params,
  onChange,
}: {
  params: DynamicPostlimingParams;
  onChange: (v: DynamicPostlimingParams) => void;
}) {
  const t = useT();
  const set = (patch: Partial<DynamicPostlimingParams>) => onChange({ ...params, ...patch });
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {t('dyncfg_general_params')}
      </h4>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        {/* §A: Temperatura postliming oculta — se toma del módulo Clima (forzada a null en backend). */}
        <div>
          <label className="label">
            {t('dyncfg_pz10_avg_outflow')}
            <Tip text={t('dyncfg_tip_pz10_avg_outflow')} />
          </label>
          <input
            type="number"
            className="input input-number"
            step={0.1}
            min={0}
            placeholder={t('dyncfg_ph_auto_derive')}
            value={params.pz10_average_outflow_t_day ?? ''}
            onChange={(e) =>
              set({
                pz10_average_outflow_t_day:
                  e.target.value === '' ? null : parseFloat(e.target.value),
              })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <FlagToggle
          label={t('dyncfg_pz10_seasonal_mod')}
          value={params.use_pz10_seasonal_modulation}
          onChange={(v) => set({ use_pz10_seasonal_modulation: v })}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dyncfg_pz10_seasonal_note')}
        </p>
        {/* §A: apply_berm_factor oculto — forzado a false en backend (su default de motor diverge). */}
      </div>
    </div>
  );
}

// =========================================================
// Simulation + precon meta
// =========================================================
function SimulationSection({
  simulation,
  onChange,
  preconMeta,
  onChangePreconMeta,
}: {
  simulation: DynamicSimulation;
  onChange: (v: DynamicSimulation) => void;
  preconMeta: {
    average_flow_ton_day: number;
    max_flow_ton_day: number;
    flow_modulation: 'seasonal' | 'constant_until_regime';
    n_days_consecutive_regime: number;
  };
  onChangePreconMeta: (v: typeof preconMeta) => void;
}) {
  const t = useT();
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-4">
        <div>
          <label className="label">
            {t('dyncfg_sim_days')}
            <Tip text={t('dyncfg_tip_sim_days')} />
          </label>
          <input
            type="number"
            className="input input-number"
            step={1}
            min={1}
            value={simulation.n_days}
            onChange={(e) => onChange({ ...simulation, n_days: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div>
          <label className="label">
            {t('dyncfg_start_date')}
            <Tip text={t('dyncfg_tip_start_date')} />
          </label>
          <input
            type="text"
            className="input"
            placeholder="YYYY-MM-DD"
            value={simulation.start_date}
            onChange={(e) => onChange({ ...simulation, start_date: e.target.value })}
          />
        </div>
      </div>

      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {t('dyncfg_flow_modulation')}
      </h4>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div>
          <label className="label">
            {t('dyncfg_avg_brine_flow')}
            <Tip text={t('dyncfg_tip_avg_brine_flow')} />
          </label>
          <input
            type="number"
            className="input input-number"
            step={1}
            min={0}
            value={preconMeta.average_flow_ton_day}
            onChange={(e) =>
              onChangePreconMeta({
                ...preconMeta,
                average_flow_ton_day: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
        <div>
          <label className="label">
            {t('dyncfg_max_brine_flow')}
            <Tip text={t('dyncfg_tip_max_brine_flow')} />
          </label>
          <input
            type="number"
            className="input input-number"
            step={1}
            min={0}
            value={preconMeta.max_flow_ton_day}
            onChange={(e) =>
              onChangePreconMeta({
                ...preconMeta,
                max_flow_ton_day: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        {t('dyncfg_modulation_fixed_pre')}{' '}
        <span className="font-mono">seasonal</span>{' '}
        {t('dyncfg_modulation_fixed_post')}
      </p>
    </div>
  );
}

// =========================================================
// Climate — stats + import/export CSV
// =========================================================
function ClimateSection({
  climate,
  onChange,
}: {
  climate: DynamicConfig['climate'];
  onChange: (v: DynamicConfig['climate']) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [bulkDays, setBulkDays] = useState(30);
  const [bulkTemp, setBulkTemp] = useState(20);
  const [bulkEvap, setBulkEvap] = useState(5);

  const evap = climate.evaporation_mm_day;
  const temp = climate.temperature_C;
  const n = Math.min(evap.length, temp.length);

  const avgEvap = n ? evap.reduce((a, b) => a + b, 0) / n : 0;
  const minEvap = n ? Math.min(...evap) : 0;
  const maxEvap = n ? Math.max(...evap) : 0;
  const avgTemp = n ? temp.reduce((a, b) => a + b, 0) / n : 0;
  const minTemp = n ? Math.min(...temp) : 0;
  const maxTemp = n ? Math.max(...temp) : 0;

  // Compute date label for row i from series_start_date + i days
  const startDate = useMemo(() => {
    try {
      return new Date(`${climate.series_start_date}T00:00:00Z`);
    } catch {
      return null;
    }
  }, [climate.series_start_date]);
  const dateLabel = (i: number): string => {
    if (!startDate || isNaN(startDate.getTime())) return `${t('schedule_day')} ${i + 1}`;
    const d = new Date(startDate.getTime() + i * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };

  const updateDay = (i: number, field: 'evap' | 'temp', val: number) => {
    const newEvap = [...evap];
    const newTemp = [...temp];
    if (field === 'evap') newEvap[i] = val;
    else newTemp[i] = val;
    onChange({ ...climate, evaporation_mm_day: newEvap, temperature_C: newTemp });
  };

  const addDay = () => {
    onChange({
      ...climate,
      evaporation_mm_day: [...evap, 5],
      temperature_C: [...temp, 20],
    });
  };

  const addBulk = () => {
    const newEvap = [...evap];
    const newTemp = [...temp];
    for (let i = 0; i < bulkDays; i++) {
      newEvap.push(bulkEvap);
      newTemp.push(bulkTemp);
    }
    onChange({ ...climate, evaporation_mm_day: newEvap, temperature_C: newTemp });
  };

  const removeDay = (i: number) => {
    onChange({
      ...climate,
      evaporation_mm_day: evap.filter((_, idx) => idx !== i),
      temperature_C: temp.filter((_, idx) => idx !== i),
    });
  };

  const clearAll = () => {
    if (!confirm(`${t('dyncfg_climate_clear_confirm_pre')} ${n} ${t('dyncfg_climate_clear_confirm_post')}`)) return;
    onChange({ ...climate, evaporation_mm_day: [], temperature_C: [] });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error(t('dyncfg_csv_empty'));
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const evapIdx = header.findIndex((h) => h.startsWith('evap'));
      const tempIdx = header.findIndex((h) => h.startsWith('temp'));
      if (evapIdx < 0 || tempIdx < 0) throw new Error(t('dyncfg_csv_missing_cols'));
      const newEvap: number[] = [];
      const newTemp: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        newEvap.push(parseFloat(cols[evapIdx]));
        newTemp.push(parseFloat(cols[tempIdx]));
      }
      onChange({ ...climate, evaporation_mm_day: newEvap, temperature_C: newTemp });
      setMsg(`${t('dyncfg_loaded_pre')} ${newEvap.length} ${t('schedule_days_lower')}.`);
    } catch (err) {
      setMsg(`${t('error')}: ${(err as Error).message}`);
    }
  };

  const handleExport = () => {
    const rows = ['day,date,evap_mm_day,temp_C'];
    for (let i = 0; i < n; i++) {
      rows.push(`${i + 1},${dateLabel(i)},${evap[i]},${temp[i]}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `climate_${climate.series_start_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        <div>
          <label className="label">{t('dyncfg_series_start_date')}</label>
          <input
            type="text"
            className="input"
            placeholder="2024-01-01"
            value={climate.series_start_date}
            onChange={(e) => onChange({ ...climate, series_start_date: e.target.value })}
          />
        </div>
        <div className="text-sm pt-6" style={{ color: 'var(--color-text-secondary)' }}>
          {n} {t('dyncfg_days_loaded')}
          {n > 0 && (
            <>
              {' · '}
              {t('dyncfg_averages')}: evap{' '}
              <span className="font-mono">{formatEs(avgEvap, 3)}</span> mm/d (min{' '}
              {formatEs(minEvap, 3)}, max {formatEs(maxEvap, 3)}) · temp{' '}
              <span className="font-mono">{formatEs(avgTemp, 2)}</span> °C (min{' '}
              {formatEs(minTemp, 2)}, max {formatEs(maxTemp, 2)})
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table>
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface)' }}>
            <tr>
              <th className="w-12">#</th>
              <th>
                {t('dyncfg_th_day_calc_date')}
                <Tip text={t('dyncfg_tip_day_calc_date')} />
              </th>
              <th>
                {t('dyncfg_enc_temperature')}
                <Tip text={t('dyncfg_tip_day_temp')} />
              </th>
              <th>
                {t('dyncfg_th_evaporation')}
                <Tip text={t('dyncfg_tip_day_evap')} />
              </th>
              <th className="w-20">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }).map((_, i) => (
              <tr key={i}>
                <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {i + 1}
                </td>
                <td className="font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {dateLabel(i)}
                </td>
                <td>
                  <input
                    type="number"
                    className="input input-number w-24"
                    step={0.5}
                    value={temp[i] ?? 0}
                    onChange={(e) =>
                      updateDay(i, 'temp', parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input input-number w-24"
                    step={0.1}
                    min={0}
                    value={evap[i] ?? 0}
                    onChange={(e) =>
                      updateDay(i, 'evap', parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeDay(i)}
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {n === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dyncfg_climate_empty')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button type="button" className="btn btn-outline btn-sm" onClick={addDay}>
          {t('schedule_add_day')}
        </button>

        <div
          className="flex items-end gap-2 border-l pl-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <label className="label">{t('schedule_days')}</label>
            <input
              type="number"
              className="input input-number w-16"
              min={1}
              value={bulkDays}
              onChange={(e) => setBulkDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="label">{t('schedule_temp_short')}</label>
            <input
              type="number"
              className="input input-number w-16"
              step={0.5}
              value={bulkTemp}
              onChange={(e) => setBulkTemp(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">{t('schedule_evap_short')}</label>
            <input
              type="number"
              className="input input-number w-16"
              step={0.1}
              min={0}
              value={bulkEvap}
              onChange={(e) => setBulkEvap(parseFloat(e.target.value) || 0)}
            />
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={addBulk}>
            {t('add')} {bulkDays} {t('schedule_days_lower')}
          </button>
        </div>

        <div
          className="flex items-end gap-2 border-l pl-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileRef.current?.click()}
          >
            {t('dyncfg_replace_with_csv')}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExport}>
            {t('dyncfg_download_csv')}
          </button>
          {n > 0 && (
            <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>
              {t('dyncfg_clear_series')}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        {t('total')}: {n} {t('schedule_days_lower')}. {t('dyncfg_climate_footnote')}
      </p>
      {msg && (
        <p
          className="text-sm mt-2"
          style={{
            color: msg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

// =========================================================
// Salt factors — table + import/export JSON (matches SaltFactorEditor style)
// =========================================================
function FactorsSection({
  label,
  factors,
  onChange,
}: {
  label: string;
  factors: SaltFactor[];
  onChange: (v: SaltFactor[]) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const favored = factors.filter((f) => f.precipitation_factor < 1).length;
  const normal = factors.filter((f) => f.precipitation_factor === 1).length;
  const inhibited = factors.filter((f) => f.precipitation_factor > 1).length;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(factors, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.toLowerCase()}_factors.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error(t('dyncfg_json_must_be_array'));
      onChange(parsed);
      setMsg(`${t('dyncfg_loaded_pre')} ${parsed.length} ${t('saltfactor_salts')}.`);
    } catch (err) {
      setMsg(`${t('error')}: ${(err as Error).message}`);
    }
  };

  const filtered = filter
    ? factors.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : factors;

  const updateRow = (idx: number, newFactor: number) => {
    onChange(
      factors.map((f, i) => (i === idx ? { ...f, precipitation_factor: newFactor } : f)),
    );
  };

  return (
    <div>
      <div className="flex gap-4 items-center mb-3 text-sm">
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('total')}:</span>{' '}
          <span className="font-mono">{factors.length}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('dyncfg_band_favored')}</span>{' '}
          <span className="font-mono">{favored}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('dyncfg_band_normal')}</span>{' '}
          <span className="font-mono">{normal}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('dyncfg_band_inhibited')}</span>{' '}
          <span className="font-mono">{inhibited}</span>
        </span>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          className="input flex-1"
          placeholder={t('dyncfg_filter_by_name')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
          {t('dyncfg_load_json')}
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleExport}>
          {t('dyncfg_download_json')}
        </button>
      </div>

      {msg && (
        <p
          className="text-sm mb-2"
          style={{
            color: msg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
          }}
        >
          {msg}
        </p>
      )}

      <div
        className="overflow-x-auto"
        style={{ maxHeight: 360, overflowY: 'auto' }}
      >
        <table>
          <thead className="sticky top-0" style={{ background: 'var(--color-surface)' }}>
            <tr>
              <th className="w-12">#</th>
              <th>
                {t('saltfactor_salt')}
                <Tip text={t('dyncfg_tip_salt_name')} />
              </th>
              <th className="w-28">
                {t('saltfactor_factor')}
                <Tip text={t('dyncfg_tip_salt_factor')} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const realIdx = factors.indexOf(f);
              return (
                <tr key={`${label}-${f.dll_index}`}>
                  <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.dll_index}
                  </td>
                  <td className="font-mono text-sm">{f.name}</td>
                  <td>
                    <input
                      type="number"
                      className="input input-number w-24"
                      step={0.01}
                      min={0}
                      value={f.precipitation_factor}
                      onChange={(e) => updateRow(realIdx, parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================
// Main editor
// =========================================================
export default function DynamicConfigEditor({ value, onChange }: Props) {
  const t = useT();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sim: true,
    brine: false,
    precon: false,
    precon_factors: false,
    climate: false,
    encalado: false,
    encalado_factors: false,
    postliming: false,
    postliming_factors: false,
  });
  const toggle = useCallback((k: string) => {
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  return (
    <div>
      <SectionHeader
        title={t('section_simulation')}
        isOpen={openSections.sim}
        onToggle={() => toggle('sim')}
      >
        <SimulationSection
          simulation={value.simulation}
          onChange={(s) => onChange({ ...value, simulation: s })}
          preconMeta={{
            average_flow_ton_day: value.precon.average_flow_ton_day,
            max_flow_ton_day: value.precon.max_flow_ton_day,
            flow_modulation: value.precon.flow_modulation,
            n_days_consecutive_regime: value.precon.n_days_consecutive_regime,
          }}
          onChangePreconMeta={(pm) =>
            onChange({ ...value, precon: { ...value.precon, ...pm } })
          }
        />
      </SectionHeader>

      <SectionHeader
        title={t('section_brine')}
        tooltip={t('dyncfg_section_tip_brine')}
        isOpen={openSections.brine}
        onToggle={() => toggle('brine')}
      >
        <BrineSection
          value={value.brine}
          onChange={(b) => onChange({ ...value, brine: b })}
          totalFlow={value.precon.average_flow_ton_day}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_precon_ponds')} (${value.precon.ponds.length})`}
        isOpen={openSections.precon}
        onToggle={() => toggle('precon')}
      >
        <PreconPondsSection
          ponds={value.precon.ponds}
          onChange={(ponds) => onChange({ ...value, precon: { ...value.precon, ponds } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_precon_factors')} (${value.precon.factors?.length ?? 0})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={openSections.precon_factors}
        onToggle={() => toggle('precon_factors')}
      >
        <FactorsSection
          label="Precon"
          factors={value.precon.factors ?? []}
          onChange={(f) => onChange({ ...value, precon: { ...value.precon, factors: f } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_climate')} (${value.climate.evaporation_mm_day.length})`}
        tooltip={t('dyncfg_section_tip_climate')}
        isOpen={openSections.climate}
        onToggle={() => toggle('climate')}
      >
        <ClimateSection
          climate={value.climate}
          onChange={(c) => onChange({ ...value, climate: c })}
        />
      </SectionHeader>

      <SectionHeader
        title={t('section_encalado_params')}
        isOpen={openSections.encalado}
        onToggle={() => toggle('encalado')}
      >
        <EncaladoParamsSection
          value={value.encalado.config}
          onChange={(c) => onChange({ ...value, encalado: { ...value.encalado, config: c } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_encalado_factors')} (${value.encalado.factors.length})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={openSections.encalado_factors}
        onToggle={() => toggle('encalado_factors')}
      >
        <FactorsSection
          label="Encalado"
          factors={value.encalado.factors}
          onChange={(f) => onChange({ ...value, encalado: { ...value.encalado, factors: f } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_postliming')} (${value.postliming.ponds.length})`}
        isOpen={openSections.postliming}
        onToggle={() => toggle('postliming')}
      >
        <PostlimingParamsSection
          params={value.postliming.config}
          onChange={(c) =>
            onChange({ ...value, postliming: { ...value.postliming, config: c } })
          }
        />
        <PostlimingPondsSection
          ponds={value.postliming.ponds}
          onChange={(ponds) =>
            onChange({ ...value, postliming: { ...value.postliming, ponds } })
          }
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_postliming_factors')} (${value.postliming.factors.length})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={openSections.postliming_factors}
        onToggle={() => toggle('postliming_factors')}
      >
        <FactorsSection
          label="Concentración"
          factors={value.postliming.factors}
          onChange={(f) => onChange({ ...value, postliming: { ...value.postliming, factors: f } })}
        />
      </SectionHeader>
    </div>
  );
}
