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
}

// ---- Project Config ----

export interface ProjectConfig {
  id: string;
  project_id: string;
  brine: Record<string, number> | null;
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
  updated_at: string;
}

export interface ProjectConfigUpdate {
  brine?: Record<string, number>;
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
}

export interface ProjectConfigDefaults {
  brine: Record<string, number>;
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
}

export interface SaltFactor {
  dll_index: number;
  name: string;
  precipitation_factor: number;
}

export interface DynamicEncalado {
  config: DynamicEncaladoParams;
  factors: SaltFactor[];
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
  created_by: string;
  created_at: string;
  updated_at: string;
  last_execution_status: string | null;
}

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
  | 'modelo_dinamico_postliming';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Execution {
  id: string;
  project_id: string;
  execution_type: ExecutionType;
  status: ExecutionStatus;
  error_message: string | null;
  celery_task_id: string | null;
  source_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ExecutionCreate {
  execution_type: ExecutionType;
  selected_days?: number[] | null;
  source_execution_id?: string | null;
  n_days_override?: number | null;
  run_tag?: string;
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

export interface DynamicCascadeOrPostlimingResults {
  stage: 'cascade' | 'postliming';
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
  run_tag: string;
  n_days_sim: number;
  n_days_with_feed: number;
  n_days_pre_feed: number;
  n_days_aqsol_failed: number;
  elapsed_seconds: number;
  kpis: DynamicKpis;
  daily_series: DynamicEncaladoDailyRow[];
  reagents_daily: DynamicReagentsDaily[];
  output_dir: string;
  feed_csv_to_postliming: string | null;
  files: ExecutionFile[];
}

export type DynamicResults = DynamicCascadeOrPostlimingResults | DynamicEncaladoResults;

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
