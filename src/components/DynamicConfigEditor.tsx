import React, { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import type { AqsolCatalog, AqsolVersion, DynamicConfig } from '../types';
import { AQSOL_VERSIONS } from '../types';
import { getAqsolCatalog } from '../services/api';
import SectionHeader from './common/SectionHeader';
import ClimateEditor from './common/ClimateEditor';
import FactorsEditor from './common/FactorsEditor';
import BrineCompositionEditor from './common/BrineCompositionEditor';
import {
  EncaladoParamsSection,
  PostlimingPondsSection,
  PostlimingParamsSection,
  PreconPondsSection,
  SimulationSection,
} from './common/ConfigSections';

type Props = {
  value: DynamicConfig;
  onChange: (next: DynamicConfig) => void;
};

// =========================================================
// Main editor
// =========================================================
export default function DynamicConfigEditor({ value, onChange }: Props) {
  const t = useT();

  // Base AQSOL de ESTA config dinamica (independiente de la del estatico): define que
  // especies y sales muestran los editores Y con que motor se ejecutan las corridas
  // dinamicas — el backend la toma de aca al lanzar, no del panel de ejecuciones, para
  // que el catalogo de los factores que se editan sea el mismo con que se corre.
  // El backend reindexa las tablas por nombre al leer la config, asi que cambiar la base
  // aca hace aparecer las filas nuevas en cuanto se recarga; el array en la base nueva
  // se persiste en el siguiente Guardar.
  const aqsolBasis: AqsolVersion = value.aqsol_version ?? '027';
  const [catalog, setCatalog] = useState<AqsolCatalog | null>(null);

  useEffect(() => {
    let cancelado = false;
    getAqsolCatalog(aqsolBasis)
      .then((c) => {
        if (!cancelado) setCatalog(c);
      })
      // Sin catalogo la salmuera cae al orden canonico de la 027: se degrada, no rompe.
      .catch(() => {
        if (!cancelado) setCatalog(null);
      });
    return () => {
      cancelado = true;
    };
  }, [aqsolBasis]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sim: true,
    brine: false,
    precon: false,
    precon_factors: false,
    climate: false,
    encalado: false,
    encalado_factors: false,
    postliming: false,
    postliming_factors: false,
  });
  const toggle = useCallback((k: string) => {
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  return (
    <div>
      <SectionHeader
        title={t('section_simulation')}
        isOpen={openSections.sim}
        onToggle={() => toggle('sim')}
      >
        <SimulationSection
          nDays={value.simulation.n_days}
          startDate={value.simulation.start_date}
          avgFlow={value.precon.average_flow_ton_day}
          maxFlow={value.precon.max_flow_ton_day}
          onChange={(patch) =>
            onChange({
              ...value,
              simulation: {
                ...value.simulation,
                ...(patch.nDays !== undefined ? { n_days: patch.nDays } : {}),
                ...(patch.startDate !== undefined ? { start_date: patch.startDate } : {}),
              },
              precon: {
                ...value.precon,
                ...(patch.avgFlow !== undefined
                  ? { average_flow_ton_day: patch.avgFlow }
                  : {}),
                ...(patch.maxFlow !== undefined ? { max_flow_ton_day: patch.maxFlow } : {}),
              },
            })
          }
        />
      </SectionHeader>

      <SectionHeader
        title={t('section_brine')}
        tooltip={t('dyncfg_section_tip_brine')}
        isOpen={openSections.brine}
        onToggle={() => toggle('brine')}
      >
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className="label" title={t('aqsol_basis_tip_dynamic')}>
              {t('aqsol_basis_dynamic')}
            </label>
            <select
              className="input w-40"
              value={aqsolBasis}
              onChange={(e) =>
                onChange({ ...value, aqsol_version: e.target.value as AqsolVersion })
              }
              title={t('aqsol_basis_tip_dynamic')}
            >
              {AQSOL_VERSIONS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            {catalog
              ? `${catalog.species.length} ${t('aqsol_basis_species')} · ${catalog.salts.length} ${t('aqsol_basis_salts')}`
              : ''}
          </p>
        </div>
        <BrineCompositionEditor
          value={value.brine}
          onChange={(b) => onChange({ ...value, brine: b })}
          totalFlow={value.precon.average_flow_ton_day}
          species={catalog?.species}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_precon_ponds')} (${value.precon.ponds.length})`}
        isOpen={openSections.precon}
        onToggle={() => toggle('precon')}
      >
        <PreconPondsSection
          ponds={value.precon.ponds}
          onChange={(ponds) => onChange({ ...value, precon: { ...value.precon, ponds } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_precon_factors')} (${value.precon.factors?.length ?? 0})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={openSections.precon_factors}
        onToggle={() => toggle('precon_factors')}
      >
        <FactorsEditor
          label="Precon"
          factors={value.precon.factors ?? []}
          onChange={(f) => onChange({ ...value, precon: { ...value.precon, factors: f } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_climate')} (${value.climate.evaporation_mm_day.length})`}
        tooltip={t('dyncfg_section_tip_climate')}
        isOpen={openSections.climate}
        onToggle={() => toggle('climate')}
      >
        <ClimateEditor
          climate={value.climate}
          onChange={(c) => onChange({ ...value, climate: c })}
        />
      </SectionHeader>

      <SectionHeader
        title={t('section_encalado_params')}
        isOpen={openSections.encalado}
        onToggle={() => toggle('encalado')}
      >
        <EncaladoParamsSection
          value={value.encalado.config}
          onChange={(c) => onChange({ ...value, encalado: { ...value.encalado, config: c } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_encalado_factors')} (${value.encalado.factors.length})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={openSections.encalado_factors}
        onToggle={() => toggle('encalado_factors')}
      >
        <FactorsEditor
          label="Encalado"
          factors={value.encalado.factors}
          onChange={(f) => onChange({ ...value, encalado: { ...value.encalado, factors: f } })}
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_postliming')} (${value.postliming.ponds.length})`}
        isOpen={openSections.postliming}
        onToggle={() => toggle('postliming')}
      >
        <PostlimingParamsSection
          params={value.postliming.config}
          onChange={(c) =>
            onChange({ ...value, postliming: { ...value.postliming, config: c } })
          }
        />
        <PostlimingPondsSection
          ponds={value.postliming.ponds}
          onChange={(ponds) =>
            onChange({ ...value, postliming: { ...value.postliming, ponds } })
          }
        />
      </SectionHeader>

      <SectionHeader
        title={`${t('section_postliming_factors')} (${value.postliming.factors.length})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={openSections.postliming_factors}
        onToggle={() => toggle('postliming_factors')}
      >
        <FactorsEditor
          label="Concentración"
          factors={value.postliming.factors}
          onChange={(f) => onChange({ ...value, postliming: { ...value.postliming, factors: f } })}
        />
      </SectionHeader>
    </div>
  );
}
