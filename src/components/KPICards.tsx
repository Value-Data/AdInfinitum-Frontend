import React from 'react';
import type { SolverResult } from '../types';

interface KPI {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}

interface Props {
  stageLabel: string;
  result: SolverResult;
}

function formatNum(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('es-CL', { maximumFractionDigits: decimals });
  }
  return n.toFixed(decimals);
}

const iconClass = 'h-5 w-5';

export default function KPICards({ stageLabel, result }: Props) {
  const kpis: KPI[] = [
    {
      label: 'Li+ Entrada',
      value: formatNum(result.li_in, 4),
      unit: 'ton/dia',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 011.414-1.414zM7.879 6.464a1 1 0 010 1.414 3 3 0 000 4.243 1 1 0 01-1.415 1.414 5 5 0 010-7.07 1 1 0 011.415 0zm4.242 0a5 5 0 010 7.072 1 1 0 01-1.415-1.415 3 3 0 000-4.242 1 1 0 011.415-1.415zM10 9a1 1 0 011 1v.01a1 1 0 11-2 0V10a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Li+ Salida',
      value: formatNum(result.li_out, 4),
      unit: 'ton/dia',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Recuperacion Li+',
      value: formatNum(result.li_recovery_pct, 2),
      unit: '%',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Flujo Salida',
      value: formatNum(result.final_outlet_flow, 2),
      unit: 'ton/dia',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Sales Totales',
      value: formatNum(result.total_salt, 2),
      unit: 'ton/dia',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
        </svg>
      ),
    },
    {
      label: 'Evaporacion Total',
      value: formatNum(result.total_evaporation, 2),
      unit: 'ton/dia',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 001.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        {stageLabel}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="card p-3 flex flex-col gap-1"
          >
            <div
              className="flex items-center gap-1.5"
              style={{ color: 'var(--color-primary)' }}
            >
              {kpi.icon}
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {kpi.label}
              </span>
            </div>
            <div className="font-mono text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {kpi.value}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {kpi.unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
