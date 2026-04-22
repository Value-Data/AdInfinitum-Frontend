import React from 'react';
import SulfateRemovalTable, { type StreamId, type StreamValues } from './SulfateRemovalTable';

interface EncaladoData {
  [key: string]: unknown;
}

interface Props {
  stageLabel: string;
  result: EncaladoData;
  temperature_C?: number;
}

const SPECIES_ORDER = [
  'H2O', 'Li+', 'Na+', 'K+', 'Mg++', 'Ca++', 'H+',
  'Cl-', 'HSO4-', 'SO4--', 'OH-',
  'CO2(aq)', 'HCO3-', 'CO3--',
  'H3BO3', 'B4O7--', 'BO2-',
];

function fmt(v: unknown, dec = 2): string {
  if (v == null) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('es-CL', { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function fmtCompact(v: unknown, dec = 4): string {
  if (v == null) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  if (n === 0) return '0';
  if (Math.abs(n) < 1e-4) return n.toExponential(3);
  return n.toFixed(dec);
}

function isNumericDict(v: unknown): v is Record<string, number> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
      <div className="font-mono text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{value}</div>
    </div>
  );
}

function KeyValueTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, unknown, string?]>;
}) {
  return (
    <div className="card overflow-hidden mb-4">
      <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </h5>
      <table>
        <thead>
          <tr><th>Concepto</th><th>Valor</th><th>Unidad</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, val, unit]) => (
            <tr key={label}>
              <td className="font-medium text-sm">{label}</td>
              <td className="font-mono">{fmtCompact(val, 4)}</td>
              <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{unit ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SaltsTableCard({
  title,
  salts,
}: {
  title: string;
  salts: Record<string, number> | undefined;
}) {
  if (!salts) return null;
  const entries = Object.entries(salts)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (entries.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </h5>
      <table>
        <thead><tr><th>Sal</th><th>ton/dia</th><th>%w/w</th></tr></thead>
        <tbody>
          {entries.map(([salt, val]) => (
            <tr key={salt}>
              <td className="text-xs">{salt}</td>
              <td className="font-mono text-xs">{fmtCompact(val, 4)}</td>
              <td className="font-mono text-xs">
                {total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EncaladoResultPanel({ stageLabel, result, temperature_C }: Props) {
  const r = result;

  // Li recovery
  const inputComp = isNumericDict(r.input_adjusted) ? r.input_adjusted : undefined;
  const outputComp = isNumericDict(r.output_adjusted_composition) ? r.output_adjusted_composition : undefined;
  const liIn = inputComp?.['Li+'] ?? 0;
  const liOut = outputComp?.['Li+'] ?? 0;
  const liPct = liIn > 0 ? (liOut / liIn * 100) : 0;

  const precipSalts1 = isNumericDict(r.precipitated_salts_1) ? r.precipitated_salts_1 : undefined;
  const precipSalts2 = isNumericDict(r.precipitated_salts_2) ? r.precipitated_salts_2 : undefined;
  const outputPct = isNumericDict(r.output_composition_pct) ? r.output_composition_pct : undefined;

  // AQSOL results (also used below for Propiedades termodinamicas table)
  const aqsol0 = isNumericDict(r.aqsol0_result) ? r.aqsol0_result as Record<string, unknown> : undefined;
  const aqsol1 = isNumericDict(r.aqsol1_result) ? r.aqsol1_result as Record<string, unknown> : undefined;
  const aqsol2 = isNumericDict(r.aqsol2_result) ? r.aqsol2_result as Record<string, unknown> : undefined;

  // Sulfate removal streams (P_25XX). Backend may ship these under `streams`;
  // if not, we derive what we can from the existing encalado fields so the table renders.
  const streamsRaw = (r as Record<string, unknown>).streams;
  const backendStreams: Partial<Record<StreamId, StreamValues>> | null =
    streamsRaw && typeof streamsRaw === 'object' && !Array.isArray(streamsRaw)
      ? (streamsRaw as Partial<Record<StreamId, StreamValues>>)
      : null;

  const num = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const cacl2Commercial = num(r.CaCl2_commercial);
  const h2oCaCl2 = num(r.H2O_CaCl2);

  const saltsSolids = num(r.total_solids_dry);
  const saltsLiquids = num(r.cake_wash_flow);
  const saltsTotal =
    saltsSolids != null || saltsLiquids != null
      ? (saltsSolids ?? 0) + (saltsLiquids ?? 0)
      : undefined;
  const saltsValues: StreamValues = {
    total_mass_day: saltsTotal,
    solids: saltsSolids,
    liquids: saltsLiquids,
  };

  // pH desde la tabla "Propiedades termodinamicas AQSOL":
  //   AQSOL #0 = brine sola (pre-tratamiento)
  //   AQSOL #1 = tras agregar cal
  //   AQSOL #2 = tras agregar CaCl2 (liquido final)
  const ph0 = num(aqsol0?.pH);
  const ph2 = num(aqsol2?.pH);

  const derivedFromEncalado: Partial<Record<StreamId, StreamValues>> = {
    P_2501: {
      total_mass_day: num(r.input_flow),
      liquids: num(r.input_flow),
      solids: 0,
      ph: ph0,
    },
    P_2502: {
      total_mass_day: cacl2Commercial,
      solids:
        cacl2Commercial != null && h2oCaCl2 != null
          ? Math.max(0, cacl2Commercial - h2oCaCl2)
          : undefined,
      liquids: h2oCaCl2,
    },
    // Agua para la solución de CaCl2 — H2O_CaCl2 de los reactivos
    P_2504: {
      total_mass_day: h2oCaCl2,
      liquids: h2oCaCl2,
      solids: 0,
    },
    P_2506: {
      total_mass_day: num(r.lime_commercial),
      solids: num(r.lime_commercial),
      liquids: 0,
    },
    P_2508: {
      total_mass_day: num(r.H2O_slurry),
      liquids: num(r.H2O_slurry),
      solids: 0,
    },
    // Agua de lavado del queque — "Lavado queque" en la tabla de Flujos por Paso
    P_2514: {
      total_mass_day: num(r.cake_wash_flow),
      liquids: num(r.cake_wash_flow),
      solids: 0,
    },
    // Cake wash solution — mismos valores que P_2514
    P_2517: {
      total_mass_day: num(r.cake_wash_flow),
      liquids: num(r.cake_wash_flow),
      solids: 0,
    },
    // Sales precipitadas: solidos = AQSOL #1 + #2 (seco); liquidos = cake wash solution
    P_2518: { ...saltsValues },
    // Salts to final disposition — mismos valores que P_2518
    P_2520: { ...saltsValues },
    P_2519: {
      total_mass_day: num(r.total_liquid_output),
      liquids: num(r.total_liquid_output),
      solids: 0,
      ph: ph2,
    },
    // Filtrated solution = liquido final tras tratamiento (AQSOL #2)
    P_2516: {
      ph: ph2,
    },
    // Treated slurry = brine + ambos reactivos (toma AQSOL #2, tras ambos pasos)
    P_2511: {
      ph: ph2,
    },
  };

  // Merge: explicit backend streams override derived fallbacks per field.
  const sulfateStreams: Partial<Record<StreamId, StreamValues>> = { ...derivedFromEncalado };
  if (backendStreams) {
    for (const [id, vals] of Object.entries(backendStreams)) {
      const key = id as StreamId;
      sulfateStreams[key] = { ...(sulfateStreams[key] ?? {}), ...(vals ?? {}) };
    }
  }

  // Temperatura del encalado: se propaga a todas las columnas.
  // Si el backend ya trajo un `temperature` especifico para un stream, se respeta.
  if (temperature_C != null && Number.isFinite(temperature_C)) {
    const STREAM_IDS: StreamId[] = [
      'P_2501', 'P_2502', 'P_2504', 'P_2505', 'P_2506', 'P_2508', 'P_2509',
      'P_2511', 'P_2514', 'P_2515', 'P_2516', 'P_2517', 'P_2518', 'P_2519', 'P_2520',
    ];
    for (const id of STREAM_IDS) {
      const existing = sulfateStreams[id] ?? {};
      if (existing.temperature == null) {
        sulfateStreams[id] = { ...existing, temperature: temperature_C };
      }
    }
  }

  // Composition flow matrix
  const compColumns: Array<{ label: string; data: Record<string, number> | undefined }> = [
    { label: 'Entrada ajustada', data: inputComp },
    { label: 'AQSOL #0 input', data: isNumericDict(r.aqsol0_input_composition) ? r.aqsol0_input_composition : undefined },
    { label: 'AQSOL #1 input', data: isNumericDict(r.aqsol1_input_composition) ? r.aqsol1_input_composition : undefined },
    { label: 'Filtrado #1', data: isNumericDict(r.filtrate1_composition) ? r.filtrate1_composition : undefined },
    { label: 'AQSOL #2 input', data: isNumericDict(r.aqsol2_input_composition) ? r.aqsol2_input_composition : undefined },
    { label: 'Filtrado #2', data: isNumericDict(r.filtrate2_composition) ? r.filtrate2_composition : undefined },
    { label: 'Salida ajustada', data: outputComp },
  ];
  const hasAnyComposition = compColumns.some((c) => c.data && Object.keys(c.data).length > 0);
  const allSpeciesSet = new Set<string>(SPECIES_ORDER);
  compColumns.forEach((c) => {
    if (c.data) Object.keys(c.data).forEach((k) => allSpeciesSet.add(k));
  });
  const speciesList = [
    ...SPECIES_ORDER,
    ...Array.from(allSpeciesSet).filter((s) => !SPECIES_ORDER.includes(s)).sort(),
  ];

  // AQSOL properties table
  const aqsolProps: Array<{
    label: string;
    key: string;
    unit?: string;
    dec?: number;
  }> = [
    { label: 'Water activity (aw)', key: 'water_activity', dec: 5 },
    { label: 'Densidad líquida', key: 'density_liquid', unit: 'kg/m³', dec: 2 },
    { label: 'Densidad sólida', key: 'density_solid', unit: 'kg/m³', dec: 2 },
    { label: 'pH', key: 'pH', dec: 2 },
    { label: 'Fuerza iónica', key: 'ionic_strength', dec: 4 },
    { label: 'Cp líquido', key: 'Cp_liquid', unit: 'J/g/K', dec: 4 },
    { label: 'Sólidos totales', key: 'total_solids_g', unit: 'ton/d', dec: 3 },
  ];

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
        <KpiCard label="Entrada (ton/d @ 328.5d)" value={fmt(r.input_flow, 1)} />
        <KpiCard label="Salida P2519 (ton/d)" value={fmt(r.total_liquid_output, 1)} />
        <KpiCard label="Salida ajustada (ton/d @ 365d)" value={fmt(r.output_adjusted_flow, 1)} />
        <KpiCard label="Li+ recuperado" value={`${liPct.toFixed(1)}%`} />
        <KpiCard label="Sólidos secos (ton/d)" value={fmt(r.total_solids_dry, 1)} />
        <KpiCard label="Sólidos húmedos (ton/d)" value={fmt(r.total_solids_wet, 1)} />
        <KpiCard label="Sales AQSOL #1 (ton/d)" value={fmt(r.solids_aqsol1, 1)} />
        <KpiCard label="Sales AQSOL #2 (ton/d)" value={fmt(r.solids_aqsol2, 1)} />
        <KpiCard label="H₃BO₃ removido (ton/d)" value={fmtCompact(r.H3BO3_removed, 4)} />
        <KpiCard label="Recuperado lavado (ton/d)" value={fmtCompact(r.wash_recovered, 3)} />
        <KpiCard label="Lavado queque (ton/d)" value={fmtCompact(r.cake_wash_flow, 3)} />
        <KpiCard label="SO₄/Mg ratio" value={fmtCompact(r.SO4_Mg_ratio, 4)} />
      </div>

      {/* Sulfate removal process streams (P_25XX) */}
      <SulfateRemovalTable streams={sulfateStreams} />

      {/* Flows */}
      <KeyValueTable
        title="Flujos por Paso (ton/dia)"
        rows={[
          ['Entrada P2501 (ajustada)', r.input_flow, 'ton/d'],
          ['Paso 0: post remoción H₃BO₃', r.step0_flow, 'ton/d'],
          ['Paso 1: mezcla + cal', r.step1_flow, 'ton/d'],
          ['Paso 1: filtrado AQSOL #1', r.filtrate1_flow, 'ton/d'],
          ['Paso 1: entrainment líquido cake', r.entrainment_liquid_1, 'ton/d'],
          ['Paso 2: filtrado AQSOL #2', r.filtrate2_flow, 'ton/d'],
          ['Paso 2: entrainment líquido cake', r.entrainment_liquid_2, 'ton/d'],
          ['Lavado queque', r.cake_wash_flow, 'ton/d'],
          ['Recuperado lavado', r.wash_recovered, 'ton/d'],
          ['Salida P2519 (+ lavado queque)', r.total_liquid_output, 'ton/d'],
          ['Salida ajustada (@ 365 d/año)', r.output_adjusted_flow, 'ton/d'],
        ]}
      />

      {/* Reactivos cal (Paso 1) */}
      <KeyValueTable
        title="Reactivos — Paso 1 (cal)"
        rows={[
          ['H₃BO₃ removido', r.H3BO3_removed, 'ton/d'],
          ['OH⁻ agregado (estequiométrico)', r.OH_added, 'ton/d'],
          ['Ca²⁺ agregado', r.Ca_added, 'ton/d'],
          ['CaO puro', r.CaO_pure, 'ton/d'],
          ['Ca(OH)₂', r.CaOH2, 'ton/d'],
          ['Cal comercial', r.lime_commercial, 'ton/d'],
          ['SiO₂ inerte', r.SiO2_inert, 'ton/d'],
          ['H₂O lechada', r.H2O_slurry, 'ton/d'],
          ['H₂O hidratación (CaO→Ca(OH)₂)', r.H2O_hydration, 'ton/d'],
        ]}
      />

      {/* Reactivos CaCl2 (Paso 2) */}
      <KeyValueTable
        title="Reactivos — Paso 2 (CaCl₂)"
        rows={[
          ['Ca²⁺ de CaCl₂', r.Ca_CaCl2, 'ton/d'],
          ['Cl⁻ de CaCl₂', r.Cl_CaCl2, 'ton/d'],
          ['CaCl₂·1.4H₂O puro', r.CaCl2_14H2O_pure, 'ton/d'],
          ['CaCl₂ comercial', r.CaCl2_commercial, 'ton/d'],
          ['H₂O de CaCl₂', r.H2O_CaCl2, 'ton/d'],
          ['Impurezas CaCl₂', r.impurities_CaCl2, 'ton/d'],
          ['SO₄/Mg ratio (gate CaCl₂)', r.SO4_Mg_ratio, '-'],
        ]}
      />

      {/* Convergencia FN */}
      <KeyValueTable
        title="Convergencia FN"
        rows={[
          ['FN₁ (factor entrainment cal)', r.FN1, '-'],
          ['Factor₁ (valor convergido)', r.factor1, '-'],
          ['Iteraciones AQSOL #1', r.iterations_1, 'iter'],
          ['Convergió AQSOL #1', r.converged_1 ? 'Sí' : 'No', '-'],
          ['FN₂ (factor entrainment CaCl₂)', r.FN2, '-'],
          ['Factor₂ (valor convergido)', r.factor2, '-'],
          ['Iteraciones AQSOL #2', r.iterations_2, 'iter'],
          ['Convergió AQSOL #2', r.converged_2 ? 'Sí' : 'No', '-'],
        ]}
      />

      {/* Propiedades AQSOL #0 / #1 / #2 */}
      {(aqsol0 || aqsol1 || aqsol2) && (
        <div className="card overflow-hidden mb-4">
          <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Propiedades termodinámicas AQSOL
          </h5>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Propiedad</th>
                  <th>Unidad</th>
                  <th>AQSOL #0 (brine)</th>
                  <th>AQSOL #1 (cal)</th>
                  <th>AQSOL #2 (CaCl₂)</th>
                </tr>
              </thead>
              <tbody>
                {aqsolProps.map((prop) => (
                  <tr key={prop.key}>
                    <td className="font-medium text-sm">{prop.label}</td>
                    <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {prop.unit ?? '-'}
                    </td>
                    <td className="font-mono">{fmtCompact(aqsol0?.[prop.key], prop.dec ?? 4)}</td>
                    <td className="font-mono">{fmtCompact(aqsol1?.[prop.key], prop.dec ?? 4)}</td>
                    <td className="font-mono">{fmtCompact(aqsol2?.[prop.key], prop.dec ?? 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Composition flow matrix */}
      {hasAnyComposition && (
        <div className="card overflow-hidden mb-4">
          <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Composición por etapa (ton/dia por especie)
          </h5>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '8rem' }}>Especie</th>
                  {compColumns.map((c) => (
                    <th key={c.label}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {speciesList.map((sp) => (
                  <tr key={sp}>
                    <td className="font-medium text-sm">{sp}</td>
                    {compColumns.map((c) => (
                      <td key={c.label} className="font-mono text-xs">
                        {c.data && sp in c.data ? fmtCompact(c.data[sp], 5) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs px-4 pb-3 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Recorrido de especies a lo largo del encalado: entrada → paso 0 → paso 1 (mezcla + cal) → filtrado 1 → paso 2 (+ CaCl₂) → filtrado 2 → salida ajustada.
          </p>
        </div>
      )}

      {/* Precipitated Salts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SaltsTableCard title="Sales precipitadas AQSOL #1 (cal)" salts={precipSalts1} />
        <SaltsTableCard title="Sales precipitadas AQSOL #2 (CaCl₂)" salts={precipSalts2} />
      </div>

      {/* Output Composition detailed (prefer server-computed pct if present) */}
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
                  const ww = outputPct && species in outputPct
                    ? Number(outputPct[species])
                    : total > 0
                      ? (val / total * 100)
                      : 0;
                  return (
                    <tr key={species}>
                      <td className="font-medium text-sm">{species}</td>
                      <td className="font-mono text-sm">{fmtCompact(val, 4)}</td>
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
