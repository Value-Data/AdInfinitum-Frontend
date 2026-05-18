import React from 'react';
import { BRINE_SPECIES_ORDER } from '../types';

interface Props {
  value: Record<string, number>;
  onChange: (brine: Record<string, number>) => void;
  readOnly?: boolean;
}

export default function BrineEditor({ value, onChange, readOnly = false }: Props) {
  const handleChange = (species: string, val: number) => {
    onChange({ ...value, [species]: val });
  };

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
          {BRINE_SPECIES_ORDER.map((species) => (
            <tr key={species}>
              <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                {species}
              </td>
              <td>
                {readOnly ? (
                  <span className="font-mono text-sm">
                    {(value[species] ?? 0).toFixed(6)}
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
                ton/dia
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
