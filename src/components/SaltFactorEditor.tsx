import React, { useState, useMemo } from 'react';
import { useT } from '../i18n/LanguageContext';
import Tip from './common/Tip';

interface Props {
  value: number[];
  onChange: (factors: number[]) => void;
  saltNames?: string[];
  readOnly?: boolean;
}

interface SaltGroup {
  label: string;
  description: string;
  items: { index: number; name: string; factor: number }[];
}

export default function SaltFactorEditor({
  value,
  onChange,
  saltNames = [],
  readOnly = false,
}: Props) {
  const t = useT();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    favored: false,
    enabled: false,
    inhibited: false,
  });

  const groups = useMemo<SaltGroup[]>(() => {
    const favored: SaltGroup['items'] = [];
    const enabled: SaltGroup['items'] = [];
    const inhibited: SaltGroup['items'] = [];

    // If salt names are known, only render real salts (skip Faktor padding slots).
    // Otherwise fall back to rendering every position with a numeric label.
    const limit = saltNames.length > 0 ? saltNames.length : value.length;

    for (let index = 0; index < limit; index++) {
      const factor = value[index];
      if (factor === undefined) continue;
      const name = saltNames[index] || `${t('saltfactor_salt')} ${index}`;
      const item = { index, name, factor };

      if (factor < 1) favored.push(item);
      else if (factor === 1) enabled.push(item);
      else inhibited.push(item);
    }

    return [
      { label: t('saltfactor_favored'), description: t('saltfactor_favored_desc'), items: favored },
      { label: t('saltfactor_enabled'), description: t('saltfactor_enabled_desc'), items: enabled },
      { label: t('saltfactor_inhibited'), description: t('saltfactor_inhibited_desc'), items: inhibited },
    ];
  }, [value, saltNames, t]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (index: number, newFactor: number) => {
    const updated = [...value];
    updated[index] = newFactor;
    onChange(updated);
  };

  const groupKeys = ['favored', 'enabled', 'inhibited'];

  return (
    <div className="space-y-2">
      {groups.map((group, gi) => (
        <div key={groupKeys[gi]} className="border" style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50"
            style={{ color: 'var(--color-text)' }}
            onClick={() => toggleGroup(groupKeys[gi])}
          >
            <span>
              {group.label}{' '}
              <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                ({group.items.length} {t('saltfactor_salts')})
              </span>
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${openGroups[groupKeys[gi]] ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {openGroups[groupKeys[gi]] && group.items.length > 0 && (
            <div className="px-3 pb-3 max-h-64 overflow-y-auto">
              <table>
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>{t('saltfactor_salt')}<Tip text={t('dyncfg_tip_salt_name')} /></th>
                    <th className="w-32">{t('saltfactor_factor')}<Tip text={t('dyncfg_tip_salt_factor')} /></th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.index}>
                      <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {item.index}
                      </td>
                      <td className="text-sm">{item.name}</td>
                      <td>
                        {readOnly ? (
                          <span className="font-mono text-sm">{item.factor}</span>
                        ) : (
                          <input
                            type="number"
                            className="input input-number w-24"
                            step={0.1}
                            min={0}
                            value={item.factor}
                            onChange={(e) =>
                              handleChange(item.index, parseFloat(e.target.value) || 0)
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {openGroups[groupKeys[gi]] && group.items.length === 0 && (
            <p className="px-3 pb-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('saltfactor_empty')}
            </p>
          )}
        </div>
      ))}

      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        {t('total')}: {groups.reduce((acc, g) => acc + g.items.length, 0)} {t('saltfactor_configured')}
        <Tip text={t('dyncfg_section_tip_salt_factors')} />
      </p>
    </div>
  );
}
