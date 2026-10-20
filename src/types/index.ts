/* ============================================================
   TypeScript interfaces aligned with backend Pydantic schemas
   ============================================================ */

// ---- Auth ----

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

// ---- User ----

export interface UserResponse {
  id: string;
  username: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UserUpdate {
  username?: string;
  password?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
}

export interface UserProjectsUpdate {
  project_ids: string[];
}

// ---- Brine: 17 species ----

export interface BrineData {
  H2O: number;
  'Li+': number;
  'Na+': number;
  'K+': number;
  'Mg++': number;
  'Ca++': number;
  'Cl-': number;
  'SO4--': number;
  H3BO3: number;
  'H+': number;
  'HSO4-': number;
  'OH-': number;
  'CO2(aq)': number;
  'HCO3-': number;
  'CO3--': number;
  'B4O7--': number;
  'BO2-': number;
}

export const MAIN_SPECIES: (keyof BrineData)[] = [
  'H2O',
  'Li+',
  'Na+',
  'K+',
  'Mg++',
  'Ca++',
  'Cl-',
  'SO4--',
  'H3BO3',
];

export const TRACE_SPECIES: (keyof BrineData)[] = [
  'H+',
  'HSO4-',
  'OH-',
  'CO2(aq)',
  'HCO3-',
  'CO3--',
  'B4O7--',
  'BO2-',
];

// Orden canónico de los 17 componentes acuosos (sin subdivisión principal/traza).
export const BRINE_SPECIES_ORDER: (keyof BrineData)[] = [
  'H2O',
  'Li+',
  'Na+',
  'K+',
  'Mg++',
  'Ca++',
  'H+',
  'Cl-',
  'HSO4-',
  'SO4--',
  'OH-',
  'CO2(aq)',
  'HCO3-',
  'CO3--',
  'H3BO3',
  'B4O7--',
  'BO2-',
];

// ---- Pond Config ----

export interface PondConfig {
  name: string;
  number: number;
  area_design_m2: number;
  pond_factor: number;
  entrainment_pct: number;
  leakage_mm_day: number;
  dilution_frac: number;
}

// ---- Encalado Config ----

export interface EncaladoConfig {
  availability_days_year: number;
  boron_removal_fraction: number;
  lime_excess_factor: number;
  lime_slurry_conc: number;
  lime_CaO_purity: number;
  CaCl2_SO4_factor: number;
  CaCl2_sol_conc: number;
  CaCl2_purity: number;
  CaCl2_NaCl_fraction: number;
  CaCl2_MgCl2_fraction: number;
  CaCl2_CaSO4_fraction: number;
  cake_retention: number;
  cake_wash_ratio: number;
  cake_wash_recovery: number;
  use_CaCl2: boolean;
  temperature_C: number;
}

// ---- Daily Schedule ----

export interface DailyScheduleItem {
  date_label: string;
  temperature_C: number;
  evap_rate: number;
  /**
   * Caudal de salmuera de este día, ton/d. Opcional: sin valor, el día usa el caudal
   * global de la configuración. La composición en %w/w es siempre la misma; lo que
   * cambia día a día es la escala.
   */
  brine_total_flow?: number;
}

// ---- Project Config ----

export interface ProjectConfig {
  id: string;
  project_id: string;
  /** Composicion de la salmuera de pozo en %w/w. El caudal va en brine_total_flow. */
  brine: Record<string, number> | null;
  /** Caudal total de la salmuera de pozo, ton/d. Escala de `brine`. */
  brine_total_flow: number | null;
  precon_ponds: PondConfig[] | null;
  precon_faktor: number[] | null;
  encalado_config: EncaladoConfig | null;
  encalado_faktor: number[] | null;
  postliming_ponds: PondConfig[] | null;
  postliming_faktor: number[] | null;
  daily_schedule: DailyScheduleItem[] | null;
  precon_days_year: number | null;
  encalado_days_year: number | null;
  postliming_days_year: number | null;
  dynamic_config: DynamicConfig | null;
  /** Escenario del modo con inventario. `_path` = uno de los que trae el motor. */
  inventario_config: InventarioConfig | null;
  /** Catalogo AQSOL en que estan brine y los *_faktor de esta config. */
  aqsol_version: AqsolVersion;
  /** Convencion del arrastre: 'wet' = % de la torta humeda, 'dry' = % de la sal. */
  entrainment_basis: EntrainmentBasis;
  updated_at: string;
}

export interface ProjectConfigUpdate {
  /** Base AQSOL en que se guardan brine y los *_faktor. */
  aqsol_version?: AqsolVersion;
  entrainment_basis?: EntrainmentBasis;
  brine?: Record<string, number>;
  brine_total_flow?: number;
  precon_ponds?: PondConfig[];
  precon_faktor?: number[];
  encalado_config?: Record<string, unknown>;
  encalado_faktor?: number[];
  postliming_ponds?: PondConfig[];
  postliming_faktor?: number[];
  daily_schedule?: DailyScheduleItem[];
  precon_days_year?: number;
  encalado_days_year?: number;
  postliming_days_year?: number;
  dynamic_config?: DynamicConfig;
  inventario_config?: InventarioConfig;
}

export interface ProjectConfigDefaults {
  brine: Record<string, number>;
  brine_total_flow: number;
  precon_ponds: PondConfig[];
  precon_faktor: number[];
  encalado_config: Record<string, unknown>;
  encalado_faktor: number[];
  postliming_ponds: PondConfig[];
  postliming_faktor: number[];
  daily_schedule: DailyScheduleItem[];
  salt_names: string[];
  precon_days_year: number;
  encalado_days_year: number;
  postliming_days_year: number;
  dynamic_config: DynamicConfig;
  inventario_config: InventarioConfig;
}

// ---- Modelo Dinámico ----

export interface DynamicPondConfig {
  name: string;
  number: number;
  area_design_m2: number;
  pond_factor: number;
  entrainment_pct: number;
  leakage_mm_day: number;
  dilution_frac: number;
  target_height_m: number | null;
  max_height_m: number | null;
  is_terminal_buffer: boolean;
  apply_berm_factor: boolean;
  control_mode: 'ALTURA' | 'FLUJO_FIJO';
  target_outflow_t_day: number | null;
  utilization: number;
  height_floor_m: number | null;
  h_arranque_m: number;
}

export interface DynamicPrecon {
  ponds: DynamicPondConfig[];
  average_flow_ton_day: number;
  max_flow_ton_day: number;
  flow_modulation: 'seasonal' | 'constant_until_regime';
  n_days_consecutive_regime: number;
  factors: SaltFactor[];
}

export interface DynamicClimate {
  series_start_date: string;
  evaporation_mm_day: number[];
  temperature_C: number[];
  /**
   * Caudal de salmuera de cada dia, ton/d. Serie paralela y OPCIONAL.
   *
   * null/ausente (default): el caudal diario lo modula el motor a partir de
   * average_flow_ton_day, max_flow_ton_day y flow_modulation.
   * Con valores: cada dia usa el suyo; las posiciones en null quedan moduladas, asi
   * que se puede fijar el caudal de un tramo y dejar el resto como estaba.
   *
   * Equivale al brine_total_flow por dia del cronograma del modelo estatico.
   */
  brine_flow_ton_day?: (number | null)[] | null;
}

// v2: 5 supported reactivo/objetivo combinations.
export type DosificacionReactivo = 'Ca(OH)2' | 'CaCl2' | 'NaOH' | 'Na2SO4';
export type DosificacionObjetivo = 'Mg' | 'SO4' | 'Ca';

export interface DosificacionConfig {
  reactivo: DosificacionReactivo;
  objetivo: DosificacionObjetivo;
  factor_exceso: number;
  concentracion_solucion: number;
  enabled: boolean;
}

export interface DynamicEncaladoParams {
  availability_days_year: number;
  temperature_C: number;
  boron_removal_fraction: number;
  lime_excess_factor: number;
  lime_slurry_conc: number;
  lime_CaO_purity: number;
  CaCl2_SO4_factor: number;
  CaCl2_sol_conc: number;
  CaCl2_purity: number;
  CaCl2_NaCl_fraction: number;
  CaCl2_MgCl2_fraction: number;
  CaCl2_CaSO4_fraction: number;
  cake_retention: number;
  cake_wash_ratio: number;
  cake_wash_recovery: number;
  use_CaCl2: boolean;
  use_CaCl2_threshold: number | null;
  use_CaCl2_threshold_basis: string;
  abort_on_aqsol_fail_pct: number;
  max_iter_fn: number;
  fn_tolerance: number;
  // v2: V3 flags (Ad-Inf convention defaults).
  use_filtrate_as_aqsol2_base: boolean;
  use_fn_input_subtraction: boolean;
  include_cake_wash_in_output: boolean;
  // v2: configurable dosing sequence (ordered).
  secuencia_dosificaciones: DosificacionConfig[];
}

export interface SaltFactor {
  dll_index: number;
  name: string;
  precipitation_factor: number;
}

export interface DynamicEncalado {
  config: DynamicEncaladoParams;
  factors: SaltFactor[];
  // v2: informative catalog for UI dropdowns (reactivos, objetivos, params per reactivo).
  reactivos_catalog?: Record<string, unknown> | null;
}

export interface DynamicPostlimingPondConfig {
  name: string;
  designation: string | null;
  area_m2: number;
  control_mode: 'CASCADE' | 'BUFFER' | 'FLUJO_FIJO';
  buffer_height_m: number | null;
  target_height_m: number;
  height_floor_m: number;
  evap_factor: number;
  leakage_mm_d: number;
  entrainment_pct: number;
  dilution_frac: number;
  pond_factor: number;
}

export interface DynamicPostlimingParams {
  n_days_max: number;
  temperature_C: number | null;
  abort_on_aqsol_fail_pct: number;
  validation_window_days: number[];
  salts_allowed: string[];
  // v2 V4: seasonal modulation Pz10 + apply_berm_factor.
  use_pz10_seasonal_modulation: boolean;
  pz10_average_outflow_t_day: number | null;
  apply_berm_factor: boolean;
}

export interface DynamicPostliming {
  config: DynamicPostlimingParams;
  ponds: DynamicPostlimingPondConfig[];
  factors: SaltFactor[];
}

export interface DynamicSimulation {
  n_days: number;
  start_date: string;
}

export interface DynamicConfig {
  /**
   * Base de catalogo AQSOL en que estan expresados `brine` y los `factors` de este
   * blob: define que especies y sales muestran los editores y la plantilla Excel, y
   * es TAMBIEN el motor con que se ejecutan las etapas dinamicas — el backend lo toma
   * de aca al lanzar, no del panel de ejecuciones.
   *
   * Es independiente de ProjectConfig.aqsol_version, la base del modelo estatico.
   */
  aqsol_version?: AqsolVersion;
  brine: Record<string, number>;
  precon: DynamicPrecon;
  climate: DynamicClimate;
  encalado: DynamicEncalado;
  postliming: DynamicPostliming;
  simulation: DynamicSimulation;
}

// ---- Project ----

export interface Project {
  id: string;
  name: string;
  description: string | null;
  /** F8: empresa dueña del proyecto; la lista se agrupa por ella. */
  client?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_execution_status: string | null;
  /** Versión de AQSOL del proyecto (D4): se elige al crearlo y no cambia. */
  aqsol_version?: AqsolVersion;
  /** F7: el rol del usuario en el proyecto (`admin` si es administrador) y lo que puede hacer. */
  my_role?: string;
  capabilities?: string[];
}

/** F7: rol de un usuario en un proyecto (de menos a más). */
export type ProjectRole = 'cliente' | 'lector' | 'editor' | 'operador';
export const PROJECT_ROLES: ProjectRole[] = ['cliente', 'lector', 'editor', 'operador'];
export interface ProjectAccess { project_id: string; role: ProjectRole }

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
}

// ---- Execution ----

export type ExecutionType =
  | 'proceso_completo'
  | 'preconcentracion'
  | 'modelo_dinamico_cascade'
  | 'modelo_dinamico_encalado'
  | 'modelo_dinamico_postliming'
  // Modo con inventario (motor Mariana): la cascada arranca con las pozas cargadas.
  // Tres etapas encadenadas; la del medio corre con el motor dinámico.
  | 'inventario_precon'
  | 'inventario_encalado'
  | 'inventario_postliming';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Execution {
  id: string;
  project_id: string;
  execution_type: ExecutionType;
  status: ExecutionStatus;
  error_message: string | null;
  /** Falló, pero el backend conservó lo calculado hasta el corte. */
  has_partial_results?: boolean;
  celery_task_id: string | null;
  source_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

/** Version del motor termodinamico. Omitir = default de la instancia. */
export type AqsolVersion = '027' | '066';

/**
 * Base del entrainment. 'wet': el % es la fraccion de la torta humeda que es salmuera
 * (lo que hace el motor; 25% => 333 kg por tonelada de sal). 'dry': el % se aplica a la
 * masa de sal seca (25% => 250 kg por tonelada).
 */
export type EntrainmentBasis = 'wet' | 'dry';

export const AQSOL_VERSIONS: { value: AqsolVersion; label: string }[] = [
  { value: '027', label: 'AQSOL027' },
  { value: '066', label: 'AQSOL066' },
];

/** Especies y sales editables de una version de AQSOL (servidas por el backend). */
export interface AqsolCatalog {
  version: string;
  species: string[];
  salts: { dll_index: number; name: string }[];
  n_aqueous: number;
  n_salts: number;
  faktor_length: number;
}

export interface ExecutionCreate {
  execution_type: ExecutionType;
  selected_days?: number[] | null;
  source_execution_id?: string | null;
  n_days_override?: number | null;
  run_tag?: string;
  aqsol_version?: AqsolVersion | null;
  /** Maximo de iteraciones del solver de pozas (default 200). */
  max_iter?: number | null;
}

export interface ExecutionFile {
  name: string;
  size_bytes: number;
}

// ---- Dynamic execution results (matches dynamic_runner summary) ----

export interface DynamicKpis {
  recovery_li_pct: number;
  annual_li_production_ton: number;
  n_days_simulated: number;
  aqsol_convergence_pct: number;
  li_in_t_year?: number;
  li_out_t_year?: number;
  n_days_with_feed?: number;
  flow_out_t_d_avg?: number;
}

export interface DynamicAnnualAggregates {
  area_m2: number;
  flow_in_t_d_avg: number;
  flow_in_t_y: number;
  flow_out_t_d_avg: number;
  flow_out_t_y: number;
  hold_up_delta_t: number;
  evap_t_y: number;
  evap_mm_d_avg: number;
  seepage_t_y: number;
  entrainment_t_y: number;
  entrainment_pct_avg: number;
  salt_t_y: number;
  density_avg: number;
  water_activity_avg: number;
}

export interface DynamicDailyState {
  day: number;
  date?: string;
  height_m: number;
  mass_liquid_ton: number;
  density_kg_m3: number;
  water_activity: number;
  li_pct: number;
  outflow_ton: number;
  inflow_ton: number;
  evaporation_ton: number;
  salt_precipitated_ton: number;
  // 5 default species %w/w for charts
  [key: `${string}_pct`]: number;
}

export interface DynamicEncaladoDailyRow {
  day: number;
  date: string;
  has_feed: boolean;
  feed_total_ton: number;
  so4_mg_ratio_feed: number;
  cacl2_applied: boolean;
  aqsol_failed: boolean;
  lechada_t_d: number;
  cacl2_t_d: number;
  flow_out_t_d: number;
}

export interface DynamicReagentsDaily {
  day: number;
  date: string;
  lechada_t_d: number;
  cacl2_t_d: number;
}

/**
 * Versión del motor termodinámico con que se corrió la ejecución. Opcional: las
 * ejecuciones anteriores a la incorporación del sello no la traen.
 */
export interface AqsolStamp {
  engine: 'static' | 'dynamic';
  available: boolean;
  version: string | null;
  dll: string | null;
}

export interface DynamicCascadeOrPostlimingResults {
  stage: 'cascade' | 'postliming';
  aqsol?: AqsolStamp;
  run_tag: string;
  n_days_sim: number;
  pond_names: string[];
  table_species: string[];
  default_chart_species: string[];
  main_salts: string[];
  annual_window: [number, number];
  kpis: DynamicKpis;
  daily_series: Record<string, DynamicDailyState[]>;
  annual_aggregates: Record<string, DynamicAnnualAggregates>;
  annual_composition_pct: Record<string, Record<string, number>>;
  annual_species_t_year: Record<string, Record<string, number>>;
  annual_salts_t_year: Record<string, Record<string, number>>;
  annual_salts_pct: Record<string, Record<string, number>>;
  output_dir: string;
  files: ExecutionFile[];
  feed_csv?: string;
  feed_to_encalado_summary?: {
    first_day_with_flow: number | null;
    n_days_with_flow: number;
    avg_flow_ton_day: number;
    avg_li_pct: number;
  };
  salt_universe?: string[];
}

export interface DynamicEncaladoResults {
  stage: 'encalado';
  aqsol?: AqsolStamp;
  run_tag: string;
  n_days_sim: number;
  n_days_with_feed: number;
  n_days_pre_feed: number;
  n_days_aqsol_failed: number;
  elapsed_seconds: number;
  kpis: DynamicKpis;
  daily_series: DynamicEncaladoDailyRow[];
  reagents_daily: DynamicReagentsDaily[];
  // Paridad con encalado estático: EncaladoResult promediado sobre los días válidos
  // (mismo objeto que consume EncaladoResultPanel en el modelo estático).
  encalado_result_averaged?: EncaladoResult | null;
  encalado_temperature_C?: number;
  n_days_averaged?: number;
  output_dir: string;
  feed_csv_to_postliming: string | null;
  files: ExecutionFile[];
}

/**
 * Marca de corrida cortada. El backend guarda igual lo calculado hasta el fallo
 * (`dynamic_runner.simular_conservando_parcial`), así que estos campos aparecen en
 * cualquier etapa cuando `status === 'failed'`.
 */
export interface DynamicPartialInfo {
  partial?: boolean;
  days_completed?: number;
  days_total?: number;
  error_msg?: string;
}

export type DynamicResults =
  (DynamicCascadeOrPostlimingResults | DynamicEncaladoResults) & DynamicPartialInfo;

// =========================================================
// Modo con inventario (motor Mariana)
// =========================================================

/**
 * Escenario que trae el motor: apunta a los JSON de pozas, feed, clima, factores e
 * inventario inicial. `con_inventario` es lo que distingue este modo — false
 * significa que ese escenario arranca con las pozas vacías, como el dinámico.
 */
/**
 * Escenario configurado en el proyecto. Dos formas: solo `_path` cuando se eligió
 * uno de los que trae el motor (lo que manda el selector), o el escenario entero
 * para uno propio.
 */
/** Poza del escenario. Mismos campos que `DynamicPondConfig` del motor. */
export interface InventarioPond {
  name: string;
  number: number;
  area_design_m2: number;
  control_mode?: 'ALTURA' | 'FLUJO_FIJO';
  target_height_m?: number | null;
  max_height_m?: number | null;
  leakage_mm_day?: number | null;
  dilution_frac?: number | null;
  apply_berm_factor?: boolean;
  [campo: string]: unknown;
}

export interface InventarioConfig {
  /** De qué escenario de la entrega salió. Marca de origen, no fuente de verdad:
   *  si el blob trae bloques editados, mandan ellos. */
  _path?: string;
  /** Bloques editables. Presentes = escenario editado; ausentes = se lee de `_path`. */
  pozas?: InventarioPond[];
  feed?: {
    flowrate_tpd?: number;
    /** Tope de la modulación estacional. Vacío = 1,5× el promedio (default del motor). */
    max_flow_tpd?: number;
    composicion_pp?: Record<string, number>;
    [k: string]: unknown;
  };
  clima?: Record<string, unknown>;
  factores?: Record<string, number>;
  inventario?: Record<string, Record<string, unknown>>;
  /** Etapas 2 y 3 de la cadena. El escenario de la entrega no las trae —su CLI solo
   *  corre la preconcentración—, así que el backend las agrega al expandirlo. */
  encalado?: { config: DynamicEncaladoParams; factors: SaltFactor[] };
  postliming?: {
    config: DynamicPostlimingParams;
    ponds: DynamicPostlimingPondConfig[];
    factors: SaltFactor[];
    validation_targets?: Record<string, unknown>;
  };
  start_date?: string;
  days_max?: number;
  target?: Record<string, unknown>;
  [campo: string]: unknown;
}

export interface InventarioEscenario {
  path: string;
  nombre: string;
  descripcion: string;
  dias: number | null;
  start_date: string | null;
  con_inventario: boolean;
}

/**
 * Resultados del modo con inventario.
 *
 * Son **los del modo dinámico**: el runner arma el resumen con el mismo
 * `build_stage_summary`, así que traen las mismas tablas anuales, la misma serie
 * diaria y los mismos KPIs, y se dibujan con la misma pantalla. Lo propio del modo
 * son los dos bloques de abajo: de qué escenario salió la corrida y contra qué
 * objetivo de litio se compara.
 */
export type InventarioResults = DynamicResults & {
  modo?: 'inventario';
  escenario?: {
    descripcion: string;
    start_date: string | null;
    days_max: number | null;
    ponds_config: string | null;
    initial_states: string | null;
    /** Si la corrida arrancó con las pozas cargadas. */
    con_inventario: boolean;
    pozas_sembradas: number;
  };
  target?: {
    pond_name: string | null;
    li_pct_target: number | null;
    band_rel: number;
    /** Li% de la última poza al final de la corrida. */
    li_pct_final: number | null;
  };
  elapsed_seconds?: number;
};

/** Igual que el dinámico: una corrida cortada guarda lo que alcanzó a calcular. */
export type InventarioResultsWithPartial = InventarioResults & DynamicPartialInfo;

export interface ExecutionStatusResponse {
  id: string;
  status: ExecutionStatus;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ExecutionResult {
  id: string;
  project_id: string;
  execution_type: ExecutionType;
  status: ExecutionStatus;
  parameters_snapshot: Record<string, unknown> | null;
  results: ExecutionResults | null;
  error_message: string | null;
  source_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

// ---- Execution Results (nested structure from engine) ----

export interface AQSOLResult {
  eq_liquid_dll: number[];
  eq_liquid: Record<string, number>;
  phases_dll: number[];
  precipitated_salts: Record<string, number>;
  total_solids_g: number;
  saturation_indices: number[];
  properties_raw: number[];
  water_activity: number;
  density_liquid: number;
  density_solid: number;
  pH: number;
  ionic_strength: number;
  Cp_liquid: number;
  error_code: number;
  timeout_remaining: number;
}

export interface PondResult {
  config: PondConfig;
  aqsol_result: AQSOLResult;
  evaporation: number;
  salt_precipitated: number;
  entrainment: number;
  leakage: number;
  dilution: number;
  outlet_flow: number;
  aqsol_input: number[];
  iterations: number;
  converged: boolean;
}

export interface SolverResult {
  initial_aqsol: AQSOLResult;
  ponds: PondResult[];
  total_evaporation: number;
  total_salt: number;
  total_entrainment: number;
  total_leakage: number;
  final_outlet_flow: number;
  li_in: number;
  li_out: number;
  li_recovery_pct: number;
}

export interface EncaladoResult {
  [key: string]: unknown;
}

export interface ExecutionResults {
  precon?: SolverResult | null;
  encalado?: EncaladoResult | null;
  postliming?: SolverResult | null;
  precon_output?: Record<string, number>;
  encalado_input?: Record<string, number>;
  encalado_output?: Record<string, number>;
  postliming_input?: Record<string, number>;
  error_stage?: string | null;
  error_msg?: string | null;
}
