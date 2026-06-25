import React, { useState } from 'react';
import type { DailyScheduleItem } from '../types';
import { useT } from '../i18n/LanguageContext';
import Tip from './common/Tip';

interface Props {
  value: DailyScheduleItem[];
  onChange: (schedule: DailyScheduleItem[]) => void;
  readOnly?: boolean;
}

export default function DailyScheduleEditor({ value, onChange, readOnly = false }: Props) {
  const t = useT();
  const [bulkDays, setBulkDays] = useState(30);
  const [bulkTemp, setBulkTemp] = useState(20);
  const [bulkEvap, setBulkEvap] = useState(5);

  const addDay = () => {
    const num = value.length + 1;
    onChange([
      ...value,
      {
        date_label: `${t('schedule_day')} ${num}`,
        temperature_C: 20,
        evap_rate: 5,
      },
    ]);
  };

  const addBulk = () => {
    const start = value.length + 1;
    const newDays: DailyScheduleItem[] = Array.from({ length: bulkDays }, (_, i) => ({
      date_label: `${t('schedule_day')} ${start + i}`,
      temperature_C: bulkTemp,
      evap_rate: bulkEvap,
    }));
    onChange([...value, ...newDays]);
  };

  const removeDay = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
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
              <th className="w-12">#</th>
              <th>{t('schedule_day')}</th>
              <th>{t('schedule_temperature_C')}<Tip text={t('dyncfg_tip_day_temp')} /></th>
              <th>{t('schedule_evaporation')}<Tip text={t('dyncfg_tip_day_evap')} /></th>
              {!readOnly && <th className="w-20">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {value.map((day, i) => (
              <tr key={i}>
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

      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        {t('total')}: {value.length} {t('schedule_days_lower')}
      </p>
    </div>
  );
}
