import React, { useMemo, useRef, useState } from 'react';
import type { DynamicConfig } from '../../types';
import { formatEs } from '../../utils/numberFormat';
import { useT } from '../../i18n/LanguageContext';
import Tip from './Tip';

/**
 * Editor de la serie climática: tabla día a día, carga masiva e import/export CSV.
 *
 * Estaba dentro de `DynamicConfigEditor`. Se movió acá sin cambiarle la lógica para
 * que el modo con inventario edite su clima con la misma herramienta: son las mismas
 * dos series (evaporación mm/día y temperatura °C) por día, y no tenía sentido que
 * un modo se editara en pantalla y el otro solo por planilla.
 *
 * La columna de caudal por día es del modelo dinámico —el de inventario toma el
 * caudal del feed— así que se puede apagar con `showFlow={false}`.
 */


// =========================================================
// Climate — stats + import/export CSV
// =========================================================
export default function ClimateEditor({
  climate,
  onChange,
  showFlow = true,
}: {
  climate: DynamicConfig['climate'];
  onChange: (v: DynamicConfig['climate']) => void;
  /** Columna de caudal por día: solo el modelo dinámico la usa. */
  showFlow?: boolean;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [bulkDays, setBulkDays] = useState(30);
  const [bulkTemp, setBulkTemp] = useState(20);
  const [bulkEvap, setBulkEvap] = useState(5);
  // 0 = los dias agregados quedan modulados (sin caudal propio).
  const [bulkFlow, setBulkFlow] = useState(0);

  const evap = climate.evaporation_mm_day;
  const temp = climate.temperature_C;
  const n = Math.min(evap.length, temp.length);

  // Caudal por dia: serie paralela y OPCIONAL. Una celda vacia (null) significa "que
  // lo module el motor con average/max_flow", que es el comportamiento por defecto.
  const flows = climate.brine_flow_ton_day ?? [];
  const nConCaudal = flows.filter((f) => typeof f === 'number' && f > 0).length;

  const setFlows = (next: (number | null)[]) => {
    // Serie toda vacia => se guarda como ausente, para no dejar ruido en la config.
    const alguno = next.some((f) => typeof f === 'number' && f > 0);
    onChange({ ...climate, brine_flow_ton_day: alguno ? next : null });
  };

  const avgEvap = n ? evap.reduce((a, b) => a + b, 0) / n : 0;
  const minEvap = n ? Math.min(...evap) : 0;
  const maxEvap = n ? Math.max(...evap) : 0;
  const avgTemp = n ? temp.reduce((a, b) => a + b, 0) / n : 0;
  const minTemp = n ? Math.min(...temp) : 0;
  const maxTemp = n ? Math.max(...temp) : 0;

  // Compute date label for row i from series_start_date + i days
  const startDate = useMemo(() => {
    try {
      return new Date(`${climate.series_start_date}T00:00:00Z`);
    } catch {
      return null;
    }
  }, [climate.series_start_date]);
  const dateLabel = (i: number): string => {
    if (!startDate || isNaN(startDate.getTime())) return `${t('schedule_day')} ${i + 1}`;
    const d = new Date(startDate.getTime() + i * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };

  const updateDay = (i: number, field: 'evap' | 'temp', val: number) => {
    const newEvap = [...evap];
    const newTemp = [...temp];
    if (field === 'evap') newEvap[i] = val;
    else newTemp[i] = val;
    onChange({ ...climate, evaporation_mm_day: newEvap, temperature_C: newTemp });
  };

  const updateFlow = (i: number, val: number | null) => {
    // Se rellena hasta i para no dejar huecos que corran los indices de la serie.
    const next: (number | null)[] = [...flows];
    while (next.length <= i) next.push(null);
    next[i] = val;
    setFlows(next);
  };

  const addDay = () => {
    onChange({
      ...climate,
      evaporation_mm_day: [...evap, 5],
      temperature_C: [...temp, 20],
      // El dia nuevo arranca modulado; el caudal propio se pone a mano si se quiere.
      brine_flow_ton_day: flows.length ? [...flows, null] : climate.brine_flow_ton_day,
    });
  };

  const addBulk = () => {
    const newEvap = [...evap];
    const newTemp = [...temp];
    const newFlows: (number | null)[] = [...flows];
    for (let i = 0; i < bulkDays; i++) {
      newEvap.push(bulkEvap);
      newTemp.push(bulkTemp);
      if (flows.length) newFlows.push(bulkFlow > 0 ? bulkFlow : null);
    }
    onChange({
      ...climate,
      evaporation_mm_day: newEvap,
      temperature_C: newTemp,
      brine_flow_ton_day: flows.length ? newFlows : climate.brine_flow_ton_day,
    });
  };

  const removeDay = (i: number) => {
    onChange({
      ...climate,
      evaporation_mm_day: evap.filter((_, idx) => idx !== i),
      temperature_C: temp.filter((_, idx) => idx !== i),
      brine_flow_ton_day: flows.length
        ? flows.filter((_, idx) => idx !== i)
        : climate.brine_flow_ton_day,
    });
  };

  const clearAll = () => {
    if (!confirm(`${t('dyncfg_climate_clear_confirm_pre')} ${n} ${t('dyncfg_climate_clear_confirm_post')}`)) return;
    onChange({
      ...climate,
      evaporation_mm_day: [],
      temperature_C: [],
      brine_flow_ton_day: null,
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error(t('dyncfg_csv_empty'));
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const evapIdx = header.findIndex((h) => h.startsWith('evap'));
      const tempIdx = header.findIndex((h) => h.startsWith('temp'));
      if (evapIdx < 0 || tempIdx < 0) throw new Error(t('dyncfg_csv_missing_cols'));
      // Columna de caudal OPCIONAL: sin ella el CSV se importa como siempre y todos
      // los dias quedan modulados. Celda vacia o <= 0 = ese dia modulado.
      const flowIdx = header.findIndex((h) => h.startsWith('flow') || h.startsWith('caudal'));
      const newEvap: number[] = [];
      const newTemp: number[] = [];
      const newFlows: (number | null)[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        newEvap.push(parseFloat(cols[evapIdx]));
        newTemp.push(parseFloat(cols[tempIdx]));
        if (flowIdx >= 0) {
          const f = parseFloat((cols[flowIdx] ?? '').trim());
          newFlows.push(Number.isFinite(f) && f > 0 ? f : null);
        }
      }
      const conCaudal = newFlows.filter((f) => f !== null).length;
      onChange({
        ...climate,
        evaporation_mm_day: newEvap,
        temperature_C: newTemp,
        brine_flow_ton_day: conCaudal > 0 ? newFlows : null,
      });
      setMsg(
        `${t('dyncfg_loaded_pre')} ${newEvap.length} ${t('schedule_days_lower')}` +
          (conCaudal > 0 ? ` · ${conCaudal} ${t('dyncfg_flow_days_loaded')}` : '') +
          '.',
      );
    } catch (err) {
      setMsg(`${t('error')}: ${(err as Error).message}`);
    }
  };

  const handleExport = () => {
    // Se exporta la columna de caudal siempre: asi el CSV exportado se puede reimportar
    // sin perder la serie, y sirve de plantilla para llenarla a mano.
    const rows = ['day,date,evap_mm_day,temp_C,flow_ton_day'];
    for (let i = 0; i < n; i++) {
      const f = typeof flows[i] === 'number' ? flows[i] : '';
      rows.push(`${i + 1},${dateLabel(i)},${evap[i]},${temp[i]},${f}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `climate_${climate.series_start_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        <div>
          <label className="label">{t('dyncfg_series_start_date')}</label>
          <input
            type="text"
            className="input"
            placeholder="2024-01-01"
            value={climate.series_start_date}
            onChange={(e) => onChange({ ...climate, series_start_date: e.target.value })}
          />
        </div>
        <div className="text-sm pt-6" style={{ color: 'var(--color-text-secondary)' }}>
          {n} {t('dyncfg_days_loaded')}
          {n > 0 && (
            <>
              {' · '}
              {t('dyncfg_averages')}: evap{' '}
              <span className="font-mono">{formatEs(avgEvap, 3)}</span> mm/d (min{' '}
              {formatEs(minEvap, 3)}, max {formatEs(maxEvap, 3)}) · temp{' '}
              <span className="font-mono">{formatEs(avgTemp, 2)}</span> °C (min{' '}
              {formatEs(minTemp, 2)}, max {formatEs(maxTemp, 2)})
            </>
          )}
          {nConCaudal > 0 && (
            <>
              {' · '}
              <span className="font-mono">{nConCaudal}</span>{' '}
              {t('dyncfg_climate_flow_summary')}
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table>
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface)' }}>
            <tr>
              <th className="w-12">#</th>
              <th>
                {t('dyncfg_th_day_calc_date')}
                <Tip text={t('dyncfg_tip_day_calc_date')} />
              </th>
              <th>
                {t('dyncfg_enc_temperature')}
                <Tip text={t('dyncfg_tip_day_temp')} />
              </th>
              <th>
                {t('dyncfg_th_evaporation')}
                <Tip text={t('dyncfg_tip_day_evap')} />
              </th>
              <th>
                {t('dyncfg_th_brine_flow')}
                <Tip text={t('dyncfg_tip_day_flow')} />
              </th>
              <th className="w-20">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }).map((_, i) => (
              <tr key={i}>
                <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {i + 1}
                </td>
                <td className="font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {dateLabel(i)}
                </td>
                <td>
                  <input
                    type="number"
                    className="input input-number w-24"
                    step={0.5}
                    value={temp[i] ?? 0}
                    onChange={(e) =>
                      updateDay(i, 'temp', parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input input-number w-24"
                    step={0.1}
                    min={0}
                    value={evap[i] ?? 0}
                    onChange={(e) =>
                      updateDay(i, 'evap', parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input input-number w-28"
                    step={100}
                    min={0}
                    // Vacio = sin caudal propio: ese dia lo modula el motor.
                    placeholder={t('dyncfg_flow_modulated')}
                    title={t('dyncfg_tip_day_flow')}
                    value={typeof flows[i] === 'number' ? (flows[i] as number) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      const parsed = parseFloat(raw);
                      updateFlow(i, raw === '' || !(parsed > 0) ? null : parsed);
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeDay(i)}
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {n === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dyncfg_climate_empty')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button type="button" className="btn btn-outline btn-sm" onClick={addDay}>
          {t('schedule_add_day')}
        </button>

        <div
          className="flex items-end gap-2 border-l pl-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <label className="label">{t('schedule_days')}</label>
            <input
              type="number"
              className="input input-number w-16"
              min={1}
              value={bulkDays}
              onChange={(e) => setBulkDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="label">{t('schedule_temp_short')}</label>
            <input
              type="number"
              className="input input-number w-16"
              step={0.5}
              value={bulkTemp}
              onChange={(e) => setBulkTemp(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">{t('schedule_evap_short')}</label>
            <input
              type="number"
              className="input input-number w-16"
              step={0.1}
              min={0}
              value={bulkEvap}
              onChange={(e) => setBulkEvap(parseFloat(e.target.value) || 0)}
            />
          </div>
          {/* Solo tiene sentido si la serie ya usa caudal propio; si no, los dias
              nuevos quedan modulados y este input no haria nada. */}
          {flows.length > 0 && (
            <div>
              <label className="label" title={t('dyncfg_tip_day_flow')}>
                {t('dyncfg_bulk_flow')}
              </label>
              <input
                type="number"
                className="input input-number w-24"
                step={100}
                min={0}
                placeholder={t('dyncfg_flow_modulated')}
                title={t('dyncfg_tip_day_flow')}
                value={bulkFlow || ''}
                onChange={(e) => setBulkFlow(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={addBulk}>
            {t('add')} {bulkDays} {t('schedule_days_lower')}
          </button>
        </div>

        <div
          className="flex items-end gap-2 border-l pl-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileRef.current?.click()}
          >
            {t('dyncfg_replace_with_csv')}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExport}>
            {t('dyncfg_download_csv')}
          </button>
          {n > 0 && (
            <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>
              {t('dyncfg_clear_series')}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        {t('total')}: {n} {t('schedule_days_lower')}. {t('dyncfg_climate_footnote')}
      </p>
      {msg && (
        <p
          className="text-sm mt-2"
          style={{
            color: msg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}