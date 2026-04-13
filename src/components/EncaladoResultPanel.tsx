import React from 'react';

interface EncaladoData {
  [key: string]: unknown;
}

interface Props {
  stageLabel: string;
  result: EncaladoData;
}

function fmt(v: unknown, dec = 2): string {
  if (v == null) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('es-CL', { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function pct(v: unknown): string {
  if (v == null) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return `${(n * 100).toFixed(2)}%`;
}

export default function EncaladoResultPanel({ stageLabel, result }: Props) {
  const r = result;

  // Li recovery
  const inputComp = r.input_adjusted as Record<string, number> | undefined;
  const outputComp = r.output_adjusted_composition as Record<string, number> | undefined;
  const liIn = inputComp?.['Li+'] ?? 0;
  const liOut = outputComp?.['Li+'] ?? 0;
  const liPct = liIn > 0 ? (liOut / liIn * 100) : 0;

  const precipSalts1 = r.precipitated_salts_1 as Record<string, number> | undefined;
  const precipSalts2 = r.precipitated_salts_2 as Record<string, number> | undefined;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        {stageLabel}
      </h4>

      {/* Convergence warnings */}
      {(!r.converged_1 || !r.converged_2) && (
        <div className="mb-4 p-3 text-sm" style={{ backgroundColor: '#fef3c7', borderRadius: 'var(--radius)' }}>
          <strong style={{ color: 'var(--color-warning)' }}>Advertencia de convergencia:</strong>
          <ul className="mt-1 ml-4 list-disc">
            {!r.converged_1 && (
              <li>AQSOL #1 (cal) no convergió FN ({String(r.iterations_1)} iteraciones)</li>
            )}
            {!r.converged_2 && (
              <li>AQSOL #2 (CaCl₂) no convergió FN ({String(r.iterations_2)} iteraciones)</li>
            )}
          </ul>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Entrada (ton/d @ 328.5d)', value: fmt(r.input_flow, 1) },
          { label: 'Salida P2519 (ton/d)', value: fmt(r.total_liquid_output, 1) },
          { label: 'Salida ajustada (ton/d @ 365d)', value: fmt(r.output_adjusted_flow, 1) },
          { label: 'Li+ recuperado', value: `${liPct.toFixed(1)}%` },
          { label: 'Sólidos secos (ton/d)', value: fmt(r.total_solids_dry, 1) },
          { label: 'Sólidos húmedos (ton/d)', value: fmt(r.total_solids_wet, 1) },
          { label: 'Sales AQSOL #1 (ton/d)', value: fmt(r.solids_aqsol1, 1) },
          { label: 'Sales AQSOL #2 (ton/d)', value: fmt(r.solids_aqsol2, 1) },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3">
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{kpi.label}</div>
            <div className="font-mono text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Flows */}
      <div className="card overflow-hidden mb-4">
        <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Flujos por Paso (ton/dia)
        </h5>
        <table>
          <thead>
            <tr><th>Paso</th><th>Flujo</th></tr>
          </thead>
          <tbody>
            {[
              ['Entrada P2501 (ajustada)', r.input_flow],
              ['Paso 0: post remoción H₃BO₃', r.step0_flow],
              ['Paso 1: mezcla + cal', r.step1_flow],
              ['Paso 1: filtrado AQSOL #1', r.filtrate1_flow],
              ['Paso 2: filtrado AQSOL #2', r.filtrate2_flow],
              ['Salida P2519 (+ lavado queque)', r.total_liquid_output],
              ['Salida ajustada (@ 365 d/año)', r.output_adjusted_flow],
            ].map(([label, val]) => (
              <tr key={String(label)}>
                <td className="font-medium text-sm">{String(label)}</td>
                <td className="font-mono">{fmt(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reagents */}
      <div className="card overflow-hidden mb-4">
        <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Reactivos
        </h5>
        <table>
          <thead>
            <tr><th>Reactivo</th><th>Valor</th><th>Unidad</th></tr>
          </thead>
          <tbody>
            {[
              ['H₃BO₃ removido', r.H3BO3_removed, 'ton/d'],
              ['OH⁻ agregado (estequiométrico)', r.OH_added, 'ton/d'],
              ['Ca²⁺ agregado', r.Ca_added, 'ton/d'],
              ['CaO puro', r.CaO_pure, 'ton/d'],
              ['Ca(OH)₂', r.CaOH2, 'ton/d'],
              ['Cal comercial', r.lime_commercial, 'ton/d'],
              ['SiO₂ inerte', r.SiO2_inert, 'ton/d'],
              ['H₂O lechada', r.H2O_slurry, 'ton/d'],
              ['CaCl₂·1.4H₂O puro', r.CaCl2_14H2O_pure, 'ton/d'],
              ['CaCl₂ comercial', r.CaCl2_commercial, 'ton/d'],
              ['SO₄/Mg ratio', r.SO4_Mg_ratio, '-'],
              ['FN₁ (factor entrainment cal)', r.FN1, '-'],
              ['FN₂ (factor entrainment CaCl₂)', r.FN2, '-'],
            ].map(([label, val, unit]) => (
              <tr key={String(label)}>
                <td className="font-medium text-sm">{String(label)}</td>
                <td className="font-mono">{fmt(val, 4)}</td>
                <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{String(unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Precipitated Salts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {precipSalts1 && Object.keys(precipSalts1).length > 0 && (
          <div className="card overflow-hidden">
            <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Sales precipitadas AQSOL #1 (cal)
            </h5>
            <table>
              <thead><tr><th>Sal</th><th>ton/dia</th></tr></thead>
              <tbody>
                {Object.entries(precipSalts1)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([salt, val]) => (
                    <tr key={salt}>
                      <td className="text-xs">{salt}</td>
                      <td className="font-mono text-xs">{fmt(val, 4)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {precipSalts2 && Object.keys(precipSalts2).length > 0 && (
          <div className="card overflow-hidden">
            <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Sales precipitadas AQSOL #2 (CaCl₂)
            </h5>
            <table>
              <thead><tr><th>Sal</th><th>ton/dia</th></tr></thead>
              <tbody>
                {Object.entries(precipSalts2)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([salt, val]) => (
                    <tr key={salt}>
                      <td className="text-xs">{salt}</td>
                      <td className="font-mono text-xs">{fmt(val, 4)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Output Composition */}
      {outputComp && (
        <div className="card overflow-hidden mb-4">
          <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Composición salida ajustada (ton/dia @ 365d)
          </h5>
          <table>
            <thead><tr><th>Especie</th><th>ton/dia</th><th>%w/w</th></tr></thead>
            <tbody>
              {Object.entries(outputComp)
                .filter(([, v]) => v > 0.0001)
                .sort(([, a], [, b]) => b - a)
                .map(([species, val]) => {
                  const total = Object.values(outputComp).reduce((s, v) => s + v, 0);
                  const ww = total > 0 ? (val / total * 100) : 0;
                  return (
                    <tr key={species}>
                      <td className="font-medium text-sm">{species}</td>
                      <td className="font-mono text-sm">{fmt(val, 4)}</td>
                      <td className="font-mono text-sm">{ww.toFixed(2)}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
