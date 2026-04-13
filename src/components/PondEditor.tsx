import React from 'react';
import type { PondConfig } from '../types';

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
  const addPond = () => {
    const num = value.length + 1;
    const pond: PondConfig = {
      name: `Poza ${num}`,
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
              <th>Nombre</th>
              <th>Area (m2)</th>
              <th>Pond Factor</th>
              <th>Entrainment (%)</th>
              <th>Leakage (mm/d)</th>
              <th>Dilucion (frac)</th>
              {!readOnly && <th className="w-20">Acciones</th>}
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
                    <span className="font-mono text-sm">{pond.area_design_m2.toLocaleString()}</span>
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
                      Eliminar
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
          + Agregar Poza
        </button>
      )}
    </div>
  );
}
