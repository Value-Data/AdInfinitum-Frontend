/**
 * Un proyecto en F4: configuración (secciones, Excel, parámetros de reporte) y
 * ejecuciones (lanzar y seguir). Reemplaza a la pantalla de antes, que editaba la
 * config en JSON del proyecto.
 */
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  apiError, getProjectV2, getSectionStates, isV2Type, listExecutions,
  type ExecutionSummary, type ProjectV2, type SectionState,
} from '../services/apiV2';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfigPanel, { type LaunchDefaults } from './ConfigPanel';
import LaunchPanel from './LaunchPanel';
import { RunStatusBadge, executionTypeLabel, formatDateTime } from './common';

// Las pantallas de la versión anterior (y sus dependencias: xlsx, recharts) van en un
// chunk aparte: solo se cargan al entrar a la pestaña de ejecuciones.
const LegacyExecutionsSection = lazy(() => import('../legacy/LegacyExecutionsSection'));

const POLL_MS = 5000;

/** Cuánto tardó (o lleva) una corrida: "1 h 05 min", "3 min 20 s". */
export function duration(desde?: string | null, hasta?: string | null, ahora = Date.now()): string {
  if (!desde) return '–';
  const t0 = Date.parse(desde.endsWith('Z') || desde.includes('+') ? desde : `${desde}Z`);
  const t1 = hasta ? Date.parse(hasta.endsWith('Z') || hasta.includes('+') ? hasta : `${hasta}Z`) : ahora;
  const s = Math.max(0, Math.round((t1 - t0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}

function ExecutionsTable({ executions }: { executions: ExecutionSummary[] }) {
  const t = useT();
  if (executions.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_no_executions')}</p>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th>{t('f6_execution_type')}</th>
            <th>{t('status')}</th>
            <th>{t('f6_run_tag')}</th>
            <th>{t('f6_days')}</th>
            <th>{t('f6_created')}</th>
            <th>{t('f6_duration')}</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((e) => (
            <tr key={e.id}>
              <td>
                <Link to={`/executions/${e.id}`} style={{ color: 'var(--color-primary)' }}>
                  {executionTypeLabel(e.execution_type, t)}
                </Link>
              </td>
              <td><RunStatusBadge status={e.status} /></td>
              <td className="font-mono">{e.run_tag}</td>
              <td className="font-mono">
                {e.n_days != null ? `${e.last_completed_day ?? 0}/${e.n_days}` : '–'}
              </td>
              <td className="font-mono">{formatDateTime(e.created_at)}</td>
              <td className="font-mono">{duration(e.started_at, e.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProjectPage() {
  const { id = '' } = useParams<{ id: string }>();
  const t = useT();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') === 'executions' ? 'executions' : 'config';
  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [sections, setSections] = useState<SectionState[]>([]);
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Fecha y días del último escenario de inventario cargado: precargan Lanzar.
  const [precarga, setPrecarga] = useState<LaunchDefaults | null>(null);

  const cargarSecciones = useCallback(() => {
    getSectionStates(id).then(setSections).catch(() => setSections([]));
  }, [id]);
  const cargarEjecuciones = useCallback(() => {
    listExecutions(id).then((l) => setExecutions(l.filter((e) => isV2Type(e.execution_type))))
      .catch(() => setExecutions([]));
  }, [id]);

  useEffect(() => {
    getProjectV2(id).then(setProject).catch((err) => setError(apiError(err).message));
    cargarSecciones();
    cargarEjecuciones();
  }, [id, cargarSecciones, cargarEjecuciones]);

  const activas = executions.some((e) => e.status === 'pending' || e.status === 'running');
  useEffect(() => {
    if (!activas) return undefined;
    const timer = setInterval(cargarEjecuciones, POLL_MS);
    return () => clearInterval(timer);
  }, [activas, cargarEjecuciones]);

  if (error) return <div className="card p-4">{error}</div>;
  if (!project) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <div className="mb-4">
        <Link to="/projects" className="text-sm" style={{ color: 'var(--color-primary)' }}>← {t('back')}</Link>
      </div>
      <div className="flex flex-wrap items-baseline gap-3 mb-1">
        <h2 className="text-xl font-semibold">{project.name}</h2>
        <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
          AQSOL {project.aqsol_version}
        </span>
      </div>
      {project.description && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{project.description}</p>
      )}
      <div className="flex gap-2 mb-4 border-b" style={{ borderColor: 'var(--color-border)' }} role="tablist">
        {(['config', 'executions'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k}
                  className={`px-3 py-2 text-sm ${tab === k ? 'font-semibold' : ''}`}
                  style={tab === k ? { borderBottom: '2px solid var(--color-primary)' } : undefined}
                  onClick={() => setSearch(k === 'config' ? {} : { tab: k })}>
            {k === 'config' ? t('configuration') : t('executions')}
          </button>
        ))}
      </div>
      {tab === 'config' ? (
        <ConfigPanel projectId={id} sections={sections} onChanged={cargarSecciones}
                     aqsolVersion={project.aqsol_version} onInventoryLoaded={setPrecarga} />
      ) : (
        <>
          {isAdmin && (
            <LaunchPanel projectId={id} executions={executions} sections={sections}
                         defaults={precarga} onLaunched={() => cargarEjecuciones()} />
          )}
          <ExecutionsTable executions={executions} />
          <Suspense fallback={null}>
            <LegacyExecutionsSection projectId={id} projectName={project.name} isAdmin={isAdmin} />
          </Suspense>
        </>
      )}
    </div>
  );
}
