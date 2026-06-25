import React from 'react';
import type { SolverResult } from '../types';
import { useT } from '../i18n/LanguageContext';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function PropertiesTable({ stageLabel, result }: Props) {
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
              <th>{t('props_water_activity')}</th>
              <th>{t('props_density')}</th>
              <th>{t('props_ph')}</th>
              <th>{t('props_ionic_strength')}</th>
              <th>{t('props_cp')}</th>
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
