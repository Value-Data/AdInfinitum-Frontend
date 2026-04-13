import React from 'react';
import type { SolverResult } from '../types';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function PropertiesTable({ stageLabel, result }: Props) {
  const ponds = result.ponds || [];

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {stageLabel}
      </h4>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Poza</th>
              <th>Actividad Agua</th>
              <th>Densidad (g/cm3)</th>
              <th>pH</th>
              <th>Fuerza Ionica</th>
              <th>Cp (J/mol*K)</th>
            </tr>
          </thead>
          <tbody>
            {ponds.map((p, i) => (
              <tr key={i}>
                <td className="font-medium">{p.config.name}</td>
                <td className="font-mono">{(p.aqsol_result?.water_activity ?? 0).toFixed(6)}</td>
                <td className="font-mono">{(p.aqsol_result?.density_liquid ?? 0).toFixed(4)}</td>
                <td className="font-mono">{(p.aqsol_result?.pH ?? 0).toFixed(4)}</td>
                <td className="font-mono">{(p.aqsol_result?.ionic_strength ?? 0).toFixed(4)}</td>
                <td className="font-mono">{(p.aqsol_result?.Cp_liquid ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
