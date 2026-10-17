/**
 * El reporte de una ejecución listo para imprimir o bajar en PDF: el que arma el
 * servidor, el PDF directo (A4, jsPDF; los gráficos salen de ECharts y el resto con
 * html2canvas) o el del navegador ("Guardar como PDF", gráficos en SVG). Portada con el proyecto, la ejecución y la configuración usada; los parámetros
 * de entrada; después lo mismo que la pantalla: KPIs, gráficos y tablas. El estático
 * trae todos los escenarios, cada uno en su página.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  apiError, blobApiError, downloadChainReportPdf, downloadReportPdf, getChain, getChainReport, getExecutionDetail,
  getProjectV2, getReport, isDynamicType, saveBlob,
  type ExecutionDetail, type ProjectV2, type ReportQuery,
} from '../services/apiV2';
import type { ChainSummary, Report } from '../types/report';
import { ChainDailyCharts } from './ChainDailyCharts';
import { useLanguage, useT } from '../i18n/LanguageContext';
import logo from '../media/logo-header.png';
import { DailyCharts, ReportCharts } from './Charts';
import { ChartPrintContext } from './EChart';
import CompareExecutions from './CompareExecutions';
import ReportView from './ReportView';
import { PartialRunBanner, executionTypeLabel, formatDateTime, partialInfo } from './common';
import InputParameters from './InputParameters';
import { generatePdfFromContainer } from '../utils/pdfReport';
import { PdfPreview } from './PdfPreview';

/** Nombre fijo del PDF, como en la versión anterior: reporte_<estatico|dinamico>_<proyecto>.pdf. */
export function pdfFileName(projectName: string, dynamic: boolean, chain = false): string {
  const seguro = (projectName || 'reporte').replace(/[^a-z0-9-_]+/gi, '_');
  return `reporte_${dynamic ? 'dinamico' : 'estatico'}${chain ? '_cadena' : ''}_${seguro}.pdf`;
}

export default function PrintReportPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const t = useT();
  const { lang } = useLanguage();
  const cadena = search.get('chain') === '1';
  const q: ReportQuery = {
    period_start: search.get('period_start'), period_end: search.get('period_end'),
    scale_factor: search.get('scale_factor') ? Number(search.get('scale_factor')) : null,
  };
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [chain, setChain] = useState<ChainSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<'idle' | 'busy' | 'error'>('idle');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfServidor, setPdfServidor] = useState(false);
  const [seriesListas, setSeriesListas] = useState(false);
  const [comparacionLista, setComparacionLista] = useState(false);
  const comparar = (search.get('compare') ?? '').split(',').filter(Boolean);
  const hoja = useRef<HTMLDivElement>(null);
  const [paramsListos, setParamsListos] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getExecutionDetail(id);
        const [p, r, c] = await Promise.all([
          getProjectV2(d.project_id), cadena ? getChainReport(id, q) : getReport(id, q),
          cadena ? getChain(id) : Promise.resolve(null)]);
        setDetail(d); setProject(p); setReport(r); setChain(c);
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
  // Los parámetros de entrada son configuración: solo si el rol la puede ver.
  const conParams = (detail.sections?.length ?? 0) > 0 && (project.capabilities ?? []).includes('view_config');
  const conSeries = dinamico && (!cadena || Boolean(chain));
  // Lo que se imprime tiene que estar dibujado: los parámetros y las series diarias.
  const conComparacion = comparar.length > 0 && !cadena;
  const esperando = (conParams && !paramsListos) || (conSeries && !seriesListas)
    || (conComparacion && !comparacionLista);
  const bajarPdf = async () => {
    if (!hoja.current) return;
    setPdf('busy');
    setPdfError(null);
    try {
      await generatePdfFromContainer(hoja.current, pdfFileName(project.name, dinamico, cadena));
      setPdf('idle');
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : null);
      setPdf('error');
    }
  };
  const bajarPdfServidor = async () => {
    setPdfServidor(true);
    setPdfError(null);
    try {
      const b = cadena ? await downloadChainReportPdf(id, lang, q) : await downloadReportPdf(id, lang, q);
      saveBlob(b, pdfFileName(project.name, dinamico, cadena));
      setPdf('idle');
    } catch (err) {
      setPdfError((await blobApiError(err)).message);
      setPdf('error');
    } finally {
      setPdfServidor(false);
    }
  };

  return (
    <div className="print-report" style={{ maxWidth: 1100, margin: '0 auto', padding: 24, background: '#fff' }}
         ref={hoja}>
      <div className="no-print flex flex-wrap items-center justify-end gap-2 mb-4">
        {pdf === 'error' && (
          <span className="text-sm" style={{ color: 'var(--color-danger)' }}>
            {t('f6_pdf_error')}{pdfError && ` (${pdfError})`}
          </span>
        )}
        <button className="btn btn-outline" onClick={bajarPdfServidor} disabled={pdfServidor}
                data-testid="download-pdf-server">
          {pdfServidor ? t('f6_pdf_server_busy') : t('f6_download_pdf_server')}
        </button>
        <button className="btn btn-primary" onClick={bajarPdf} disabled={pdf === 'busy' || esperando} data-testid="download-pdf">
          {pdf === 'busy' || esperando ? t('f6_pdf_busy') : t('f6_download_pdf')}
        </button>
        <button className="btn btn-outline" onClick={() => window.print()} disabled={esperando}>{t('f6_print_now')}</button>
      </div>
      <PdfPreview load={() => (cadena ? downloadChainReportPdf(id, lang, q) : downloadReportPdf(id, lang, q))} />
      <section className="print-cover mb-8 pdf-block">
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
        <div className="mt-6"><PartialRunBanner info={partialInfo(detail)} /></div>
      </section>
      {conParams && (
        <InputParameters projectId={detail.project_id} engine={dinamico ? 'dynamic' : 'static'}
                         onSettled={() => setParamsListos(true)}
                         sections={(detail.sections ?? []) as unknown as { section: string; version_no: number }[]} />
      )}
      <ChartPrintContext.Provider value>
        <section className="print-page-break">
          {conSeries && (cadena && chain && periodo
            ? <ChainDailyCharts chain={chain} print onSettled={() => setSeriesListas(true)}
                                query={{ ...q, period_start: periodo.start, period_end: periodo.end }} />
            : <DailyCharts executionId={id} query={q} print onSettled={() => setSeriesListas(true)} />)}
          <ReportCharts report={report} allScenarios />
          {conComparacion && (
            <CompareExecutions detail={detail} query={q} ids={comparar} onSettled={() => setComparacionLista(true)} />
          )}
        </section>
      </ChartPrintContext.Provider>
      <section className="print-page-break">
        <ReportView report={report} printAll />
      </section>
    </div>
  );
}
