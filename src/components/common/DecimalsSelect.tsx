import React from 'react';
import { useT } from '../../i18n/LanguageContext';
import { useDecimals } from '../../context/DecimalsContext';

/**
 * Decimals selector for result views. Lets the user choose how many decimals
 * the tables show ("Auto" = each field's default precision). Reads/writes the
 * global decimals setting so the choice is consistent and persisted.
 */
export default function DecimalsSelect() {
  const t = useT();
  const { decimals, setDecimals } = useDecimals();
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        {t('decimals_label')}
      </label>
      <select
        className="input"
        style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.85rem', width: 'auto' }}
        value={decimals == null ? 'auto' : String(decimals)}
        onChange={(e) =>
          setDecimals(e.target.value === 'auto' ? null : parseInt(e.target.value, 10))
        }
        title={t('decimals_label')}
      >
        <option value="auto">{t('decimals_auto')}</option>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
