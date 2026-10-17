import React, { useId, useState } from 'react';
import type { DailyScheduleItem } from '../types';
import { useT } from '../../i18n/LanguageContext';
import Tip from './common/Tip';

interface Props {
  value: DailyScheduleItem[];
  onChange: (schedule: DailyScheduleItem[]) => void;
  readOnly?: boolean;
  /**
   * Caudal global de la configuración, ton/d. Es el valor por defecto de los días
   * nuevos y el que se usa al ejecutar en las filas que lo dejen vacío.
   */
  defaultFlow?: number;
}

export default function DailyScheduleEditor({
  value,
  onChange,
  readOnly = false,
  defaultFlow,
}: Props) {
  const t = useT();
  const [bulkDays, setBulkDays] = useState(30);
  const [bulkTemp, setBulkTemp] = useState(20);
  const [bulkEvap, setBulkEvap] = useState(5);
  // Selección para borrado masivo. Se guarda por índice, así que cualquier cambio
  // estructural (agregar o quitar filas) la limpia: un índice guardado apunta a otra
  // fila después de un borrado, y borrar "lo seleccionado" pasaría a borrar otra cosa.
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [rangoDesde, setRangoDesde] = useState(1);
  const [rangoHasta, setRangoHasta] = useState(30);
  // Los id de los campos de rango tienen que ser únicos por instancia: el editor se
  // monta más de una vez en la misma página (config y snapshot de solo lectura).
  const idBase = useId();

  const limpiarSeleccion = () => setSeleccion(new Set());

  const addDay = () => {
    const num = value.length + 1;
    limpiarSeleccion();
    onChange([
      ...value,
      {
        date_label: `${t('schedule_day')} ${num}`,
        temperature_C: 20,
        evap_rate: 5,
        ...(defaultFlow ? { brine_total_flow: defaultFlow } : {}),
      },
    ]);
  };

  const addBulk = () => {
    const start = value.length + 1;
    limpiarSeleccion();
    const newDays: DailyScheduleItem[] = Array.from({ length: bulkDays }, (_, i) => ({
      date_label: `${t('schedule_day')} ${start + i}`,
      temperature_C: bulkTemp,
      evap_rate: bulkEvap,
      ...(defaultFlow ? { brine_total_flow: defaultFlow } : {}),
    }));
    onChange([...value, ...newDays]);
  };

  const removeDay = (index: number) => {
    limpiarSeleccion();
    onChange(value.filter((_, i) => i !== index));
  };

  const alternarFila = (i: number) => {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      return s;
    });
  };

  const alternarTodo = () => {
    setSeleccion((prev) =>
      prev.size === value.length ? new Set() : new Set(value.map((_, i) => i)),
    );
  };

  /** Suma el rango a la selección en vez de reemplazarla: permite juntar varios tramos. */
  const seleccionarRango = () => {
    const desde = Math.max(1, Math.min(rangoDesde, rangoHasta));
    const hasta = Math.min(value.length, Math.max(rangoDesde, rangoHasta));
    setSeleccion((prev) => {
      const s = new Set(prev);
      for (let n = desde; n <= hasta; n++) s.add(n - 1); // la UI cuenta desde 1
      return s;
    });
  };

  const eliminarSeleccionados = () => {
    const n = seleccion.size;
    if (n === 0) return;
    // Confirmación siempre: borrar 200 filas de un cronograma de 365 no se deshace con
    // Ctrl+Z, y el editor no tiene historial.
    const ok = window.confirm(
      `${t('schedule_delete_confirm_pre')} ${n} ${t('schedule_days_lower')}. ${t('schedule_delete_confirm_post')}`,
    );
    if (!ok) return;
    onChange(value.filter((_, i) => !seleccion.has(i)));
    limpiarSeleccion();
  };

  const updateDay = (
    index: number,
    field: keyof DailyScheduleItem,
    val: string | number,
  ) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  return (
    <div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table>
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface)' }}>
            <tr>
              {!readOnly && (
                <th className="w-8">
                  <input
                    type="checkbox"
                    aria-label={t('schedule_select_all')}
                    title={t('schedule_select_all')}
                    checked={value.length > 0 && seleccion.size === value.length}
                    // Estado intermedio: hay filas marcadas, pero no todas.
                    ref={(el) => {
                      if (el) el.indeterminate = seleccion.size > 0 && seleccion.size < value.length;
                    }}
                    onChange={alternarTodo}
                  />
                </th>
              )}
              <th className="w-12">#</th>
              <th>{t('schedule_day')}</th>
              <th>{t('schedule_temperature_C')}<Tip text={t('dyncfg_tip_day_temp')} /></th>
              <th>{t('schedule_evaporation')}<Tip text={t('dyncfg_tip_day_evap')} /></th>
              <th>{t('schedule_brine_flow')}<Tip text={t('schedule_tip_brine_flow')} /></th>
              {!readOnly && <th className="w-20">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {value.map((day, i) => (
              <tr
                key={i}
                style={
                  seleccion.has(i)
                    ? { backgroundColor: 'var(--color-primary-light, #dbeafe)' }
                    : undefined
                }
              >
                {!readOnly && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${t('schedule_day')} ${i + 1}`}
                      checked={seleccion.has(i)}
                      onChange={() => alternarFila(i)}
                    />
                  </td>
                )}
                <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {i + 1}
                </td>
                <td>
                  {readOnly ? (
                    <span className="text-sm">{day.date_label}</span>
                  ) : (
                    <input
                      type="text"
                      className="input w-28"
                      value={day.date_label}
                      onChange={(e) => updateDay(i, 'date_label', e.target.value)}
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{day.temperature_C}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-24"
                      step={0.5}
                      value={day.temperature_C}
                      onChange={(e) =>
                        updateDay(i, 'temperature_C', parseFloat(e.target.value) || 0)
                      }
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">{day.evap_rate}</span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-24"
                      step={0.1}
                      min={0}
                      value={day.evap_rate}
                      onChange={(e) =>
                        updateDay(i, 'evap_rate', parseFloat(e.target.value) || 0)
                      }
                    />
                  )}
                </td>
                <td>
                  {readOnly ? (
                    <span className="font-mono text-sm">
                      {day.brine_total_flow ?? defaultFlow ?? '-'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      className="input input-number w-28"
                      step={0.0001}
                      min={0}
                      // Vacío = usar el caudal global. Se distingue de 0, que sería un
                      // día sin alimentación y es una configuración legítima distinta.
                      placeholder={defaultFlow != null ? String(defaultFlow) : ''}
                      value={day.brine_total_flow ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateDay(
                          i,
                          'brine_total_flow',
                          raw === '' ? (undefined as unknown as number) : parseFloat(raw) || 0,
                        );
                      }}
                    />
                  )}
                </td>
                {!readOnly && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeDay(i)}
                    >
                      {t('delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {value.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {t('schedule_empty')}
        </p>
      )}

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <button type="button" className="btn btn-outline btn-sm" onClick={addDay}>
            {t('schedule_add_day')}
          </button>

          <div className="flex items-end gap-2 border-l pl-3" style={{ borderColor: 'var(--color-border)' }}>
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
            <button type="button" className="btn btn-outline btn-sm" onClick={addBulk}>
              {t('add')} {bulkDays} {t('schedule_days_lower')}
            </button>
          </div>
        </div>
      )}

      {/* Borrado masivo. Marcar 200 casillas a mano no es una opción, así que el rango
          selecciona de una y la selección se puede acumular en varios tramos antes de
          borrar una sola vez. */}
      {!readOnly && value.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
            <div>
              <label className="label" htmlFor={`${idBase}-desde`}>
                {t('schedule_from')}
              </label>
              <input
                id={`${idBase}-desde`}
                type="number"
                className="input input-number w-20"
                min={1}
                max={value.length}
                value={rangoDesde}
                onChange={(e) => setRangoDesde(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${idBase}-hasta`}>
                {t('schedule_to')}
              </label>
              <input
                id={`${idBase}-hasta`}
                type="number"
                className="input input-number w-20"
                min={1}
                max={value.length}
                value={rangoHasta}
                onChange={(e) => setRangoHasta(parseInt(e.target.value) || 1)}
              />
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={seleccionarRango}>
              {t('schedule_select_range')}
            </button>
          </div>

          <div
            className="flex items-end gap-2 border-l pl-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={alternarTodo}
            >
              {seleccion.size === value.length
                ? t('schedule_select_none')
                : t('schedule_select_all')}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={eliminarSeleccionados}
              disabled={seleccion.size === 0}
            >
              {t('schedule_delete_selected')} ({seleccion.size})
            </button>
          </div>
        </div>
      )}

      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        {t('total')}: {value.length} {t('schedule_days_lower')}
        {seleccion.size > 0 && (
          <span style={{ color: 'var(--color-primary)' }}>
            {' '}
            · {seleccion.size} {t('schedule_selected_count')}
          </span>
        )}
      </p>
    </div>
  );
}
