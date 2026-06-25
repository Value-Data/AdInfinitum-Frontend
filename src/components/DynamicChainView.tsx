import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchExecutionChain,
  applyFactorsToChain,
  DEFAULT_STAGE_FACTORS,
  type ChainData,
  type StageFactors,
} from '../utils/dynamicChain';
import { useT } from '../i18n/LanguageContext';
import { listExecutionFiles } from '../services/api';
import type { ExecutionFile } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import DynamicResultsView from './DynamicResultsView';

type Props = {
  rootExecutionId: string;
  onClose: () => void;
};

export default function DynamicChainView({ rootExecutionId, onClose }: Props) {
  const t = useT();
  const [chain, setChain] = useState<ChainData | null>(null);
  const [allFiles, setAllFiles] = useState<ExecutionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [factors, setFactors] = useState<StageFactors>(DEFAULT_STAGE_FACTORS);
  const [factorInputs, setFactorInputs] = useState<{ precon: string; encalado: string; postliming: string }>({
    precon: '1',
    encalado: '1',
    postliming: '1',
  });

  // Re-apply per-stage factors whenever they change
  const scaledChain = useMemo(() => {
    if (!chain) return null;
    return applyFactorsToChain(chain, factors);
  }, [chain, factors]);

  const applyFactors = () => {
    const parse = (s: string) => {
      const v = parseFloat(s);
      return Number.isFinite(v) && v > 0 ? v : 1;
    };
    setFactors({
      precon: parse(factorInputs.precon),
      encalado: parse(factorInputs.encalado),
      postliming: parse(factorInputs.postliming),
    });
  };

  const resetFactors = () => {
    setFactors(DEFAULT_STAGE_FACTORS);
    setFactorInputs({ precon: '1', encalado: '1', postliming: '1' });
  };

  const factorsApplied =
    factors.precon !== 1 || factors.encalado !== 1 || factors.postliming !== 1;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetchExecutionChain(rootExecutionId)
      .then(async (data) => {
        if (!alive) return;
        setChain(data);
        // Aggregate file listings across the chain
        const files: ExecutionFile[] = [];
        for (const id of data.executionIds) {
          try {
            const fs = await listExecutionFiles(id);
            for (const f of fs) {
              files.push({ ...f, name: `${id.slice(0, 8)}/${f.name}` });
            }
          } catch {
            // ignore
          }
        }
        if (!alive) return;
        setAllFiles(files);
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [rootExecutionId]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-base font-semibold">
          {t('chain_root')}{' '}
          <span className="font-mono text-xs">{rootExecutionId.slice(0, 8)}</span>
        </h3>
        <button className="btn btn-outline btn-sm" onClick={onClose}>
          {t('close')}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner size="md" />
      ) : err ? (
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      ) : !chain || !scaledChain ? (
        <p>{t('dynchain_no_data')}</p>
      ) : (
        <>
          {/* Chain summary banner */}
          <ChainBanner chain={chain} />

          {/* Per-stage scale factors (Section 3.5) */}
          <div
            className="card p-3 mb-4 flex flex-wrap items-end gap-3"
            style={{ background: factorsApplied ? '#fff8e1' : undefined }}
          >
            <div className="text-sm font-semibold mr-2">{t('dynchain_scale_factors_by_process')}</div>
            <FactorInput
              label={t('stage_precon')}
              value={factorInputs.precon}
              onChange={(v) => setFactorInputs((p) => ({ ...p, precon: v }))}
              onEnter={applyFactors}
            />
            <FactorInput
              label={t('stage_reagent_plant')}
              value={factorInputs.encalado}
              onChange={(v) => setFactorInputs((p) => ({ ...p, encalado: v }))}
              onEnter={applyFactors}
            />
            <FactorInput
              label={t('stage_postliming')}
              value={factorInputs.postliming}
              onChange={(v) => setFactorInputs((p) => ({ ...p, postliming: v }))}
              onEnter={applyFactors}
            />
            <button className="btn btn-outline btn-sm" onClick={applyFactors}>
              {t('apply')}
            </button>
            {factorsApplied && (
              <button className="btn btn-outline btn-sm" onClick={resetFactors}>
                {t('reset')}
              </button>
            )}
            {factorsApplied && (
              <p className="text-xs flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                {t('applied')}: precon ×{factors.precon} · encalado ×{factors.encalado} · postliming ×{factors.postliming}.
                {' '}{t('dynchain_factors_applied_note')}
              </p>
            )}
          </div>

          {/* Encalado KPIs (extracted from chain since it doesn't fit cascade-pond shape) */}
          {scaledChain.encalado && (
            <div className="card p-3 mb-4" style={{ background: 'var(--color-bg)' }}>
              <h4 className="text-sm font-semibold mb-2">
                {t('dynchain_enc_stage_title')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label={t('dynchain_stat_days_with_feed')} value={scaledChain.encalado.n_days_with_feed} />
                <Stat
                  label={t('dynchain_stat_avg_outflow')}
                  value={`${scaledChain.encalado.kpis.flow_out_t_d_avg?.toFixed(2) ?? '—'} t/d`}
                />
                <Stat
                  label={t('dynchain_stat_aqsol_conv')}
                  value={`${scaledChain.encalado.kpis.aqsol_convergence_pct.toFixed(2)}%`}
                />
                <Stat
                  label={t('dynchain_stat_li_out_annual')}
                  value={`${scaledChain.encalado.kpis.li_out_t_year?.toFixed(2) ?? '—'} t/y`}
                />
              </div>
              <p
                className="text-xs mt-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('dynchain_enc_detail_note')}
              </p>
            </div>
          )}

          {/* Merged cascade + postliming view */}
          {scaledChain.merged ? (
            <DynamicResultsView
              executionId={rootExecutionId}
              results={scaledChain.merged}
              files={allFiles}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('dynchain_no_cascade_stages')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FactorInput({
  label,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input
        type="number"
        className="input input-number w-24"
        step={0.01}
        min={0.01}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter();
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </div>
      <div className="font-semibold font-mono">{value}</div>
    </div>
  );
}

function ChainBanner({ chain }: { chain: ChainData }) {
  const t = useT();
  const stageLabels = chain.stages.map((s, i) => {
    const tag = s.stage === 'cascade' ? t('stage_precon') : s.stage === 'encalado' ? t('stage_reagent_plant') : t('stage_postliming');
    return `${tag} (${chain.executionIds[i].slice(0, 8)})`;
  });
  return (
    <div
      className="rounded p-2 mb-4 text-xs"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
    >
      {t('chain')}: {stageLabels.join(' → ') || '—'}
    </div>
  );
}
