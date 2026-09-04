import React, { useRef, useState } from 'react';
import type { SaltFactor } from '../../types';
import { useT } from '../../i18n/LanguageContext';
import Tip from './Tip';

/**
 * Editor de factores de precipitación: tabla filtrable con las sales del catálogo,
 * más import/export JSON.
 *
 * Estaba dentro de `DynamicConfigEditor`. Se movió acá para que el modo con
 * inventario edite sus 137 factores con la misma herramienta en vez de mostrarlos
 * como un resumen de solo lectura.
 *
 * Trabaja con la lista `{dll_index, name, precipitation_factor}` del modelo
 * dinámico. El modo con inventario guarda los suyos como `{nombre: factor}`, así
 * que convierte en la frontera (ver `InventarioConfigEditor`).
 */


// =========================================================
// Salt factors — table + import/export JSON (matches SaltFactorEditor style)
// =========================================================
export default function FactorsEditor({
  label,
  factors,
  onChange,
}: {
  label: string;
  factors: SaltFactor[];
  onChange: (v: SaltFactor[]) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const favored = factors.filter((f) => f.precipitation_factor < 1).length;
  const normal = factors.filter((f) => f.precipitation_factor === 1).length;
  const inhibited = factors.filter((f) => f.precipitation_factor > 1).length;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(factors, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.toLowerCase()}_factors.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error(t('dyncfg_json_must_be_array'));
      onChange(parsed);
      setMsg(`${t('dyncfg_loaded_pre')} ${parsed.length} ${t('saltfactor_salts')}.`);
    } catch (err) {
      setMsg(`${t('error')}: ${(err as Error).message}`);
    }
  };

  const filtered = filter
    ? factors.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : factors;

  const updateRow = (idx: number, newFactor: number) => {
    onChange(
      factors.map((f, i) => (i === idx ? { ...f, precipitation_factor: newFactor } : f)),
    );
  };

  return (
    <div>
      <div className="flex gap-4 items-center mb-3 text-sm">
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('total')}:</span>{' '}
          <span className="font-mono">{factors.length}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('dyncfg_band_favored')}</span>{' '}
          <span className="font-mono">{favored}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('dyncfg_band_normal')}</span>{' '}
          <span className="font-mono">{normal}</span>
        </span>
        <span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('dyncfg_band_inhibited')}</span>{' '}
          <span className="font-mono">{inhibited}</span>
        </span>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          className="input flex-1"
          placeholder={t('dyncfg_filter_by_name')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
          {t('dyncfg_load_json')}
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleExport}>
          {t('dyncfg_download_json')}
        </button>
      </div>

      {msg && (
        <p
          className="text-sm mb-2"
          style={{
            color: msg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
          }}
        >
          {msg}
        </p>
      )}

      <div
        className="overflow-x-auto"
        style={{ maxHeight: 360, overflowY: 'auto' }}
      >
        <table>
          <thead className="sticky top-0" style={{ background: 'var(--color-surface)' }}>
            <tr>
              <th className="w-12">#</th>
              <th>
                {t('saltfactor_salt')}
                <Tip text={t('dyncfg_tip_salt_name')} />
              </th>
              <th className="w-28">
                {t('saltfactor_factor')}
                <Tip text={t('dyncfg_tip_salt_factor')} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const realIdx = factors.indexOf(f);
              return (
                <tr key={`${label}-${f.dll_index}`}>
                  <td className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.dll_index}
                  </td>
                  <td className="font-mono text-sm">{f.name}</td>
                  <td>
                    <input
                      type="number"
                      className="input input-number w-24"
                      step={0.01}
                      min={0}
                      value={f.precipitation_factor}
                      onChange={(e) => updateRow(realIdx, parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}