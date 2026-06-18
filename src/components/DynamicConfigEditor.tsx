import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext';
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
            <th className="w-32">
              Especies Acuosas
              <Tip text="Nombre de la especie química (H2O, Li+, Na+, K+, Mg++, Ca++, …)." />
            </th>
            <th>
              Valor
              <Tip text="Flujo de la especie, en toneladas por día." />
            </th>
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
            <th>
              Área de Proceso (m²)
              <Tip text="Área efectiva de evaporación de la poza." />
            </th>
            <th>
              Factor de Pozas
              <Tip text="Factor geométrico de Ad-Inf que ajusta la evaporación efectiva de la poza." />
            </th>
            <th>
              Impregnación (%)
              <Tip text="Porcentaje de salmuera que queda atrapada en las sales precipitadas y no se recupera." />
            </th>
            <th>
              Fugas (mm/d)
              <Tip text="Salmuera que se filtra por el fondo de la poza y se pierde, en milímetros por día." />
            </th>
            <th>
              Dilución (frac)
              <Tip text="Fracción de agua de dilución que se añade en la transferencia entre pozas. La primera poza va en 0 (recibe salmuera cruda, sin poza previa)." />
            </th>
            <th>
              Target H (m)
              <Tip text='Altura que la poza mantiene para decidir cuándo traspasa flujo. Solo aplica en modo "Por Altura".' />
            </th>
            <th>
              Control
              <Tip text="Modo de operación de la poza. Por Altura: ajusta el flujo de salida para mantener la altura objetivo. Buffer (flujo fijo): acumula hasta la altura de arranque y luego entrega un caudal fijo y constante." />
            </th>
            <th>
              Flujo Target (T/D)
              <Tip text='Caudal constante que entrega la poza en modo "Buffer (flujo fijo)".' />
            </th>
            <th>
              Floor H (m)
              <Tip text="Altura mínima de seguridad: la poza no entrega flujo que la haga caer por debajo de este nivel." />
            </th>
            <th>
              H Arranque (m)
              <Tip text="Altura que la poza buffer debe alcanzar antes de empezar a entregar flujo. Una vez alcanzada, queda operativa de forma permanente. Solo aplica a los modos Buffer." />
            </th>
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
                  <option value="ALTURA">Por Altura</option>
                  <option value="FLUJO_FIJO">Buffer (flujo fijo)</option>
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
            <th>
              Área de Proceso (m²)
              <Tip text="Área efectiva de evaporación de la poza." />
            </th>
            <th>
              Control
              <Tip text="Modo de operación de la poza. Por Altura: ajusta el flujo de salida para mantener la altura objetivo. Buffer (estacional): acumula hasta la altura de arranque y luego entrega un caudal que sube y baja con la evaporación diaria." />
            </th>
            <th>
              H Arranque (m)
              <Tip text="Altura que la poza buffer debe alcanzar antes de empezar a entregar flujo. Una vez alcanzada, queda operativa de forma permanente. Solo aplica a los modos Buffer." />
            </th>
            <th>
              Target H (m)
              <Tip text='Altura que la poza mantiene para decidir cuándo traspasa flujo. Solo aplica en modo "Por Altura".' />
            </th>
            <th>
              Floor H (m)
              <Tip text="Altura mínima de seguridad: la poza no entrega flujo que la haga caer por debajo de este nivel." />
            </th>
            <th>
              Fugas (mm/d)
              <Tip text="Salmuera que se filtra por el fondo de la poza y se pierde, en milímetros por día." />
            </th>
            <th>
              Impregnación (%)
              <Tip text="Porcentaje de salmuera que queda atrapada en las sales precipitadas y no se recupera." />
            </th>
            <th>
              Dilución (frac)
              <Tip text="Fracción de agua de dilución que se añade en la transferencia entre pozas." />
            </th>
            <th>
              Factor de Pozas
              <Tip text="Factor geométrico de Ad-Inf que ajusta la evaporación efectiva de la poza." />
            </th>
            <th className="w-20">Acciones</th>
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
                  <option value="CASCADE">Por Altura</option>
                  <option value="BUFFER">Buffer (estacional)</option>
                  <option value="FLUJO_FIJO">Buffer (flujo fijo)</option>
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
  tooltip?: string;
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
      {
        key: 'temperature_C',
        label: 'Temperatura (°C)',
        step: 0.5,
        min: -10,
        max: 60,
        tooltip:
          'Temperatura fija del proceso de encalado. A diferencia de las pozas de evaporación, el encalado son reactores químicos y no depende del clima.',
      },
      {
        key: 'use_CaCl2',
        label: 'Usar CaCl2',
        step: 0,
        type: 'toggle',
        tooltip:
          'Activa o desactiva el uso de CaCl2 para remover sulfato (SO4). A diferencia de los otros reactivos, el CaCl2 no se aplica todos los días: el modelo evalúa la razón SO4/Mg del feed de entrada al encalado y solo lo dosifica cuando esa razón supera el umbral configurado.',
      },
      {
        key: 'use_CaCl2_threshold',
        label: 'Umbral SO4/Mg',
        step: 0.1,
        min: 0,
        tooltip:
          'Razón sulfato/magnesio del feed por encima de la cual se aplica el CaCl2. Si la razón del feed es mayor a este valor, el modelo dosifica CaCl2 ese día.',
      },
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
    title: 'Torta / Lavado',
    key: 'torta',
    fields: [
      { key: 'cake_retention', label: 'Retencion de torta', step: 0.01, min: 0, max: 1 },
      { key: 'cake_wash_ratio', label: 'Ratio de lavado', step: 0.1, min: 0 },
      { key: 'cake_wash_recovery', label: 'Recuperacion de lavado', step: 0.01, min: 0, max: 1 },
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
                  <label className="label">
                    {field.label}
                    {field.tooltip && <Tip text={field.tooltip} />}
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
          <span>Secuencia de dosificaciones ({seq.length})</span>
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
              El orden de la tabla es el orden de aplicacion. Combinaciones soportadas: Ca(OH)2/Mg, CaCl2/SO4, Ca(OH)2/SO4, NaOH/Mg, Na2SO4/Ca.
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Reactivo</th>
                    <th>Objetivo</th>
                    <th>Factor exceso</th>
                    <th>Conc. solucion</th>
                    <th>Enabled</th>
                    <th className="w-28">Acciones</th>
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
                              title="Subir"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={i === seq.length - 1}
                              onClick={() => moveDos(i, 1)}
                              title="Bajar"
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
              + Agregar dosificacion
            </button>
            {seq.some((d) => !COMBINACIONES_VALIDAS.has(`${d.reactivo}/${d.objetivo}`)) && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-danger)' }}>
                Las filas en rojo tienen combinaciones reactivo/objetivo no soportadas. El motor lanzara NotImplementedError si las dejas asi al ejecutar.
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
  const set = (patch: Partial<DynamicPostlimingParams>) => onChange({ ...params, ...patch });
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        Parámetros Generales
      </h4>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        {/* §A: Temperatura postliming oculta — se toma del módulo Clima (forzada a null en backend). */}
        <div>
          <label className="label">
            PZ10 Average Outflow (T/D)
            <Tip text="Caudal promedio que entrega la poza buffer (Pz10), sobre el cual se aplica la modulación estacional. Dejar vacío para que el modelo lo calcule automáticamente a partir del balance. Solo tiene efecto si la modulación estacional está activada." />
          </label>
          <input
            type="number"
            className="input input-number"
            step={0.1}
            min={0}
            placeholder="vacío = auto-derivar"
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
          label="Modulación estacional Pz10"
          value={params.use_pz10_seasonal_modulation}
          onChange={(v) => set({ use_pz10_seasonal_modulation: v })}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Si está activada, la poza buffer entrega un caudal que sube y baja con la evaporación
          diaria, en vez de un caudal fijo.
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
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-4">
        <div>
          <label className="label">
            Días de Simulación
            <Tip text="Cantidad de días que simula el modelo completo (preconcentración → encalado → postliming)." />
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
            Fecha de Partida
            <Tip text="Fecha del primer día de simulación. Las fechas de la serie de clima se calculan a partir de esta." />
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
        Modulación de Flujo
      </h4>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div>
          <label className="label">
            Flujo Promedio de Salmuera (T/D)
            <Tip text="Flujo medio de salmuera que entra a la primera poza de preconcentración. El modelo lo modula con la evaporación: en días de mayor evaporación entra más salmuera, para mantener el balance de masa del sistema." />
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
            Flujo Máximo de Salmuera (T/D)
            <Tip text="Tope del flujo de entrada. En días de muy alta evaporación, el flujo modulado no supera este límite." />
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
              <th>
                Día (Fecha Calculada)
                <Tip text="Fecha de cada día, calculada a partir de la fecha de inicio de la serie." />
              </th>
              <th>
                Temperatura (°C)
                <Tip text="Temperatura del día." />
              </th>
              <th>
                Evaporación (mm/día)
                <Tip text="Evaporación del día." />
              </th>
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
          <span style={{ color: 'var(--color-text-secondary)' }}>Favorecidas (F&lt;1):</span>{' '}
          <span className="font-mono">{favored}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Normales (F=1):</span>{' '}
          <span className="font-mono">{normal}</span>
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
              <th>
                Sal
                <Tip text="Nombre de la sal." />
              </th>
              <th className="w-28">
                Factor
                <Tip text="Qué tan fácil precipita esta sal: 1 = normal, mayor a 1 = más difícil (inhibida), menor a 1 = más fácil (favorecida)." />
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
        tooltip="Composición de la salmuera que sale del pozo de extracción del salar, antes de entrar a la primera poza de preconcentración. Cada fila es una especie acuosa con su flujo en toneladas por día."
        isOpen={openSections.brine}
        onToggle={() => toggle('brine')}
      >
        <BrineSection
          value={value.brine}
          onChange={(b) => onChange({ ...value, brine: b })}
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
        tooltip="Factor de precipitación de cada sal. Controla qué tan fácil precipita cada sal en esta etapa. No son porcentajes, son multiplicadores del modelo termodinámico."
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
        tooltip="Serie diaria de temperatura y evaporación que alimenta todo el modelo. La temperatura se usa en cada cálculo de equilibrio químico; la evaporación controla la concentración en cada poza y modula el flujo de entrada de salmuera."
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
        tooltip="Factor de precipitación de cada sal. Controla qué tan fácil precipita cada sal en esta etapa. No son porcentajes, son multiplicadores del modelo termodinámico."
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
        tooltip="Factor de precipitación de cada sal. Controla qué tan fácil precipita cada sal en esta etapa. No son porcentajes, son multiplicadores del modelo termodinámico."
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
