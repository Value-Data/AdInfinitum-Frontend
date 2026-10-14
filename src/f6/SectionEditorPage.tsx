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
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  apiError, getAqsolCatalogV2, getDictionary, getProjectV2, getSection, saveSection,
  validateSection,
  type DictionaryEntry, type SectionKind, type ValidationIssue, type ValidationReport,
} from '../services/apiV2';
import { useLanguage, useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { IssueList } from './ConfigPanel';
import {
  addDays, buildSchema, cleanPayload, coerce, hiddenTopLevel, isScalar, isVisible, issuesAt,
  parsePaste, seriesColumns, type EnumChoice, type SectionSchema,
} from './sectionModel';

type Obj = Record<string, unknown>;
const PAGE = 100;

// ---------------------------------------------------------------------------
// Celdas
// ---------------------------------------------------------------------------
function CellInput({ entry, value, onChange, choices, invalid, disabled, testId }: {
  entry: DictionaryEntry; value: unknown; onChange: (v: unknown) => void; choices?: EnumChoice[];
  invalid?: string; disabled?: boolean; testId?: string;
}) {
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
    <input className="input" type={entry.data_type === 'date' ? 'date' : 'text'} value={texto}
           disabled={disabled} style={{ minWidth: 80, ...estilo }} title={invalid} data-testid={testId}
           onChange={(e) => setTexto(e.target.value)}
           onBlur={() => onChange(coerce(entry, texto))}
           onKeyDown={(e) => { if (e.key === 'Enter') onChange(coerce(entry, texto)); }} />
  );
}

function headerOf(e: DictionaryEntry): string {
  return e.unit ? `${e.label} (${e.unit})` : e.label;
}

function tooltipOf(e: DictionaryEntry): string {
  const rango = e.min_value != null || e.max_value != null
    ? ` [${e.min_value ?? '−∞'}, ${e.max_value ?? '∞'}]` : '';
  return `${e.description ?? ''}${rango} — ${e.key}`.trim();
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
            <span className="label">{headerOf(e)}</span>
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
  const columnas = hijos.filter(isScalar);
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
              {columnas.map((c) => <th key={c.key} title={tooltipOf(c)} className="whitespace-nowrap">{headerOf(c)}</th>)}
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
function KeyValueEditor({ title, keys, value, onChange, unit, testId, issues, field }: {
  title: string; keys: string[]; value: Obj | null | undefined; onChange: (v: Obj | null) => void;
  unit?: string | null; testId: string; issues: ValidationIssue[]; field: string;
}) {
  const t = useT();
  const actual = value ?? {};
  const suma = Object.values(actual).reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const entrada: DictionaryEntry = { key: field, entity: '', field, category: 'model', data_type: 'number',
    label: '', required: false, time_variable: false };
  return (
    <section className="card p-3 mb-4" data-testid={testId}>
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <IssueList issues={issuesAt(issues, field)} kind="error" />
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {keys.map((k) => (
          <label key={k} className="text-xs">
            <span className="label" style={{ textTransform: 'none' }}>{k}{unit ? ` (${unit})` : ''}</span>
            <CellInput entry={entrada} value={actual[k]} testId={`${testId}-${k}`} onChange={(v) => {
              const n = { ...actual };
              if (v == null) delete n[k]; else n[k] = v;
              onChange(Object.keys(n).length ? n : null);
            }} />
          </label>
        ))}
      </div>
      {unit === '%p/p' && (
        <p className="text-xs mt-2" style={{ color: Math.abs(suma - 100) > 0.01 ? '#b91c1c' : 'var(--color-text-secondary)' }}>
          {t('total')}: {suma.toFixed(4)} %
        </p>
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
      </div>
      <IssueList issues={issues.filter((i) => i.field.startsWith('series'))} kind="error" />
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th>{t('f6_date')}</th>
              {entradas.map((e) => <th key={e.key} title={tooltipOf(e)}>{headerOf(e)}</th>)}
              {porDia && species.map((sp) => <th key={sp} style={{ textTransform: 'none' }}>{sp} (%p/p)</th>)}
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
              </tr>
            ))}
          </tbody>
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
                  <span className="label">{headerOf(pureza)}</span>
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
  const t = useT();
  const { lang } = useLanguage();
  const [entries, setEntries] = useState<DictionaryEntry[] | null>(null);
  const [species, setSpecies] = useState<string[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [payload, setPayload] = useState<Obj | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [proyecto, dic, seccion] = await Promise.all([
          getProjectV2(id), getDictionary(lang, { kind }), getSection(id, kind)]);
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
  }, [id, kind, lang]);

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
    if (e.data_type === 'composition') {
      return <KeyValueEditor key={e.key} title={e.label} keys={species} unit={e.unit} testId={`comp-${e.key}`}
                             field={e.key} issues={issues} value={payload[e.key] as Obj | undefined}
                             onChange={(v) => set(e.key, v)} />;
    }
    if (e.data_type === 'map') {
      return <KeyValueEditor key={e.key} title={e.label} keys={phases} testId={`map-${e.key}`} field={e.key}
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
        <div className="flex-1" />
        <button className="btn btn-outline" onClick={validar} disabled={ocupado}>{t('f6_validate')}</button>
        <button className="btn btn-primary" onClick={guardar} disabled={ocupado} data-testid="save-section">
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
