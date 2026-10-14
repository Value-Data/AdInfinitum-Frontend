/**
 * Etiquetas del diccionario de datos del backend (`GET /dictionary/labels`), por idioma.
 *
 * Las etiquetas de los datos (parámetros, resultados, corrientes, KPIs) salen solo del
 * diccionario (DECISIONES §14): el front no las traduce. `translations.ts` queda para los
 * textos de la interfaz.
 */
import { useEffect, useState } from 'react';
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
  return { label: makeLabel(labels), loaded };
}

/** Solo para tests. */
export function __setLabelsCache(lang: Language, labels: Record<string, string>): void {
  cache[lang] = labels;
}
