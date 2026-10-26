/**
 * Etiquetas del diccionario de datos del backend (`GET /dictionary/labels`), por idioma.
 *
 * Las etiquetas de los datos (parámetros, resultados, corrientes, KPIs) salen solo del
 * diccionario (DECISIONES §14): el front no las traduce. `translations.ts` queda para los
 * textos de la interfaz.
 */
import { useEffect, useMemo, useState } from 'react';
import { getDictionaryLabels, type Language } from '../services/apiV2';
import { useLanguage } from '../i18n/LanguageContext';

const cache: Partial<Record<Language, Record<string, string>>> = {};
const pending: Partial<Record<Language, Promise<Record<string, string>>>> = {};

function load(lang: Language): Promise<Record<string, string>> {
  if (cache[lang]) return Promise.resolve(cache[lang]!);
  if (!pending[lang]) {
    pending[lang] = getDictionaryLabels(lang)
      .then((d) => { cache[lang] = d; return d; })
      .catch(() => ({}))
      .finally(() => { delete pending[lang]; });
  }
  return pending[lang]!;
}

export type LabelFn = (key: string, fallback?: string) => string;

/** Etiqueta por clave; sin entrada en el diccionario, `fallback` o el último tramo de la clave. */
export function makeLabel(labels: Record<string, string>): LabelFn {
  return (key, fallback) => labels[key] ?? fallback ?? key.slice(key.lastIndexOf('.') + 1);
}

export function useLabels(): { label: LabelFn; loaded: boolean } {
  const { lang } = useLanguage();
  const [labels, setLabels] = useState<Record<string, string>>(() => cache[lang] ?? {});
  const [loaded, setLoaded] = useState<boolean>(() => Boolean(cache[lang]));
  useEffect(() => {
    let vivo = true;
    load(lang).then((d) => { if (vivo) { setLabels(d); setLoaded(true); } });
    return () => { vivo = false; };
  }, [lang]);
  // Estable entre renders: los gráficos la usan para decidir si rearman sus opciones.
  const label = useMemo(() => makeLabel(labels), [labels]);
  return { label, loaded };
}

/** Solo para tests. */
export function __setLabelsCache(lang: Language, labels: Record<string, string>): void {
  cache[lang] = labels;
}

/** Unidad comparable: sin espacios, minúsculas y con ² ³ como 2 3. */
function normUnit(u: string): string {
  return u.toLowerCase().replace(/\s+/g, '').replace(/²/g, '2').replace(/³/g, '3');
}

/** Otras formas de escribir la misma unidad en una etiqueta del diccionario. */
const UNIT_ALIASES: Record<string, string[]> = {
  '%w/w': ['%p/p'], '%p/p': ['%w/w'], frac: ['fracción', 'fraction'], 'fracción': ['frac'], fraction: ['frac'],
};

/** "Etiqueta (unidad)", sin repetirla si la etiqueta del diccionario ya la trae
 * (antes salía "Área de proceso (m²) (m2)", "Composición (%p/p) (%w/w)" o
 * "Dilución (fracción) (frac)"). */
export function labelWithUnit(label: string, unit: string | null | undefined): string {
  if (!unit) return label;
  const formas = [unit, ...(UNIT_ALIASES[normUnit(unit)] ?? [])];
  return formas.some((f) => normUnit(label).includes(`(${normUnit(f)})`)) ? label : `${label} (${unit})`;
}
