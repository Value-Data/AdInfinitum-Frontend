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

export type ExecutionType = 'proceso_completo' | 'preconcentracion';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Execution {
  id: string;
  project_id: string;
  execution_type: ExecutionType;
  status: ExecutionStatus;
  error_message: string | null;
  celery_task_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ExecutionCreate {
  execution_type: ExecutionType;
  selected_days?: number[] | null;
}

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
