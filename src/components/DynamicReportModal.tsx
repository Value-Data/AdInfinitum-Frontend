import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Execution, ExecutionType } from '../types';
import { getExecution } from '../services/api';
import Modal from './common/Modal';
import DynamicReportDocument, { type ReportStageInput } from './DynamicReportDocument';
import { generatePdfFromContainer } from '../utils/pdfReport';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

type StageKey = 'cascade' | 'encalado' | 'postliming';

const STAGE_TO_TYPE: Record<StageKey, ExecutionType> = {
  cascade: 'modelo_dinamico_cascade',
  encalado: 'modelo_dinamico_encalado',
  postliming: 'modelo_dinamico_postliming',
};

const STAGE_LABEL: Record<StageKey, TranslationKey> = {
  cascade: 'cascade_label',
  encalado: 'encalado_label',
  postliming: 'postliming_label',
};

const STAGE_ORDER: StageKey[] = ['cascade', 'encalado', 'postliming'];

type StageSel = { include: boolean; execId: string };

export default function DynamicReportModal({
  open,
  onClose,
  executions,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  executions: Execution[];
  projectName: string;
}) {
  const t = useT();
  const [sel, setSel] = useState<Record<StageKey, StageSel>>({
    cascade: { include: true, execId: '' },
    encalado: { include: false, execId: '' },
    postliming: { include: false, execId: '' },
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportStages, setReportStages] = useState<ReportStageInput[] | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const completedByStage = useMemo(() => {
    const map: Record<StageKey, Execution[]> = { cascade: [], encalado: [], postliming: [] };
    for (const st of STAGE_ORDER) {
      map[st] = executions
        .filter((e) => e.execution_type === STAGE_TO_TYPE[st] && e.status === 'completed')
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return map;
  }, [executions]);

  const setStage = (st: StageKey, patch: Partial<StageSel>) =>
    setSel((prev) => ({ ...prev, [st]: { ...prev[st], ...patch } }));

  const handleGenerate = async () => {
    setError(null);
    const chosen = STAGE_ORDER.filter((st) => sel[st].include && sel[st].execId);
    if (chosen.length === 0) {
      setError(t('dynreport_error_no_stage'));
      return;
    }
    setGenerating(true);
    try {
      const stages: ReportStageInput[] = [];
      for (const st of chosen) {
        const exec = await getExecution(sel[st].execId);
        const results = exec.results as unknown as
          | ReportStageInput['results']
          | null;
        if (!results) {
          throw new Error(`${t('dynreport_error_no_results_prefix')} ${t(STAGE_LABEL[st])} ${t('dynreport_error_no_results_suffix')}`);
        }
        stages.push({
          stage: st,
          executionId: sel[st].execId,
          label: t(STAGE_LABEL[st]),
          runTag: (results as { run_tag?: string }).run_tag,
          results,
        } as ReportStageInput);
      }
      setReportStages(stages);
    } catch (e) {
      setError(String((e as Error).message || e));
      setGenerating(false);
    }
  };

  // Once the offscreen report is mounted, wait for charts to settle and capture.
  useEffect(() => {
    if (!reportStages) return;
    let cancelled = false;
    const run = async () => {
      // Let recharts finish layout/animation before rasterizing.
      await new Promise((r) => setTimeout(r, 1600));
      if (cancelled || !reportRef.current) return;
      try {
        const safe = projectName.replace(/[^a-z0-9-_]+/gi, '_');
        await generatePdfFromContainer(reportRef.current, `reporte_dinamico_${safe}.pdf`);
        if (!cancelled) onClose();
      } catch (e) {
        if (!cancelled) setError(`${t('dynreport_error_pdf')}: ${String((e as Error).message || e)}`);
      } finally {
        if (!cancelled) {
          setReportStages(null);
          setGenerating(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [reportStages, projectName, onClose, t]);

  return (
    <>
      <Modal open={open} onClose={generating ? () => undefined : onClose} title={t('dynreport_title')} width="560px">
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dynreport_instructions')}
        </p>

        <div className="space-y-3">
          {STAGE_ORDER.map((st) => {
            const opts = completedByStage[st];
            return (
              <div
                key={st}
                className="border rounded p-3"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={sel[st].include}
                    onChange={(e) => setStage(st, { include: e.target.checked })}
                  />
                  {t(STAGE_LABEL[st])}
                </label>
                <select
                  className="input w-full"
                  disabled={!sel[st].include || opts.length === 0}
                  value={sel[st].execId}
                  onChange={(e) => setStage(st, { execId: e.target.value })}
                >
                  <option value="">{t('dynreport_choose_execution')}</option>
                  {opts.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id.slice(0, 8)} · {new Date(e.created_at).toLocaleString()}
                    </option>
                  ))}
                </select>
                {sel[st].include && opts.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
                    {t('dynreport_no_completed_prefix')} {t(STAGE_LABEL[st])} {t('dynreport_no_completed_suffix')}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-sm mt-3" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={generating}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating}>
            {generating ? t('dynreport_generating') : t('dynreport_generate')}
          </button>
        </div>
      </Modal>

      {/* Offscreen report — rendered only during capture. position:fixed keeps it
          laid out (so recharts measures width) while staying out of view. */}
      {reportStages && (
        <div
          aria-hidden
          style={{ position: 'fixed', left: -100000, top: 0, zIndex: -1, pointerEvents: 'none' }}
        >
          <div ref={reportRef}>
            <DynamicReportDocument
              projectName={projectName}
              generatedAt={new Date().toLocaleString()}
              stages={reportStages}
            />
          </div>
        </div>
      )}
    </>
  );
}
