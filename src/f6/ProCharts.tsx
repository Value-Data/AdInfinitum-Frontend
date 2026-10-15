/**
 * Gráficos de lectura rápida, desde lo que ya trae el reporte o las series (sin recalcular):
 *   - balance de litio (Sankey) de la salmuera de pozo al producto, por etapa;
 *   - medidores de la recuperación de Li de cada etapa y del proceso;
 *   - mapa de calor poza × día de una variable de las series diarias.
 */
import React, { useMemo, useState } from 'react';
import type { DailySeries, StageReport } from '../types/report';
import { useT } from '../i18n/LanguageContext';
import { useDecimals } from '../context/DecimalsContext';
import { dmy } from './common';
import { heatVariables, liFlows, recoveries } from './chartData';
import { liSankeyOption, pondHeatmapOption, recoveryGaugesOption } from './chartOptions';
import { EChart, useChartPrint } from './EChart';
import { Panel, nombreArchivo, useTools } from './chartPanel';

/**
 * Li de la salmuera de pozo (o lo que entra a la primera etapa) al producto, pasando por
 * cada etapa, con lo no recuperado de cada una. `dynamic`: t en el período; si no, t/d.
 */
export function LiSankeyPanel({ stages, dynamic, prefix = '' }: {
  stages: StageReport[]; dynamic: boolean; prefix?: string;
}) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const unidad = dynamic ? 't' : 't/d';
  const titulo = `${prefix}${t('f6_li_balance')} (${dynamic ? t('f6_li_unit_period') : t('f6_li_unit_static')})`;
  const flujos = liFlows(stages, dynamic);
  const option = useMemo(() => {
    const etapa = (s: string) => t(`f6_stage_${s}` as never);
    return liSankeyOption({
      stages: flujos.map((f) => ({ name: etapa(f.stage), li_in: f.li_in, li_out: f.li_out,
        lossName: `${etapa(f.stage)} · ${t('f6_li_unrecovered')}` })),
      sourceName: flujos[0]?.stage === 'precon' ? t('f6_li_source_well') : t('f6_li_source_in'),
      productName: t('f6_li_product'), unit: unidad, pctLabel: t('f6_li_pct_of_in'),
      print, tools, fileName: nombreArchivo(titulo),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, dynamic, print, decimals, t, titulo]);
  if (!flujos.some((f) => f.li_in !== null || f.li_out !== null)) return null;
  return (
    <>
      <Panel title={titulo} height={300} wide>
        <EChart option={option} height={300} />
      </Panel>
      <p className="text-xs -mt-2 mb-2 pdf-block" style={{ gridColumn: '1 / -1', color: 'var(--color-text-secondary)' }}>
        {t('f6_li_unrecovered_hint')}
      </p>
    </>
  );
}

/** Recuperación de Li de cada etapa y del proceso, como medidores (las tarjetas de KPIs siguen en el reporte). */
export function RecoveryPanel({ stages, processKpis, prefix = '' }: {
  stages: StageReport[]; processKpis: Record<string, number | null>; prefix?: string;
}) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const titulo = `${prefix}${t('f6_recovery_panel')} (%)`;
  const filas = recoveries(stages, processKpis);
  const option = useMemo(() => recoveryGaugesOption({
    items: filas.map((f) => ({
      name: f.key === 'process' ? t('f6_process_full') : t(`f6_stage_${f.key}` as never),
      value: f.value, highlight: f.key === 'process',
    })),
    print, tools, fileName: nombreArchivo(titulo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stages, processKpis, print, decimals, t, titulo]);
  if (filas.length === 0) return null;
  return (
    <Panel title={titulo} height={210} wide={filas.length > 2}>
      <EChart option={option} height={210} />
    </Panel>
  );
}

/**
 * Mapa de calor poza × día de una variable de las series (las que vienen por poza y la
 * composición de cada especie). La poza de producto va marcada en el eje.
 */
export function PondHeatmap({ data, eje, interval, titleOf }: {
  data: DailySeries; eje: 'date' | 'day'; interval: number | 'auto';
  /** Nombre de la variable (el mismo título que su gráfico de líneas). */
  titleOf: (key: string, species?: string) => string;
}) {
  const t = useT();
  const { decimals } = useDecimals();
  const tools = useTools();
  const print = useChartPrint();
  const variables = useMemo(() => heatVariables(data), [data]);
  const [elegida, setElegida] = useState<string | null>(null);
  const v = variables.find((x) => x.key === elegida) ?? variables[0];
  const nombre = v ? titleOf(v.key, v.species) : '';
  const titulo = v ? `${t('f6_heatmap')} · ${nombre}${v.unit ? ` (${v.unit})` : ''}` : '';
  const option = useMemo(() => {
    if (!v) return null;
    const categorias = eje === 'date' ? data.dates : data.dates.map((_f, i) => String(data.days?.[i] ?? i + 1));
    return pondHeatmapOption({
      categories: categorias, ponds: v.ponds, values: v.values, unit: v.unit, productPond: data.product_pond,
      axisLabel: eje === 'date' ? (x) => dmy(x) : (x) => x,
      tooltipTitle: eje === 'date' ? (x) => dmy(x) : (x) => `${t('f6_day')} ${x}`,
      interval, print, tools, fileName: nombreArchivo(titulo),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, v, eje, interval, print, decimals, t]);
  if (!v || !option) return null;
  const alto = Math.max(240, v.ponds.length * 22 + (print ? 110 : 140));
  return (
    <div style={{ gridColumn: '1 / -1' }} data-testid="pond-heatmap">
      {!print && (
        <label className="flex gap-1 items-center text-xs mb-1 no-print">
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('f6_heatmap')} · {t('f6_variable')}:</span>
          <select className="input text-xs" style={{ width: 'auto' }} value={v.key} data-testid="heatmap-variable"
                  onChange={(e) => setElegida(e.target.value)}>
            {variables.map((x) => <option key={x.key} value={x.key}>{titleOf(x.key, x.species)}</option>)}
          </select>
        </label>
      )}
      <Panel title={titulo} height={alto} wide>
        <EChart option={option} height={alto} canvas />
      </Panel>
    </div>
  );
}
