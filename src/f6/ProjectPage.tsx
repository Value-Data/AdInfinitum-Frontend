/**
 * Un proyecto en F4: configuración (secciones, Excel, parámetros de reporte) y
 * ejecuciones (lanzar y seguir). Reemplaza a la pantalla de antes, que editaba la
 * config en JSON del proyecto.
 */
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Pager, pageSlice } from './paging';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { usePageTrail } from '../components/common/trail';
import {
  apiError, getProjectV2, getSectionStates, isV2Type, listExecutions,
  type ExecutionSummary, type ProjectV2, type SectionState,
} from '../services/apiV2';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfigPanel from './ConfigPanel';
import LaunchPanel from './LaunchPanel';
import { canDo } from './executionTabs';
import ProjectEditModal from './ProjectEditModal';
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
  const [pagina, setPagina] = useState(0);
  const hoja = pageSlice(executions, pagina);
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
          {hoja.items.map((e) => (
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
      <Pager {...hoja} total={executions.length} onPage={setPagina} />
    </div>
  );
}

export default function ProjectPage() {
  const { id = '' } = useParams<{ id: string }>();
  const t = useT();
  const { isAdmin } = useAuth();
  const [editando, setEditando] = useState(false);
  const [search, setSearch] = useSearchParams();
  const tabPedida = search.get('tab') === 'executions' ? 'executions' : 'config';
  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [sections, setSections] = useState<SectionState[]>([]);
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Antes un error dejaba la lista vacía en silencio; ahora se dice.
  const [errorSecciones, setErrorSecciones] = useState<string | null>(null);
  const [errorEjecuciones, setErrorEjecuciones] = useState<string | null>(null);
  const cargarSecciones = useCallback(() => {
    getSectionStates(id).then((l) => { setSections(l); setErrorSecciones(null); })
      .catch((err) => { setSections([]); setErrorSecciones(apiError(err).message); });
  }, [id]);
  const cargarEjecuciones = useCallback(() => {
    listExecutions(id).then((l) => { setExecutions(l.filter((e) => isV2Type(e.execution_type))); setErrorEjecuciones(null); })
      .catch((err) => { setExecutions([]); setErrorEjecuciones(apiError(err).message); });
  }, [id]);

  useEffect(() => {
    getProjectV2(id).then(setProject).catch((err) => setError(apiError(err).message));
    cargarSecciones();
    cargarEjecuciones();
  }, [id, cargarSecciones, cargarEjecuciones]);

  const loc = useLocation();
  usePageTrail(loc.pathname, [{ label: t('topbar_projects'), path: '/projects' },
    project ? { label: project.name } : null]);

  const activas = executions.some((e) => e.status === 'pending' || e.status === 'running');
  useEffect(() => {
    if (!activas) return undefined;
    const timer = setInterval(cargarEjecuciones, POLL_MS);
    return () => clearInterval(timer);
  }, [activas, cargarEjecuciones]);

  if (error) return <div className="card p-4">{error}</div>;
  if (!project) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  // Lo que el rol permite: el cliente no ve la configuración y abre directo en las ejecuciones.
  const caps = project.capabilities ?? [];
  const conConfig = canDo(caps, 'view_config');
  const tab = conConfig ? tabPedida : 'executions';
  const tabs = conConfig ? (['config', 'executions'] as const) : (['executions'] as const);

  return (
    <div>
      <div className="mb-4">
        <Link to="/projects" className="text-sm" style={{ color: 'var(--color-primary)' }}>← {t('back')}</Link>
      </div>
      <div className="flex flex-wrap items-baseline gap-3 mb-1">
        <h2 className="text-xl font-semibold">{project.name}</h2>
        {project.client && (
          <span className="text-sm font-medium" data-testid="project-client"
                style={{ color: 'var(--color-text-secondary)' }}>{project.client}</span>
        )}
        <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
          AQSOL {project.aqsol_version}
        </span>
        {project.my_role && (
          <span className="text-xs px-2 py-0.5 rounded-full" data-testid="my-role"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                title={t('f7_my_role')}>
            {t(`f7_role_${project.my_role}` as never)}
          </span>
        )}
        {isAdmin && (
          <button type="button" className="btn btn-outline btn-sm" data-testid="edit-project"
                  aria-label={t('f8_project_edit')} title={t('f8_project_edit')}
                  onClick={() => setEditando(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            {t('f8_edit')}
          </button>
        )}
      </div>
      {project.description && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{project.description}</p>
      )}
      <ProjectEditModal project={editando ? project : null} onClose={() => setEditando(false)}
                        onSaved={(p) => { setProject(p); setEditando(false); }} />
      <div className="flex gap-2 mb-4 border-b" style={{ borderColor: 'var(--color-border)' }} role="tablist">
        {tabs.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k}
                  className={`px-3 py-2 text-sm ${tab === k ? 'font-semibold' : ''}`}
                  style={tab === k ? { borderBottom: '2px solid var(--color-primary)' } : undefined}
                  onClick={() => setSearch(k === 'config' ? {} : { tab: k })}>
            {k === 'config' ? t('configuration') : t('executions')}
          </button>
        ))}
      </div>
      {(tab === 'config' ? errorSecciones : errorEjecuciones) && (
        <div className="card p-3 mb-4 text-sm flex items-center gap-3" role="alert" style={{ borderColor: '#fca5a5' }}>
          <span style={{ color: 'var(--color-danger)' }}>{tab === 'config' ? errorSecciones : errorEjecuciones}</span>
          <button className="btn btn-outline btn-sm"
                  onClick={tab === 'config' ? cargarSecciones : cargarEjecuciones}>{t('f7_retry')}</button>
        </div>
      )}
      {tab === 'config' ? (
        <ConfigPanel projectId={id} sections={sections} onChanged={cargarSecciones} />
      ) : (
        <>
          {canDo(caps, 'launch') && (
            <LaunchPanel projectId={id} executions={executions} sections={sections}
                         onLaunched={() => cargarEjecuciones()} />
          )}
          <ExecutionsTable executions={executions} />
          {canDo(caps, 'view_legacy') && (
            <Suspense fallback={null}>
              <LegacyExecutionsSection projectId={id} projectName={project.name} isAdmin={isAdmin} />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
