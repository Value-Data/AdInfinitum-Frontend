/**
 * Datos y geometría de los gráficos, sin React: lo que se puede probar sin dibujar.
 * Los valores salen tal cual de lo que devuelve el backend; aquí solo se ordenan.
 */
import type {
  DailySeries, DailySeriesGroup, DailySeriesItem, ReportTable, Stage, StageReport,
} from '../types/report';

/** Paleta categórica (mismo orden que `--chart-series-*` en tokens.css). Va en hex y no
 * como variable CSS porque ECharts dibuja en un lienzo, que no resuelve variables. Validada con
 * el validador de dataviz (banda de luminosidad, croma, separación CVD). */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
  '#6250d6', '#e34948'];

/** Estilo de la serie i: las 8 primeras por color; desde la 9ª se repiten con trazo
 * cortado, para que nunca dos series se distingan solo por un color generado. */
export function seriesStyle(i: number): { color: string; dashed: boolean } {
  return { color: SERIES_COLORS[i % SERIES_COLORS.length], dashed: i >= SERIES_COLORS.length };
}

// ---------------------------------------------------------------------------
// Eje X de las series diarias
// ---------------------------------------------------------------------------
export type DayStep = number | 'auto';
/** Las opciones de la versión anterior: una marca cada N días. */
export const DAY_STEPS: DayStep[] = ['auto', 10, 30, 60, 100, 200, 365];

const PX_PER_TICK = 46;
/** Píxeles mínimos por día: con menos, el cursor salta días y alguno queda inalcanzable. */
export const PX_PER_DAY = 3;

export interface ChartLayout {
  /** `axisLabel.interval` del eje X de ECharts: una marca cada `interval + 1` días, o
   * 'auto' (las que quepan sin pisarse). */
  interval: number | 'auto';
  angled: boolean;
  /** Alto del eje X (las etiquetas en ángulo necesitan más). */
  axisHeight: number;
  /** Ancho mínimo del gráfico en px; 0 = el ancho del panel (sin barra de desplazamiento). */
  minWidth: number;
}

/**
 * Geometría de un gráfico diario de `nDays` puntos (todos: no se ralea). Con un paso
 * elegido, una marca cada `step` días y el gráfico se ensancha para que quepan; además,
 * con muchos días el gráfico nunca baja de `PX_PER_DAY` por día, para que el cursor
 * alcance cada día. `fit` (impresión/PDF) lo deja al ancho de la página.
 */
export function chartLayout(nDays: number, step: DayStep, mode: 'day' | 'date', fit = false): ChartLayout {
  const paso = step === 'auto' ? null : Math.max(1, Math.round(step));
  const marcas = paso ? Math.floor(Math.max(0, nDays - 1) / paso) + 1 : 0;
  const angled = mode === 'date' || marcas > 10;
  if (fit) {
    return { interval: 'auto', angled: mode === 'date', axisHeight: mode === 'date' ? 62 : 30, minWidth: 0 };
  }
  const porMarcas = marcas > 16 ? Math.round(marcas * PX_PER_TICK) : 0;
  const porDias = nDays * PX_PER_DAY > 900 ? nDays * PX_PER_DAY : 0;
  return {
    interval: paso ? paso - 1 : 'auto',
    angled,
    axisHeight: angled ? 62 : 30,
    minWidth: Math.max(porMarcas, porDias),
  };
}

// ---------------------------------------------------------------------------
// Gráficos por poza del estático (desde las tablas del reporte, unidas por poza)
// ---------------------------------------------------------------------------
/** Especies que se comparan con el Li+, como en la versión anterior (sin H2O por escala). */
export const REFERENCE_SPECIES = ['Na+', 'K+', 'Mg++', 'Ca++', 'Cl-', 'SO4--', 'H3BO3'];

export type Row = { id: string } & Record<string, number | null | string>;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function findTable(stage: StageReport, key: string): ReportTable | undefined {
  return stage.tables.find((t) => t.key === key);
}

/** Una etapa con pozas (precon o postliming) trae la tabla de propiedades de la salmuera. */
export function hasPondCharts(stage: StageReport): boolean {
  return Boolean(findTable(stage, 'pond_properties')?.rows.length);
}

/**
 * Li+ y las especies de referencia por poza: en t/d (lo que sale de cada poza) o en %p/p
 * (su composición). Una poza sin salida queda en null (no se dibuja como cero).
 */
export function liVsSpecies(stage: StageReport, mode: 'abs' | 'pct'): { species: string[]; rows: Row[] } {
  const t = findTable(stage, mode === 'abs' ? 'pond_outflow_species' : 'pond_outflow_composition');
  if (!t) return { species: [], rows: [] };
  const hay = new Set(t.columns.filter((c) => c.kind === 'species').map((c) => c.key));
  const species = REFERENCE_SPECIES.filter((sp) => hay.has(sp));
  const rows = t.rows.map((r) => {
    const fila: Row = { id: String(r.id), 'Li+': num(r['Li+']) };
    species.forEach((sp) => { fila[sp] = num(r[sp]); });
    return fila;
  });
  return { species: hay.has('Li+') ? species : [], rows };
}

/**
 * Lo que se grafica de cada poza: caudal de salida y sal precipitada (balance), densidad
 * y actividad de agua (propiedades) y el Li+ (t/d o %p/p). Las tablas se unen por poza.
 */
export function pondRows(stage: StageReport, mode: 'abs' | 'pct'): Row[] {
  const props = findTable(stage, 'pond_properties');
  if (!props) return [];
  const porId = (key: string) => new Map((findTable(stage, key)?.rows ?? []).map((r) => [String(r.id), r]));
  const balance = porId('pond_balance');
  const li = porId(mode === 'abs' ? 'pond_outflow_species' : 'pond_outflow_composition');
  return props.rows.map((p) => {
    const id = String(p.id);
    const b = balance.get(id);
    return {
      id,
      liquid_density: num(p.liquid_density),
      water_activity: num(p.water_activity),
      outflow_t_d: num(b?.outflow_t_d),
      salt_precipitated_t_d: num(b?.salt_precipitated_t_d),
      'Li+': num(li.get(id)?.['Li+']),
    };
  });
}

/** Sal precipitada por tipo y por poza: solo las sales que precipitaron, de mayor a menor. */
export function saltEvolution(stage: StageReport): { salts: string[]; rows: Row[] } {
  const t = findTable(stage, 'salts_by_pond');
  if (!t) return { salts: [], rows: [] };
  const max = new Map<string, number>();
  for (const c of t.columns.filter((x) => x.kind === 'salt')) {
    max.set(c.key, Math.max(0, ...t.rows.map((r) => num(r[c.key]) ?? 0)));
  }
  const salts = [...max.entries()].filter(([, m]) => m > 1e-9).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const rows = t.rows.map((r) => {
    const fila: Row = { id: String(r.id) };
    salts.forEach((s) => { fila[s] = num(r[s]); });
    return fila;
  });
  return { salts, rows };
}

/** Clima de cada escenario (temperatura y evaporación), desde la tabla comparativa. */
export function climateRows(comparison: ReportTable): Row[] {
  return comparison.rows.map((r) => ({
    id: String(r.id), temperature_C: num(r.temperature_C), evaporation_mm_d: num(r.evaporation_mm_d),
  }));
}

// ---------------------------------------------------------------------------
// Series diarias del dinámico
// ---------------------------------------------------------------------------
/** Un grupo de series a dibujar: los del backend, la composición de cada especie elegida
 * (una línea por poza) y las sales de la poza elegida (una línea por sal). */
export interface DailyGroup extends DailySeriesGroup {
  /** "group": el título sale de la clave; "composition"/"salts": de la clave + `subject`. */
  origin: 'group' | 'composition' | 'salts';
  subject?: string;
}

const conDatos = (g: DailySeriesGroup) =>
  g.series.some((s) => s.values.some((v) => v !== null && v !== undefined));

/** Li % de la salmuera de cada poza (de la composición): el "Li% por poza (por día)" de
 * antes. Va siempre en la cascada; por eso la composición de Li+ no se repite. */
export const LI_BRINE = 'li_brine_pct';

function liSalmuera(d: DailySeries): DailyGroup | null {
  if (d.stage === 'liming' || !d.composition?.species.includes('Li+')) return null;
  return {
    key: LI_BRINE, unit: '%', origin: 'group',
    series: Object.entries(d.composition.ponds).map(([pozo, c]) => ({ key: pozo, pond: true, values: c['Li+'] ?? [] })),
  };
}

export function dailyGroups(d: DailySeries, especies: string[], pozaSales: string | null): DailyGroup[] {
  const li = liSalmuera(d);
  const comp: DailyGroup[] = (d.composition?.species ?? [])
    .filter((sp) => especies.includes(sp) && !(li && sp === 'Li+'))
    .map((sp) => ({
      key: `composition_${sp}`, unit: '%p/p', origin: 'composition', subject: sp,
      series: Object.entries(d.composition!.ponds).map(([pozo, c]) => ({ key: pozo, pond: true, values: c[sp] ?? [] })),
    }));
  const sales: DailyGroup[] = [];
  const dePoza = pozaSales ? d.salts?.ponds[pozaSales] : undefined;
  if (pozaSales && dePoza) {
    sales.push({
      key: `salts_${pozaSales}`, unit: 't/d', origin: 'salts', subject: pozaSales,
      series: (d.salts!.salts).filter((s) => s in dePoza).map((s) => ({ key: s, salt: true, values: dePoza[s] })),
    });
  }
  const grupos: DailyGroup[] = [...(li ? [li] : []), ...d.groups.map((g) => ({ ...g, origin: 'group' as const }))];
  return ordenBase([...grupos, ...comp, ...sales], d.stage).filter(conDatos);
}

/**
 * Los gráficos del reporte de antes van primero y en su orden (`COMPOSICION` = la
 * composición de cada especie elegida); después los demás, como los manda el backend.
 * Cascada: entrada por poza, altura, Li % de la salmuera, composición (el Li % de la
 * salida de cada poza queda entre los demás). Planta: Li % de la salida,
 * composición de la salida, sales (torta), reactivos, flujo de salida, razón SO4/Mg.
 */
export const COMPOSICION = '*composition';
export const BASE_DAILY_ORDER: Record<'cascade' | 'liming', string[]> = {
  cascade: ['inflow_t_d', 'height_m', LI_BRINE, COMPOSICION],
  liming: ['li_pct', 'outlet_composition_pct', 'salt_cake_t_d', 'reagents', 'liming_flows', 'so4_mg_ratio'],
};

function ordenBase(grupos: DailyGroup[], stage: string): DailyGroup[] {
  const orden = BASE_DAILY_ORDER[stage === 'liming' ? 'liming' : 'cascade'];
  const lugar = (g: DailyGroup) => {
    const i = orden.indexOf(g.origin === 'composition' ? COMPOSICION : g.origin === 'group' ? g.key : '');
    return i === -1 ? orden.length : i;
  };
  // sort estable: dentro del mismo lugar se conserva el orden del backend.
  return [...grupos].sort((a, b) => lugar(a) - lugar(b));
}

/** Pozas con alguna sal en el período (las que tienen sentido en el selector). */
export function saltPonds(d: DailySeries): string[] {
  return Object.entries(d.salts?.ponds ?? {}).filter(([, s]) => Object.keys(s).length > 0).map(([p]) => p);
}

/** Filas del gráfico: una por día (todas, sin ralear), con la fecha y el día de la corrida. */
export function dailyRows(d: DailySeries, g: DailySeriesGroup): Record<string, string | number | null>[] {
  return d.dates.map((fecha, i) => {
    const fila: Record<string, string | number | null> = { date: fecha, day: d.days?.[i] ?? i + 1 };
    g.series.forEach((s) => { fila[s.key] = s.values[i] ?? null; });
    return fila;
  });
}

/** El nombre de una serie que no es una poza, especie o sal sale del diccionario. */
export function seriesUsesOwnName(s: DailySeriesItem): boolean {
  return Boolean(s.pond || s.species || s.salt);
}

// ---------------------------------------------------------------------------
// Litio por etapa (Sankey) y recuperaciones (indicadores)
// ---------------------------------------------------------------------------
/** Li que entra y que sale de una etapa, tal cual los KPIs del reporte: en el período
 * (t, dinámico) o en estado estacionario (t/d, estático). */
export interface LiFlow { stage: Stage; li_in: number | null; li_out: number | null }

export function liFlows(stages: StageReport[], dynamic: boolean): LiFlow[] {
  const [kIn, kOut] = dynamic ? ['li_in_t', 'li_out_t'] : ['li_in_t_d', 'li_out_t_d'];
  return stages.map((s) => ({ stage: s.stage, li_in: num(s.kpis[kIn]), li_out: num(s.kpis[kOut]) }));
}

/** Recuperación de Li de cada etapa (`li_recovery_pct`) y la del proceso
 * (`process_li_recovery_pct`, solo si el reporte la trae). */
export function recoveries(stages: StageReport[], processKpis: Record<string, number | null>):
  { key: Stage | 'process'; value: number | null }[] {
  const filas: { key: Stage | 'process'; value: number | null }[] =
    stages.map((s) => ({ key: s.stage, value: num(s.kpis.li_recovery_pct) }));
  if ('process_li_recovery_pct' in processKpis) {
    filas.push({ key: 'process', value: num(processKpis.process_li_recovery_pct) });
  }
  return filas;
}

// ---------------------------------------------------------------------------
// Mapa de calor poza × día
// ---------------------------------------------------------------------------
/** Una variable del mapa de calor: un grupo con una serie por poza, o la composición de
 * una especie. */
export interface HeatVariable { key: string; unit: string; ponds: string[]; values: (number | null)[][]; species?: string }

export function heatVariables(d: DailySeries): HeatVariable[] {
  const grupos: HeatVariable[] = d.groups
    .filter((g) => g.series.length > 0 && g.series.every((s) => s.pond))
    .map((g) => ({ key: g.key, unit: g.unit, ponds: g.series.map((s) => s.key), values: g.series.map((s) => s.values) }));
  const comp: HeatVariable[] = (d.composition?.species ?? []).map((sp) => {
    const ponds = Object.keys(d.composition!.ponds);
    return { key: `composition_${sp}`, unit: '%p/p', species: sp, ponds,
      values: ponds.map((p) => d.composition!.ponds[p][sp] ?? []) };
  });
  return [...grupos, ...comp].filter((v) => v.values.some((s) => s.some((x) => x !== null && x !== undefined)));
}

// ---------------------------------------------------------------------------
// Comparación de ejecuciones
// ---------------------------------------------------------------------------
/** Una serie de la comparación: el grupo (o la composición de una especie) y la serie
 * dentro de él (poza, especie, sal o corriente). */
export interface SeriesRef { group: string; series: string }

/** Los valores de una serie de una ejecución, alineados a `fechas` (null si ese día no
 * está en su período). */
export function seriesOnDates(d: DailySeries, ref: SeriesRef, fechas: string[]): (number | null)[] {
  let valores: (number | null)[] | undefined;
  if (ref.group.startsWith('composition_')) {
    valores = d.composition?.ponds[ref.series]?.[ref.group.slice('composition_'.length)];
  } else {
    valores = d.groups.find((g) => g.key === ref.group)?.series.find((s) => s.key === ref.series)?.values;
  }
  const porFecha = new Map(d.dates.map((f, i) => [f, valores?.[i] ?? null]));
  return fechas.map((f) => porFecha.get(f) ?? null);
}

/** Las fechas de varias ejecuciones, sin repetir y en orden. */
export function unionDates(series: DailySeries[]): string[] {
  return [...new Set(series.flatMap((s) => s.dates))].sort();
}

/** Columnas numéricas de la comparativa del estático (por escenario). */
export function comparisonColumns(t: ReportTable): { key: string; unit: string }[] {
  return t.columns.filter((c) => c.key !== 'id' && t.rows.some((r) => typeof r[c.key] === 'number'))
    .map((c) => ({ key: c.key, unit: c.unit }));
}
