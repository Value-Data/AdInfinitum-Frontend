/**
 * El reporte de una ejecución listo para imprimir o guardar como PDF (el PDF lo hace el
 * navegador: "Guardar como PDF"). Portada con el proyecto, la ejecución y la
 * configuración usada; después lo mismo que la pantalla: KPIs, gráficos y tablas. El
 * estático trae todos los escenarios, cada uno en su página.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  apiError, getChainReport, getExecutionDetail, getProjectV2, getReport, isDynamicType,
  type ExecutionDetail, type ProjectV2, type ReportQuery,
} from '../services/apiV2';
import type { Report } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import logo from '../media/logo-header.png';
import { DailyCharts, ReportCharts } from './Charts';
import ReportView from './ReportView';
import { executionTypeLabel, formatDateTime } from './common';

export default function PrintReportPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const t = useT();
  const cadena = search.get('chain') === '1';
  const q: ReportQuery = {
    period_start: search.get('period_start'), period_end: search.get('period_end'),
    scale_factor: search.get('scale_factor') ? Number(search.get('scale_factor')) : null,
  };
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await getExecutionDetail(id);
        const [p, r] = await Promise.all([
          getProjectV2(d.project_id), cadena ? getChainReport(id, q) : getReport(id, q)]);
        setDetail(d); setProject(p); setReport(r);
      } catch (err) {
        setError(apiError(err).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="p-6">{error}</div>;
  if (!detail || !project || !report) return <div className="p-6">…</div>;
  const dinamico = isDynamicType(detail.execution_type);
  const periodo = 'period' in report ? report.period : null;

  return (
    <div className="print-report" style={{ maxWidth: 1100, margin: '0 auto', padding: 24, background: '#fff' }}>
      <div className="no-print flex justify-end mb-4">
        <button className="btn btn-primary" onClick={() => window.print()}>{t('f6_print_now')}</button>
      </div>
      <section className="print-cover mb-8">
        <img src={logo} alt="" style={{ height: 56 }} />
        <h1 className="text-2xl font-semibold mt-6">{t('f6_print_title')}</h1>
        <h2 className="text-xl mt-1">{project.name}</h2>
        <table className="text-sm mt-6" style={{ maxWidth: 640 }}>
          <tbody>
            <tr><th className="text-left pr-6">{t('f6_project')}</th><td>{project.name} · AQSOL {project.aqsol_version}</td></tr>
            <tr><th className="text-left pr-6">{t('f6_execution_type')}</th>
              <td>{cadena ? t('f6_chain_report') : executionTypeLabel(detail.execution_type, t)}</td></tr>
            <tr><th className="text-left pr-6">{t('f6_run_tag')}</th><td className="font-mono">{detail.run_tag} · {detail.id.slice(0, 8)}</td></tr>
            <tr><th className="text-left pr-6">{t('f6_print_configuration')}</th>
              <td>{detail.sections?.map((s) => `${t(`f6_stage_${s.section}` as never)} v${s.version_no}`).join(' · ')}</td></tr>
            {detail.start_date && (
              <tr><th className="text-left pr-6">{t('f6_start_date')}</th><td>{detail.start_date} · {detail.n_days} {t('f6_days')}</td></tr>
            )}
            {periodo && (
              <tr><th className="text-left pr-6">{t('f6_period')}</th><td>{periodo.start} – {periodo.end} ({periodo.n_days} {t('f6_days')})</td></tr>
            )}
            <tr><th className="text-left pr-6">{t('f6_scale_factor')}</th><td>{report.params.scale_factor}</td></tr>
            <tr><th className="text-left pr-6">{t('f6_print_generated')}</th><td>{formatDateTime(new Date().toISOString())}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="print-page-break">
        {dinamico && !cadena && <DailyCharts executionId={id} query={q} />}
        <ReportCharts report={report} />
      </section>
      <section className="print-page-break">
        <ReportView report={report} printAll />
      </section>
    </div>
  );
}
