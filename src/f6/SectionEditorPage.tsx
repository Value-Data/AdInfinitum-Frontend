/**
 * Editor de una sección (precon, planta o postliming, del estático o del dinámico).
 *
 * Los campos, su orden, tipo, unidad, rango y cuándo se muestran salen del diccionario
 * del backend; las etiquetas también. Los componentes propios son los que el schema no
 * describe solo: composiciones por especie, factores por fase, la serie diaria, las
 * fichas de reactivos. Guardar crea una versión nueva; con errores no se guarda y el
 * informe del backend marca campo y fila.
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { labelWithUnit } from './labels';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePageTrail } from '../components/common/trail';
import {
  apiError, getAqsolCatalogV2, getDictionary, getProjectV2, getSection, getSectionDefaults, getSectionVersion,
  getSectionVersions, saveBlob, saveSection, validateSection,
  type DictionaryEntry, type SectionKind, type ValidationReport,
} from '../services/apiV2';
import { useLanguage, useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Collapsible from '../components/common/Collapsible';
import { IssueList } from './ConfigPanel';
import { formatDateTime } from './common';
import {
  addDays, bufferCondition, buildSchema, cleanPayload, coerce, computedPurity, defaultOf, hiddenTopLevel, INERTS,
  INITIAL_STATE_KINDS, initialStateForm, initialStateRows, initialStatesForSave, isDefaultValue, isEmptyComposition,
  isEmptyInitialState, isInerts, isNothing, isScalar, isVisible, isWaterOnly, issuePond, issuesAt, joinMessages,
  notApplicable, parsePaste, parseSeriesCsv, pasteInitialStates, PCT_TOLERANCE, pondsByName, serializeSeriesCsv,
  seriesColumns, speciesFieldOf, speciesSum, splitIssues, switchInitialStateForm, tagIssues, takesDefaultWhenEmpty,
  type EditorIssue, type EnumChoice, type InitialForm, type NotApplicable, type SectionSchema,
} from './sectionModel';

type Obj = Record<string, unknown>;
/** Problemas del informe con su gravedad (errores en rojo, avisos en ámbar). */
type ValidationIssue = EditorIssue;
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

/** Un valor por defecto para leer: número con hasta 4 decimales, Sí/No, o la etiqueta del enumerado. */
function useDefaultText() {
  const t = useT();
  return (d: unknown, choices?: EnumChoice[]): string => {
    if (typeof d === 'number') return displayNumber(d);
    if (typeof d === 'boolean') return t(d ? 'yes' : 'no');
    return choices?.find((c) => c.value === d)?.label ?? String(d ?? '');
  };
}

/** Marca sutil de que el valor de un campo es su valor por defecto documentado (punto 21). */
function DefaultTag({ testId }: { testId?: string }) {
  const t = useT();
  return (
    <span className="ml-1 font-normal italic" data-testid={testId}
          style={{ ...SIN_MAYUSCULAS, color: 'var(--color-text-secondary)' }}>
      · {t('f9_default')}
    </span>
  );
}

function CellInput({ entry, value, onChange, choices, invalid, warning, disabled, notApplicable, testId, placeholder,
  className, ariaLabel, required }: {
  entry: DictionaryEntry; value: unknown; onChange: (v: unknown) => void; choices?: EnumChoice[];
  /** Errores del campo (rojo: con errores no se guarda). */
  invalid?: string;
  /** Avisos del campo (ámbar: se guarda igual, p. ej. un vacío que tomó su valor por defecto). */
  warning?: string;
  disabled?: boolean;
  /** El campo no aplica a esta fila: se ve vacío y deshabilitado, con el motivo como ayuda.
   * Lo que tenga cargado no se borra (vuelve si cambia la fila) pero no se manda. */
  notApplicable?: string;
  testId?: string; placeholder?: string;
  /** Clases extra del campo de texto (p. ej. `input-number` en las tablas especie | valor). */
  className?: string; ariaLabel?: string;
  /** Obligatorio en esta fila aunque el diccionario no lo marque (p. ej. la altura en composición). */
  required?: boolean;
}) {
  const t = useT();
  const textoDefault = useDefaultText();
  const idMotivo = useId();
  const [foco, setFoco] = useState(false);
  const [texto, setTexto] = useState(value == null ? '' : String(value));
  useEffect(() => { setTexto(value == null ? '' : String(value)); }, [value]);
  const na = notApplicable !== undefined;
  const apagado = disabled || na || entry.read_only === true;
  // Punto 21: el valor por defecto se nota (cursiva y ayuda) y un vacío dice cuál se usará.
  const def = defaultOf(entry);
  const esDefault = !na && isDefaultValue(entry, value);
  const tomaDefault = !na && takesDefaultWhenEmpty(entry, value);
  const valorDefault = def === undefined ? '' : textoDefault(def, choices);
  const ayudaDefault = esDefault ? t('f9_default_is').replace('{value}', valorDefault)
    : tomaDefault ? t('f9_default_if_empty').replace('{value}', valorDefault) : undefined;
  const severidad = na ? undefined : invalid ? 'error' : warning ? 'warning' : undefined;
  const estilo: React.CSSProperties = severidad === 'error'
    ? { borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' }
    : severidad === 'warning' ? { borderColor: 'var(--color-warning)', background: 'var(--color-warning-bg)' } : {};
  // El aviso lleva su palabra además del color.
  const ayuda = na ? notApplicable : invalid || (warning ? `${t('f9_warning')}: ${warning}` : undefined);
  const marcaDefault = esDefault ? 'true' : tomaDefault ? 'empty' : undefined;
  // El motivo de que no aplique también para el lector de pantalla (el `title` no basta).
  const describeNa = na ? idMotivo : undefined;
  const motivoNa = na ? <span id={idMotivo} className="sr-only">{notApplicable}</span> : null;
  const obligatorio = !na && required ? true : undefined;
  if (entry.data_type === 'boolean') {
    return (
      <>
        <input type="checkbox" checked={!na && Boolean(value)} disabled={apagado} title={ayuda ?? ayudaDefault}
               aria-label={ariaLabel} aria-invalid={severidad === 'error' ? true : undefined}
               aria-describedby={describeNa} aria-required={obligatorio}
               data-severity={severidad} data-default={marcaDefault}
               data-testid={testId} onChange={(e) => onChange(e.target.checked)} />
        {motivoNa}
      </>
    );
  }
  if (entry.data_type === 'enum' && choices) {
    return (
      <>
        <select className={esDefault ? 'input italic' : 'input'} value={na || value == null ? '' : String(value)}
                disabled={apagado} style={estilo} title={ayuda ?? ayudaDefault} aria-label={ariaLabel}
                aria-invalid={severidad === 'error' ? true : undefined} aria-describedby={describeNa}
                aria-required={obligatorio} data-severity={severidad}
                data-default={marcaDefault} data-testid={testId}
                onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
          <option value="">{!isNothing(def) ? `– (${t('f9_default')}: ${valorDefault})` : '–'}</option>
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {motivoNa}
      </>
    );
  }
  const clases = ['input', className, esDefault ? 'italic' : ''].filter(Boolean).join(' ');
  return (
    <>
    <input className={clases} type={entry.data_type === 'date' ? 'date' : 'text'}
           value={na ? '' : !foco && typeof value === 'number' && texto === String(value) ? displayNumber(value) : texto}
           placeholder={na ? '—' : placeholder ?? (tomaDefault ? valorDefault : undefined)} aria-label={ariaLabel}
           aria-invalid={severidad === 'error' ? true : undefined}
           aria-describedby={describeNa} aria-required={obligatorio}
           readOnly={entry.read_only === true || undefined}
           disabled={apagado} style={{ minWidth: 80, ...estilo }}
           title={ayuda ?? ayudaDefault ?? (typeof value === 'number' ? String(value) : undefined)} data-testid={testId}
           data-severity={severidad} data-default={marcaDefault}
           onFocus={() => setFoco(true)}
           onChange={(e) => setTexto(e.target.value)}
           onBlur={() => { setFoco(false); onChange(coerce(entry, texto)); }}
           onKeyDown={(e) => { if (e.key === 'Enter') onChange(coerce(entry, texto)); }} />
    {motivoNa}
    </>
  );
}

/** El motivo, para leer, de que un campo no aplique a la fila (en el idioma de la pantalla). */
function useNotApplicableText(schema: SectionSchema, prefix: string) {
  const t = useT();
  return (why: NotApplicable | null): string | undefined => {
    if (!why) return undefined;
    const campo = schema.byKey.get(`${prefix}.${why.field}`)?.label || why.field;
    const clave = ({ pending: 'f9_na_pending', pond_type: 'f9_na_pond_type', value: 'f9_na_value',
      flag_on: 'f9_na_flag_on', flag_off: 'f9_na_flag_off' } as const)[why.kind];
    return t(clave).replace('{field}', campo);
  };
}

/**
 * La nota del campo en esta sección (del diccionario, ya traducida: "clima para la
 * concentración; la planta no lo usa", "vacío = dosificar siempre"…), con "opcional"
 * delante si el campo no es obligatorio. Va bajo la etiqueta o la cabecera.
 */
function FieldNote({ entry, testId }: { entry: DictionaryEntry; testId?: string }) {
  const t = useT();
  if (!entry.note) return null;
  return (
    <span className="block text-[11px] font-normal whitespace-normal" data-testid={testId ?? `note-${entry.key}`}
          style={{ ...SIN_MAYUSCULAS, color: 'var(--color-text-secondary)', minWidth: '9rem', maxWidth: '18rem' }}>
      {!entry.required && `${t('f9_optional')} · `}{entry.note}
    </span>
  );
}

/** Cabecera de columna de una tabla: etiqueta con unidad, marca de obligatorio, ayuda y nota. */
function ColumnHeader({ entry }: { entry: DictionaryEntry }) {
  const t = useT();
  return (
    <>
      {headerOf(entry)}
      {entry.required && (
        <span title={t('f9_required')} style={{ color: 'var(--color-danger-text)' }}>
          <span aria-hidden="true"> *</span><span className="sr-only"> ({t('f9_required')})</span>
        </span>
      )}
      <Tip text={tooltipOf(entry)} />
      <FieldNote entry={entry} />
    </>
  );
}

/** Errores (rojo) y avisos (ámbar) de un bloque, cada uno en su lista. */
function Issues({ issues }: { issues: ValidationIssue[] }) {
  const { errors, warnings } = splitIssues(issues);
  return (
    <>
      <IssueList issues={errors} kind="error" />
      <IssueList issues={warnings} kind="warning" />
    </>
  );
}

/** Cuántos errores y avisos tiene un bloque cerrado, en su color y con su palabra. */
function IssueCount({ issues, leading = true }: { issues: ValidationIssue[]; leading?: boolean }) {
  const t = useT();
  const { errors, warnings } = splitIssues(issues);
  return (
    <>
      {errors.length > 0 && (
        <span style={{ color: 'var(--color-danger-text)' }} data-testid="issue-count-errors">
          {leading ? ' · ' : ''}{errors.length} {t(errors.length === 1 ? 'f9_error_one' : 'f9_error_many')}
        </span>
      )}
      {warnings.length > 0 && (
        <span style={{ color: 'var(--color-warning-text)' }} data-testid="issue-count-warnings">
          {leading || errors.length > 0 ? ' · ' : ''}{warnings.length} {t(warnings.length === 1 ? 'f9_warning_one' : 'f9_warning_many')}
        </span>
      )}
    </>
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
function FieldsForm({ schema, prefix, entries, value, onChange, issues, className = 'mb-4' }: {
  schema: SectionSchema; prefix: string; entries: DictionaryEntry[]; value: Obj;
  onChange: (v: Obj) => void; issues: ValidationIssue[]; className?: string;
}) {
  return (
    <div className={`grid gap-3 ${className}`} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      {entries.filter((e) => isVisible(e.visible_if, value)).map((e) => {
        const { errors, warnings } = splitIssues(issuesAt(issues, e.key));
        const v = value[e.field];
        const porDefecto = isDefaultValue(e, v) || takesDefaultWhenEmpty(e, v);
        // Opcional sin default y vacío: la nota dice qué significa el vacío ("vacío =
        // dosificar siempre"). Va siempre bajo el campo y, mientras está vacío, también
        // dentro de él.
        const vacio = v === null || v === undefined || v === '';
        const notaDentro = Boolean(e.note) && vacio && !e.required && defaultOf(e) === undefined
          && e.data_type !== 'boolean' && e.data_type !== 'enum';
        return (
          <label key={e.key} className="text-sm" title={tooltipOf(e)}>
            <span className="label" style={caps(e)}>
              {headerOf(e)}<Tip text={tooltipOf(e)} />
              {porDefecto && <DefaultTag testId={`default-${prefix}${e.field}`} />}
            </span>
            <CellInput entry={e} value={v} choices={schema.enumValues(e.key)}
                       invalid={joinMessages(errors)} warning={joinMessages(warnings)}
                       placeholder={notaDentro ? e.note ?? undefined : undefined}
                       testId={`field-${prefix}${e.field}`}
                       onChange={(nuevo) => onChange({ ...value, [e.field]: nuevo })} />
            <FieldNote entry={e} testId={`note-${prefix}${e.field}`} />
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

/**
 * Una tabla de filas (pozas, escenarios, cambios de pozas, dosificación). Todas las
 * columnas se ven siempre, como en la plantilla: la celda de un campo que no aplica a su
 * fila (`visible_if`: el tipo de poza, el marco de alturas) va gris y deshabilitada, con
 * el motivo, y su valor no se manda (`cleanPayload`).
 */
export function TableEditor({ schema, prefix, rows, onChange, issues, species, title }: {
  schema: SectionSchema; prefix: string; rows: Obj[]; onChange: (rows: Obj[]) => void;
  issues: ValidationIssue[]; species: string[]; title: string;
}) {
  const t = useT();
  const motivo = useNotApplicableText(schema, prefix);
  const hijos = schema.children(prefix);
  const columnas = orderColumns(hijos.filter(isScalar));
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
      <Issues issues={issues.filter((i) => i.field === prefix && i.row == null)} />
      <div className="overflow-x-auto relative">
        <table className="text-xs data-table">
          <thead>
            <tr>
              <th>#</th>
              {columnas.map((c) => <th key={c.key} className="whitespace-nowrap" style={caps(c)}><ColumnHeader entry={c} /></th>)}
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
                    const { errors, warnings } = splitIssues(
                      issuesAt(issues, c.key, i + 1).filter((p) => p.row === i + 1));
                    const na = motivo(notApplicable(c.visible_if, r));
                    return (
                      <td key={c.key} className={na ? 'cell-na' : undefined}
                          data-testid={`cell-${prefix}-${i + 1}-${c.field}-td`}>
                        <CellInput entry={c} value={r[c.field]} choices={schema.enumValues(c.key)}
                                   notApplicable={na}
                                   ariaLabel={`${headerOf(c)} · ${String(r.name ?? r.label ?? r.pond ?? i + 1)}`}
                                   invalid={joinMessages(errors)} warning={joinMessages(warnings)}
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
/**
 * Las claves en bloques de tabla lado a lado: hasta 12, una tabla; hasta 40, dos; más
 * (las fases de AQSOL son cientos), tres. Se leen hacia abajo y luego al bloque siguiente.
 */
export function splitBlocks<T>(items: T[]): T[][] {
  const n = items.length <= 12 ? 1 : items.length <= 40 ? 2 : 3;
  const largo = Math.ceil(items.length / n);
  return Array.from({ length: n }, (_, i) => items.slice(i * largo, (i + 1) * largo)).filter((b) => b.length > 0);
}

/** Una tabla especie | valor (o fase | valor) por bloque, en una tarjeta plegable. */
export function KeyValueEditor({ title, keys, value, onChange, unit, testId, issues, field, neutral,
  keyKind = 'species', storageKey, defaultOpen = true, defaultText, isDefault = false, clearLabel }: {
  title: string; keys: string[]; value: Obj | null | undefined; onChange: (v: Obj | null) => void;
  unit?: string | null; testId: string; issues: ValidationIssue[]; field: string;
  /** Valor que vale una clave sin cargar (los factores de precipitación: 1). */
  neutral?: number;
  /** Qué son las claves: especies (composiciones) o fases (factores de precipitación). */
  keyKind?: 'species' | 'phase';
  storageKey?: string; defaultOpen?: boolean;
  /** Lo que vale la composición vacía (el medio de lavado: "Agua 100 % (valor por defecto)").
   * Con él, vacía no es un total en 0 en rojo: es ese valor, y se manda `null`. */
  defaultText?: string;
  /** El valor cargado es el por defecto: se marca, sutil. */
  isDefault?: boolean;
  /** Botón para vaciarla y volver al valor por defecto. */
  clearLabel?: string;
}) {
  const t = useT();
  const actual = value ?? {};
  const [filtro, setFiltro] = useState<'all' | 'eq' | 'gt' | 'lt'>('all');
  const vale = (k: string) => (typeof actual[k] === 'number' ? (actual[k] as number) : (neutral ?? 0));
  const visibles = neutral === undefined || filtro === 'all' ? keys : keys.filter((k) =>
    filtro === 'eq' ? vale(k) === neutral : filtro === 'gt' ? vale(k) > neutral : vale(k) < neutral);
  const suma = Object.values(actual).reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const entrada: DictionaryEntry = { key: field, entity: '', field, category: 'model', data_type: 'number',
    label: '', required: false, time_variable: false, read_only: false };
  const propios = issuesAt(issues, field);
  const errores = splitIssues(propios).errors;
  const pct = unit === '%p/p';
  const fueraDe100 = Math.abs(suma - 100) > 0.01;
  const distintos = neutral === undefined ? 0 : keys.filter((k) => vale(k) !== neutral).length;
  const bloques = splitBlocks(visibles);
  const vaciaConDefault = defaultText !== undefined && isEmptyComposition(value);
  // Cerrado se sigue viendo lo esencial: cuántas, cuántas cambiadas o el total.
  const resumen = (
    <>
      {vaciaConDefault
        ? <span data-testid={`${testId}-default-summary`}>{defaultText}</span>
        : neutral !== undefined
          ? `${keys.length} ${t(keyKind === 'phase' ? 'f6_kv_n_phases' : 'f6_kv_n_species')} · ${distintos} ${t('f6_kv_not_neutral')} ${neutral}`
          : pct
            ? <span style={fueraDe100 ? { color: 'var(--color-danger-text)' } : undefined}>{t('total')} {suma.toFixed(2)} %</span>
            : `${keys.length} ${t(keyKind === 'phase' ? 'f6_kv_n_phases' : 'f6_kv_n_species')}`}
      {!vaciaConDefault && isDefault && <DefaultTag testId={`${testId}-is-default`} />}
      <IssueCount issues={propios} />
    </>
  );
  return (
    <Collapsible title={title} summary={resumen} testId={testId} storageKey={storageKey}
                 defaultOpen={defaultOpen} forceOpen={errores.length > 0}>
      {neutral !== undefined && (
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <select className="input" style={{ width: 'auto' }} value={filtro} data-testid={`${testId}-filter`}
                  onChange={(e) => setFiltro(e.target.value as 'all' | 'eq' | 'gt' | 'lt')}>
            <option value="all">{t('f6_factors_all')} ({keys.length})</option>
            <option value="eq">= {neutral} ({keys.filter((k) => vale(k) === neutral).length})</option>
            <option value="gt">&gt; {neutral} ({keys.filter((k) => vale(k) > neutral).length})</option>
            <option value="lt">&lt; {neutral} ({keys.filter((k) => vale(k) < neutral).length})</option>
          </select>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_factors_hint')}</span>
        </div>
      )}
      <Issues issues={propios} />
      {vaciaConDefault && (
        <p className="text-sm mb-2" data-testid={`${testId}-default`}>{defaultText}</p>
      )}
      {defaultText !== undefined && clearLabel && !vaciaConDefault && !isDefault && (
        <button className="btn btn-outline btn-sm mb-2" data-testid={`${testId}-use-default`}
                onClick={() => onChange(null)}>
          {clearLabel}
        </button>
      )}
      {bloques.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }} data-testid={`${testId}-empty`}>
          {t('f6_kv_none_filtered')}
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-3 items-start"
             style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', maxWidth: `${bloques.length * 26}rem` }}>
          {bloques.map((bloque, b) => (
            <table key={b} className="data-table [&_td]:py-0.5 [&_td]:px-2 [&_th]:py-1 [&_th]:px-2" data-testid={`${testId}-block`}>
              <thead>
                <tr>
                  <th scope="col">{t(keyKind === 'phase' ? 'f6_kv_phase' : 'f6_kv_species')}</th>
                  <th scope="col" className="text-right">
                    {t('f6_kv_value')}{unit && <span style={SIN_MAYUSCULAS}> ({unit})</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bloque.map((k) => {
                  // Los factores distintos de 1 resaltan (peso, no solo color): son los que se guardan.
                  const cambiado = neutral !== undefined && vale(k) !== neutral;
                  return (
                    <tr key={k}>
                      <th scope="row" style={{ color: 'var(--color-text)' }}
                          className={`text-sm normal-case tracking-normal border-b ${cambiado ? 'font-semibold' : 'font-normal'}`}>
                        {k}
                      </th>
                      <td className="w-32">
                        <CellInput entry={entrada} value={actual[k] ?? neutral} testId={`${testId}-${k}`}
                                   ariaLabel={`${k}${unit ? ` (${unit})` : ''}`}
                                   className={`input-number tabular-nums py-1 px-2${neutral !== undefined && !cambiado ? ' text-text-secondary' : ''}`}
                                   onChange={(v) => {
                                     const n = { ...actual };
                                     // Volver al valor neutro es no cargarlo (el backend no guarda los factores 1).
                                     if (v == null || v === neutral) delete n[k]; else n[k] = v;
                                     onChange(Object.keys(n).length ? n : null);
                                   }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
      )}
      {pct && !vaciaConDefault && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs" style={{ color: fueraDe100 ? 'var(--color-danger-text)' : 'var(--color-text-secondary)' }}>
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
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Serie diaria del dinámico
// ---------------------------------------------------------------------------
function SeriesEditor({ schema, payload, onChange, issues, species, storageKey }: {
  schema: SectionSchema; payload: Obj; onChange: (s: Obj) => void; issues: ValidationIssue[];
  species: string[]; storageKey?: string;
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
  const propios = issues.filter((i) => i.field.startsWith('series'));
  return (
    <Collapsible title={t('f6_daily_series')} testId="series-editor" storageKey={storageKey}
                 forceOpen={splitIssues(propios).errors.length > 0}
                 summary={(
                   <>
                     {n} {t('f6_days')}{inicio ? ` · ${inicio}` : ''}
                     <IssueCount issues={propios} />
                   </>
                 )}>
      <div className="flex flex-wrap items-end gap-2 mb-2">
        <label className="text-xs">
          <span className="label">{schema.byKey.get('series.series_start_date')?.label ?? 'series_start_date'}</span>
          <input type="date" className="input" value={inicio}
                 onChange={(e) => onChange({ ...serie, series_start_date: e.target.value || null })} />
        </label>
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
      <Issues issues={propios} />
      <div className="overflow-x-auto relative">
        <table className="text-xs data-table">
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
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Estado inicial de las pozas (inventario)
// ---------------------------------------------------------------------------
/**
 * Una fila por poza de la sección: con qué inventario arranca. Cada poza en una de dos
 * formas (punto 4): toneladas por especie (la altura la calcula la app) o composición
 * %p/p con el agua más la altura; se manda solo la forma elegida. La densidad es opcional
 * (si falta, la calcula AQSOL). `outflow_started` solo vale en los buffers: en una poza
 * por altura objetivo va gris. Una fila vacía es una poza que arranca vacía y no se
 * guarda. Se puede pegar desde Excel (la poza primero, o en el orden de la tabla).
 */
export function InitialStatesEditor({ schema, payload, onChange, issues, species }: {
  schema: SectionSchema; payload: Obj; onChange: (rows: Obj[]) => void; issues: ValidationIssue[];
  species: string[];
}) {
  const t = useT();
  const pozas = (payload.ponds as Obj[] | undefined) ?? [];
  const porNombre = pondsByName(pozas);
  const buffer = bufferCondition(schema);
  const cargados = (payload.initial_states as Obj[] | undefined) ?? [];
  const filas = initialStateRows(pozas, cargados);
  // Lo que se mandó al validar: la fila de un problema es su posición ahí.
  const enviados = initialStatesForSave(cargados, pozas, buffer);
  const columnas = orderColumns(schema.children('initial_states').filter(isScalar))
    .filter((c) => c.field !== 'pond');
  const entradaEspecie = (forma: InitialForm) => schema.byKey.get(`initial_states.${speciesFieldOf(forma)}`);
  const unidad = (forma: InitialForm) => entradaEspecie(forma)?.unit ?? (forma === 'composition' ? '%p/p' : 't');
  const formas = Array.from(new Set(filas.map(initialStateForm)));
  const unidadesEspecie = (formas.length ? formas : ['mass' as InitialForm]).map(unidad).join(' | ');
  const propios = issues.filter((i) => i.field.startsWith('initial_states'));
  const n = initialStatesForSave(filas, pozas, buffer).length;
  const cambiar = (i: number, fila: Obj) => onChange(filas.map((f, j) => (j === i ? fila : f)));
  const set = (i: number, campo: string, v: unknown) => cambiar(i, { ...filas[i], [campo]: v });
  const setEspecie = (i: number, sp: string, v: unknown) => {
    const forma = initialStateForm(filas[i]);
    const campo = speciesFieldOf(forma);
    const actual = { ...((filas[i][campo] as Obj | null) ?? {}) };
    if (v == null) delete actual[sp]; else actual[sp] = v;
    // En composición el dict queda aunque se vacíe: es lo que dice que la fila está en esa forma.
    set(i, campo, Object.keys(actual).length ? actual : (forma === 'composition' ? {} : null));
  };
  const dePoza = (i: number, p: ValidationIssue) => issuePond(p, enviados) === String(filas[i].pond ?? '').trim().toLowerCase();
  const { errors: erroresPropios, warnings: avisosPropios } = splitIssues(propios);
  // Errores de la celda (rojo) y avisos (ámbar), por separado.
  const problema = (i: number, campo: string) => joinMessages(erroresPropios
    .filter((p) => p.field === `initial_states.${campo}` && dePoza(i, p)));
  const aviso = (i: number, campo: string) => joinMessages(avisosPropios
    .filter((p) => p.field === `initial_states.${campo}` && dePoza(i, p)));
  // Los de la fila entera (las dos formas a la vez, ninguna): van en la forma y en la poza.
  const problemaFila = (i: number) => joinMessages(erroresPropios
    .filter((p) => p.field === 'initial_states' && p.row != null && dePoza(i, p)));
  const motivoArranque = (poza: Obj | undefined): string | undefined => {
    if (!poza) return undefined;
    const why = notApplicable(buffer, poza);
    if (!why) return undefined;
    return t(why.kind === 'pending' ? 'f9_na_outflow_pending' : 'f9_na_outflow_target');
  };
  const cabecera = (c: DictionaryEntry) => {
    if (c.field === 'height_m') {
      // El diccionario la tiene opcional (con toneladas no va), pero en composición es
      // obligatoria: se marca como cualquier obligatorio, con la condición a la vista.
      return (
        <span>
          {headerOf(c)}
          <span title={t('f9_height_required_hint')} style={{ color: 'var(--color-danger-text)' }}
                data-testid="initial-states-height-required">
            <span aria-hidden="true"> *</span><span className="sr-only"> ({t('f9_height_required_hint')})</span>
          </span>
          <Tip text={tooltipOf(c)} />
          <span className="block text-[11px] font-normal" style={SIN_MAYUSCULAS} aria-hidden="true">
            {t('f9_height_required_hint')}
          </span>
        </span>
      );
    }
    if (c.field === 'density_kg_m3') {
      return (
        <span>
          {headerOf(c)}<Tip text={`${t('f9_density_hint')}\n${tooltipOf(c)}`} />
          <span className="block text-[11px] font-normal" style={SIN_MAYUSCULAS}>{t('f9_optional')}</span>
        </span>
      );
    }
    return <ColumnHeader entry={c} />;
  };
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
      <Issues issues={propios} />
      {filas.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_initial_states_no_ponds')}</p>
      ) : (
        <div className="overflow-x-auto relative">
          <table className="text-xs data-table">
            <thead>
              <tr>
                <th>{schema.byKey.get('initial_states.pond')?.label ?? 'pond'}</th>
                <th className="whitespace-nowrap" style={SIN_MAYUSCULAS}>{t('f9_initial_form')}</th>
                {columnas.map((c) => (
                  <th key={c.key} className={c.data_type === 'boolean' ? undefined : 'whitespace-nowrap'}
                      style={c.data_type === 'boolean' ? { ...SIN_MAYUSCULAS, minWidth: '9rem' } : caps(c)}>
                    {cabecera(c)}
                  </th>
                ))}
                {species.map((sp) => (
                  <th key={sp} className="whitespace-nowrap" style={{ textTransform: 'none' }}>
                    {sp} ({unidadesEspecie})
                  </th>
                ))}
                <th className="whitespace-nowrap text-right" style={SIN_MAYUSCULAS}>{t('f9_sum')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((r, i) => {
                const vacia = isEmptyInitialState(r);
                // Estado de una poza que ya no está en la sección: se puede borrar.
                const huerfana = i >= pozas.length;
                const forma = initialStateForm(r);
                const deFila = problemaFila(i);
                const malPoza = [problema(i, 'pond'), deFila].filter(Boolean).join(' · ') || undefined;
                const poza = porNombre.get(String(r.pond ?? '').trim().toLowerCase());
                const especie = entradaEspecie(forma) ?? columnas[0];
                const suma = speciesSum(r);
                const fueraDe100 = forma === 'composition' && suma !== null && Math.abs(suma - 100) > PCT_TOLERANCE;
                const malEspecie = problema(i, speciesFieldOf(forma));
                const avisoEspecie = aviso(i, speciesFieldOf(forma));
                return (
                  <tr key={`${String(r.pond)}-${i}`} data-testid={`initial-state-row-${i + 1}`}
                      data-form={forma} style={vacia ? { opacity: 0.75 } : undefined}>
                    <td className="font-medium whitespace-nowrap" title={malPoza}
                        style={huerfana || malPoza ? { color: 'var(--color-danger-text)' } : undefined}>
                      {String(r.pond ?? '')}
                      {vacia && (
                        <span className="ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                          · {t('f6_initial_states_empty')}
                        </span>
                      )}
                    </td>
                    <td>
                      <select className="input" value={forma} data-testid={`initial-state-${i + 1}-form`}
                              aria-label={t('f9_initial_form_of').replace('{pond}', String(r.pond ?? ''))}
                              aria-invalid={deFila ? true : undefined} title={deFila}
                              style={deFila ? { borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' } : undefined}
                              onChange={(e) => cambiar(i, switchInitialStateForm(r, e.target.value as InitialForm))}>
                        <option value="mass">{t('f9_form_mass')}</option>
                        <option value="composition">{t('f9_form_composition')}</option>
                      </select>
                    </td>
                    {columnas.map((c) => {
                      const etiqueta = `${headerOf(c)} · ${String(r.pond ?? '')}`;
                      if (c.field === 'height_m' && forma === 'mass') {
                        // Con toneladas la altura sale de la masa: no se escribe. Un error que
                        // llegue igual (p. ej. de un Excel) se ve en la celda.
                        const mal = problema(i, c.field);
                        return (
                          <td key={c.key} className={`whitespace-nowrap text-xs${mal ? '' : ' cell-na'}`}
                              data-testid={`initial-state-${i + 1}-${c.field}`}
                              title={mal ?? t('f9_height_computed_hint')} aria-label={`${etiqueta}: ${mal ?? t('f9_height_computed')}`}
                              style={mal ? { background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)',
                                boxShadow: 'inset 0 0 0 1px var(--color-danger)' } : undefined}>
                            {t('f9_height_computed')}
                          </td>
                        );
                      }
                      const na = c.field === 'outflow_started' ? motivoArranque(poza) : undefined;
                      return (
                        <td key={c.key} className={na ? 'cell-na' : undefined}
                            data-testid={`initial-state-${i + 1}-${c.field}-td`}>
                          <CellInput entry={c} value={r[c.field]} invalid={problema(i, c.field)} notApplicable={na}
                                     warning={aviso(i, c.field)}
                                     required={c.field === 'height_m' && forma === 'composition'}
                                     ariaLabel={etiqueta}
                                     placeholder={c.field === 'density_kg_m3' ? t('f9_optional') : undefined}
                                     testId={`initial-state-${i + 1}-${c.field}`}
                                     onChange={(v) => set(i, c.field, v)} />
                        </td>
                      );
                    })}
                    {species.map((sp) => (
                      <td key={sp}>
                        <CellInput entry={{ ...especie, data_type: 'number' }}
                                   value={((r[speciesFieldOf(forma)] as Obj | null) ?? {})[sp]}
                                   invalid={malEspecie} warning={avisoEspecie}
                                   ariaLabel={`${sp} (${unidad(forma)}) · ${String(r.pond ?? '')}`}
                                   testId={`initial-state-${i + 1}-sp-${sp}`}
                                   onChange={(v) => setEspecie(i, sp, v)} />
                      </td>
                    ))}
                    <td className="text-right font-mono whitespace-nowrap" data-testid={`initial-state-${i + 1}-sum`}
                        title={fueraDe100 ? `${t('f9_sum')}: ${t('f9_sum_must_100')}` : undefined}
                        style={fueraDe100 ? { color: 'var(--color-danger-text)' } : undefined}>
                      {suma === null ? '–' : `${displayNumber(suma)} ${unidad(forma)}`}
                      {fueraDe100 && <span className="block text-[11px] font-body">{t('f9_sum_must_100')}</span>}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" aria-label={t('f6_initial_states_clear_row')}
                              title={t('f6_initial_states_clear_row')}
                              onClick={() => onChange(huerfana ? filas.filter((_, j) => j !== i)
                                : filas.map((f, j) => (j === i ? switchInitialStateForm({ pond: f.pond }, forma) : f)))}>✕</button>
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
const IMPUREZA = 'plant.reagents.impurities';

/** La entrada del diccionario de una columna de impurezas (o una mínima si faltara). */
function impurityColumn(schema: SectionSchema, field: string, dataType: string): DictionaryEntry {
  return schema.byKey.get(`${IMPUREZA}.${field}`) ?? {
    key: `${IMPUREZA}.${field}`, entity: 'impurities', field, category: 'model', data_type: dataType,
    label: field, required: true, time_variable: false, read_only: false,
  };
}

/**
 * Las impurezas de un reactivo. La línea "Inertes / otros" (clave `inertes`) es lo no
 * identificado del reactivo: se agrega con su botón (o escribiendo "inertes"), su nombre no
 * se edita y su destino queda fijo en la torta. Los problemas llegan con `row` = la impureza.
 */
function ImpuritiesTable({ schema, reagent, rows, onChange, issues }: {
  schema: SectionSchema; reagent: string; rows: Obj[]; onChange: (rows: Obj[]) => void; issues: ValidationIssue[];
}) {
  const t = useT();
  const especie = impurityColumn(schema, 'species', 'string');
  const frac = impurityColumn(schema, 'frac', 'number');
  const destino = impurityColumn(schema, 'destination', 'enum');
  const destinos = schema.enumValues(destino.key);
  const conInertes = rows.some((r) => isInerts(r.species));
  const set = (i: number, campo: string, v: unknown) => {
    let fila: Obj = { ...rows[i], [campo]: v };
    if (isInerts(fila.species)) fila = { ...fila, destination: 'cake' };
    onChange(rows.map((r, j) => (j === i ? fila : r)));
  };
  const de = (i: number, campo: string) => splitIssues(issues.filter((p) => p.field === `${IMPUREZA}.${campo}` && p.row === i + 1));
  const celda = (i: number, r: Obj, c: DictionaryEntry, extra: { disabled?: boolean; value?: unknown } = {}) => {
    const { errors, warnings } = de(i, c.field);
    return (
      <CellInput entry={c} value={extra.value ?? r[c.field]} choices={c.data_type === 'enum' ? destinos : undefined}
                 disabled={extra.disabled} invalid={joinMessages(errors)} warning={joinMessages(warnings)}
                 ariaLabel={`${headerOf(c)} · ${reagent} · ${i + 1}`}
                 testId={`impurity-${reagent}-${i + 1}-${c.field}`}
                 onChange={(v) => set(i, c.field, v)} />
    );
  };
  return (
    <div data-testid={`impurities-${reagent}`}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h5 className="font-semibold text-xs">{t('f6_impurities')}</h5>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>({rows.length})</span>
        <div className="flex-1" />
        <button className="btn btn-outline btn-sm" data-testid={`impurities-${reagent}-add`}
                onClick={() => onChange([...rows, {}])}>{t('add')}</button>
        {!conInertes && (
          <button className="btn btn-outline btn-sm" title={t('f9_inerts_hint')} data-testid={`impurities-${reagent}-add-inerts`}
                  onClick={() => onChange([...rows, { species: INERTS, destination: 'cake' }])}>
            {t('f9_inerts_add')}
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }} data-testid={`impurities-${reagent}-empty`}>
          {t('f9_no_impurities')}
        </p>
      ) : (
        <div className="overflow-x-auto relative">
          <table className="text-xs data-table">
            <thead>
              <tr>
                <th>#</th>
                {[especie, frac, destino].map((c) => (
                  <th key={c.key} className="whitespace-nowrap" style={caps(c)}><ColumnHeader entry={c} /></th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const inertes = isInerts(r.species);
                return (
                  <tr key={i} data-testid={`impurity-${reagent}-${i + 1}`} data-inerts={inertes || undefined}>
                    <td>{i + 1}</td>
                    <td title={inertes ? t('f9_inerts_hint') : undefined}>
                      {inertes
                        ? <span className="font-medium" data-testid={`impurity-${reagent}-${i + 1}-inerts`}>{t('f9_inerts_label')}</span>
                        : celda(i, r, especie)}
                    </td>
                    <td>{celda(i, r, frac)}</td>
                    <td className={inertes ? 'cell-na' : undefined} title={inertes ? t('f9_inerts_hint') : undefined}>
                      {inertes ? celda(i, r, destino, { disabled: true, value: 'cake' }) : celda(i, r, destino)}
                    </td>
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
      )}
    </div>
  );
}

/**
 * Fichas de reactivos de la planta (punto 8). La pureza de cada reactivo la calcula la
 * app: 1 − Σ impurezas (sin impurezas, 100 %); se ve, no se edita ni se manda. Lo que no
 * es reactivo ni impureza conocida va en la línea "Inertes / otros". Los problemas del
 * backend traen el reactivo en `row_label` (la suma de impurezas, sin fila).
 */
export function ReagentsEditor({ schema, value, onChange, issues }: {
  schema: SectionSchema; value: Obj; onChange: (v: Obj) => void; issues: ValidationIssue[];
}) {
  const t = useT();
  const idBase = useId();
  const enumerados = schema.enumValues('plant.dosing_sequence.reagent').map((c) => c.value);
  // Una ficha cargada de un reactivo que no esté en el enumerado también se ve.
  const reactivos = [...enumerados, ...Object.keys(value).filter((r) => !enumerados.includes(r))];
  const pureza = schema.byKey.get('plant.reagents.purity_frac');
  const notaPureza = pureza?.note || t('f9_purity_computed');
  const propios = issues.filter((i) => i.field.startsWith('plant.reagents'));
  const generales = propios.filter((i) => !i.row_label || !reactivos.includes(i.row_label));
  return (
    <section className="card p-3 mb-4" data-testid="reagents-editor">
      <h4 className="font-semibold text-sm mb-2">{t('f6_reagents')}</h4>
      <Issues issues={generales} />
      {reactivos.map((r, n) => {
        const ficha = (value[r] as Obj | undefined) ?? null;
        const impurezas = (ficha?.impurities as Obj[] | undefined) ?? [];
        const deReactivo = propios.filter((i) => i.row_label === r);
        const calculada = computedPurity(impurezas);
        const desborde = !(calculada > 0);
        const setImpurezas = (filas: Obj[]) => {
          // La pureza escrita no se guarda: la calcula el backend.
          const { purity_frac: _p, ...resto } = ficha ?? {};
          onChange({ ...value, [r]: { ...resto, impurities: filas } });
        };
        // La pureza se lee con su etiqueta y el reactivo ("CaCl2 Pureza (%)") y su nota.
        // Por posición: el nombre de un reactivo podría traer espacios.
        const id = `${idBase}-${n}`;
        return (
          <div key={r} className="mb-4 pb-3 border-b last:border-b-0" data-testid={`reagent-${r}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <span className="font-medium text-sm" style={{ minWidth: 80 }} id={`${id}-name`}>{r}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }} id={`${id}-label`}>
                {pureza?.label || t('f9_purity')} (%)
              </span>
              <output className="cell-na font-mono tabular-nums text-sm px-2 py-0.5" data-testid={`reagent-${r}-purity`}
                      title={notaPureza} aria-labelledby={`${id}-name ${id}-label`} aria-describedby={`${id}-note`}
                      style={desborde ? { background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' } : undefined}>
                {displayNumber(calculada * 100)} %
              </output>
              <span className="text-xs italic" style={{ color: 'var(--color-text-secondary)' }} id={`${id}-note`}>
                {notaPureza}
              </span>
            </div>
            {desborde && (
              <p className="text-xs mb-1" style={{ color: 'var(--color-danger-text)' }} data-testid={`reagent-${r}-overflow`}>
                {t('f9_purity_overflow')}
              </p>
            )}
            <Issues issues={deReactivo.filter((i) => i.row == null)} />
            <ImpuritiesTable schema={schema} reagent={r} rows={impurezas} onChange={setImpurezas}
                             issues={deReactivo.filter((i) => i.row != null)} />
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
        // Una sección vacía arranca con los valores por defecto del schema (una planta nueva,
        // con sus cuatro reactivos y su composición): se ven y se editan como cualquier dato.
        const datos: Obj = seccion ? seccion.data as unknown as Obj : await getSectionDefaults(id, kind);
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

  // Errores y avisos juntos para ubicarlos por campo, cada uno con su gravedad: un aviso
  // (p. ej. `default_applied`) se pinta en ámbar y no impide guardar.
  const issues = tagIssues(report);
  const errores = report?.errors ?? [];
  const nAvisos = report?.warnings?.length ?? 0;
  const ocultos = hiddenTopLevel(payload);
  const raiz = schema.children('').filter((e) => !ocultos.has(e.key));
  const escalares = raiz.filter(isScalar);
  const deEscalares = issues.filter((i) => escalares.some((e) => e.key === i.field));
  const erroresEscalares = splitIssues(deEscalares).errors.length;
  const set = (campo: string, v: unknown) => setPayload({ ...payload, [campo]: v });

  const validar = async () => {
    setOcupado(true);
    try { setReport(await validateSection(id, kind, cleanPayload(payload, schema), lang)); setAviso(null); }
    catch (err) { setAviso(apiError(err).message); } finally { setOcupado(false); }
  };
  const guardar = async () => {
    setOcupado(true);
    try {
      const r = await saveSection(id, kind, cleanPayload(payload, schema), lang);
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
                           storageKey={`section.${kind}.series`} onChange={(s) => set('series', s)} />;
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
          {/* Punto 22: vacío = agua 100 % (default del backend, con aviso); se manda `null`. */}
          <KeyValueEditor title={schema.byKey.get('plant.cake_wash_medium_pct')?.label ?? ''} keys={species}
                          unit="%p/p" testId="wash-medium" field="plant.cake_wash_medium_pct" issues={issues}
                          storageKey={`section.${kind}.plant.cake_wash_medium_pct`}
                          value={plant.cake_wash_medium_pct as Obj | undefined}
                          defaultText={t('f9_wash_default')} clearLabel={t('f9_wash_use_default')}
                          isDefault={isWaterOnly(plant.cake_wash_medium_pct)}
                          onChange={(v) => setPlant('cake_wash_medium_pct', v)} />
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
                             storageKey={`section.${kind}.${e.key}`}
                             onChange={(v) => set(e.key, v)} />;
    }
    if (e.data_type === 'map') {
      // Los factores son por fase (cientos en 066): cerrados de entrada si la lista es larga.
      return <KeyValueEditor key={e.key} title={e.label} keys={phases} testId={`map-${e.key}`} field={e.key}
                             neutral={1} keyKind="phase" defaultOpen={phases.length <= 40}
                             storageKey={`section.${kind}.${e.key}`}
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
            {nAvisos > 0 && (
              <span className="font-normal" style={{ color: 'var(--color-warning-text)' }} data-testid="section-report-warnings">
                {' · '}{nAvisos} {t(nAvisos === 1 ? 'f9_warning_one' : 'f9_warning_many')}
              </span>
            )}
          </p>
          <IssueList issues={report.errors} kind="error" />
          <IssueList issues={report.warnings} kind="warning" />
        </div>
      )}
      {escalares.length > 0 && (
        <Collapsible title={t('f6_section_params')} testId="section-params" storageKey={`section.${kind}.params`}
                     forceOpen={erroresEscalares > 0}
                     summary={deEscalares.length > 0 ? <IssueCount issues={deEscalares} leading={false} /> : undefined}>
          <FieldsForm schema={schema} prefix="" entries={escalares} value={payload}
                      issues={issues} onChange={setPayload} className="" />
        </Collapsible>
      )}
      {raiz.filter((e) => !isScalar(e)).map(bloque)}
    </div>
  );
}
