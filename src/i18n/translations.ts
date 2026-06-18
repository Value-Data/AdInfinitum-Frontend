/* ============================================================
   Translation dictionary. Each key maps to {es, en}.
   Add new keys here as you internationalize more strings.
   ============================================================ */

export const TRANSLATIONS = {
  // --- Common / Layout ---
  language: { es: 'Idioma', en: 'Language' },
  spanish: { es: 'Español', en: 'Spanish' },
  english: { es: 'Inglés', en: 'English' },
  save: { es: 'Guardar', en: 'Save' },
  saving: { es: 'Guardando…', en: 'Saving…' },
  cancel: { es: 'Cancelar', en: 'Cancel' },
  close: { es: 'Cerrar', en: 'Close' },
  refresh: { es: 'Refrescar', en: 'Refresh' },
  view: { es: 'Ver', en: 'View' },
  delete: { es: 'Eliminar', en: 'Delete' },
  add: { es: 'Agregar', en: 'Add' },
  download: { es: 'Descargar', en: 'Download' },
  upload: { es: 'Cargar', en: 'Upload' },
  files: { es: 'Archivos', en: 'Files' },
  total: { es: 'Total', en: 'Total' },
  error: { es: 'Error', en: 'Error' },
  loading: { es: 'Cargando', en: 'Loading' },
  status: { es: 'Estado', en: 'Status' },
  yes: { es: 'Sí', en: 'Yes' },
  no: { es: 'No', en: 'No' },

  // --- Project Detail Mode toggle ---
  static_mode: { es: 'Modo Estático', en: 'Static Mode' },
  dynamic_mode: { es: 'Modo Dinámico', en: 'Dynamic Mode' },
  configuration: { es: 'Configuración', en: 'Configuration' },
  executions: { es: 'Ejecuciones', en: 'Executions' },

  // --- Dynamic Mode Panel ---
  dynamic_config_title: {
    es: 'Configuración dinámica del proyecto',
    en: 'Dynamic project configuration',
  },
  download_excel: { es: 'Descargar Excel', en: 'Download Excel' },
  upload_excel: { es: 'Cargar desde Excel', en: 'Upload from Excel' },
  load_defaults: { es: 'Cargar defaults', en: 'Load defaults' },
  restore_defaults: { es: 'Restaurar defaults', en: 'Restore defaults' },
  discard_changes: { es: 'Descartar cambios', en: 'Discard changes' },
  launch_execution: { es: 'Lanzar ejecución', en: 'Launch execution' },
  launching: { es: 'Encolando…', en: 'Queuing…' },
  dynamic_executions: { es: 'Ejecuciones dinámicas', en: 'Dynamic executions' },
  no_executions_yet: { es: 'Sin ejecuciones todavía.', en: 'No executions yet.' },
  source: { es: 'Fuente', en: 'Source' },
  chain: { es: 'Cadena', en: 'Chain' },
  chain_root: { es: 'Vista cadena · raíz', en: 'Chain view · root' },
  simulation_days: { es: 'Días simulación', en: 'Simulation days' },
  tag: { es: 'Tag', en: 'Tag' },
  stage: { es: 'Etapa', en: 'Stage' },
  date: { es: 'Fecha', en: 'Date' },

  // --- Stage labels ---
  cascade_label: { es: 'Cascade (Pz1-Pz7)', en: 'Cascade (Pz1-Pz7)' },
  encalado_label: { es: 'Encalado (Pz8-Pz9)', en: 'Liming (Pz8-Pz9)' },
  postliming_label: { es: 'Postliming (Pz10-Pz18)', en: 'Postliming (Pz10-Pz18)' },

  // --- Dynamic Config Editor sections ---
  section_simulation: {
    es: 'Simulación',
    en: 'Simulation',
  },
  section_brine: { es: 'Salmuera de Pozo', en: 'Well Brine' },
  section_precon_ponds: {
    es: 'Pozas de Preconcentración',
    en: 'Preconcentration Ponds',
  },
  section_precon_factors: {
    es: 'Factores de Sales Preconcentración',
    en: 'Preconcentration Salt Factors',
  },
  section_climate: { es: 'Clima', en: 'Climate' },
  section_encalado_params: {
    es: 'Parámetros de Encalado',
    en: 'Liming Parameters',
  },
  section_encalado_factors: {
    es: 'Factores de Sales Encalado',
    en: 'Liming Salt Factors',
  },
  section_postliming: {
    es: 'Postliming',
    en: 'Postliming',
  },
  section_postliming_factors: {
    es: 'Factores de Sales Postliming',
    en: 'Postliming Salt Factors',
  },

  // --- Pond table headers ---
  name: { es: 'Nombre', en: 'Name' },
  number: { es: '#', en: '#' },
  area_process_m2: { es: 'Area de proceso (m2)', en: 'Process area (m2)' },
  pond_factor: { es: 'Pond Factor', en: 'Pond Factor' },
  entrainment_pct: { es: 'Entrainment (%)', en: 'Entrainment (%)' },
  leakage_mm_d: { es: 'Leakage (mm/d)', en: 'Leakage (mm/d)' },
  dilution_frac: { es: 'Dilución (frac)', en: 'Dilution (frac)' },
  target_h_m: { es: 'Target h (m)', en: 'Target h (m)' },
  control_mode: { es: 'Control', en: 'Control' },
  berm: { es: 'Berm', en: 'Berm' },
  buffer: { es: 'Buffer', en: 'Buffer' },
  flujo_target: { es: 'FLUJO target (t/d)', en: 'FLUJO target (t/d)' },
  floor_h_m: { es: 'Floor h (m)', en: 'Floor h (m)' },
  h_arranque_m: { es: 'h arranque (m)', en: 'startup h (m)' },
  actions: { es: 'Acciones', en: 'Actions' },
  add_pond: { es: '+ Agregar Poza', en: '+ Add Pond' },

  // --- Postliming table ---
  designation: { es: 'Designación', en: 'Designation' },
  buffer_h_m: { es: 'Buffer h (m)', en: 'Buffer h (m)' },
  evap_factor: { es: 'Evap factor', en: 'Evap factor' },

  // --- Encalado sub-sections ---
  general: { es: 'General', en: 'General' },
  paso_0_boro: { es: 'Paso 0 - Remoción de Boro', en: 'Step 0 - Boron Removal' },
  torta_lavado: { es: 'Torta / Lavado', en: 'Cake / Wash' },
  secuencia_dosificaciones: {
    es: 'Secuencia de dosificaciones',
    en: 'Dosing sequence',
  },
  flags_v3_advanced: {
    es: 'Flags V3 (avanzado — defaults Ad-Inf)',
    en: 'V3 Flags (advanced — Ad-Inf defaults)',
  },
  temperature_c: { es: 'Temperatura (C)', en: 'Temperature (C)' },
  use_cacl2_label: {
    es: 'Usar CaCl2 (veta/fuerza dosificación CaCl2/SO4)',
    en: 'Use CaCl2 (veto/force CaCl2/SO4 dosing)',
  },
  reactivo: { es: 'Reactivo', en: 'Reagent' },
  objetivo: { es: 'Objetivo', en: 'Target' },
  factor_exceso: { es: 'Factor exceso', en: 'Excess factor' },
  conc_solucion: { es: 'Conc. solución', en: 'Solution conc.' },
  enabled: { es: 'Enabled', en: 'Enabled' },
  add_dosificacion: {
    es: '+ Agregar dosificación',
    en: '+ Add dosing step',
  },
  dosing_order_note: {
    es: 'El orden de la tabla es el orden de aplicación. Combinaciones soportadas: Ca(OH)2/Mg, CaCl2/SO4, Ca(OH)2/SO4, NaOH/Mg, Na2SO4/Ca.',
    en: 'Row order is the order of application. Supported combinations: Ca(OH)2/Mg, CaCl2/SO4, Ca(OH)2/SO4, NaOH/Mg, Na2SO4/Ca.',
  },
  invalid_combos_warning: {
    es: 'Las filas en rojo tienen combinaciones reactivo/objetivo no soportadas. El motor lanzará NotImplementedError si las dejas así al ejecutar.',
    en: 'Red rows have unsupported reagent/target combinations. The engine will raise NotImplementedError if left as-is.',
  },

  // --- Postliming params V4 ---
  parameters_v4: { es: 'Parámetros V4', en: 'V4 Parameters' },
  temp_c_climate_hint: {
    es: 'Temperatura (C) — vacío = usar serie clima día a día',
    en: 'Temperature (C) — empty = use daily climate series',
  },
  pz10_avg_outflow_hint: {
    es: 'Pz10 average outflow (t/d) — vacío = auto-derivar',
    en: 'Pz10 average outflow (t/d) — empty = auto-derive',
  },
  pz10_seasonal_modulation: {
    es: 'Modulación estacional Pz10 (outflow proporcional a evap diaria)',
    en: 'Pz10 seasonal modulation (outflow proportional to daily evap)',
  },
  apply_berm_factor: {
    es: 'apply_berm_factor (FALSE = áreas en config ya son de proceso, no se divide por 1.08)',
    en: 'apply_berm_factor (FALSE = config areas are process areas, not divided by 1.08)',
  },

  // --- Results view tabs ---
  kpis: { es: 'KPIs', en: 'KPIs' },
  table_1_balance: { es: 'Tabla 1 · Balance', en: 'Table 1 · Balance' },
  table_2_compositions: {
    es: 'Tabla 2 · Composiciones',
    en: 'Table 2 · Compositions',
  },
  table_3_salts: { es: 'Tabla 3 · Sales', en: 'Table 3 · Salts' },
  compact_table: { es: 'Tabla compacta', en: 'Compact table' },
  charts: { es: 'Gráficos', en: 'Charts' },

  // --- KPI labels ---
  recovery_li: { es: 'Recovery Li', en: 'Li Recovery' },
  li_production: { es: 'Producción Li', en: 'Li Production' },
  days_simulated: { es: 'Días simulados', en: 'Days simulated' },
  aqsol_convergence: { es: 'AQSOL convergencia', en: 'AQSOL convergence' },
  last_year: { es: 'último año', en: 'last year' },

  // --- Charts ---
  inflow_per_pond: { es: 'Flujos de entrada por poza', en: 'Inflows per pond' },
  height_per_pond: { es: 'Altura por poza', en: 'Height per pond' },
  li_per_pond_per_day: {
    es: 'Li% por poza (por día)',
    en: 'Li% per pond (daily)',
  },
  composition_per_pond: {
    es: 'Composiciones — elegir especies',
    en: 'Compositions — pick species',
  },
  salts_per_pond_chart: {
    es: 'Sales precipitadas por poza (t/d) — una línea por sal',
    en: 'Precipitated salts per pond (t/d) — one line per salt',
  },
  reagent_consumption: {
    es: 'Consumo de reactivos (t/d)',
    en: 'Reagent consumption (t/d)',
  },
  flow_out: {
    es: 'Flujo de salida (P2519) t/d',
    en: 'Output flow (P2519) t/d',
  },
  so4_mg_ratio: {
    es: 'Ratio SO4/Mg del feed',
    en: 'SO4/Mg ratio of feed',
  },

  // --- Scale factor ---
  scale_factor_label: {
    es: 'Factor de escalado (post-corrida)',
    en: 'Scale factor (post-run)',
  },
  scale_factor_hint: {
    es: 'Multiplica flujos, masas anuales, sales y reactivos sin re-correr el motor. NO afecta composiciones %w/w, alturas, densidades ni actividad de agua.',
    en: 'Multiplies flows, annual masses, salts and reagents without re-running the engine. Does NOT affect %w/w compositions, heights, densities, or water activity.',
  },
  apply: { es: 'Aplicar', en: 'Apply' },
  reset: { es: 'Reset', en: 'Reset' },
  applied: { es: 'Aplicado', en: 'Applied' },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS;
export type Language = 'es' | 'en';
