/**
 * "Parámetros de entrada" del reporte impreso: las versiones de sección que usó la
 * ejecución, leídas tal cual (`GET .../sections/{kind}/versions/{n}`) y con las
 * etiquetas del diccionario. Sin lo que no aplica (como al guardar). La serie diaria va
 * resumida (inicio, días y promedio de cada columna): miles de filas no caben en un PDF;
 * la serie completa está en la configuración de la ejecución.
 */
import React, { useEffect, useState } from 'react';
import {
  apiError, getDictionary, getSectionVersion, type DictionaryEntry, type SectionKind,
} from '../services/apiV2';
import { useLanguage, useT } from '../i18n/LanguageContext';
import { buildSchema, cleanPayload, type SectionSchema } from './sectionModel';
import { displayNumber, seriesAverage } from './SectionEditorPage';

export type ParamBlock =
  | { kind: 'fields'; title: string; rows: [string, string][] }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] };

type Obj = Record<string, unknown>;
const esObjeto = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const esEscalar = (v: unknown) => v === null || v === undefined || ['number', 'string', 'boolean'].includes(typeof v);

/**
 * Una sección como bloques para leer: campos sueltos (etiqueta, valor) y tablas (pozas,
 * escenarios, pasos de dosificación…). `labels` trae las palabras de la pantalla.
 */
export function describeSection(
  data: Obj, entries: DictionaryEntry[], labels: { general: string; startDate: string; days: string; average: string },
): ParamBlock[] {
  const schema: SectionSchema = buildSchema(entries);
  const etiqueta = (key: string) => {
    const e = schema.byKey.get(key);
    if (!e) return key.split('.').pop() ?? key;
    return e.unit ? `${e.label} (${e.unit})` : e.label;
  };
  const valor = (key: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '–';
    if (typeof v === 'boolean') return v ? '✓' : '✗';
    if (typeof v === 'number') return displayNumber(v);
    if (typeof v === 'string') return schema.enumValues(key).find((c) => c.value === v)?.label ?? v;
    if (Array.isArray(v)) return v.map((x) => valor(key, x)).join(', ');
    if (esObjeto(v)) return Object.entries(v).map(([k, x]) => `${k}: ${valor(`${key}.${k}`, x)}`).join(' · ');
    return String(v);
  };
  const ordenar = (obj: Obj, prefix: string) => {
    const primero = schema.children(prefix).map((e) => e.field).filter((f) => f in obj);
    return [...primero, ...Object.keys(obj).filter((k) => !primero.includes(k))];
  };
  const tabla = (key: string, filas: Obj[], primera?: [string, string[]]): ParamBlock => {
    const vistos = new Set<string>();
    filas.forEach((f) => Object.keys(f).forEach((k) => vistos.add(k)));
    const cols = ordenar(Object.fromEntries([...vistos].map((k) => [k, true])), key);
    return {
      kind: 'table', title: etiqueta(key),
      columns: [...(primera ? [primera[0]] : []), ...cols.map((c) => etiqueta(`${key}.${c}`))],
      rows: filas.map((f, i) => [...(primera ? [primera[1][i]] : []), ...cols.map((c) => valor(`${key}.${c}`, f[c]))]),
    };
  };

  const recorrer = (obj: Obj, prefix: string, titulo: string): ParamBlock[] => {
    const campos: [string, string][] = [];
    const bloques: ParamBlock[] = [];
    for (const k of ordenar(obj, prefix)) {
      const v = obj[k];
      const key = prefix ? `${prefix}.${k}` : k;
      if (key === 'series' && esObjeto(v)) {
        const filas: [string, string][] = [[labels.startDate, valor('', v.series_start_date)]];
        const n = Math.max(0, ...Object.values(v).map((x) => (Array.isArray(x) ? x.length : 0)));
        filas.push([labels.days, String(n)]);
        for (const [c, x] of Object.entries(v)) {
          if (!Array.isArray(x) || c === 'composition_pct_by_day') continue;
          const p = seriesAverage(x as (number | null)[]);
          filas.push([`${etiqueta(`series.${c}`)} · ${labels.average}`, p === null ? '–' : displayNumber(p)]);
        }
        if (Array.isArray(v.composition_pct_by_day)) {
          filas.push([etiqueta('series.composition_pct_by_day'),
            `${v.composition_pct_by_day.filter(Boolean).length} ${labels.days}`]);
        }
        bloques.push({ kind: 'fields', title: etiqueta('series'), rows: filas });
      } else if (Array.isArray(v) && v.some(esObjeto)) {
        bloques.push(tabla(key, v.filter(esObjeto)));
      } else if (esObjeto(v) && Object.keys(v).length > 0 && Object.values(v).every(esObjeto)) {
        // Un objeto por nombre (fichas de reactivos): una fila por nombre.
        bloques.push(tabla(key, Object.values(v) as Obj[], [etiqueta(key), Object.keys(v)]));
      } else if (esObjeto(v) && Object.values(v).every(esEscalar)) {
        if (Object.keys(v).length > 0) {
          bloques.push({ kind: 'fields', title: etiqueta(key),
            rows: Object.entries(v).map(([s, x]) => [s, valor(`${key}.${s}`, x)]) });
        }
      } else if (esObjeto(v)) {
        bloques.push(...recorrer(v, key, etiqueta(key)));
      } else {
        campos.push([etiqueta(key), valor(key, v)]);
      }
    }
    return [...(campos.length ? [{ kind: 'fields' as const, title: titulo, rows: campos }] : []), ...bloques];
  };
  return recorrer(cleanPayload(data), '', labels.general);
}

function Block({ b }: { b: ParamBlock }) {
  return (
    <div className="card p-3 mb-3 pdf-block overflow-x-auto">
      <h5 className="text-sm font-semibold mb-2">{b.title}</h5>
      {b.kind === 'fields' ? (
        <table className="text-xs">
          <tbody>
            {b.rows.map(([k, v], i) => (
              <tr key={i}><th className="text-left pr-6 font-medium" style={{ textTransform: 'none' }}>{k}</th>
                <td className="font-mono">{v}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="text-xs">
          <thead>
            <tr>{b.columns.map((c, i) => <th key={i} style={{ textTransform: 'none' }}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className="font-mono">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface Loaded { section: string; version_no: number; blocks: ParamBlock[] }

export default function InputParameters({ projectId, sections, engine, onSettled }: {
  projectId: string; sections: { section: string; version_no: number }[]; engine: 'static' | 'dynamic';
  /** Cuando terminó de cargar (o falló): el PDF espera a esto para no salir sin la sección. */
  onSettled?: () => void;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const [datos, setDatos] = useState<Loaded[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clave = sections.map((s) => `${s.section}:${s.version_no}`).join(',');

  useEffect(() => {
    let vivo = true;
    setDatos(null); setError(null);
    Promise.all(sections.map(async (s) => {
      const kind = `${s.section}_${engine}` as SectionKind;
      const [v, dic] = await Promise.all([getSectionVersion(projectId, kind, s.version_no),
        getDictionary(lang, { kind })]);
      return {
        section: s.section, version_no: s.version_no,
        blocks: describeSection(v.data as unknown as Obj, dic, {
          general: t('f6_params_general'), startDate: t('f6_params_start_date'), days: t('f6_days'),
          average: t('f6_average'),
        }),
      };
    }))
      .then((r) => { if (vivo) setDatos(r); })
      .catch((err) => { if (vivo) setError(apiError(err).message); })
      .finally(() => { if (vivo) onSettled?.(); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, clave, engine, lang]);

  return (
    <section className="print-page-break" data-testid="input-parameters">
      <h3 className="text-base font-semibold mb-2 pdf-block pdf-page-break">{t('f6_params_title')}</h3>
      {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{t('f6_params_error')}: {error}</p>}
      {!error && !datos && <p className="text-sm">{t('f6_params_loading')}</p>}
      {datos && datos.length === 0 && <p className="text-sm">{t('f6_params_empty')}</p>}
      {datos?.map((d) => (
        <div key={d.section} className="mb-4">
          <h4 className="text-sm font-semibold mb-2 pdf-block">
            {t(`f6_stage_${d.section}` as never)} · v{d.version_no}
          </h4>
          {d.blocks.map((b, i) => <Block key={i} b={b} />)}
        </div>
      ))}
    </section>
  );
}
