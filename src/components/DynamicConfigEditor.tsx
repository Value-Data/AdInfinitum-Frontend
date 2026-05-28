import React, { useCallback, useMemo, useRef, useState } from 'react';
import type {
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
// Collapsible section (same look as static project detail)
// =========================================================
function SectionHeader({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
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
        <span>{title}</span>
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
// Brine — single table with all 17 species (matches static BrineEditor)
// =========================================================
function BrineSection({
  value,
  onChange,
}: {
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const handleChange = (sp: string, v: number) => onChange({ ...value, [sp]: v });
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th className="w-32">Aqueous components</th>
            <th>Valor</th>
            <th className="w-20">Unidad</th>
          </tr>
        </thead>
        <tbody>
          {BRINE_SPECIES_ORDER.map((sp) => (
            <tr key={sp}>
              <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                {sp}
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-36"
                  step={0.0001}
                  min={0}
                  value={value[sp] ?? 0}
                  onChange={(e) => handleChange(sp, parseFloat(e.target.value) || 0)}
                />
              </td>
              <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                ton/dia
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  apply_berm_factor: true,
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
            <th>Nombre</th>
            <th>Area de proceso (m2)</th>
            <th>Pond Factor</th>
            <th>Entrainment (%)</th>
            <th>Leakage (mm/d)</th>
            <th>Dilucion (frac)</th>
            <th>Target h (m)</th>
            <th>Control</th>
            <th>Berm</th>
            <th>Buffer</th>
            <th>FLUJO target (t/d)</th>
            <th>Floor h (m)</th>
            <th>h arranque (m)</th>
            <th className="w-20">Acciones</th>
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
                  className="input w-28"
                  value={p.control_mode}
                  onChange={(e) =>
                    updatePond(i, {
                      control_mode: e.target.value as DynamicPondConfig['control_mode'],
                    })
                  }
                >
                  <option value="ALTURA">ALTURA</option>
                  <option value="FLUJO_FIJO">FLUJO_FIJO</option>
                </select>
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  checked={p.apply_berm_factor}
                  onChange={(e) => updatePond(i, { apply_berm_factor: e.target.checked })}
                />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  checked={p.is_terminal_buffer}
                  onChange={(e) => updatePond(i, { is_terminal_buffer: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-24"
                  step={0.01}
                  min={0}
                  disabled={p.control_mode !== 'FLUJO_FIJO'}
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
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline btn-sm mt-3" onClick={addPond}>
        + Agregar Poza
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
            <th>Nombre</th>
            <th>Designacion</th>
            <th>Area de proceso (m2)</th>
            <th>Control</th>
            <th>Buffer h (m)</th>
            <th>Target h (m)</th>
            <th>Floor h (m)</th>
            <th>Evap factor</th>
            <th>Leakage (mm/d)</th>
            <th>Entrainment (%)</th>
            <th>Dilucion (frac)</th>
            <th>Pond Factor</th>
            <th className="w-20">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ponds.map((p, i) => (
            <tr key={i}>
              <td>
                <input
                  type="text"
                  className="input w-20"
                  value={p.name}
                  onChange={(e) => updatePond(i, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="input w-24"
                  value={p.designation ?? ''}
                  onChange={(e) => updatePond(i, { designation: e.target.value || null })}
                />
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
                  className="input w-28"
                  value={p.control_mode}
                  onChange={(e) =>
                    updatePond(i, {
                      control_mode: e.target.value as DynamicPostlimingPondConfig['control_mode'],
                    })
                  }
                >
                  <option value="CASCADE">CASCADE</option>
                  <option value="BUFFER">BUFFER</option>
                  <option value="FLUJO_FIJO">FLUJO_FIJO</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  className="input input-number w-20"
                  step={0.01}
                  min={0}
                  disabled={p.control_mode !== 'BUFFER'}
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
                  step={0.01}
                  min={0}
                  value={p.evap_factor}
                  onChange={(e) =>
                    updatePond(i, { evap_factor: parseFloat(e.target.value) || 0 })
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
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline btn-sm mt-3" onClick={addPond}>
        + Agregar Poza
      </button>
    </div>
  );
}

// =========================================================
// Encalado dynamic params — same look as static EncaladoConfigForm (nested expanders)
// =========================================================
interface EncFieldDef {
  key: keyof DynamicEncaladoParams;
  label: string;
  step: number;
  min?: number;
  max?: number;
  type?: 'number' | 'toggle' | 'text';
}
interface EncSectionDef {
  title: string;
  key: string;
  fields: EncFieldDef[];
}
const ENC_SECTIONS: EncSectionDef[] = [
  {
    title: 'General',
    key: 'general',
    fields: [
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
      { key: 'use_CaCl2_threshold_basis', label: 'Threshold basis', step: 0, type: 'text' },
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

function EncaladoParamsSection({
  value,
  onChange,
}: {
  value: DynamicEncaladoParams;
  onChange: (v: DynamicEncaladoParams) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    paso0: false,
    paso1: false,
    paso2: false,
    paso3: false,
  });
  const toggle = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));
  const set = (patch: Partial<DynamicEncaladoParams>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2">
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
  const set = (patch: Partial<DynamicPostlimingParams>) => onChange({ ...params, ...patch });
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        <div>
          <label className="label">n_days_max</label>
          <input
            type="number"
            className="input input-number"
            step={1}
            min={1}
            value={params.n_days_max}
            onChange={(e) => set({ n_days_max: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div>
          <label className="label">Temperatura (C) — vacio = serie clima</label>
          <input
            type="number"
            className="input input-number"
            step={0.1}
            value={params.temperature_C ?? ''}
            onChange={(e) =>
              set({
                temperature_C: e.target.value === '' ? null : parseFloat(e.target.value),
              })
            }
          />
        </div>
        <div>
          <label className="label">Abort AQSOL fail (%)</label>
          <input
            type="number"
            className="input input-number"
            step={0.1}
            min={0}
            max={100}
            value={params.abort_on_aqsol_fail_pct}
            onChange={(e) => set({ abort_on_aqsol_fail_pct: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="label">Validation window (dias, coma)</label>
          <input
            type="text"
            className="input"
            value={params.validation_window_days.join(',')}
            onChange={(e) =>
              set({
                validation_window_days: e.target.value
                  .split(',')
                  .map((s) => parseInt(s.trim()))
                  .filter((n) => !isNaN(n)),
              })
            }
          />
        </div>
      </div>
      <div>
        <label className="label">Sales permitidas (una por linea)</label>
        <textarea
          className="input"
          rows={5}
          value={params.salts_allowed.join('\n')}
          onChange={(e) =>
            set({
              salts_allowed: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
            })
          }
        />
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {params.salts_allowed.length} sales activadas.
        </p>
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
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-4">
        <div>
          <label className="label">n_days (default ejecucion)</label>
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
          <label className="label">Start date (YYYY-MM-DD)</label>
          <input
            type="text"
            className="input"
            value={simulation.start_date}
            onChange={(e) => onChange({ ...simulation, start_date: e.target.value })}
          />
        </div>
      </div>

      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        Modulacion de flujo (cascade)
      </h4>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div>
          <label className="label">Flujo promedio (t/d)</label>
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
          <label className="label">Flujo maximo (t/d)</label>
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
        Modulacion fijada a <span className="font-mono">seasonal</span> (flujo escala con la
        serie de evaporacion diaria).
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
    if (!startDate || isNaN(startDate.getTime())) return `Dia ${i + 1}`;
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
    if (!confirm(`Eliminar los ${n} dias de la serie climatica?`)) return;
    onChange({ ...climate, evaporation_mm_day: [], temperature_C: [] });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error('CSV vacio');
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const evapIdx = header.findIndex((h) => h.startsWith('evap'));
      const tempIdx = header.findIndex((h) => h.startsWith('temp'));
      if (evapIdx < 0 || tempIdx < 0) throw new Error('Faltan columnas evap*/temp*');
      const newEvap: number[] = [];
      const newTemp: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        newEvap.push(parseFloat(cols[evapIdx]));
        newTemp.push(parseFloat(cols[tempIdx]));
      }
      onChange({ ...climate, evaporation_mm_day: newEvap, temperature_C: newTemp });
      setMsg(`Cargados ${newEvap.length} dias.`);
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
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
          <label className="label">Fecha inicio serie (YYYY-MM-DD)</label>
          <input
            type="text"
            className="input"
            placeholder="2024-01-01"
            value={climate.series_start_date}
            onChange={(e) => onChange({ ...climate, series_start_date: e.target.value })}
          />
        </div>
        <div className="text-sm pt-6" style={{ color: 'var(--color-text-secondary)' }}>
          {n} dias cargados
          {n > 0 && (
            <>
              {' · '}
              promedios: evap{' '}
              <span className="font-mono">{avgEvap.toFixed(3)}</span> mm/d (min{' '}
              {minEvap.toFixed(3)}, max {maxEvap.toFixed(3)}) · temp{' '}
              <span className="font-mono">{avgTemp.toFixed(2)}</span> °C (min{' '}
              {minTemp.toFixed(2)}, max {maxTemp.toFixed(2)})
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table>
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface)' }}>
            <tr>
              <th className="w-12">#</th>
              <th>Dia (fecha calculada)</th>
              <th>Temperatura (C)</th>
              <th>Evaporacion (mm/dia)</th>
              <th className="w-20">Acciones</th>
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
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {n === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No hay dias en la serie climatica. Agregue dias o cargue un CSV.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button type="button" className="btn btn-outline btn-sm" onClick={addDay}>
          + Agregar Dia
        </button>

        <div
          className="flex items-end gap-2 border-l pl-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <label className="label">Dias</label>
            <input
              type="number"
              className="input input-number w-16"
              min={1}
              value={bulkDays}
              onChange={(e) => setBulkDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="label">Temp (C)</label>
            <input
              type="number"
              className="input input-number w-16"
              step={0.5}
              value={bulkTemp}
              onChange={(e) => setBulkTemp(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">Evap (mm/d)</label>
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
            Agregar {bulkDays} dias
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
            Reemplazar por CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExport}>
            Descargar CSV
          </button>
          {n > 0 && (
            <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>
              Vaciar serie
            </button>
          )}
        </div>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        Total: {n} dias. La fecha de cada dia se calcula desde la fecha de inicio (read-only).
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const active = factors.filter((f) => f.precipitation_factor <= 1).length;
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
      if (!Array.isArray(parsed)) throw new Error('JSON debe ser un array');
      onChange(parsed);
      setMsg(`Cargadas ${parsed.length} sales.`);
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
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
          <span style={{ color: 'var(--color-text-secondary)' }}>Total:</span>{' '}
          <span className="font-mono">{factors.length}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Activas (F&le;1):</span>{' '}
          <span className="font-mono">{active}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Inhibidas (F&gt;1):</span>{' '}
          <span className="font-mono">{inhibited}</span>
        </span>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          className="input flex-1"
          placeholder="Filtrar por nombre..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
          Cargar JSON
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleExport}>
          Descargar JSON
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
              <th>Sal</th>
              <th className="w-28">Factor</th>
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
        title="0. Simulacion (n_days, start date, flujo cascade)"
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
        title="1. Salmuera de Pozo"
        isOpen={openSections.brine}
        onToggle={() => toggle('brine')}
      >
        <BrineSection
          value={value.brine}
          onChange={(b) => onChange({ ...value, brine: b })}
        />
      </SectionHeader>

      <SectionHeader
        title={`2. Pozas de Preconcentracion (${value.precon.ponds.length})`}
        isOpen={openSections.precon}
        onToggle={() => toggle('precon')}
      >
        <PreconPondsSection
          ponds={value.precon.ponds}
          onChange={(ponds) => onChange({ ...value, precon: { ...value.precon, ponds } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`2b. Factores de Sales Preconcentracion (${value.precon.factors?.length ?? 0})`}
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
        title={`3. Clima (${value.climate.evaporation_mm_day.length} dias)`}
        isOpen={openSections.climate}
        onToggle={() => toggle('climate')}
      >
        <ClimateSection
          climate={value.climate}
          onChange={(c) => onChange({ ...value, climate: c })}
        />
      </SectionHeader>

      <SectionHeader
        title="4. Parametros de Encalado"
        isOpen={openSections.encalado}
        onToggle={() => toggle('encalado')}
      >
        <EncaladoParamsSection
          value={value.encalado.config}
          onChange={(c) => onChange({ ...value, encalado: { ...value.encalado, config: c } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`5. Factores de Sales Encalado (${value.encalado.factors.length})`}
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
        title={`6. Pozas de Post-liming (${value.postliming.ponds.length})`}
        isOpen={openSections.postliming}
        onToggle={() => toggle('postliming')}
      >
        <PostlimingPondsSection
          ponds={value.postliming.ponds}
          onChange={(ponds) =>
            onChange({ ...value, postliming: { ...value.postliming, ponds } })
          }
        />
      </SectionHeader>

      <SectionHeader
        title={`7. Factores de Sales Post-liming (${value.postliming.factors.length})`}
        isOpen={openSections.postliming_factors}
        onToggle={() => toggle('postliming_factors')}
      >
        <FactorsSection
          label="Postliming"
          factors={value.postliming.factors}
          onChange={(f) => onChange({ ...value, postliming: { ...value.postliming, factors: f } })}
        />
      </SectionHeader>
    </div>
  );
}
