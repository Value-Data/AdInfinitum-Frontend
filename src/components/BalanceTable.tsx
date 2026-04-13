import React from 'react';
import type { SolverResult } from '../types';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function BalanceTable({ stageLabel, result }: Props) {
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
              <th>Evaporacion (ton/d)</th>
              <th>Sales (ton/d)</th>
              <th>Entrainment (ton/d)</th>
              <th>Fugas (ton/d)</th>
              <th>Dilucion (ton/d)</th>
              <th>Flujo Salida (ton/d)</th>
              <th>Iteraciones</th>
              <th>Convergencia</th>
            </tr>
          </thead>
          <tbody>
            {ponds.map((p, i) => (
              <tr key={i}>
                <td className="font-medium">{p.config.name}</td>
                <td className="font-mono">{p.evaporation.toFixed(2)}</td>
                <td className="font-mono">{p.salt_precipitated.toFixed(2)}</td>
                <td className="font-mono">{p.entrainment.toFixed(2)}</td>
                <td className="font-mono">{p.leakage.toFixed(4)}</td>
                <td className="font-mono">{p.dilution.toFixed(4)}</td>
                <td className="font-mono">{p.outlet_flow.toFixed(2)}</td>
                <td className="font-mono text-center">{p.iterations}</td>
                <td>
                  <span
                    className="text-xs font-medium"
                    style={{ color: p.converged ? 'var(--color-success)' : 'var(--color-danger)' }}
                  >
                    {p.converged ? 'Si' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ backgroundColor: 'var(--color-primary-lighter)', fontWeight: 600 }}>
              <td>TOTAL</td>
              <td className="font-mono">{result.total_evaporation.toFixed(2)}</td>
              <td className="font-mono">{result.total_salt.toFixed(2)}</td>
              <td className="font-mono">{result.total_entrainment.toFixed(2)}</td>
              <td className="font-mono">{result.total_leakage.toFixed(4)}</td>
              <td className="font-mono">-</td>
              <td className="font-mono">{result.final_outlet_flow.toFixed(2)}</td>
              <td>-</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
