import React, { useState, useMemo } from 'react';

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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    favored: false,
    enabled: false,
    inhibited: false,
  });

  const groups = useMemo<SaltGroup[]>(() => {
    const favored: SaltGroup['items'] = [];
    const enabled: SaltGroup['items'] = [];
    const inhibited: SaltGroup['items'] = [];

    value.forEach((factor, index) => {
      const name = saltNames[index] || `Salt ${index}`;
      const item = { index, name, factor };

      if (factor < 1) favored.push(item);
      else if (factor === 1) enabled.push(item);
      else inhibited.push(item);
    });

    return [
      { label: 'Favorecidas (F < 1)', description: 'Precipitacion favorecida', items: favored },
      { label: 'Habilitadas (F = 1)', description: 'Precipitacion habilitada (default)', items: enabled },
      { label: 'Inhibidas (F > 1)', description: 'Precipitacion inhibida', items: inhibited },
    ];
  }, [value, saltNames]);

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
                ({group.items.length} sales)
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
                    <th>Sal</th>
                    <th className="w-32">Factor</th>
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
              No hay sales en esta categoria.
            </p>
          )}
        </div>
      ))}

      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        Total: {value.length} sales configuradas
      </p>
    </div>
  );
}
