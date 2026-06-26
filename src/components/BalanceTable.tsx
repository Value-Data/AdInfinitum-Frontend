import React from 'react';
import type { SolverResult } from '../types';
import { useT } from '../i18n/LanguageContext';
import { fmtNum } from '../utils/numberFormat';
import { useDecimals } from '../context/DecimalsContext';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function BalanceTable({ stageLabel, result }: Props) {
  const t = useT();
  useDecimals();
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
                <td className="font-mono">{fmtNum(p.evaporation, 2)}</td>
                <td className="font-mono">{fmtNum(p.salt_precipitated, 2)}</td>
                <td className="font-mono">{fmtNum(p.entrainment, 2)}</td>
                <td className="font-mono">{fmtNum(p.leakage, 4)}</td>
                <td className="font-mono">{fmtNum(p.dilution, 4)}</td>
                <td className="font-mono">{fmtNum(p.outlet_flow, 2)}</td>
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
              <td className="font-mono">{fmtNum(result.total_evaporation, 2)}</td>
              <td className="font-mono">{fmtNum(result.total_salt, 2)}</td>
              <td className="font-mono">{fmtNum(result.total_entrainment, 2)}</td>
              <td className="font-mono">{fmtNum(result.total_leakage, 4)}</td>
              <td className="font-mono">-</td>
              <td className="font-mono">{fmtNum(result.final_outlet_flow, 2)}</td>
              <td>-</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
