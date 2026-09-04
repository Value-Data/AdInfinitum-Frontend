import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type {
  Project,
  ProjectConfig,
  PondConfig,
  EncaladoConfig,
  DailyScheduleItem,
} from '../types';
import {
  getProject,
  getProjectConfig,
  getAqsolCatalog,
  updateProjectConfig,
  getProjectConfigDefaults,
} from '../services/api';
import { useT } from '../i18n/LanguageContext';
import BrineEditor, { brineCloses } from '../components/BrineEditor';
import PondEditor from '../components/PondEditor';
import SaltFactorEditor from '../components/SaltFactorEditor';
import EncaladoConfigForm from '../components/EncaladoConfigForm';
import DailyScheduleEditor from '../components/DailyScheduleEditor';
import ExecutionList from '../components/ExecutionList';
import RunSimulationPanel from '../components/RunSimulationPanel';
import DynamicModePanel from '../components/DynamicModePanel';
import InventarioModePanel from '../components/InventarioModePanel';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { downloadExcel, parseWorkbookFile } from '../utils/configExcel';
import type { AqsolCatalog, AqsolVersion, EntrainmentBasis } from '../types';
import { AQSOL_VERSIONS } from '../types';

type TabKey = 'config' | 'executions';
type ProjectMode = 'static' | 'dynamic' | 'inventario';

const DEFAULT_ENCALADO: EncaladoConfig = {
  availability_days_year: 328.5,
  boron_removal_fraction: 0.4,
  lime_excess_factor: 1.17,
  lime_slurry_conc: 0.25,
  lime_CaO_purity: 0.833,
  CaCl2_SO4_factor: 0.7,
  CaCl2_sol_conc: 0.381,
  CaCl2_purity: 0.9494,
  CaCl2_NaCl_fraction: 0.0425,
  CaCl2_MgCl2_fraction: 0.005,
  CaCl2_CaSO4_fraction: 0.0003,
  cake_retention: 0.56,
  cake_wash_ratio: 1.0,
  cake_wash_recovery: 0.35,
  use_CaCl2: true,
  temperature_C: 15.0,
};

// Defined OUTSIDE the component so React doesn't re-create it on every render
function SectionHeader({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-3 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-gray-50"
        style={{ color: 'var(--color-text)' }}
        onClick={onToggle}
      >
        <span>{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const t = useT();
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(isAdmin ? 'config' : 'executions');
  const [refreshExecKey, setRefreshExecKey] = useState(0);
  const [mode, setMode] = useState<ProjectMode>('static');

  // Local config state for editing.
  // `brine` es composición en %w/w; el caudal vive aparte en `brineTotalFlow`.
  const [brine, setBrine] = useState<Record<string, number>>({});
  const [brineTotalFlow, setBrineTotalFlow] = useState<number>(0);
  const [preconPonds, setPreconPonds] = useState<PondConfig[]>([]);
  const [preconFaktor, setPreconFaktor] = useState<number[]>([]);
  const [encaladoConfig, setEncaladoConfig] = useState<EncaladoConfig>(DEFAULT_ENCALADO);
  const [encaladoFaktor, setEncaladoFaktor] = useState<number[]>([]);
  const [postlimingPonds, setPostlimingPonds] = useState<PondConfig[]>([]);
  const [postlimingFaktor, setPostlimingFaktor] = useState<number[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleItem[]>([]);
  const [saltNames, setSaltNames] = useState<string[]>([]);
  // Base AQSOL de ESTA config: define que especies y sales muestran los editores.
  const [aqsolBasis, setAqsolBasis] = useState<AqsolVersion>('027');
  // Convencion del arrastre: la del motor ('wet') o sobre la sal seca ('dry').
  const [entrBasis, setEntrBasis] = useState<EntrainmentBasis>('wet');
  const [catalog, setCatalog] = useState<AqsolCatalog | null>(null);
  const [preconDaysYear, setPreconDaysYear] = useState<number>(365);
  const [encaladoDaysYear, setEncaladoDaysYear] = useState<number>(328.5);
  const [postlimingDaysYear, setPostlimingDaysYear] = useState<number>(365);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    calendar: false,
    brine: true,
    precon_ponds: false,
    precon_faktor: false,
    encalado: false,
    encalado_faktor: false,
    postliming_ponds: false,
    postliming_faktor: false,
    schedule: false,
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const proj = await getProject(id);
      setProject(proj);

      if (isAdmin) {
        const [cfg, defaults] = await Promise.all([
          getProjectConfig(id),
          getProjectConfigDefaults(id).catch(() => null),
        ]);
        setConfig(cfg);
        setBrine(cfg.brine || {});
        setBrineTotalFlow(cfg.brine_total_flow ?? 0);
        setAqsolBasis((cfg.aqsol_version as AqsolVersion) || '027');
        setEntrBasis((cfg.entrainment_basis as EntrainmentBasis) || 'wet');
        setPreconPonds(cfg.precon_ponds || []);
        setPreconFaktor(cfg.precon_faktor || []);
        setEncaladoConfig((cfg.encalado_config as EncaladoConfig) || DEFAULT_ENCALADO);
        setEncaladoFaktor(cfg.encalado_faktor || []);
        setPostlimingPonds(cfg.postliming_ponds || []);
        setPostlimingFaktor(cfg.postliming_faktor || []);
        setDailySchedule(cfg.daily_schedule || []);
        setPreconDaysYear(cfg.precon_days_year ?? defaults?.precon_days_year ?? 365);
        setEncaladoDaysYear(
          cfg.encalado_days_year ??
            (cfg.encalado_config as { availability_days_year?: number } | null)
              ?.availability_days_year ??
            defaults?.encalado_days_year ??
            328.5,
        );
        setPostlimingDaysYear(cfg.postliming_days_year ?? defaults?.postliming_days_year ?? 365);
        if (defaults?.salt_names) setSaltNames(defaults.salt_names);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const safeName = (project?.name || 'proyecto').replace(/[^a-z0-9-_]+/gi, '_');
    downloadExcel(
      {
        brine,
        brine_total_flow: brineTotalFlow,
        precon_ponds: preconPonds,
        precon_faktor: preconFaktor,
        encalado_config: encaladoConfig,
        encalado_faktor: encaladoFaktor,
        postliming_ponds: postlimingPonds,
        postliming_faktor: postlimingFaktor,
        daily_schedule: dailySchedule,
        // Mismo catalogo que usan los editores: si la base es 066, el Excel
        // sale con 23 especies y 243 sales.
        species: catalog?.species,
        salt_names: catalog ? catalog.salts.map((x: { name: string }) => x.name) : saltNames,
        precon_days_year: preconDaysYear,
        encalado_days_year: encaladoDaysYear,
        postliming_days_year: postlimingDaysYear,
      },
      `config_${safeName}.xlsx`,
    );
    setSaveMsg(t('projdetail_excel_downloaded'));
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseWorkbookFile(file, catalog?.faktor_length);
      const applied: string[] = [];
      if (parsed.brine) {
        setBrine(parsed.brine);
        // Una plantilla antigua (en ton/d) llega ya convertida a % + caudal por el
        // parser, así que el caudal viene definido en ambos formatos.
        if (parsed.brine_total_flow !== undefined) setBrineTotalFlow(parsed.brine_total_flow);
        applied.push(t('projdetail_applied_brine'));
      }
      if (parsed.precon_ponds) {
        setPreconPonds(parsed.precon_ponds);
        applied.push(t('projdetail_applied_precon_ponds'));
      }
      if (parsed.precon_faktor) {
        setPreconFaktor(parsed.precon_faktor);
        applied.push(t('projdetail_applied_precon_factors'));
      }
      if (parsed.encalado_config) {
        setEncaladoConfig({ ...encaladoConfig, ...parsed.encalado_config });
        applied.push(t('projdetail_applied_reagent_plant'));
      }
      if (parsed.encalado_faktor) {
        setEncaladoFaktor(parsed.encalado_faktor);
        applied.push(t('projdetail_applied_reagent_factors'));
      }
      if (parsed.postliming_ponds) {
        setPostlimingPonds(parsed.postliming_ponds);
        applied.push(t('projdetail_applied_postliming_ponds'));
      }
      if (parsed.postliming_faktor) {
        setPostlimingFaktor(parsed.postliming_faktor);
        applied.push(t('projdetail_applied_postliming_factors'));
      }
      if (parsed.daily_schedule) {
        setDailySchedule(parsed.daily_schedule);
        applied.push(t('projdetail_applied_schedule'));
      }
      if (parsed.precon_days_year != null) setPreconDaysYear(parsed.precon_days_year);
      if (parsed.encalado_days_year != null) setEncaladoDaysYear(parsed.encalado_days_year);
      if (parsed.postliming_days_year != null) setPostlimingDaysYear(parsed.postliming_days_year);
      if (
        parsed.precon_days_year != null ||
        parsed.encalado_days_year != null ||
        parsed.postliming_days_year != null
      ) {
        applied.push(t('projdetail_applied_calendar'));
      }
      if (applied.length === 0) {
        setSaveMsg(t('projdetail_excel_no_sheets'));
      } else {
        setSaveMsg(`${t('projdetail_excel_loaded')} (${applied.join(', ')}). ${t('projdetail_save_to_apply')}`);
      }
    } catch (err) {
      setSaveMsg(`${t('projdetail_excel_read_error')}: ${(err as Error).message}`);
    }
  };

  const handleLoadDefaults = async () => {
    if (!id) return;
    try {
      const defaults = await getProjectConfigDefaults(id);
      setBrine(defaults.brine);
      setBrineTotalFlow(defaults.brine_total_flow ?? 0);
      setPreconPonds(defaults.precon_ponds);
      setPreconFaktor(defaults.precon_faktor);
      setEncaladoConfig(defaults.encalado_config as unknown as EncaladoConfig);
      setEncaladoFaktor(defaults.encalado_faktor);
      setPostlimingPonds(defaults.postliming_ponds);
      setPostlimingFaktor(defaults.postliming_faktor);
      setDailySchedule(defaults.daily_schedule);
      setPreconDaysYear(defaults.precon_days_year);
      setEncaladoDaysYear(defaults.encalado_days_year);
      setPostlimingDaysYear(defaults.postliming_days_year);
      setSaveMsg(t('projdetail_defaults_loaded'));
    } catch {
      setSaveMsg(t('projdetail_defaults_error'));
    }
  };

  // El catalogo manda que filas se editan; sin el, los editores caen a las 17
  // especies y 137 sales de la 027 (comportamiento previo).
  useEffect(() => {
    let cancelado = false;
    getAqsolCatalog(aqsolBasis)
      .then((c) => { if (!cancelado) setCatalog(c); })
      .catch(() => { if (!cancelado) setCatalog(null); });
    return () => { cancelado = true; };
  }, [aqsolBasis]);

  // La salmuera de pozo es la entrada de las etapas estáticas: si su composición no
  // cierra en 100%, el ton/día por especie no corresponde al caudal declarado. El
  // backend lo rechaza igual (422); acá se bloquea antes para que el usuario vea el
  // motivo junto a la tabla y no como un error al guardar.
  const brineOk = brineCloses(brine) && brineTotalFlow > 0;

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateProjectConfig(id, {
        aqsol_version: aqsolBasis,
        entrainment_basis: entrBasis,
        brine,
        brine_total_flow: brineTotalFlow,
        precon_ponds: preconPonds,
        precon_faktor: preconFaktor,
        encalado_config: {
          ...encaladoConfig,
          availability_days_year: encaladoDaysYear,
        } as unknown as Record<string, unknown>,
        encalado_faktor: encaladoFaktor,
        postliming_ponds: postlimingPonds,
        postliming_faktor: postlimingFaktor,
        daily_schedule: dailySchedule,
        precon_days_year: preconDaysYear,
        encalado_days_year: encaladoDaysYear,
        postliming_days_year: postlimingDaysYear,
      });
      setConfig(updated);
      setSaveMsg(t('projdetail_config_saved'));
    } catch {
      setSaveMsg(t('projdetail_config_save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card p-8 text-center">
        <p style={{ color: 'var(--color-danger)' }}>{t('projdetail_not_found')}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/projects')}
        className="inline-flex items-center gap-1 text-sm mb-3 hover:underline"
        style={{ color: 'var(--color-primary-light)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        {t('back')}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {project.name}
          </h2>
          {project.description && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {project.description}
            </p>
          )}
        </div>

        {/* Mode selector: Estático / Dinámico */}
        <div
          className="inline-flex rounded border overflow-hidden text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            className="px-3 py-1.5"
            style={{
              background: mode === 'static' ? 'var(--color-primary)' : 'transparent',
              color: mode === 'static' ? '#fff' : 'var(--color-text)',
            }}
            onClick={() => setMode('static')}
          >
            {t('static_mode')}
          </button>
          <button
            className="px-3 py-1.5"
            style={{
              background: mode === 'dynamic' ? 'var(--color-primary)' : 'transparent',
              color: mode === 'dynamic' ? '#fff' : 'var(--color-text)',
            }}
            onClick={() => setMode('dynamic')}
          >
            {t('dynamic_mode')}
          </button>
          <button
            className="px-3 py-1.5"
            style={{
              background: mode === 'inventario' ? 'var(--color-primary)' : 'transparent',
              color: mode === 'inventario' ? '#fff' : 'var(--color-text)',
            }}
            onClick={() => setMode('inventario')}
          >
            {t('inventario_mode')}
          </button>
        </div>
      </div>

      {/* Dynamic mode: replace tabs with DynamicModePanel */}
      {mode === 'dynamic' && (
        <DynamicModePanel projectId={project.id} isAdmin={isAdmin} />
      )}

      {/* Modo con inventario: mismo trato que el dinámico, panel propio */}
      {mode === 'inventario' && (
        <InventarioModePanel projectId={project.id} isAdmin={isAdmin} />
      )}

      {/* Static mode: existing tabs */}
      {mode === 'static' && (
      <>
      {/* Tabs */}
      <div
        className="flex gap-0 border-b mb-6"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {isAdmin && (
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'config' ? 'border-current' : 'border-transparent'
            }`}
            style={{
              color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === 'config' ? 'var(--color-primary)' : 'transparent',
            }}
            onClick={() => setActiveTab('config')}
          >
            {t('configuration')}
          </button>
        )}
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'executions' ? 'border-current' : 'border-transparent'
          }`}
          style={{
            color: activeTab === 'executions' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderColor: activeTab === 'executions' ? 'var(--color-primary)' : 'transparent',
          }}
          onClick={() => setActiveTab('executions')}
        >
          {t('executions')}
        </button>
      </div>

      {/* Config Tab (Admin only) */}
      {activeTab === 'config' && isAdmin && (
        <div>
          {/* Config action buttons */}
          <div className="flex justify-end mb-3 gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportFile}
              className="hidden"
            />
            <button className="btn btn-outline btn-sm" onClick={handleDownloadTemplate}>
              {t('download_excel')}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleImportClick}>
              {t('upload_excel')}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleLoadDefaults}>
              {t('load_defaults')}
            </button>
          </div>

          <SectionHeader
            title={t('projdetail_section_calendar')}
            isOpen={openSections.calendar}
            onToggle={() => toggleSection('calendar')}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: t('stage_precon'), value: preconDaysYear, set: setPreconDaysYear, hint: t('projdetail_calendar_hint_precon') },
                { label: t('stage_reagent_plant'), value: encaladoDaysYear, set: setEncaladoDaysYear, hint: t('projdetail_calendar_hint_reagent') },
                { label: t('stage_postliming'), value: postlimingDaysYear, set: setPostlimingDaysYear, hint: t('projdetail_calendar_hint_postliming') },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                    {f.label}
                  </label>
                  <input
                    type="number"
                    className="input input-number w-full"
                    step={0.5}
                    min={0}
                    max={365}
                    value={f.value}
                    onChange={(e) => f.set(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.hint}
                  </p>
                </div>
              ))}
            </div>
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_brine')}
            isOpen={openSections.brine}
            onToggle={() => toggleSection('brine')}
          >
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div>
                <label className="label" title={t('aqsol_basis_tip')}>
                  {t('aqsol_basis')}
                </label>
                <select
                  className="input w-40"
                  value={aqsolBasis}
                  onChange={(e) => setAqsolBasis(e.target.value as AqsolVersion)}
                  title={t('aqsol_basis_tip')}
                >
                  {AQSOL_VERSIONS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {catalog
                  ? `${catalog.species.length} ${t('aqsol_basis_species')} · ${catalog.salts.length} ${t('aqsol_basis_salts')}`
                  : ''}
              </p>
            </div>
            <BrineEditor
              value={brine}
              onChange={setBrine}
              totalFlow={brineTotalFlow}
              onTotalFlowChange={setBrineTotalFlow}
              species={catalog?.species}
            />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_precon_ponds')}
            isOpen={openSections.precon_ponds}
            onToggle={() => toggleSection('precon_ponds')}
          >
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div>
                <label className="label" title={t('entr_basis_tip')}>
                  {t('entr_basis')}
                </label>
                <select
                  className="input w-44"
                  value={entrBasis}
                  onChange={(e) => setEntrBasis(e.target.value as EntrainmentBasis)}
                  title={t('entr_basis_tip')}
                >
                  <option value="wet">{t('entr_basis_wet')}</option>
                  <option value="dry">{t('entr_basis_dry')}</option>
                </select>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {entrBasis === 'wet' ? '25% → 333 kg/t' : '25% → 250 kg/t'}
              </p>
            </div>
            <PondEditor value={preconPonds} onChange={setPreconPonds} label={t('projdetail_label_precon_ponds')} />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_precon_factors')}
            isOpen={openSections.precon_faktor}
            onToggle={() => toggleSection('precon_faktor')}
          >
            <SaltFactorEditor value={preconFaktor} onChange={setPreconFaktor} saltNames={catalog ? catalog.salts.map((x: { name: string }) => x.name) : saltNames} />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_reagent_params')}
            isOpen={openSections.encalado}
            onToggle={() => toggleSection('encalado')}
          >
            <EncaladoConfigForm value={encaladoConfig} onChange={setEncaladoConfig} />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_reagent_factors')}
            isOpen={openSections.encalado_faktor}
            onToggle={() => toggleSection('encalado_faktor')}
          >
            <SaltFactorEditor value={encaladoFaktor} onChange={setEncaladoFaktor} saltNames={catalog ? catalog.salts.map((x: { name: string }) => x.name) : saltNames} />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_postliming_ponds')}
            isOpen={openSections.postliming_ponds}
            onToggle={() => toggleSection('postliming_ponds')}
          >
            <PondEditor value={postlimingPonds} onChange={setPostlimingPonds} label={t('projdetail_label_postliming_ponds')} />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_postliming_factors')}
            isOpen={openSections.postliming_faktor}
            onToggle={() => toggleSection('postliming_faktor')}
          >
            <SaltFactorEditor value={postlimingFaktor} onChange={setPostlimingFaktor} saltNames={catalog ? catalog.salts.map((x: { name: string }) => x.name) : saltNames} />
          </SectionHeader>

          <SectionHeader
            title={t('projdetail_section_schedule')}
            isOpen={openSections.schedule}
            onToggle={() => toggleSection('schedule')}
          >
            <DailyScheduleEditor
              value={dailySchedule}
              onChange={setDailySchedule}
              defaultFlow={brineTotalFlow}
            />
          </SectionHeader>

          {/* Save button */}
          <div className="flex items-center gap-3 mt-4">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !brineOk}
              title={brineOk ? undefined : t('brine_sum_error')}
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('saving')}
                </>
              ) : (
                t('projdetail_save_config')
              )}
            </button>
            {saveMsg && (
              <p
                className="text-sm"
                style={{
                  color: saveMsg.includes('Error')
                    ? 'var(--color-danger)'
                    : 'var(--color-success)',
                }}
              >
                {saveMsg}
              </p>
            )}
          </div>

          {/* Run Simulation Panel */}
          <RunSimulationPanel
            projectId={project.id}
            disabled={!brineOk}
            disabledReason={t('brine_sum_error')}
            onExecutionCreated={() => {
              setActiveTab('executions');
              setRefreshExecKey((k) => k + 1);
            }}
          />
        </div>
      )}

      {/* Executions Tab */}
      {activeTab === 'executions' && (
        <ExecutionList key={refreshExecKey} projectId={project.id} />
      )}
      </>
      )}
    </div>
  );
}
