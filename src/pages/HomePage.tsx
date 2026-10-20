/**
 * Portada después del login: la entrada al módulo de simulación, los otros módulos que el
 * rol del usuario puede usar (y dónde viven) y los proyectos con actividad más reciente.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';
import { getProjects } from '../services/api';
import { apiError } from '../services/apiV2';
import { usePageTrail } from '../components/common/trail';
import { RunStatusBadge } from '../f6/common';
import { canDo } from '../f6/executionTabs';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import PondsIllustration from '../media/PondsIllustration';

const RECIENTES = 6;

/** Los proyectos con actividad más reciente primero (la lista no trae la fecha de la
 * última ejecución: `updated_at` es lo más cercano). */
export function recientes(projects: Project[], n = RECIENTES): Project[] {
  const cuando = (p: Project) => Date.parse(p.updated_at || p.created_at) || 0;
  return [...projects].sort((a, b) => cuando(b) - cuando(a)).slice(0, n);
}

/** "2026-10-19T21:10:00" (UTC sin zona, como lo manda el backend) → "19-10-2026". */
function fecha(s: string): string {
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? '–'
    : d.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const Flecha = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const MODOS: [TranslationKey, TranslationKey][] = [
  ['f8_home_mode_static', 'f8_home_mode_static_desc'],
  ['f8_home_mode_dynamic', 'f8_home_mode_dynamic_desc'],
  ['f8_home_mode_chain', 'f8_home_mode_chain_desc'],
];

function Modulo({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{desc}</p>
      <div className="mt-4 text-sm">{children}</div>
    </div>
  );
}

/** Un módulo sin pantalla propia: se dice dónde está, sin enlace inventado. */
function Ubicacion({ ruta }: { ruta: string }) {
  const t = useT();
  return (
    <p style={{ color: 'var(--color-text-secondary)' }}>
      {t('f8_home_where')}: <span className="font-medium" style={{ color: 'var(--color-text)' }}>{ruta}</span>
    </p>
  );
}

function ProyectoReciente({ project, conRol }: { project: Project; conRol: boolean }) {
  const t = useT();
  const detalle = [project.client, conRol && project.my_role ? t(`f7_role_${project.my_role}` as TranslationKey) : null]
    .filter(Boolean).join(' · ');
  return (
    <Link
      to={`/projects/${project.id}`}
      className="card group flex h-full flex-col p-4 transition-colors hover:border-primary-light hover:shadow-card-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium leading-snug group-hover:underline" style={{ color: 'var(--color-primary)' }}>
          {project.name}
        </span>
        {project.aqsol_version && (
          <span className="shrink-0 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            AQSOL {project.aqsol_version}
          </span>
        )}
      </div>
      {detalle && (
        <span className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{detalle}</span>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs">
        {project.last_execution_status ? (
          <RunStatusBadge status={project.last_execution_status} />
        ) : (
          <span style={{ color: 'var(--color-text-secondary)' }}>{t('projects_no_executions')}</span>
        )}
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {t('f8_home_updated')} <span className="font-mono">{fecha(project.updated_at)}</span>
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const t = useT();
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loc = useLocation();
  usePageTrail(loc.pathname, [{ label: t('f8_nav_home') }]);

  // La portada hace de bienvenida: el aviso de bienvenida de Proyectos no se repite en
  // esta sesión.
  useEffect(() => {
    sessionStorage.removeItem('adinf_show_welcome');
    sessionStorage.setItem('adinf_welcomed', '1');
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await getProjects());
      setLoadError(null);
    } catch (err) {
      setLoadError(apiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Lo que el rol permite en algún proyecto: el cliente (solo resultados) no ve los
  // módulos de configuración ni la comparación.
  const algun = (cap: string) => isAdmin || projects.some((p) => canDo(p.capabilities, cap));
  const verComparar = algun('view_logs');
  const verInventario = algun('view_config');
  const conModulos = !loading && (verComparar || verInventario || isAdmin);
  const lista = recientes(projects);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('f8_home_greeting').replace('{name}', user?.username ?? '')}
        </h1>
        {user && (
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full" data-testid="home-role"
                style={{ backgroundColor: 'var(--color-primary-lighter)', color: 'var(--color-primary)' }}>
            {isAdmin ? t('users_role_admin_full') : t('users_role_user')}
          </span>
        )}
      </header>

      {/* Entrada principal: el módulo de simulación. */}
      <section className="card overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_26rem]"
               aria-labelledby="home-sim-title">
        <div className="flex flex-col p-6 lg:p-8">
          <h2 id="home-sim-title" className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-primary)' }}>
            {t('f8_home_sim_title')}
          </h2>
          <p className="mt-2 max-w-prose text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('f8_home_sim_desc')}
          </p>
          <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {MODOS.map(([titulo, desc]) => (
              <div key={titulo} className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                <dt className="text-sm font-semibold">{t(titulo)}</dt>
                <dd className="mt-1 text-sm leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{t(desc)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8">
            <Link to="/projects" className="btn btn-primary h-11 px-6 text-sm">
              {t('f8_home_sim_cta')}
              <Flecha />
            </Link>
          </div>
        </div>
        <div className="hidden p-6 lg:flex lg:items-center" style={{ backgroundColor: 'var(--color-primary)' }}>
          <div className="w-full overflow-hidden" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)' }}>
            <PondsIllustration className="block h-auto w-full" />
          </div>
        </div>
      </section>

      {conModulos && (
        <section aria-labelledby="home-modules-title">
          <h2 id="home-modules-title" className="mb-3 text-lg font-semibold">{t('f8_home_modules')}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {verComparar && (
              <Modulo title={t('f8_home_compare_title')} desc={t('f8_home_compare_desc')}>
                <Ubicacion ruta={t('f8_home_compare_where')} />
              </Modulo>
            )}
            {verInventario && (
              <Modulo title={t('f8_home_inventory_title')} desc={t('f8_home_inventory_desc')}>
                <Ubicacion ruta={t('f8_home_inventory_where')} />
              </Modulo>
            )}
            {isAdmin && (
              <Modulo title={t('f8_home_users_title')} desc={t('f8_home_users_desc')}>
                <Link to="/users" className="inline-flex items-center gap-1.5 font-medium hover:underline"
                      style={{ color: 'var(--color-primary)' }}>
                  {t('f8_home_users_cta')}
                  <Flecha />
                </Link>
              </Modulo>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="home-recent-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-recent-title" className="text-lg font-semibold">{t('f8_home_recent')}</h2>
          {lista.length > 0 && (
            <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: 'var(--color-primary)' }}>
              {t('f8_home_all_projects')}
              <Flecha />
            </Link>
          )}
        </div>

        {loading ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" data-testid="home-recent-loading">
            <li className="sr-only">{t('loading')}</li>
            {[0, 1, 2].map((i) => (
              <li key={i} className="card p-4 motion-safe:animate-pulse" aria-hidden="true">
                <div className="h-4 w-2/3 rounded" style={{ backgroundColor: 'var(--color-bg)' }} />
                <div className="mt-2 h-3 w-1/3 rounded" style={{ backgroundColor: 'var(--color-bg)' }} />
                <div className="mt-5 h-5 w-24 rounded" style={{ backgroundColor: 'var(--color-bg)' }} />
              </li>
            ))}
          </ul>
        ) : loadError ? (
          <div className="card flex flex-wrap items-center gap-3 p-4 text-sm" role="alert">
            <span style={{ color: 'var(--color-danger)' }}>{t('f7_projects_load_error')}: {loadError}</span>
            <button className="btn btn-outline btn-sm" onClick={fetchProjects}>{t('f7_retry')}</button>
          </div>
        ) : lista.length === 0 ? (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-6">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {isAdmin ? t('projects_empty_admin') : t('projects_empty_user')}
            </p>
            {isAdmin && (
              <Link to="/projects" className="btn btn-outline btn-sm">{t('f8_home_go_projects')}</Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((p) => (
              <li key={p.id}><ProyectoReciente project={p} conRol={!isAdmin} /></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
