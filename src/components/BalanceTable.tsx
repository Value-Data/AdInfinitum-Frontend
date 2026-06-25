import React from 'react';
import type { SolverResult } from '../types';
import { useT } from '../i18n/LanguageContext';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function BalanceTable({ stageLabel, result }: Props) {
  const t = useT();
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
              <th>{t('tbl_pond')}</th>
              <th>{t('balance_evaporation')}</th>
              <th>{t('balance_salts')}</th>
              <th>{t('balance_entrainment')}</th>
              <th>{t('balance_leakage')}</th>
              <th>{t('balance_dilution')}</th>
              <th>{t('balance_outlet_flow')}</th>
              <th>{t('balance_iterations')}</th>
              <th>{t('balance_convergence')}</th>
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
                    {p.converged ? t('balance_yes') : t('balance_no')}
                  </span>
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ backgroundColor: 'var(--color-primary-lighter)', fontWeight: 600 }}>
              <td>{t('total')}</td>
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
