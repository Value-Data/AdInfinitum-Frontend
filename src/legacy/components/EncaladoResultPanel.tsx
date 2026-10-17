import React from 'react';
import SulfateRemovalTable, { type StreamId, type StreamValues } from './SulfateRemovalTable';
import { useT } from '../../i18n/LanguageContext';
import { fmtNum, getDecimalsOverride, formatEs } from '../../utils/numberFormat';
import { useDecimals } from '../../context/DecimalsContext';
import { CANONICAL_SPECIES_ORDER } from '../utils/species';

interface EncaladoData {
  [key: string]: unknown;
}

interface Props {
  stageLabel: string;
  result: EncaladoData;
  temperature_C?: number;
}

// Orden base; más abajo se le anexan las especies extra que traiga el resultado.
const SPECIES_ORDER = CANONICAL_SPECIES_ORDER;

function fmt(v: unknown, dec = 2): string {
  if (v == null) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  const _ov = getDecimalsOverride();
  return formatEs(n, _ov != null ? _ov : dec);
}

function fmtCompact(v: unknown, dec = 4): string {
  if (v == null) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  const _ov = getDecimalsOverride();
  if (_ov != null) return formatEs(n, _ov);
  if (n === 0) return '0';
  if (Math.abs(n) < 1e-4) return n.toExponential(3).replace('.', ',');
  return formatEs(n, dec);
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
  const t = useT();
  useDecimals();
  return (
    <div className="card overflow-hidden mb-4">
      <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </h5>
      <table>
        <thead>
          <tr><th>{t('encpanel_concept')}</th><th>{t('brine_value')}</th><th>{t('brine_unit')}</th></tr>
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
  const t = useT();
  useDecimals();
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
        <thead><tr><th>{t('salts_salt')}</th><th>ton/dia</th><th>%w/w</th></tr></thead>
        <tbody>
          {entries.map(([salt, val]) => (
            <tr key={salt}>
              <td className="text-xs">{salt}</td>
              <td className="font-mono text-xs">{fmtCompact(val, 4)}</td>
              <td className="font-mono text-xs">
                {total > 0 ? (fmtNum((val / total) * 100, 2) || '-') + '%' : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EncaladoResultPanel({ stageLabel, result, temperature_C }: Props) {
  const t = useT();
  useDecimals();
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
    { label: t('encpanel_adjusted_input'), data: inputComp },
    { label: 'AQSOL #0 input', data: isNumericDict(r.aqsol0_input_composition) ? r.aqsol0_input_composition : undefined },
    { label: 'AQSOL #1 input', data: isNumericDict(r.aqsol1_input_composition) ? r.aqsol1_input_composition : undefined },
    { label: t('encpanel_filtrate_1'), data: isNumericDict(r.filtrate1_composition) ? r.filtrate1_composition : undefined },
    { label: 'AQSOL #2 input', data: isNumericDict(r.aqsol2_input_composition) ? r.aqsol2_input_composition : undefined },
    { label: t('encpanel_filtrate_2'), data: isNumericDict(r.filtrate2_composition) ? r.filtrate2_composition : undefined },
    { label: t('encpanel_adjusted_output'), data: outputComp },
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
    { label: t('encpanel_prop_water_activity'), key: 'water_activity', dec: 5 },
    { label: t('encpanel_prop_liquid_density'), key: 'density_liquid', unit: 'kg/m³', dec: 2 },
    { label: t('encpanel_prop_solid_density'), key: 'density_solid', unit: 'kg/m³', dec: 2 },
    { label: 'pH', key: 'pH', dec: 2 },
    { label: t('encpanel_prop_ionic_strength'), key: 'ionic_strength', dec: 4 },
    { label: t('encpanel_prop_liquid_cp'), key: 'Cp_liquid', unit: 'J/g/K', dec: 4 },
    { label: t('encpanel_prop_total_solids'), key: 'total_solids_g', unit: 'ton/d', dec: 3 },
  ];

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        {stageLabel}
      </h4>

      {/* Convergence warnings */}
      {(!r.converged_1 || !r.converged_2) && (
        <div className="mb-4 p-3 text-sm" style={{ backgroundColor: '#fef3c7', borderRadius: 'var(--radius)' }}>
          <strong style={{ color: 'var(--color-warning)' }}>{t('encpanel_convergence_warning')}</strong>
          <ul className="mt-1 ml-4 list-disc">
            {!r.converged_1 && (
              <li>{t('encpanel_aqsol1_no_converge')} ({String(r.iterations_1)} {t('encpanel_iterations')})</li>
            )}
            {!r.converged_2 && (
              <li>{t('encpanel_aqsol2_no_converge')} ({String(r.iterations_2)} {t('encpanel_iterations')})</li>
            )}
          </ul>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label={`${t('encpanel_kpi_input')} (ton/d @ 328.5d)`} value={fmt(r.input_flow, 1)} />
        <KpiCard label={`${t('encpanel_kpi_output_p2519')} (ton/d)`} value={fmt(r.total_liquid_output, 1)} />
        <KpiCard label={`${t('encpanel_kpi_adjusted_output')} (ton/d @ 365d)`} value={fmt(r.output_adjusted_flow, 1)} />
        <KpiCard label={t('encpanel_kpi_li_recovered')} value={`${fmtNum(liPct, 1) || '0'}%`} />
        <KpiCard label={`${t('encpanel_kpi_dry_solids')} (ton/d)`} value={fmt(r.total_solids_dry, 1)} />
        <KpiCard label={`${t('encpanel_kpi_wet_solids')} (ton/d)`} value={fmt(r.total_solids_wet, 1)} />
        <KpiCard label={`${t('encpanel_kpi_salts_aqsol1')} (ton/d)`} value={fmt(r.solids_aqsol1, 1)} />
        <KpiCard label={`${t('encpanel_kpi_salts_aqsol2')} (ton/d)`} value={fmt(r.solids_aqsol2, 1)} />
        <KpiCard label={`${t('encpanel_kpi_h3bo3_removed')} (ton/d)`} value={fmtCompact(r.H3BO3_removed, 4)} />
        <KpiCard label={`${t('encpanel_kpi_wash_recovered')} (ton/d)`} value={fmtCompact(r.wash_recovered, 3)} />
        <KpiCard label={`${t('encpanel_kpi_cake_wash')} (ton/d)`} value={fmtCompact(r.cake_wash_flow, 3)} />
        <KpiCard label={`${t('encpanel_kpi_so4_mg_ratio')}`} value={fmtCompact(r.SO4_Mg_ratio, 4)} />
      </div>

      {/* Sulfate removal process streams (P_25XX) */}
      <SulfateRemovalTable streams={sulfateStreams} />

      {/* Flows */}
      <KeyValueTable
        title={`${t('encpanel_flows_by_step')} (ton/dia)`}
        rows={[
          [t('encpanel_row_input_p2501'), r.input_flow, 'ton/d'],
          [t('encpanel_row_step0_h3bo3'), r.step0_flow, 'ton/d'],
          [t('encpanel_row_step1_mix_lime'), r.step1_flow, 'ton/d'],
          [t('encpanel_row_step1_filtrate'), r.filtrate1_flow, 'ton/d'],
          [t('encpanel_row_step1_entrainment'), r.entrainment_liquid_1, 'ton/d'],
          [t('encpanel_row_step2_filtrate'), r.filtrate2_flow, 'ton/d'],
          [t('encpanel_row_step2_entrainment'), r.entrainment_liquid_2, 'ton/d'],
          [t('encpanel_row_cake_wash'), r.cake_wash_flow, 'ton/d'],
          [t('encpanel_row_wash_recovered'), r.wash_recovered, 'ton/d'],
          [t('encpanel_row_output_p2519'), r.total_liquid_output, 'ton/d'],
          [t('encpanel_row_adjusted_output'), r.output_adjusted_flow, 'ton/d'],
        ]}
      />

      {/* Reactivos cal (Paso 1) */}
      <KeyValueTable
        title={t('encpanel_reagents_step1')}
        rows={[
          [t('encpanel_row_h3bo3_removed'), r.H3BO3_removed, 'ton/d'],
          [t('encpanel_row_oh_added'), r.OH_added, 'ton/d'],
          [t('encpanel_row_ca_added'), r.Ca_added, 'ton/d'],
          [t('encpanel_row_cao_pure'), r.CaO_pure, 'ton/d'],
          ['Ca(OH)₂', r.CaOH2, 'ton/d'],
          [t('encpanel_row_lime_commercial'), r.lime_commercial, 'ton/d'],
          [t('encpanel_row_sio2_inert'), r.SiO2_inert, 'ton/d'],
          [t('encpanel_row_h2o_slurry'), r.H2O_slurry, 'ton/d'],
          [t('encpanel_row_h2o_hydration'), r.H2O_hydration, 'ton/d'],
        ]}
      />

      {/* Reactivos CaCl2 (Paso 2) */}
      <KeyValueTable
        title={t('encpanel_reagents_step2')}
        rows={[
          [t('encpanel_row_ca_from_cacl2'), r.Ca_CaCl2, 'ton/d'],
          [t('encpanel_row_cl_from_cacl2'), r.Cl_CaCl2, 'ton/d'],
          [t('encpanel_row_cacl2_14h2o_pure'), r.CaCl2_14H2O_pure, 'ton/d'],
          [t('encpanel_row_cacl2_commercial'), r.CaCl2_commercial, 'ton/d'],
          [t('encpanel_row_h2o_cacl2'), r.H2O_CaCl2, 'ton/d'],
          [t('encpanel_row_cacl2_impurities'), r.impurities_CaCl2, 'ton/d'],
          [t('encpanel_row_so4_mg_gate'), r.SO4_Mg_ratio, '-'],
        ]}
      />

      {/* Convergencia FN */}
      <KeyValueTable
        title={t('encpanel_convergence_fn')}
        rows={[
          [t('encpanel_row_fn1'), r.FN1, '-'],
          [t('encpanel_row_factor1'), r.factor1, '-'],
          [t('encpanel_row_iterations_aqsol1'), r.iterations_1, 'iter'],
          [t('encpanel_row_converged_aqsol1'), r.converged_1 ? t('yes') : t('no'), '-'],
          [t('encpanel_row_fn2'), r.FN2, '-'],
          [t('encpanel_row_factor2'), r.factor2, '-'],
          [t('encpanel_row_iterations_aqsol2'), r.iterations_2, 'iter'],
          [t('encpanel_row_converged_aqsol2'), r.converged_2 ? t('yes') : t('no'), '-'],
        ]}
      />

      {/* Propiedades AQSOL #0 / #1 / #2 */}
      {(aqsol0 || aqsol1 || aqsol2) && (
        <div className="card overflow-hidden mb-4">
          <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            {t('encpanel_aqsol_thermo_props')}
          </h5>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>{t('gbal_property')}</th>
                  <th>{t('brine_unit')}</th>
                  <th>{t('encpanel_aqsol0_brine')}</th>
                  <th>{t('encpanel_aqsol1_lime')}</th>
                  <th>{t('encpanel_aqsol2_cacl2')}</th>
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
            {t('encpanel_comp_by_stage')} (ton/dia)
          </h5>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '8rem' }}>{t('comp_species')}</th>
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
            {t('encpanel_comp_footnote')}
          </p>
        </div>
      )}

      {/* Precipitated Salts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SaltsTableCard title={t('encpanel_precip_salts_aqsol1')} salts={precipSalts1} />
        <SaltsTableCard title={t('encpanel_precip_salts_aqsol2')} salts={precipSalts2} />
      </div>

      {/* Output Composition detailed (prefer server-computed pct if present) */}
      {outputComp && (
        <div className="card overflow-hidden mb-4">
          <h5 className="text-xs font-semibold px-4 pt-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            {t('encpanel_adjusted_output_comp')} (ton/dia @ 365d)
          </h5>
          <table>
            <thead><tr><th>{t('comp_species')}</th><th>ton/dia</th><th>%w/w</th></tr></thead>
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
                      <td className="font-mono text-sm">{fmtNum(ww, 2) || '0'}%</td>
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
