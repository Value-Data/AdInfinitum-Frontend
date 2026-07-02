import React from 'react';
import type { SolverResult } from '../types';
import { useT } from '../i18n/LanguageContext';
import KPICards from './KPICards';
import GlobalBalanceTable, { type GlobalBalanceTableProps } from './GlobalBalanceTable';
import PondDetailBreakdown from './PondDetailBreakdown';
import ResultCharts from './ResultCharts';
import EncaladoResultPanel from './EncaladoResultPanel';
import ParameterSnapshot from './ParameterSnapshot';

export interface StaticReportStage {
  label: string;
  result: SolverResult;
  temperature_C?: number;
}

export interface StaticReportProps {
  projectName: string;
  executionLabel: string;
  executionId: string;
  generatedAt: string;
  stages: StaticReportStage[];
  streams: GlobalBalanceTableProps['streams'];
  preconDaysYear?: number;
  encaladoDaysYear?: number;
  postlimingDaysYear?: number;
  encaladoData?: Record<string, unknown>;
  snapshot?: Record<string, unknown> | null;
}

// Un bloque que html2canvas captura como una unidad (se mantiene junto en la página).
function Block({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="pdf-block" style={{ marginBottom: 16, breakInside: 'avoid' }}>
      {title && (
        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text)' }}>
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

export default function StaticReportDocument({
  projectName,
  executionLabel,
  executionId,
  generatedAt,
  stages,
  streams,
  preconDaysYear,
  encaladoDaysYear,
  postlimingDaysYear,
  encaladoData,
  snapshot,
}: StaticReportProps) {
  const t = useT();
  return (
    <div
      className="staticreport-root"
      style={{
        width: 'max-content',
        minWidth: 1000,
        padding: 24,
        background: '#ffffff',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body, sans-serif)',
      }}
    >
      {/* Mismo fix que el reporte dinámico: las tablas anchas se recortaban en el PDF.
          overflow visible + contenedor max-content + bloques de tabla a su ancho natural
          (:has). Los gráficos (ResponsiveContainer) van envueltos en ancho fijo 900px. */}
      <style>{`
        .staticreport-root .overflow-x-auto { overflow: visible !important; }
        .staticreport-root .pdf-block { width: 1000px; }
        .staticreport-root .pdf-block:has(.overflow-x-auto) { width: max-content; max-width: none; }
        .staticreport-root .pdf-chartwrap { width: 900px; }
      `}</style>

      {/* Portada */}
      <div className="pdf-block" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
          {t('dynreport_cover_title')}
        </h1>
        <p style={{ margin: '0 0 2px', color: 'var(--color-text-secondary)' }}>
          {t('dynreport_cover_project')} <strong>{projectName}</strong>
        </p>
        <p style={{ margin: '0 0 2px', color: 'var(--color-text-secondary)' }}>
          {t('stage')}: <strong>{executionLabel}</strong>
        </p>
        <p style={{ margin: '0 0 2px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
          {t('dynreport_cover_execution_id')}: {executionId}
        </p>
        <p style={{ margin: '0 0 12px', color: 'var(--color-text-secondary)' }}>
          {t('dynreport_cover_generated')} {generatedAt}
        </p>
      </div>

      {/* Resumen (KPIs por etapa) */}
      <Block title={t('kpis')}>
        {stages.map((s, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <KPICards stageLabel={s.label} result={s.result} />
          </div>
        ))}
      </Block>

      {/* Balance global */}
      <Block title={t('execres_tab_global')}>
        <GlobalBalanceTable
          streams={streams}
          preconDaysYear={preconDaysYear}
          encaladoDaysYear={encaladoDaysYear}
          postlimingDaysYear={postlimingDaysYear}
        />
      </Block>

      {/* Detalle por poza + gráficos, por etapa */}
      {stages.map((s, i) => (
        <div key={i} className="pdf-block pdf-page-break" style={{ marginBottom: 16 }}>
          <PondDetailBreakdown stageLabel={s.label} result={s.result} temperature_C={s.temperature_C} />
          <div className="pdf-chartwrap" style={{ marginTop: 12 }}>
            <ResultCharts stageLabel={s.label} result={s.result} />
          </div>
        </div>
      ))}

      {/* Encalado (si aplica) */}
      {encaladoData && (
        <Block title={t('stage_reagent_plant')}>
          <EncaladoResultPanel
            stageLabel={t('stage_reagent_plant')}
            result={encaladoData}
            temperature_C={
              (snapshot?.encalado_config as Record<string, unknown> | undefined)?.temperature_C as
                | number
                | undefined
            }
          />
        </Block>
      )}

      {/* Parámetros usados */}
      {snapshot && (
        <div className="pdf-block pdf-page-break" style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>{t('execres_tab_parameters')}</h4>
          <ParameterSnapshot snapshot={snapshot} />
        </div>
      )}
    </div>
  );
}
