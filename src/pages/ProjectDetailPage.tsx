import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  updateProjectConfig,
  getProjectConfigDefaults,
} from '../services/api';
import BrineEditor from '../components/BrineEditor';
import PondEditor from '../components/PondEditor';
import SaltFactorEditor from '../components/SaltFactorEditor';
import EncaladoConfigForm from '../components/EncaladoConfigForm';
import DailyScheduleEditor from '../components/DailyScheduleEditor';
import ExecutionList from '../components/ExecutionList';
import RunSimulationPanel from '../components/RunSimulationPanel';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { downloadExcel, parseWorkbookFile } from '../utils/configExcel';

type TabKey = 'config' | 'executions';

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
  const { isAdmin } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(isAdmin ? 'config' : 'executions');
  const [refreshExecKey, setRefreshExecKey] = useState(0);

  // Local config state for editing
  const [brine, setBrine] = useState<Record<string, number>>({});
  const [preconPonds, setPreconPonds] = useState<PondConfig[]>([]);
  const [preconFaktor, setPreconFaktor] = useState<number[]>([]);
  const [encaladoConfig, setEncaladoConfig] = useState<EncaladoConfig>(DEFAULT_ENCALADO);
  const [encaladoFaktor, setEncaladoFaktor] = useState<number[]>([]);
  const [postlimingPonds, setPostlimingPonds] = useState<PondConfig[]>([]);
  const [postlimingFaktor, setPostlimingFaktor] = useState<number[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleItem[]>([]);
  const [saltNames, setSaltNames] = useState<string[]>([]);
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
        precon_ponds: preconPonds,
        precon_faktor: preconFaktor,
        encalado_config: encaladoConfig,
        encalado_faktor: encaladoFaktor,
        postliming_ponds: postlimingPonds,
        postliming_faktor: postlimingFaktor,
        daily_schedule: dailySchedule,
        salt_names: saltNames,
        precon_days_year: preconDaysYear,
        encalado_days_year: encaladoDaysYear,
        postliming_days_year: postlimingDaysYear,
      },
      `config_${safeName}.xlsx`,
    );
    setSaveMsg('Plantilla Excel descargada.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseWorkbookFile(file);
      const applied: string[] = [];
      if (parsed.brine) {
        setBrine(parsed.brine);
        applied.push('salmuera');
      }
      if (parsed.precon_ponds) {
        setPreconPonds(parsed.precon_ponds);
        applied.push('pozas precon');
      }
      if (parsed.precon_faktor) {
        setPreconFaktor(parsed.precon_faktor);
        applied.push('factores precon');
      }
      if (parsed.encalado_config) {
        setEncaladoConfig({ ...encaladoConfig, ...parsed.encalado_config });
        applied.push('encalado');
      }
      if (parsed.encalado_faktor) {
        setEncaladoFaktor(parsed.encalado_faktor);
        applied.push('factores encalado');
      }
      if (parsed.postliming_ponds) {
        setPostlimingPonds(parsed.postliming_ponds);
        applied.push('pozas post-liming');
      }
      if (parsed.postliming_faktor) {
        setPostlimingFaktor(parsed.postliming_faktor);
        applied.push('factores post-liming');
      }
      if (parsed.daily_schedule) {
        setDailySchedule(parsed.daily_schedule);
        applied.push('cronograma');
      }
      if (parsed.precon_days_year != null) setPreconDaysYear(parsed.precon_days_year);
      if (parsed.encalado_days_year != null) setEncaladoDaysYear(parsed.encalado_days_year);
      if (parsed.postliming_days_year != null) setPostlimingDaysYear(parsed.postliming_days_year);
      if (
        parsed.precon_days_year != null ||
        parsed.encalado_days_year != null ||
        parsed.postliming_days_year != null
      ) {
        applied.push('calendario');
      }
      if (applied.length === 0) {
        setSaveMsg('Error: el archivo no contiene hojas reconocidas.');
      } else {
        setSaveMsg(`Excel cargado (${applied.join(', ')}). Guarde para aplicar.`);
      }
    } catch (err) {
      setSaveMsg(`Error al leer el Excel: ${(err as Error).message}`);
    }
  };

  const handleLoadDefaults = async () => {
    if (!id) return;
    try {
      const defaults = await getProjectConfigDefaults(id);
      setBrine(defaults.brine);
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
      setSaveMsg('Valores por defecto cargados. Guarde para aplicar.');
    } catch {
      setSaveMsg('Error al cargar valores por defecto');
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateProjectConfig(id, {
        brine,
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
      setSaveMsg('Configuracion guardada exitosamente.');
    } catch {
      setSaveMsg('Error al guardar la configuracion.');
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
        <p style={{ color: 'var(--color-danger)' }}>Proyecto no encontrado.</p>
      </div>
    );
  }

  return (
    <div>
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
      </div>

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
            Configuracion
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
          Ejecuciones
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
              Descargar Excel
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleImportClick}>
              Cargar desde Excel
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleLoadDefaults}>
              Cargar valores por defecto
            </button>
          </div>

          <SectionHeader
            title="0. Calendario Operativo (dias/ano)"
            isOpen={openSections.calendar}
            onToggle={() => toggleSection('calendar')}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Preconcentracion', value: preconDaysYear, set: setPreconDaysYear, hint: 'Pozas operan continuo (default 365).' },
                { label: 'Encalado', value: encaladoDaysYear, set: setEncaladoDaysYear, hint: 'Disponibilidad de planta (default 328.5).' },
                { label: 'Postliming', value: postlimingDaysYear, set: setPostlimingDaysYear, hint: 'Pozas operan continuo (default 365).' },
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
            title="1. Salmuera de Pozo"
            isOpen={openSections.brine}
            onToggle={() => toggleSection('brine')}
          >
            <BrineEditor value={brine} onChange={setBrine} />
          </SectionHeader>

          <SectionHeader
            title="2. Pozas de Preconcentracion"
            isOpen={openSections.precon_ponds}
            onToggle={() => toggleSection('precon_ponds')}
          >
            <PondEditor value={preconPonds} onChange={setPreconPonds} label="Pozas preconcentracion" />
          </SectionHeader>

          <SectionHeader
            title="3. Factores de Sales Preconcentracion"
            isOpen={openSections.precon_faktor}
            onToggle={() => toggleSection('precon_faktor')}
          >
            <SaltFactorEditor value={preconFaktor} onChange={setPreconFaktor} saltNames={saltNames} />
          </SectionHeader>

          <SectionHeader
            title="4. Parametros de Encalado"
            isOpen={openSections.encalado}
            onToggle={() => toggleSection('encalado')}
          >
            <EncaladoConfigForm value={encaladoConfig} onChange={setEncaladoConfig} />
          </SectionHeader>

          <SectionHeader
            title="5. Factores de Sales Encalado"
            isOpen={openSections.encalado_faktor}
            onToggle={() => toggleSection('encalado_faktor')}
          >
            <SaltFactorEditor value={encaladoFaktor} onChange={setEncaladoFaktor} saltNames={saltNames} />
          </SectionHeader>

          <SectionHeader
            title="6. Pozas de Post-liming"
            isOpen={openSections.postliming_ponds}
            onToggle={() => toggleSection('postliming_ponds')}
          >
            <PondEditor value={postlimingPonds} onChange={setPostlimingPonds} label="Pozas post-liming" />
          </SectionHeader>

          <SectionHeader
            title="7. Factores de Sales Post-liming"
            isOpen={openSections.postliming_faktor}
            onToggle={() => toggleSection('postliming_faktor')}
          >
            <SaltFactorEditor value={postlimingFaktor} onChange={setPostlimingFaktor} saltNames={saltNames} />
          </SectionHeader>

          <SectionHeader
            title="8. Cronograma Diario"
            isOpen={openSections.schedule}
            onToggle={() => toggleSection('schedule')}
          >
            <DailyScheduleEditor value={dailySchedule} onChange={setDailySchedule} />
          </SectionHeader>

          {/* Save button */}
          <div className="flex items-center gap-3 mt-4">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuracion'
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
    </div>
  );
}
