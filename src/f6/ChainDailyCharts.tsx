/**
 * Las series diarias de cada etapa de la cadena, en el período común del reporte de la
 * cadena (como el PDF de la cadena del servidor y la vista de antes).
 */
import React, { useEffect, useRef } from 'react';
import type { ReportQuery } from '../services/apiV2';
import type { ChainSummary } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import { DailyCharts } from './Charts';

export function ChainDailyCharts({ chain, query, print = false, onSettled }: {
  chain: ChainSummary; query: ReportQuery; print?: boolean; onSettled?: () => void;
}) {
  const t = useT();
  const etapas = chain.executions.filter((e) => e.status === 'completed');
  const faltan = useRef(etapas.length);
  useEffect(() => { if (etapas.length === 0) onSettled?.(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
  const listo = () => { faltan.current -= 1; if (faltan.current === 0) onSettled?.(); };
  return (
    <>
      {etapas.map((e) => (
        <section key={e.id} className="mb-6" data-testid={`chain-daily-${e.stage}`}>
          <h3 className="text-base font-semibold mb-2 pdf-block pdf-page-break">
            {t(`f6_stage_${e.stage}` as never)}
          </h3>
          <DailyCharts executionId={e.id} query={query} print={print} onSettled={listo} />
        </section>
      ))}
    </>
  );
}
