import React, { useState } from 'react';
import type { PondResult, SolverResult } from '../types';
import { useT } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { getDecimalsOverride, formatEs } from '../../utils/numberFormat';
import { boronFrom } from '../utils/boron';
import { speciesWithExtras } from '../utils/species';
import { useDecimals } from '../../context/DecimalsContext';

interface Props {
  stageLabel: string;
  result: SolverResult;
  temperature_C?: number;
  /**
   * Sales con Faktor <= 1 (habilitadas) segun el catalogo de la version de AQSOL de la
   * ejecucion. Se listan aunque precipiten 0: sin esto, "inhibida y nunca evaluada" y
   * "habilitada que no llego a saturacion" se ven igual — ambas ausentes — y no hay
   * forma de distinguirlas mirando la tabla.
   */
  enabledSalts?: string[];
}

function formatNum(v: number | undefined | null, digits = 4): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '-';
  const _ov = getDecimalsOverride();
  if (_ov != null) return formatEs(v, _ov);
  if (v === 0) return '0';
  if (Math.abs(v) < 1e-4) return v.toExponential(3).replace('.', ',');
  return formatEs(v, digits);
}

type MetricExtractor = (pond: PondResult, temperature_C?: number) => string;

const METRICS: Array<{ label: TranslationKey; extract: MetricExtractor }> = [
  { label: 'ponddetail_salts_precipitated', extract: (p) => formatNum(p.salt_precipitated, 3) },
  { label: 'ponddetail_entrained_liquid_mass', extract: (p) => formatNum(p.entrainment, 3) },
  { label: 'ponddetail_evaporation', extract: (p) => formatNum(p.evaporation, 3) },
  { label: 'ponddetail_infiltration', extract: (p) => formatNum(p.leakage, 5) },
  { label: 'ponddetail_liquid_density', extract: (p) => formatNum(p.aqsol_result?.density_liquid, 2) },
  { label: 'ponddetail_solid_density', extract: (p) => formatNum(p.aqsol_result?.density_solid, 2) },
  { label: 'ponddetail_in_situ_density', extract: () => '-' },
  { label: 'ponddetail_temperature', extract: (_p, t) => (t != null ? formatNum(t, 1) : '-') },
  { label: 'props_ph', extract: (p) => formatNum(p.aqsol_result?.pH, 2) },
  { label: 'ponddetail_activity_aw', extract: (p) => formatNum(p.aqsol_result?.water_activity, 5) },
  // El backend pre-multiplica el área por 1.08 para neutralizar el descuento de bermas
  // que el motor aplica siempre; al dividir acá se recupera el área configurada, que es
  // el área de proceso. Ya no se muestra "área de diseño": con factor 1 no existe tal
  // distinción, y `config.area_design_m2` es solo el valor compensado.
  { label: 'ponddetail_process_area', extract: (p) => formatNum(p.config.area_design_m2 / 1.08, 2) },
];

function MatrixSubTable({
  title,
  caption,
  rowLabels,
  headerLabel,
  ponds,
  getValue,
  titleRight,
  valueDigits = 5,
}: {
  title: string;
  caption?: string;
  rowLabels: string[];
  headerLabel: string;
  ponds: PondResult[];
  getValue: (rowLabel: string, pond: PondResult) => number | null | undefined;
  titleRight?: React.ReactNode;
  valueDigits?: number;
}) {
  const t = useT();
  useDecimals();
  if (rowLabels.length === 0) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h5
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {title}
          </h5>
          {titleRight}
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('ponddetail_no_data')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h5
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {title}
        </h5>
        {titleRight}
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '12rem' }}>{headerLabel}</th>
              {ponds.map((p, i) => (
                <th key={i}>{p.config.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((label) => (
              <tr key={label}>
                <td className="font-medium">{label}</td>
                {ponds.map((p, i) => (
                  <td key={i} className="font-mono">
                    {formatNum(getValue(label, p) ?? undefined, valueDigits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {caption}
        </p>
      )}
    </div>
  );
}

export default function PondDetailBreakdown({
  stageLabel,
  result,
  temperature_C,
  enabledSalts,
}: Props) {
  const t = useT();
  useDecimals();
  const ponds = result.ponds || [];
  const [liquidView, setLiquidView] = useState<'abs' | 'pct'>('abs');
  const [showZeroSalts, setShowZeroSalts] = useState(false);

  if (ponds.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          {stageLabel}
        </h4>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('ponddetail_no_ponds')}
        </p>
      </div>
    );
  }

  // Collect all precipitated salts across ponds (keep only those with at least one > 0)
  const saltSet = new Set<string>();
  ponds.forEach((p) => {
    const salts = p.aqsol_result?.precipitated_salts || {};
    Object.entries(salts).forEach(([name, v]) => {
      if (typeof v === 'number' && v > 0) saltSet.add(name);
    });
  });
  // Las habilitadas que no precipitaron van detras de un toggle, apagado por defecto:
  // con un Faktor permisivo son decenas de filas en cero que tapan las pocas que si
  // precipitan. La comparacion es normalizada porque el catalogo 027 guarda el punto
  // medio con mojibake y el 066 con el caracter limpio; sin esto la misma sal entraria
  // dos veces.
  const normSalt = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const seen = new Set(Array.from(saltSet, normSalt));
  const zeroSalts = (enabledSalts || []).filter((name) => {
    if (seen.has(normSalt(name))) return false;
    seen.add(normSalt(name));
    return true;
  });
  const saltNames = Array.from(
    showZeroSalts ? new Set([...saltSet, ...zeroSalts]) : saltSet,
  ).sort();

  // Total precipitated per pond (for %w/w)
  const totalSolidsByPond = ponds.map((p) => {
    const direct = p.aqsol_result?.total_solids_g;
    if (typeof direct === 'number' && direct > 0) return direct;
    const salts = p.aqsol_result?.precipitated_salts || {};
    return Object.values(salts).reduce(
      (acc, v) => acc + (typeof v === 'number' && v > 0 ? v : 0),
      0,
    );
  });

  // Especies de la corrida: las canonicas mas las que agregue el motor. Con la lista
  // fija de 17, una corrida 066 no mostraba Ba++, Sr++, NO3-, NH4+, NH3(aq) ni
  // NH2COO-, y ademas el total de liquido las dejaba fuera, asi que los %w/w de esta
  // tabla no cerraban contra la de Composicion.
  const species = speciesWithExtras(ponds.map((p) => p.aqsol_result?.eq_liquid));

  // Total liquid flow per pond across the rendered species (sum of eq_liquid)
  const liquidTotalsByPond = ponds.map((p) => {
    const eq = p.aqsol_result?.eq_liquid || {};
    return species.reduce((acc, sp) => acc + (eq[sp] ?? 0), 0);
  });

  const liquidToggle = (
    <div
      className="inline-flex rounded overflow-hidden text-xs"
      style={{ border: '1px solid var(--color-border, #d1d5db)' }}
    >
      {([
        ['abs', 'ton/d'],
        ['pct', '%'],
      ] as const).map(([value, label]) => {
        const active = liquidView === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLiquidView(value)}
            className="px-2 py-1 font-medium"
            style={{
              backgroundColor: active
                ? 'var(--color-primary)'
                : 'var(--color-surface)',
              color: active ? '#fff' : 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {stageLabel} — {t('ponddetail_breakdown')}
      </h4>

      {/* Main metrics matrix */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '14rem' }}>{t('ponddetail_metric')}</th>
              {ponds.map((p, i) => (
                <th key={i}>{p.config.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.label}>
                <td className="font-medium">{t(m.label)}</td>
                {ponds.map((p, i) => (
                  <td key={i} className="font-mono">
                    {m.extract(p, temperature_C)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Liquid composition (flujo de traspaso) */}
      <MatrixSubTable
        title={
          liquidView === 'abs'
            ? `${t('ponddetail_transfer_chemistry')} (ton/d)`
            : `${t('ponddetail_transfer_chemistry')} (%)`
        }
        caption={
          liquidView === 'abs'
            ? t('ponddetail_transfer_caption_abs')
            : t('ponddetail_transfer_caption_pct')
        }
        rowLabels={[...species, 'B']}
        headerLabel={t('comp_species')}
        ponds={ponds}
        titleRight={liquidToggle}
        valueDigits={liquidView === 'pct' ? 3 : 5}
        getValue={(label, p) => {
          // B (Boro) derivado de H3BO3 + B4O7-- + BO2-; el resto, directo de eq_liquid.
          const value =
            label === 'B'
              ? boronFrom(p.aqsol_result?.eq_liquid)
              : p.aqsol_result?.eq_liquid?.[label] ?? 0;
          if (liquidView === 'abs') return value;
          const idx = ponds.indexOf(p);
          const total = liquidTotalsByPond[idx];
          if (!total || total <= 0) return 0;
          return (value / total) * 100;
        }}
      />

      {/* Precipitated salts absolute */}
      <MatrixSubTable
        title={`${t('ponddetail_precip_salts_comp')} (ton/d)`}
        caption={
          showZeroSalts
            ? `${t('ponddetail_precip_salts_caption')} ${t('ponddetail_enabled_zero_note')}`
            : t('ponddetail_precip_salts_caption')
        }
        rowLabels={saltNames}
        headerLabel={t('salts_salt')}
        ponds={ponds}
        titleRight={
          zeroSalts.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowZeroSalts((v) => !v)}
              className="px-2 py-1 text-xs font-medium rounded"
              style={{
                border: '1px solid var(--color-border, #d1d5db)',
                backgroundColor: showZeroSalts ? 'var(--color-primary)' : 'var(--color-surface)',
                color: showZeroSalts ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              {showZeroSalts
                ? t('ponddetail_hide_enabled_zero')
                : `${t('ponddetail_show_enabled_zero')} (${zeroSalts.length})`}
            </button>
          ) : undefined
        }
        getValue={(label, p) => p.aqsol_result?.precipitated_salts?.[label] ?? 0}
      />

      {/* Precipitated salts percent w/w */}
      <MatrixSubTable
        title={`${t('ponddetail_precip_salts_comp')} (%w/w)`}
        caption={t('ponddetail_precip_salts_ww_caption')}
        rowLabels={saltNames}
        headerLabel={t('salts_salt')}
        ponds={ponds}
        getValue={(label, p) => {
          const idx = ponds.indexOf(p);
          const total = totalSolidsByPond[idx];
          if (!total || total <= 0) return 0;
          const v = p.aqsol_result?.precipitated_salts?.[label] ?? 0;
          return (v / total) * 100;
        }}
      />
    </div>
  );
}
