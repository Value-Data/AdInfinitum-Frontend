/**
 * Datos y geometría de los gráficos, sin React: lo que se puede probar sin dibujar.
 * Los valores salen tal cual de lo que devuelve el backend; aquí solo se ordenan.
 */
import type { ReportTable, StageReport } from '../types/report';

/** Paleta categórica (mismo orden que `--chart-series-*` en tokens.css). Va en hex y no
 * como variable CSS porque el SVG exportado a PNG no resuelve variables. Validada con
 * el validador de dataviz (banda de luminosidad, croma, separación CVD). */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
  '#6250d6', '#e34948'];

/** Estilo de la serie i: las 8 primeras por color; desde la 9ª se repiten con trazo
 * cortado, para que nunca dos series se distingan solo por un color generado. */
export function seriesStyle(i: number): { stroke: string; strokeDasharray?: string } {
  const stroke = SERIES_COLORS[i % SERIES_COLORS.length];
  return i >= SERIES_COLORS.length ? { stroke, strokeDasharray: '6 3' } : { stroke };
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
  /** Prop `interval` del eje X de recharts. */
  interval: number | 'preserveStartEnd';
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
    return { interval: 'preserveStartEnd', angled: mode === 'date', axisHeight: mode === 'date' ? 62 : 30, minWidth: 0 };
  }
  const porMarcas = marcas > 16 ? Math.round(marcas * PX_PER_TICK) : 0;
  const porDias = nDays * PX_PER_DAY > 900 ? nDays * PX_PER_DAY : 0;
  return {
    interval: paso ? paso - 1 : 'preserveStartEnd',
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
