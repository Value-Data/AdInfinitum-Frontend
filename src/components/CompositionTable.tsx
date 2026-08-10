import React from 'react';
import type { SolverResult } from '../types';
import { BRINE_SPECIES_ORDER, MAIN_SPECIES } from '../types';
import { boronFrom } from '../utils/boron';
import { useT } from '../i18n/LanguageContext';
import { fmtNum } from '../utils/numberFormat';
import { useDecimals } from '../context/DecimalsContext';

interface Props {
  stageLabel: string;
  result: SolverResult;
}

export default function CompositionTable({ stageLabel, result }: Props) {
  const t = useT();
  useDecimals();
  const ponds = result.ponds || [];

  // Las especies se derivan del RESULTADO, no de una lista fija. El motor devuelve las
  // que tiene su catalogo: 17 en la 027 y 23 en la 066 (Ba++, Sr++, NO3-, NH4+…). Con
  // MAIN_SPECIES hardcodeado solo se veian 9 y las nuevas no aparecian nunca.
  // Orden: las principales primero, despues el resto del orden canonico, y al final
  // cualquier especie que el motor haya agregado.
  const speciesRows = React.useMemo(() => {
    const presentes = new Set<string>();
    for (const p of ponds) {
      for (const k of Object.keys(p.aqsol_result?.eq_liquid || {})) presentes.add(k);
    }
    const orden = [...MAIN_SPECIES, ...BRINE_SPECIES_ORDER] as string[];
    const vistas = new Set<string>();
    const salida: string[] = [];
    for (const sp of orden) {
      if (presentes.has(sp) && !vistas.has(sp)) { vistas.add(sp); salida.push(sp); }
    }
    for (const sp of presentes) {
      if (!vistas.has(sp)) { vistas.add(sp); salida.push(sp); }
    }
    // Sin datos (ejecucion vacia): al menos las principales, como antes.
    return salida.length ? salida : (MAIN_SPECIES as unknown as string[]);
  }, [ponds]);

  // Calculate %w/w from eq_liquid: species_mass / total_mass * 100
  const getWW = (eqLiquid: Record<string, number> | undefined, species: string): number => {
    if (!eqLiquid) return 0;
    const total = Object.values(eqLiquid).reduce((sum, v) => sum + (v || 0), 0);
    if (total === 0) return 0;
    return ((eqLiquid[species] ?? 0) / total) * 100;
  };

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
                {t('comp_species')}
              </th>
              {ponds.map((p, i) => (
                <th key={i}>
                  <div>{p.config.name}</div>
                  <div className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('comp_units')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {speciesRows.map((species) => (
              <tr key={species}>
                <td
                  className="font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  {species}
                </td>
                {ponds.map((p, i) => {
                  const eqLiq = p.aqsol_result?.eq_liquid?.[species] ?? 0;
                  const ww = getWW(p.aqsol_result?.eq_liquid, species);
                  return (
                    <td key={i} className="font-mono text-xs">
                      {fmtNum(eqLiq, 4)} | {fmtNum(ww, 2)}%
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Boro derivado (H3BO3 + B4O7-- + BO2-) */}
            <tr>
              <td
                className="font-medium sticky left-0"
                style={{ backgroundColor: 'var(--color-surface)' }}
                title="Boro derivado de H3BO3 + B4O7-- + BO2-"
              >
                B
              </td>
              {ponds.map((p, i) => {
                const eqLiquid = p.aqsol_result?.eq_liquid;
                const total = eqLiquid
                  ? Object.values(eqLiquid).reduce((s, v) => s + (v || 0), 0)
                  : 0;
                const mass = boronFrom(eqLiquid);
                const ww = total > 0 ? (mass / total) * 100 : 0;
                return (
                  <td key={i} className="font-mono text-xs">
                    {fmtNum(mass, 4)} | {fmtNum(ww, 2)}%
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        {t('comp_footnote')}
      </p>
    </div>
  );
}
