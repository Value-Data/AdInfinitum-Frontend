import React from 'react';
import type { SolverResult } from '../types';
import { MAIN_SPECIES } from '../types';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function CompositionTable({ stageLabel, result }: Props) {
  const ponds = result.ponds || [];

  // Calculate %w/w from eq_liquid: species_mass / total_mass * 100
  const getWW = (eqLiquid: Record<string, number> | undefined, species: string): number => {
    if (!eqLiquid) return 0;
    const total = Object.values(eqLiquid).reduce((sum, v) => sum + (v || 0), 0);
    if (total === 0) return 0;
    return ((eqLiquid[species] ?? 0) / total) * 100;
  };

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {stageLabel}
      </h4>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="sticky left-0" style={{ backgroundColor: 'var(--color-surface)' }}>
                Especie
              </th>
              {ponds.map((p, i) => (
                <th key={i}>
                  <div>{p.config.name}</div>
                  <div className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                    ton/dia | %w/w
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MAIN_SPECIES.map((species) => (
              <tr key={species}>
                <td
                  className="font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  {species}
                </td>
                {ponds.map((p, i) => {
                  const eqLiq = p.aqsol_result?.eq_liquid?.[species] ?? 0;
                  const ww = getWW(p.aqsol_result?.eq_liquid, species);
                  return (
                    <td key={i} className="font-mono text-xs">
                      {eqLiq.toFixed(4)} | {ww.toFixed(2)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        Valores en ton/dia | %w/w
      </p>
    </div>
  );
}
