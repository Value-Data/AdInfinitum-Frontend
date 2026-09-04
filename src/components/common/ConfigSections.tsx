import React, { useState } from 'react';
import { useT } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type {
  DosificacionConfig,
  DosificacionObjetivo,
  DosificacionReactivo,
  DynamicEncaladoParams,
  DynamicPondConfig,
  DynamicPostlimingParams,
  DynamicPostlimingPondConfig,
} from '../../types';

/**
 * Secciones de configuración compartidas entre el modo dinámico y el modo con
 * inventario.
 *
 * Vivían dentro de `DynamicConfigEditor`. Están acá porque los dos modos tienen que
 * mostrar **la misma estructura**: mismas secciones, mismas columnas y mismas
 * etiquetas. Manteniéndolas en un solo lugar eso es automático — si se agrega una
 * columna a las pozas, aparece en los dos — en vez de depender de que alguien copie
 * el cambio de un editor al otro.
 *
 * Lo único propio del modo con inventario es el estado inicial de las pozas, que no
 * está acá porque el dinámico no lo tiene: sus pozas arrancan vacías.
 */

// =========================================================
// Tooltip — icono de info con title nativo.
// El texto sale de DOC_PARAMETROS_UI_MODELO_DINAMICO.
// =========================================================
export function Tip({ text }: { text: string }) {
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

export function FlagToggle({
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
// Simulación — horizonte, fecha de inicio y modulación de flujo
// =========================================================

/**
 * Los cuatro valores son los mismos en los dos modos aunque vivan en lugares
 * distintos del blob: el dinámico los tiene en `simulation` y `precon`, el modo con
 * inventario en la raíz del escenario y en `feed`. Por eso la sección recibe
 * primitivos y devuelve un parche, en vez de un sub-objeto.
 */
export function SimulationSection({
  nDays,
  startDate,
  avgFlow,
  maxFlow,
  onChange,
}: {
  nDays: number;
  startDate: string;
  avgFlow: number;
  maxFlow: number;
  onChange: (patch: {
    nDays?: number;
    startDate?: string;
    avgFlow?: number;
    maxFlow?: number;
  }) => void;
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
            value={nDays}
            onChange={(e) => onChange({ nDays: parseInt(e.target.value) || 1 })}
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
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
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
            value={avgFlow}
            onChange={(e) => onChange({ avgFlow: parseFloat(e.target.value) || 0 })}
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
            value={maxFlow}
            onChange={(e) => onChange({ maxFlow: parseFloat(e.target.value) || 0 })}
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
// Pozas de preconcentración
// =========================================================
export const DEFAULT_PRECON_POND: Omit<DynamicPondConfig, 'name' | 'number'> = {
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

export function PreconPondsSection({
  ponds,
  onChange,
  nameOf,
}: {
  ponds: DynamicPondConfig[];
  onChange: (next: DynamicPondConfig[]) => void;
  /** Nombre de una poza nueva. El dinámico numera `1-N`; el modo con inventario
   *  usa los nombres de la faena, así que puede pasar el suyo. */
  nameOf?: (index: number) => string;
}) {
  const t = useT();
  const updatePond = (idx: number, patch: Partial<DynamicPondConfig>) => {
    onChange(ponds.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addPond = () => {
    const num = ponds.length + 1;
    const pond: DynamicPondConfig = {
      ...DEFAULT_PRECON_POND,
      name: nameOf ? nameOf(num) : `1-${num}`,
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
              {t('dyncfg_th_max_h')}
              <Tip text={t('dyncfg_tip_max_h')} />
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
                <input
                  type="number"
                  className="input input-number w-20"
                  min={0}
                  step={0.01}
                  value={p.max_height_m ?? ''}
                  onChange={(e) =>
                    updatePond(i, {
                      max_height_m: e.target.value === '' ? null : parseFloat(e.target.value),
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
// Parámetros de encalado — expanders anidados, igual que el estático
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

// v2: catálogo de las 5 combinaciones soportadas.
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

export function EncaladoParamsSection({
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
    secuencia: true,         // abierta por defecto — es el editor principal
    flags_v3: false,
  });
  const toggle = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));
  const set = (patch: Partial<DynamicEncaladoParams>) => onChange({ ...value, ...patch });

  // --- v2: secuencia_dosificaciones ---
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
      {/* Sub-secciones fijas (General, Paso 0 boro, Torta) */}
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

// =========================================================
// Post-liming — parámetros generales y pozas
// =========================================================
export function PostlimingParamsSection({
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

export function PostlimingPondsSection({
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
    const nextNum = 10 + ponds.length; // sigue Pz10, Pz11, ...
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
