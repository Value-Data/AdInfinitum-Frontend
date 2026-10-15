import React, { useEffect, useMemo, useState } from 'react';
import BrineEditor from './BrineEditor';
import PondEditor from './PondEditor';
import EncaladoConfigForm from './EncaladoConfigForm';
import DailyScheduleEditor from './DailyScheduleEditor';
import type { EncaladoConfig, PondConfig, DailyScheduleItem } from '../types';
import { speciesWithExtras } from '../utils/species';
import { getAqsolCatalog } from '../api';
import { useT } from '../../i18n/LanguageContext';

interface Props {
  snapshot: Record<string, unknown>;
}

export default function ParameterSnapshot({ snapshot }: Props) {
  const t = useT();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brine: true,
    precon_ponds: false,
    precon_faktor: false,
    encalado: false,
    postliming_ponds: false,
    postliming_faktor: false,
    schedule: false,
  });

  const toggle = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Los snapshots anteriores a la migración 008 guardan la salmuera en ton/d y sin
  // caudal total. Se convierten a composición + caudal solo para mostrarlos, que es lo
  // que el editor espera ahora; el snapshot en sí es inmutable y se deja como está.
  const rawBrine = (snapshot.brine as Record<string, number>) || {};
  const rawTotal = snapshot.brine_total_flow as number | undefined;
  const { brine, brineTotal } = useMemo(() => {
    if (rawTotal !== undefined && rawTotal !== null) {
      return { brine: rawBrine, brineTotal: rawTotal };
    }
    const suma = Object.values(rawBrine).reduce(
      (s, v) => s + (typeof v === 'number' ? v : 0),
      0,
    );
    if (suma <= 0) return { brine: rawBrine, brineTotal: 0 };
    const pct: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawBrine)) {
      pct[k] = (typeof v === 'number' ? v : 0) / suma * 100;
    }
    return { brine: pct, brineTotal: suma };
  }, [rawBrine, rawTotal]);

  // Las filas salen del catálogo de la versión con que corrió la ejecución, igual que
  // en el editor de configuración. Sin esto BrineEditor caía al orden canónico de 17 y
  // una ejecución en 066 no mostraba las 6 especies que agrega esa base — ni siquiera
  // en cero, que es como entraron al motor si no se les cargó valor.
  const snapshotVersion =
    typeof snapshot.aqsol_version === 'string' ? snapshot.aqsol_version : null;
  const [catalogSpecies, setCatalogSpecies] = useState<string[] | null>(null);

  useEffect(() => {
    if (!snapshotVersion) {
      setCatalogSpecies(null);
      return;
    }
    let cancelado = false;
    getAqsolCatalog(snapshotVersion)
      .then((c) => { if (!cancelado) setCatalogSpecies(c.species); })
      .catch(() => { if (!cancelado) setCatalogSpecies(null); });
    return () => { cancelado = true; };
  }, [snapshotVersion]);

  // Si el catálogo no llega (ejecución vieja sin versión, o la API falla), se cae al
  // orden canónico más lo que traiga el snapshot: nunca se pierde una especie.
  const brineSpecies = useMemo(
    () => speciesWithExtras([brine], catalogSpecies ?? undefined),
    [brine, catalogSpecies],
  );
  const preconPonds = (snapshot.precon_ponds as PondConfig[]) || [];
  const preconFaktor = (snapshot.precon_faktor as number[]) || [];
  const encaladoConfig = (snapshot.encalado_config as EncaladoConfig) || null;
  const postlimingPonds = (snapshot.postliming_ponds as PondConfig[]) || [];
  const postlimingFaktor = (snapshot.postliming_faktor as number[]) || [];
  const dailySchedule = (snapshot.daily_schedule as DailyScheduleItem[]) || [];

  const Section = ({
    sectionKey,
    title,
    children,
  }: {
    sectionKey: string;
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="border mb-2" style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50"
        style={{ color: 'var(--color-text)' }}
        onClick={() => toggle(sectionKey)}
      >
        <span>{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${openSections[sectionKey] ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {openSections[sectionKey] && <div className="px-3 pb-3">{children}</div>}
    </div>
  );

  return (
    <div>
      <Section sectionKey="brine" title={t('section_brine')}>
        <BrineEditor
          value={brine}
          onChange={() => {}}
          totalFlow={brineTotal}
          readOnly
          species={brineSpecies}
        />
      </Section>

      <Section sectionKey="precon_ponds" title={t('section_precon_ponds')}>
        <PondEditor value={preconPonds} onChange={() => {}} readOnly />
      </Section>

      <Section sectionKey="precon_faktor" title={t('section_precon_factors')}>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {preconFaktor.length} {t('psnap_factors_configured')}
        </p>
        <div className="max-h-40 overflow-y-auto mt-1">
          <div className="flex flex-wrap gap-1">
            {preconFaktor.map((f, i) => (
              <span
                key={i}
                className="font-mono text-xs px-1 py-0.5 border"
                style={{
                  borderColor: 'var(--color-border)',
                  borderRadius: 'var(--radius)',
                  backgroundColor: f < 1 ? '#dcfce7' : f > 1 ? '#fee2e2' : 'transparent',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {encaladoConfig && (
        <Section sectionKey="encalado" title={t('section_encalado_params')}>
          <EncaladoConfigForm value={encaladoConfig} onChange={() => {}} readOnly />
        </Section>
      )}

      <Section sectionKey="postliming_ponds" title={t('psnap_postliming_ponds')}>
        <PondEditor value={postlimingPonds} onChange={() => {}} readOnly />
      </Section>

      <Section sectionKey="postliming_faktor" title={t('section_postliming_factors')}>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {postlimingFaktor.length} {t('psnap_factors_configured')}
        </p>
      </Section>

      <Section sectionKey="schedule" title={t('psnap_daily_schedule')}>
        <DailyScheduleEditor value={dailySchedule} onChange={() => {}} readOnly />
      </Section>
    </div>
  );
}
