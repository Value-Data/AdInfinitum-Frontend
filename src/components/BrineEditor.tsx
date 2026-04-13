import React, { useState } from 'react';
import { MAIN_SPECIES, TRACE_SPECIES } from '../types';

interface Props {
  value: Record<string, number>;
  onChange: (brine: Record<string, number>) => void;
  readOnly?: boolean;
}

export default function BrineEditor({ value, onChange, readOnly = false }: Props) {
  const [traceOpen, setTraceOpen] = useState(false);

  const handleChange = (species: string, val: number) => {
    onChange({ ...value, [species]: val });
  };

  const renderRow = (species: string) => (
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
            onChange={(e) => handleChange(species, parseFloat(e.target.value) || 0)}
          />
        )}
      </td>
      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        ton/dia
      </td>
    </tr>
  );

  return (
    <div>
      <h4
        className="text-sm font-semibold mb-2"
        style={{ color: 'var(--color-text)' }}
      >
        Especies principales
      </h4>
      <table>
        <thead>
          <tr>
            <th className="w-32">Especie</th>
            <th>Valor</th>
            <th className="w-20">Unidad</th>
          </tr>
        </thead>
        <tbody>{MAIN_SPECIES.map(renderRow)}</tbody>
      </table>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setTraceOpen(!traceOpen)}
          className="flex items-center gap-1 text-sm font-medium hover:underline"
          style={{ color: 'var(--color-primary-light)' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${traceOpen ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Especies traza ({TRACE_SPECIES.length})
        </button>

        {traceOpen && (
          <table className="mt-2">
            <thead>
              <tr>
                <th className="w-32">Especie</th>
                <th>Valor</th>
                <th className="w-20">Unidad</th>
              </tr>
            </thead>
            <tbody>{TRACE_SPECIES.map(renderRow)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
