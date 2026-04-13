import React, { useState } from 'react';
import BrineEditor from './BrineEditor';
import PondEditor from './PondEditor';
import EncaladoConfigForm from './EncaladoConfigForm';
import DailyScheduleEditor from './DailyScheduleEditor';
import type { EncaladoConfig, PondConfig, DailyScheduleItem } from '../types';

interface Props {
  snapshot: Record<string, unknown>;
}

export default function ParameterSnapshot({ snapshot }: Props) {
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

  const brine = (snapshot.brine as Record<string, number>) || {};
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
      <Section sectionKey="brine" title="Salmuera de Pozo">
        <BrineEditor value={brine} onChange={() => {}} readOnly />
      </Section>

      <Section sectionKey="precon_ponds" title="Pozas de Preconcentracion">
        <PondEditor value={preconPonds} onChange={() => {}} readOnly />
      </Section>

      <Section sectionKey="precon_faktor" title="Factores de Sales Preconcentracion">
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {preconFaktor.length} factores configurados
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
        <Section sectionKey="encalado" title="Parametros de Encalado">
          <EncaladoConfigForm value={encaladoConfig} onChange={() => {}} readOnly />
        </Section>
      )}

      <Section sectionKey="postliming_ponds" title="Pozas de Post-liming">
        <PondEditor value={postlimingPonds} onChange={() => {}} readOnly />
      </Section>

      <Section sectionKey="postliming_faktor" title="Factores de Sales Post-liming">
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {postlimingFaktor.length} factores configurados
        </p>
      </Section>

      <Section sectionKey="schedule" title="Cronograma Diario">
        <DailyScheduleEditor value={dailySchedule} onChange={() => {}} readOnly />
      </Section>
    </div>
  );
}
