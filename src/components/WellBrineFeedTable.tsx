import { useT } from '../i18n/LanguageContext';
import { formatEs } from '../utils/numberFormat';
import { resolveWellBrineFeed } from '../utils/wellBrineFeed';

const fmt = (n: number | undefined | null, digits = 2): string =>
  n == null || !Number.isFinite(n) ? '—' : formatEs(n, digits);

/**
 * Tabla "Masa ingreso salmuera de pozo": composición del feed inicial normalizada a
 * %w/w y escalada al flujo de ingreso. Compartida por el modo estático y dinámico.
 */
export default function WellBrineFeedTable({
  snapshot,
  mode,
  flowOverride,
}: {
  snapshot?: Record<string, unknown> | null;
  mode: 'dynamic' | 'static';
  /** Caudal del día que se está viendo, cuando el cronograma lo define por día. */
  flowOverride?: number | null;
}) {
  const t = useT();
  const feed = resolveWellBrineFeed(snapshot, mode, flowOverride);
  if (!feed) return null;

  return (
    <div className="card p-3 mb-4">
      <h4 className="text-sm font-semibold mb-2">
        {t('dynres_well_brine_feed')}: <span className="font-mono">{fmt(feed.flow, 0)}</span> t/d
      </h4>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t('comp_species')}</th>
              <th>%w/w</th>
              <th>t/d</th>
            </tr>
          </thead>
          <tbody>
            {feed.rows.map((r) => (
              <tr key={r.species}>
                <td className="font-medium">{r.species}</td>
                <td className="font-mono text-xs">{fmt(r.pct, 2)}</td>
                <td className="font-mono text-xs">{fmt(r.mass, 0)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td>Total</td>
              <td className="font-mono text-xs">{fmt(100, 2)}</td>
              <td className="font-mono text-xs">{fmt(feed.flow, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
