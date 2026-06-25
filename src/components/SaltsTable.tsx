import React from 'react';
import type { SolverResult } from '../types';
import { useT } from '../i18n/LanguageContext';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function SaltsTable({ stageLabel, result }: Props) {
  const t = useT();
  const ponds = result.ponds || [];

  // Collect all unique salt names
  const allSalts = new Set<string>();
  ponds.forEach((p) => {
    const salts = p.aqsol_result?.precipitated_salts || {};
    Object.keys(salts).forEach((s) => allSalts.add(s));
  });
  const saltNames = Array.from(allSalts).sort();

  if (saltNames.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          {stageLabel}
        </h4>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('salts_none')}
        </p>
      </div>
    );
  }

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
                {t('salts_salt')}
              </th>
              {ponds.map((p, i) => (
                <th key={i}>{p.config.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saltNames.map((salt) => {
              const hasValues = ponds.some(
                (p) => (p.aqsol_result?.precipitated_salts?.[salt] ?? 0) > 0,
              );
              if (!hasValues) return null;

              return (
                <tr key={salt}>
                  <td
                    className="font-medium text-xs sticky left-0"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                  >
                    {salt}
                  </td>
                  {ponds.map((p, i) => {
                    const val = p.aqsol_result?.precipitated_salts?.[salt] ?? 0;
                    return (
                      <td key={i} className="font-mono text-xs">
                        {val > 0 ? val.toFixed(4) : '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        {t('salts_footnote')}
      </p>
    </div>
  );
}
