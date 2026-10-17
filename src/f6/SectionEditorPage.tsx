/**
 * Editor de una sección (precon, planta o postliming, del estático o del dinámico).
 *
 * Los campos, su orden, tipo, unidad, rango y cuándo se muestran salen del diccionario
 * del backend; las etiquetas también. Los componentes propios son los que el schema no
 * describe solo: composiciones por especie, factores por fase, la serie diaria, las
 * fichas de reactivos. Guardar crea una versión nueva; con errores no se guarda y el
 * informe del backend marca campo y fila.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { labelWithUnit } from './labels';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePageTrail } from '../components/common/trail';
import api from '../services/api';
import {
  apiError, getAqsolCatalogV2, getDictionary, getProjectV2, getSection, getSectionVersion, getSectionVersions,
  saveBlob, saveSection, validateSection,
  type DictionaryEntry, type SectionKind, type ValidationIssue, type ValidationReport,
} from '../services/apiV2';
import { useLanguage, useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { IssueList } from './ConfigPanel';
import { formatDateTime } from './common';
import {
  addDays, buildSchema, cleanPayload, coerce, hiddenTopLevel, INITIAL_STATE_KINDS, initialStateRows,
  initialStatesForSave, isEmptyInitialState, isScalar, isVisible, issuePond, issuesAt, parsePaste,
  parseSeriesCsv, pasteInitialStates, serializeSeriesCsv, seriesColumns, type EnumChoice, type SectionSchema,
} from './sectionModel';

type Obj = Record<string, unknown>;
const PAGE = 100;

// ---------------------------------------------------------------------------
// Celdas
// ---------------------------------------------------------------------------
/** Un número para leer: hasta 4 decimales (el valor guardado no cambia). */
export function displayNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  const dec = abs !== 0 && abs < 0.01 ? 6 : 4;
  return String(Number(v.toFixed(dec)));
}

/** Ícono ⓘ con la ayuda del campo (descripción, unidad, rango y nombre interno). */
function Tip({ text }: { text: string }) {
  return (
    <span className="ml-1 cursor-help select-none align-middle" title={text} aria-label={text}
          style={{ color: 'var(--color-text-secondary)', fontSize: '0.85em', textTransform: 'none' }}>
      &#9432;
    </span>
  );
}

function CellInput({ entry, value, onChange, choices, invalid, disabled, testId, placeholder }: {
  entry: DictionaryEntry; value: unknown; onChange: (v: unknown) => void; choices?: EnumChoice[];
  invalid?: string; disabled?: boolean; testId?: string; placeholder?: string;
}) {
  const [foco, setFoco] = useState(false);
  const [texto, setTexto] = useState(value == null ? '' : String(value));
  useEffect(() => { setTexto(value == null ? '' : String(value)); }, [value]);
  const estilo: React.CSSProperties = invalid ? { borderColor: '#dc2626', background: '#fef2f2' } : {};
  if (entry.data_type === 'boolean') {
    return <input type="checkbox" checked={Boolean(value)} disabled={disabled} title={invalid}
                  data-testid={testId} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (entry.data_type === 'enum' && choices) {
    return (
      <select className="input" value={value == null ? '' : String(value)} disabled={disabled}
              style={estilo} title={invalid} data-testid={testId}
              onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
        <option value="">–</option>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    );
  }
  return (
    <input className="input" type={entry.data_type === 'date' ? 'date' : 'text'}
           value={!foco && typeof value === 'number' && texto === String(value) ? displayNumber(value) : texto}
           placeholder={placeholder}
           disabled={disabled} style={{ minWidth: 80, ...estilo }}
           title={invalid ?? (typeof value === 'number' ? String(value) : undefined)} data-testid={testId}
           onFocus={() => setFoco(true)}
           onChange={(e) => setTexto(e.target.value)}
           onBlur={() => { setFoco(false); onChange(coerce(entry, texto)); }}
           onKeyDown={(e) => { if (e.key === 'Enter') onChange(coerce(entry, texto)); }} />
  );
}

/** La composición escalada para que sume 100 (las proporciones no cambian). */
export function normalizePct(comp: Record<string, number>): Record<string, number> {
  const suma = Object.values(comp).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  if (!(suma > 0)) return comp;
  return Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, (v * 100) / suma]));
}

/** Promedio de una serie sin contar los días vacíos. */
export function seriesAverage(valores: (number | null | undefined)[]): number | null {
  const n = valores.filter((v): v is number => typeof v === 'number');
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
}

/** La serie con `valor` en los días vacíos. */
export function fillEmpty(valores: (number | null)[], valor: number): number[] {
  return valores.map((v) => (v === null || v === undefined ? valor : v));
}

/** Las columnas que identifican la fila van primero: nombre, designación, tipo, área. */
export function orderColumns(cols: DictionaryEntry[]): DictionaryEntry[] {
  const primero = ['name', 'label', 'pond', 'designation', 'pond_type', 'area_m2'];
  const rango = (c: DictionaryEntry) => (primero.includes(c.field) ? primero.indexOf(c.field) : primero.length);
  return [...cols].sort((a, b) => rango(a) - rango(b) || (a.ui_order ?? 0) - (b.ui_order ?? 0));
}

/** Las cabeceras con unidad no van en mayúsculas: "(T/D)" junto a "(t/d)" confunde. */
const SIN_MAYUSCULAS: React.CSSProperties = { textTransform: 'none', letterSpacing: 0 };
const caps = (e: DictionaryEntry) => (e.unit ? SIN_MAYUSCULAS : undefined);

function headerOf(e: DictionaryEntry): string {
  return labelWithUnit(e.label, e.unit);
}

/** La ayuda del campo: qué es, la nota adicional, unidad y rango, y su nombre interno. */
export function tooltipOf(e: DictionaryEntry): string {
  const abre = e.min_inclusive === false ? '(' : '[';
  const cierra = e.max_inclusive === false ? ')' : ']';
  const rango = e.min_value != null || e.max_value != null
    ? `${abre}${e.min_value ?? '−∞'}, ${e.max_value ?? '∞'}${cierra}` : '';
  const unidad = [e.unit, rango].filter(Boolean).join(' ');
  return [e.description, e.help_text, unidad, e.key].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Formulario de campos sueltos
// ---------------------------------------------------------------------------
function FieldsForm({ schema, prefix, entries, value, onChange, issues }: {
  schema: SectionSchema; prefix: string; entries: DictionaryEntry[]; value: Obj;
  onChange: (v: Obj) => void; issues: ValidationIssue[];
}) {
  return (
    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      {entries.filter((e) => isVisible(e.visible_if, value)).map((e) => {
        const problemas = issuesAt(issues, e.key);
        return (
          <label key={e.key} className="text-sm" title={tooltipOf(e)}>
            <span className="label" style={caps(e)}>{headerOf(e)}<Tip text={tooltipOf(e)} /></span>
            <CellInput entry={e} value={value[e.field]} choices={schema.enumValues(e.key)}
                       invalid={problemas.map((p) => p.message).join(' · ') || undefined}
                       testId={`field-${prefix}${e.field}`}
                       onChange={(v) => onChange({ ...value, [e.field]: v })} />
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabla genérica (pozas, escenarios, cambios de pozas, estados iniciales, dosificación)
// ---------------------------------------------------------------------------
function PasteBox({ onPaste }: { onPaste: (rows: string[][]) => void }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  if (!abierto) {
    return <button className="btn btn-outline btn-sm" onClick={() => setAbierto(true)}>{t('f6_paste')}</button>;
  }
  return (
    <div className="w-full">
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_paste_hint')}</p>
      <textarea className="input w-full font-mono text-xs" rows={6} value={texto}
                onChange={(e) => setTexto(e.target.value)} />
      <div className="flex gap-2 mt-1">
        <button className="btn btn-primary btn-sm" onClick={() => { onPaste(parsePaste(texto)); setAbierto(false); setTexto(''); }}>
          {t('f6_apply')}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => setAbierto(false)}>{t('cancel')}</button>
      </div>
    </div>
  );
}

function TableEditor({ schema, prefix, rows, onChange, issues, species, title }: {
  schema: SectionSchema; prefix: string; rows: Obj[]; onChange: (rows: Obj[]) => void;
  issues: ValidationIssue[]; species: string[]; title: string;
}) {
  const t = useT();
  const hijos = schema.children(prefix);
  const columnas = orderColumns(hijos.filter(isScalar))
    .filter((c) => !c.visible_if || rows.some((r) => isVisible(c.visible_if, r)));
  // Una columna por especie para el campo de composición/masas de la fila, si tiene.
  const porEspecie = hijos.find((e) => e.data_type === 'composition' || e.data_type === 'map');
  const [pagina, setPagina] = useState(0);
  const set = (i: number, campo: string, v: unknown) => {
    const nuevas = rows.slice();
    nuevas[i] = { ...nuevas[i], [campo]: v };
    onChange(nuevas);
  };
  const setEspecie = (i: number, sp: string, v: unknown) => {
    const actual = { ...((rows[i][porEspecie!.field] as Obj | null) ?? {}) };
    if (v == null) delete actual[sp]; else actual[sp] = v;
    set(i, porEspecie!.field, Object.keys(actual).length ? actual : null);
  };
  const pegar = (filas: string[][]) => {
    const nuevas = filas.map((celdas) => {
      const r: Obj = {};
      columnas.forEach((c, j) => {
        const v = coerce(c, celdas[j] ?? '');
        if (v !== null) r[c.field] = v;
      });
      if (porEspecie) {
        const comp: Obj = {};
        species.forEach((sp, j) => {
          const v = coerce({ ...porEspecie, data_type: 'number' }, celdas[columnas.length + j] ?? '');
          if (v !== null) comp[sp] = v;
        });
        if (Object.keys(comp).length) r[porEspecie.field] = comp;
      }
      return r;
    });
    onChange([...rows, ...nuevas]);
  };
  const desde = pagina * PAGE;
  const visibles = rows.slice(desde, desde + PAGE);
  return (
    <section className="card p-3 mb-4" data-testid={`table-${prefix}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>({rows.length})</span>
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm" onClick={() => onChange([...rows, {}])}>{t('add')}</button>
        <PasteBox onPaste={pegar} />
      </div>
      <IssueList issues={issues.filter((i) => i.field === prefix && i.row == null)} kind="error" />
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th>#</th>
              {columnas.map((c) => <th key={c.key} className="whitespace-nowrap" style={caps(c)}>{headerOf(c)}<Tip text={tooltipOf(c)} /></th>)}
              {porEspecie && species.map((sp) => <th key={sp} className="whitespace-nowrap" style={{ textTransform: 'none' }}>{sp}{porEspecie.unit ? ` (${porEspecie.unit})` : ''}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((r, k) => {
              const i = desde + k;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {columnas.map((c) => {
                    const problemas = issuesAt(issues, c.key, i + 1).filter((p) => p.row === i + 1);
                    return (
                      <td key={c.key}>
                        <CellInput entry={c} value={r[c.field]} choices={schema.enumValues(c.key)}
                                   disabled={!isVisible(c.visible_if, r)}
                                   invalid={problemas.map((p) => p.message).join(' · ') || undefined}
                                   testId={`cell-${prefix}-${i + 1}-${c.field}`}
                                   onChange={(v) => set(i, c.field, v)} />
                      </td>
                    );
                  })}
                  {porEspecie && species.map((sp) => (
                    <td key={sp}>
                      <CellInput entry={{ ...porEspecie, data_type: 'number' }}
                                 value={((r[porEspecie.field] as Obj | null) ?? {})[sp]}
                                 onChange={(v) => setEspecie(i, sp, v)} />
                    </td>
                  ))}
                  <td>
                    <button className="btn btn-outline btn-sm" aria-label={t('delete')}
                            onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <div className="flex gap-2 mt-2 text-xs items-center">
          <button className="btn btn-outline btn-sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>‹</button>
          {desde + 1}–{Math.min(desde + PAGE, rows.length)} / {rows.length}
          <button className="btn btn-outline btn-sm" disabled={desde + PAGE >= rows.length} onClick={() => setPagina(pagina + 1)}>›</button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Composición por especie y factores por fase
// ---------------------------------------------------------------------------
function KeyValueEditor({ title, keys, value, onChange, unit, testId, issues, field, neutral }: {
  title: string; keys: string[]; value: Obj | null | undefined; onChange: (v: Obj | null) => void;
  unit?: string | null; testId: string; issues: ValidationIssue[]; field: string;
  /** Valor que vale una clave sin cargar (los factores de precipitación: 1). */
  neutral?: number;
}) {
  const t = useT();
  const actual = value ?? {};
  const [filtro, setFiltro] = useState<'all' | 'eq' | 'gt' | 'lt'>('all');
  const vale = (k: string) => (typeof actual[k] === 'number' ? (actual[k] as number) : (neutral ?? 0));
  const visibles = neutral === undefined || filtro === 'all' ? keys : keys.filter((k) =>
    filtro === 'eq' ? vale(k) === neutral : filtro === 'gt' ? vale(k) > neutral : vale(k) < neutral);
  const suma = Object.values(actual).reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const entrada: DictionaryEntry = { key: field, entity: '', field, category: 'model', data_type: 'number',
    label: '', required: false, time_variable: false };
  return (
    <section className="card p-3 mb-4" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        {neutral !== undefined && (
          <>
            <select className="input" style={{ width: 'auto' }} value={filtro} data-testid={`${testId}-filter`}
                    onChange={(e) => setFiltro(e.target.value as 'all' | 'eq' | 'gt' | 'lt')}>
              <option value="all">{t('f6_factors_all')} ({keys.length})</option>
              <option value="eq">= {neutral} ({keys.filter((k) => vale(k) === neutral).length})</option>
              <option value="gt">&gt; {neutral} ({keys.filter((k) => vale(k) > neutral).length})</option>
              <option value="lt">&lt; {neutral} ({keys.filter((k) => vale(k) < neutral).length})</option>
            </select>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_factors_hint')}</span>
          </>
        )}
      </div>
      <IssueList issues={issuesAt(issues, field)} kind="error" />
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {visibles.map((k) => (
          <label key={k} className="text-xs">
            <span className="label" style={{ textTransform: 'none' }}>{k}{unit ? ` (${unit})` : ''}</span>
            <CellInput entry={entrada} value={actual[k] ?? neutral} testId={`${testId}-${k}`} onChange={(v) => {
              const n = { ...actual };
              // Volver al valor neutro es no cargarlo (el backend no guarda los factores 1).
              if (v == null || v === neutral) delete n[k]; else n[k] = v;
              onChange(Object.keys(n).length ? n : null);
            }} />
          </label>
        ))}
      </div>
      {unit === '%p/p' && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs" style={{ color: Math.abs(suma - 100) > 0.01 ? '#b91c1c' : 'var(--color-text-secondary)' }}>
            {t('total')}: {suma.toFixed(4)} %
          </p>
          {suma > 0 && Math.abs(suma - 100) > 1e-9 && (
            <button className="btn btn-outline btn-sm" data-testid={`${testId}-normalize`}
                    onClick={() => onChange(normalizePct(actual as Record<string, number>))}>
              {t('f6_normalize')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Serie diaria del dinámico
// ---------------------------------------------------------------------------
function SeriesEditor({ schema, payload, onChange, issues, species }: {
  schema: SectionSchema; payload: Obj; onChange: (s: Obj) => void; issues: ValidationIssue[];
  species: string[];
}) {
  const t = useT();
  const serie = (payload.series as Obj | undefined) ?? {};
  const cols = seriesColumns(payload);
  const porDia = payload.composition_mode === 'per_row' && payload.feed_source !== 'execution';
  const inicio = (serie.series_start_date as string | undefined) ?? '';
  const n = Math.max(0, ...cols.map((c) => ((serie[c] as unknown[]) ?? []).length),
    ((serie.composition_pct_by_day as unknown[]) ?? []).length);
  const [pagina, setPagina] = useState(0);
  const entradas = cols.map((c) => schema.byKey.get(`series.${c}`)!).filter(Boolean);
  const lista = (c: string): (number | null)[] => {
    const v = ((serie[c] as (number | null)[] | undefined) ?? []).slice();
    while (v.length < n) v.push(null);
    return v;
  };
  const setValor = (c: string, i: number, v: unknown) => {
    const l = lista(c);
    l[i] = v as number | null;
    onChange({ ...serie, [c]: l });
  };
  const comps = (): (Obj | null)[] => {
    const v = ((serie.composition_pct_by_day as (Obj | null)[] | undefined) ?? []).slice();
    while (v.length < n) v.push(null);
    return v;
  };
  const setEspecie = (i: number, sp: string, v: unknown) => {
    const l = comps();
    const actual = { ...(l[i] ?? {}) };
    if (v == null) delete actual[sp]; else actual[sp] = v;
    l[i] = Object.keys(actual).length ? actual : null;
    onChange({ ...serie, composition_pct_by_day: l });
  };
  const pegar = (filas: string[][]) => {
    // Columnas: fecha (opcional, se ignora si no es número), luego las de la serie y las especies.
    const nuevo: Obj = { ...serie };
    const salta = filas.length && Number.isNaN(Number(String(filas[0][0]).replace(',', '.'))) ? 1 : 0;
    cols.forEach((c, j) => {
      nuevo[c] = filas.map((f) => coerce(entradas[j], f[j + salta] ?? ''));
    });
    if (porDia) {
      nuevo.composition_pct_by_day = filas.map((f) => {
        const comp: Obj = {};
        species.forEach((sp, j) => {
          const v = coerce(entradas[0], f[salta + cols.length + j] ?? '');
          if (v !== null) comp[sp] = v;
        });
        return Object.keys(comp).length ? comp : null;
      });
    }
    if (salta && !inicio && /^\d{4}-\d{2}-\d{2}$/.test(filas[0][0])) nuevo.series_start_date = filas[0][0];
    onChange(nuevo);
  };
  const { lang } = useLanguage();
  const [csvAviso, setCsvAviso] = useState<string | null>(null);
  const importarCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    const r = parseSeriesCsv(await archivo.text(), cols, porDia ? species : []);
    if (!r.ok) { setCsvAviso(t(r.error === 'empty' ? 'f6_csv_empty' : 'f6_csv_no_columns')); return; }
    // El archivo manda: sus columnas reemplazan las de la serie; las que no trae se vacían.
    const nuevo: Obj = { series_start_date: r.start ?? serie.series_start_date };
    cols.forEach((c) => { nuevo[c] = r.values[c] ?? Array(r.n).fill(null); });
    if (porDia) nuevo.composition_pct_by_day = r.composition ?? Array(r.n).fill(null);
    onChange(nuevo);
    setPagina(0);
    setCsvAviso(`${t('f6_csv_loaded')}: ${r.n} ${t('f6_days')} · ${Object.keys(r.values).length} ${t('f6_csv_columns')}`);
  };
  const exportarCsv = () => {
    const valores = Object.fromEntries(cols.map((c) => [c, lista(c)]));
    const texto = serializeSeriesCsv(inicio || null, cols, valores, lang, porDia ? species : [],
      porDia ? comps() : null);
    saveBlob(new Blob([texto], { type: 'text/csv;charset=utf-8' }),
      `serie_${String(payload.kind ?? 'seccion')}_${inicio || 'sin_fecha'}.csv`);
  };
  const [rellenoCol, setRellenoCol] = useState(cols[0] ?? '');
  const [rellenoValor, setRellenoValor] = useState('');
  const borrarDia = (i: number) => {
    const nuevo: Obj = { ...serie };
    cols.forEach((c) => { nuevo[c] = lista(c).filter((_, j) => j !== i); });
    if (porDia) nuevo.composition_pct_by_day = comps().filter((_, j) => j !== i);
    // Si se borra el primer día, la serie empieza al día siguiente.
    if (i === 0 && inicio) nuevo.series_start_date = addDays(inicio, 1);
    onChange(nuevo);
  };
  const vaciar = () => {
    const nuevo: Obj = { series_start_date: serie.series_start_date };
    onChange(nuevo);
  };
  const rellenar = () => {
    const v = coerce(entradas.find((e) => e.field === rellenoCol) ?? entradas[0], rellenoValor);
    if (typeof v !== 'number') return;
    onChange({ ...serie, [rellenoCol]: fillEmpty(lista(rellenoCol), v) });
  };
  const agregar = (k: number) => {
    const nuevo: Obj = { ...serie };
    cols.forEach((c) => { nuevo[c] = [...lista(c), ...Array(k).fill(null)]; });
    if (porDia) nuevo.composition_pct_by_day = [...comps(), ...Array(k).fill(null)];
    onChange(nuevo);
  };
  const desde = pagina * PAGE;
  return (
    <section className="card p-3 mb-4" data-testid="series-editor">
      <div className="flex flex-wrap items-end gap-2 mb-2">
        <h4 className="font-semibold text-sm">{t('f6_daily_series')}</h4>
        <label className="text-xs">
          <span className="label">{schema.byKey.get('series.series_start_date')?.label ?? 'series_start_date'}</span>
          <input type="date" className="input" value={inicio}
                 onChange={(e) => onChange({ ...serie, series_start_date: e.target.value || null })} />
        </label>
        <span className="text-xs">{n} {t('f6_days')}</span>
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm" onClick={() => agregar(1)}>{t('add')}</button>
        <button className="btn btn-outline btn-sm" onClick={() => agregar(365)}>+365</button>
        <PasteBox onPaste={pegar} />
        <label className="btn btn-outline btn-sm" title={t('f6_csv_hint')} style={{ cursor: 'pointer' }}>
          {t('f6_csv_import')}
          <input type="file" accept=".csv,.txt,text/csv" className="sr-only" data-testid="series-csv-input"
                 onChange={importarCsv} />
        </label>
        {n > 0 && <button className="btn btn-outline btn-sm" onClick={exportarCsv}>{t('f6_csv_export')}</button>}
        {n > 0 && <button className="btn btn-outline btn-sm" onClick={vaciar}>{t('f6_clear_series')}</button>}
      </div>
      {n > 0 && (
        <div className="flex flex-wrap items-end gap-2 mb-2 text-xs" title={t('f6_fill_hint')}>
          <select className="input" style={{ width: 'auto' }} value={rellenoCol} onChange={(e) => setRellenoCol(e.target.value)}>
            {entradas.map((e) => <option key={e.field} value={e.field}>{headerOf(e)}</option>)}
          </select>
          <input className="input" style={{ width: 100 }} value={rellenoValor} placeholder="0"
                 onChange={(e) => setRellenoValor(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={rellenar}>{t('f6_fill')}</button>
        </div>
      )}
      {csvAviso && <p className="text-xs mb-2" role="status">{csvAviso}</p>}
      <IssueList issues={issues.filter((i) => i.field.startsWith('series'))} kind="error" />
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th>{t('f6_date')}</th>
              {entradas.map((e) => <th key={e.key} title={tooltipOf(e)} style={caps(e)}>{headerOf(e)}</th>)}
              {porDia && species.map((sp) => <th key={sp} style={{ textTransform: 'none' }}>{sp} (%p/p)</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.min(PAGE, n - desde) }, (_, k) => desde + k).map((i) => (
              <tr key={i}>
                <td className="font-mono whitespace-nowrap">{inicio ? addDays(inicio, i) : i + 1}</td>
                {entradas.map((e) => (
                  <td key={e.key}>
                    <CellInput entry={e} value={lista(e.field)[i]} onChange={(v) => setValor(e.field, i, v)} />
                  </td>
                ))}
                {porDia && species.map((sp) => (
                  <td key={sp}>
                    <CellInput entry={entradas[0]} value={(comps()[i] ?? {})[sp]} onChange={(v) => setEspecie(i, sp, v)} />
                  </td>
                ))}
                <td>
                  <button className="btn btn-outline btn-sm" aria-label={t('delete')} onClick={() => borrarDia(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          {n > 0 && (
            <tfoot>
              <tr>
                <td className="font-semibold">{t('f6_average')}</td>
                {entradas.map((e) => {
                  const p = seriesAverage(lista(e.field));
                  return <td key={e.key} className="font-mono font-semibold">{p === null ? '–' : displayNumber(p)}</td>;
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {n > PAGE && (
        <div className="flex gap-2 mt-2 text-xs items-center">
          <button className="btn btn-outline btn-sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>‹</button>
          {desde + 1}–{Math.min(desde + PAGE, n)} / {n}
          <button className="btn btn-outline btn-sm" disabled={desde + PAGE >= n} onClick={() => setPagina(pagina + 1)}>›</button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Estado inicial de las pozas (inventario)
// ---------------------------------------------------------------------------
/**
 * Una fila por poza de la sección: con qué arranca (masa, altura, densidad, actividad
 * de agua, acumulados, masas por especie). Una fila vacía es una poza que arranca vacía
 * y no se guarda. Se puede pegar desde Excel (la poza primero, o en el orden de la tabla).
 */
export function InitialStatesEditor({ schema, payload, onChange, issues, species }: {
  schema: SectionSchema; payload: Obj; onChange: (rows: Obj[]) => void; issues: ValidationIssue[];
  species: string[];
}) {
  const t = useT();
  const pozas = (payload.ponds as Obj[] | undefined) ?? [];
  const cargados = (payload.initial_states as Obj[] | undefined) ?? [];
  const filas = initialStateRows(pozas, cargados);
  // Lo que se mandó al validar: la fila de un problema es su posición ahí.
  const enviados = initialStatesForSave(cargados);
  const columnas = orderColumns(schema.children('initial_states').filter(isScalar))
    .filter((c) => c.field !== 'pond');
  const masas = schema.byKey.get('initial_states.species_mass_t');
  const propios = issues.filter((i) => i.field.startsWith('initial_states'));
  const n = initialStatesForSave(filas).length;
  const set = (i: number, campo: string, v: unknown) => {
    const nuevas = filas.slice();
    nuevas[i] = { ...nuevas[i], [campo]: v };
    onChange(nuevas);
  };
  const setMasa = (i: number, sp: string, v: unknown) => {
    const actual = { ...((filas[i].species_mass_t as Obj | null) ?? {}) };
    if (v == null) delete actual[sp]; else actual[sp] = v;
    set(i, 'species_mass_t', Object.keys(actual).length ? actual : null);
  };
  const problema = (i: number, campo: string) => propios
    .filter((p) => p.field === `initial_states.${campo}`
      && issuePond(p, enviados) === String(filas[i].pond ?? '').trim().toLowerCase())
    .map((p) => p.message).join(' · ') || undefined;
  return (
    <section className="card p-3 mb-4" data-testid="initial-states-editor">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h4 className="font-semibold text-sm">{t('f6_initial_states_title')}</h4>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }} data-testid="initial-states-count">
          ({n}/{pozas.length} {t('f6_initial_states_loaded')})
        </span>
        <div className="flex-1" />
        <PasteBox onPaste={(rows) => onChange(pasteInitialStates(filas, rows, columnas, species))} />
        {n > 0 && (
          <button className="btn btn-outline btn-sm" onClick={() => onChange([])}>{t('f6_initial_states_clear')}</button>
        )}
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_initial_states_hint')}</p>
      <IssueList issues={propios} kind="error" />
      {filas.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_initial_states_no_ponds')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th>{schema.byKey.get('initial_states.pond')?.label ?? 'pond'}</th>
                {columnas.map((c) => <th key={c.key} className="whitespace-nowrap" style={caps(c)}>{headerOf(c)}<Tip text={tooltipOf(c)} /></th>)}
                {species.map((sp) => (
                  <th key={sp} className="whitespace-nowrap" style={{ textTransform: 'none' }}
                      title={masas ? tooltipOf(masas) : undefined}>
                    {sp}{masas?.unit ? ` (${masas.unit})` : ''}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((r, i) => {
                const vacia = isEmptyInitialState(r);
                // Estado de una poza que ya no está en la sección: se puede borrar.
                const huerfana = i >= pozas.length;
                const malPoza = problema(i, 'pond');
                return (
                  <tr key={`${String(r.pond)}-${i}`} data-testid={`initial-state-row-${i + 1}`}
                      style={vacia ? { opacity: 0.75 } : undefined}>
                    <td className="font-medium whitespace-nowrap" title={malPoza}
                        style={huerfana || malPoza ? { color: '#b91c1c' } : undefined}>
                      {String(r.pond ?? '')}
                      {vacia && (
                        <span className="ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                          · {t('f6_initial_states_empty')}
                        </span>
                      )}
                    </td>
                    {columnas.map((c) => (
                      <td key={c.key}>
                        <CellInput entry={c} value={r[c.field]} invalid={problema(i, c.field)}
                                   testId={`initial-state-${i + 1}-${c.field}`}
                                   onChange={(v) => set(i, c.field, v)} />
                      </td>
                    ))}
                    {species.map((sp) => (
                      <td key={sp}>
                        <CellInput entry={{ ...(masas ?? columnas[0]), data_type: 'number' }}
                                   value={((r.species_mass_t as Obj | null) ?? {})[sp]}
                                   invalid={problema(i, 'species_mass_t')}
                                   testId={`initial-state-${i + 1}-sp-${sp}`}
                                   onChange={(v) => setMasa(i, sp, v)} />
                      </td>
                    ))}
                    <td>
                      <button className="btn btn-outline btn-sm" aria-label={t('f6_initial_states_clear_row')}
                              title={t('f6_initial_states_clear_row')}
                              onClick={() => onChange(huerfana ? filas.filter((_, j) => j !== i)
                                : filas.map((f, j) => (j === i ? { pond: f.pond } : f)))}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fichas de reactivos de la planta
// ---------------------------------------------------------------------------
function ReagentsEditor({ schema, value, onChange, issues }: {
  schema: SectionSchema; value: Obj; onChange: (v: Obj) => void; issues: ValidationIssue[];
}) {
  const t = useT();
  const reactivos = schema.enumValues('plant.dosing_sequence.reagent').map((c) => c.value);
  const pureza = schema.byKey.get('plant.reagents.purity_frac');
  return (
    <section className="card p-3 mb-4" data-testid="reagents-editor">
      <h4 className="font-semibold text-sm mb-2">{t('f6_reagents')}</h4>
      <IssueList issues={issues.filter((i) => i.field.startsWith('plant.reagents'))} kind="error" />
      {reactivos.map((r) => {
        const ficha = (value[r] as Obj | undefined) ?? null;
        const impurezas = ((ficha?.impurities as Obj[] | undefined) ?? []);
        return (
          <div key={r} className="mb-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-sm" style={{ minWidth: 80 }}>{r}</span>
              {pureza && (
                <label className="text-xs">
                  <span className="label" style={caps(pureza)}>{headerOf(pureza)}</span>
                  <CellInput entry={pureza} value={ficha?.purity_frac ?? null} onChange={(v) => {
                    onChange({ ...value, [r]: { impurities: impurezas, ...(ficha ?? {}), purity_frac: v ?? 1 } });
                  }} />
                </label>
              )}
            </div>
            <TableEditor schema={schema} prefix="plant.reagents.impurities" rows={impurezas} species={[]}
                         issues={[]} title={t('f6_impurities')}
                         onChange={(filas) => onChange({ ...value, [r]: { purity_frac: ficha?.purity_frac ?? 1, ...(ficha ?? {}), impurities: filas } })} />
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function SectionEditorPage() {
  const { id = '', kind = 'precon_static' } = useParams<{ id: string; kind: SectionKind }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  // ?version=N: una versión guardada, de solo lectura (la que usó una ejecución).
  const pedida = search.get('version') ? Number(search.get('version')) : null;
  const [historial, setHistorial] = useState<{ version_no: number; created_at: string; source_kind: string }[]>([]);
  const t = useT();
  const { lang } = useLanguage();
  const [entries, setEntries] = useState<DictionaryEntry[] | null>(null);
  const [species, setSpecies] = useState<string[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [payload, setPayload] = useState<Obj | null>(null);
  const [nombreProyecto, setNombreProyecto] = useState<string | null>(null);
  const loc = useLocation();
  usePageTrail(loc.pathname, [
    { label: t('topbar_projects'), path: '/projects' },
    nombreProyecto ? { label: nombreProyecto, path: `/projects/${id}` } : null,
    { label: t(`f6_kind_${kind}` as never) }]);
  const [version, setVersion] = useState<number | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [proyecto, dic, ultima, versiones] = await Promise.all([
          getProjectV2(id), getDictionary(lang, { kind }), getSection(id, kind),
          getSectionVersions(id, kind).catch(() => [])]);
        const seccion = pedida && ultima && pedida !== ultima.version_no
          ? await getSectionVersion(id, kind, pedida)
          : ultima;
        if (vivo) { setHistorial(versiones as never); setNombreProyecto(proyecto.name); }
        const catalogo = await getAqsolCatalogV2(proyecto.aqsol_version);
        let datos: Obj;
        if (seccion) {
          datos = seccion.data as unknown as Obj;
        } else {
          const { data } = await api.get<Obj>(`/projects/${id}/sections/${kind}/defaults`);
          datos = data;
        }
        if (!vivo) return;
        setEntries(dic);
        setSpecies(catalogo.species.map((s) => s.name));
        setPhases(catalogo.phases.map((s) => s.name));
        setPayload(datos);
        setVersion(seccion?.version_no ?? null);
      } catch (err) {
        if (vivo) setError(apiError(err).message);
      }
    })();
    return () => { vivo = false; };
  }, [id, kind, lang, pedida]);

  const schema = useMemo(() => buildSchema(entries ?? []), [entries]);
  if (error) return <div className="card p-4">{error}</div>;
  if (!payload || !entries) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  const issues = [...(report?.errors ?? []), ...(report?.warnings ?? [])];
  const errores = report?.errors ?? [];
  const ocultos = hiddenTopLevel(payload);
  const raiz = schema.children('').filter((e) => !ocultos.has(e.key));
  const set = (campo: string, v: unknown) => setPayload({ ...payload, [campo]: v });

  const validar = async () => {
    setOcupado(true);
    try { setReport(await validateSection(id, kind, cleanPayload(payload), lang)); setAviso(null); }
    catch (err) { setAviso(apiError(err).message); } finally { setOcupado(false); }
  };
  const guardar = async () => {
    setOcupado(true);
    try {
      const r = await saveSection(id, kind, cleanPayload(payload), lang);
      setReport(r.validation);
      if (r.ok) { setVersion(r.version_no); setAviso(`${t('f6_saved_version')} v${r.version_no}`); }
      else setAviso(r.message);
    } catch (err) {
      setAviso(apiError(err).message);
    } finally {
      setOcupado(false);
    }
  };

  const bloque = (e: DictionaryEntry) => {
    if (e.key === 'series') {
      return <SeriesEditor key={e.key} schema={schema} payload={payload} species={species} issues={issues}
                           onChange={(s) => set('series', s)} />;
    }
    if (e.key === 'plant') {
      const plant = (payload.plant as Obj | undefined) ?? {};
      const setPlant = (campo: string, v: unknown) => set('plant', { ...plant, [campo]: v });
      return (
        <section key="plant" className="mb-4">
          <h3 className="font-semibold mb-2">{e.label}</h3>
          <FieldsForm schema={schema} prefix="plant." entries={schema.children('plant').filter(isScalar)}
                      value={plant} issues={issues} onChange={(v) => set('plant', v)} />
          <TableEditor schema={schema} prefix="plant.dosing_sequence" title={schema.byKey.get('plant.dosing_sequence')?.label ?? ''}
                       rows={(plant.dosing_sequence as Obj[] | undefined) ?? []} species={[]} issues={issues}
                       onChange={(filas) => setPlant('dosing_sequence', filas)} />
          <ReagentsEditor schema={schema} value={(plant.reagents as Obj | undefined) ?? {}} issues={issues}
                          onChange={(v) => setPlant('reagents', v)} />
          <KeyValueEditor title={schema.byKey.get('plant.cake_wash_medium_pct')?.label ?? ''} keys={species}
                          unit="%p/p" testId="wash-medium" field="plant.cake_wash_medium_pct" issues={issues}
                          value={plant.cake_wash_medium_pct as Obj | undefined}
                          onChange={(v) => setPlant('cake_wash_medium_pct', v ?? { H2O: 100 })} />
        </section>
      );
    }
    if (e.key === 'initial_states' && INITIAL_STATE_KINDS.has(kind)) {
      return <InitialStatesEditor key={e.key} schema={schema} payload={payload} species={species}
                                  issues={issues} onChange={(filas) => set('initial_states', filas)} />;
    }
    if (e.data_type === 'composition') {
      return <KeyValueEditor key={e.key} title={e.label} keys={species} unit={e.unit} testId={`comp-${e.key}`}
                             field={e.key} issues={issues} value={payload[e.key] as Obj | undefined}
                             onChange={(v) => set(e.key, v)} />;
    }
    if (e.data_type === 'map') {
      return <KeyValueEditor key={e.key} title={e.label} keys={phases} testId={`map-${e.key}`} field={e.key}
                             neutral={1}
                             issues={issues} value={payload[e.key] as Obj | undefined}
                             onChange={(v) => set(e.key, v ?? {})} />;
    }
    if (e.data_type === 'list') {
      return <TableEditor key={e.key} schema={schema} prefix={e.key} title={e.label} species={species}
                          rows={(payload[e.key] as Obj[] | undefined) ?? []} issues={issues}
                          onChange={(filas) => set(e.key, filas)} />;
    }
    return null;
  };

  return (
    <div>
      <div className="mb-4">
        <Link to={`/projects/${id}`} className="text-sm" style={{ color: 'var(--color-primary)' }}>← {t('back')}</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">{t(`f6_kind_${kind}` as never)}</h2>
        <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
          {version ? `v${version}` : t('f6_section_empty')}
        </span>
        {historial.length > 0 && (
          <select className="input" style={{ width: 'auto' }} value={pedida ?? ''} data-testid="section-history"
                  onChange={(e) => navigate(e.target.value ? `?version=${e.target.value}` : '?')}>
            <option value="">{t('f6_latest_version')}</option>
            {historial.map((v) => (
              <option key={v.version_no} value={v.version_no}>
                v{v.version_no} · {formatDateTime(v.created_at)} · {v.source_kind}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <button className="btn btn-outline" onClick={validar} disabled={ocupado}>{t('f6_validate')}</button>
        <button className="btn btn-primary" onClick={guardar} disabled={ocupado} data-testid="save-section"
                title={pedida && historial[0] && pedida !== historial[0].version_no ? t('f6_save_from_old') : undefined}>
          {t('f6_save_version')}
        </button>
      </div>
      {aviso && <div className="card p-3 mb-3 text-sm" data-testid="section-notice">{aviso}</div>}
      {report && (
        <div className="card p-3 mb-4" data-testid="section-report">
          <p className="text-sm font-semibold mb-1">
            {report.ok ? t('f6_valid') : `${errores.length} ${t('f6_errors')}`}
          </p>
          <IssueList issues={report.errors} kind="error" />
          <IssueList issues={report.warnings} kind="warning" />
        </div>
      )}
      <FieldsForm schema={schema} prefix="" entries={raiz.filter(isScalar)} value={payload}
                  issues={issues} onChange={setPayload} />
      {raiz.filter((e) => !isScalar(e)).map(bloque)}
    </div>
  );
}
