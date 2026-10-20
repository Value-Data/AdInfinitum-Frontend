import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';
import { getProjects } from '../services/api';
import { createProjectV2, deleteProjectV2, apiError } from '../services/apiV2';
import Modal from '../components/common/Modal';
import { RunStatusBadge } from '../f6/common';
import LoadingSpinner from '../components/common/LoadingSpinner';
import WelcomeOverlay from '../components/common/WelcomeOverlay';
import { useT } from '../i18n/LanguageContext';
import ProjectEditModal, { ClientInput } from '../f6/ProjectEditModal';

const NO_CLIENT = '__sin_cliente__';
// Nombre, descripción, AQSOL, creado, última corrida y (rol | acciones).
const N_COLS = 6;

export default function ProjectsPage() {
  const t = useT();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newClient, setNewClient] = useState('');
  const [editando, setEditando] = useState<Project | null>(null);
  // Filtros de la lista (F8): texto libre y cliente ('' = todos, NO_CLIENT = sin cliente).
  const [filtro, setFiltro] = useState('');
  const [clienteSel, setClienteSel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newVersion, setNewVersion] = useState<'027' | '066'>('027');
  const [createError, setCreateError] = useState<string | null>(null);
  // Borrar pide dos clics en el mismo proyecto.
  const [aBorrar, setABorrar] = useState<string | null>(null);
  const borrar = async (id: string) => {
    if (aBorrar !== id) { setABorrar(id); return; }
    try {
      await deleteProjectV2(id);
      setABorrar(null);
      fetchProjects();
    } catch (err) {
      setCreateError(apiError(err).message);
    }
  };
  // Show the welcome overlay once per session: either right after an explicit
  // login (flag set by LoginPage) or on the first landing on Projects when the
  // session is already authenticated (persisted token).
  // NOTE: the initializer only READS the flags (no side effects) so it is safe
  // under React StrictMode double-mounting; the flags are consumed on close.
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    const loginFlag = sessionStorage.getItem('adinf_show_welcome') === '1';
    const alreadyWelcomed = sessionStorage.getItem('adinf_welcomed') === '1';
    return loginFlag || !alreadyWelcomed;
  });

  const closeWelcome = useCallback(() => {
    sessionStorage.removeItem('adinf_show_welcome');
    sessionStorage.setItem('adinf_welcomed', '1');
    setShowWelcome(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
      setLoadError(null);
    } catch (err) {
      // Antes se tragaba el error y se veía "No tiene proyectos asignados".
      setLoadError(apiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProjectV2({ name: newName, description: newDesc || undefined,
                              client: newClient.trim() || null, aqsol_version: newVersion });
      setShowCreate(false);
      setCreateError(null);
      setNewName('');
      setNewDesc('');
      setNewClient('');
      fetchProjects();
    } catch (err) {
      setCreateError(apiError(err).message);
    } finally {
      setCreating(false);
    }
  };

  // Clientes en uso, para el selector y las sugerencias.
  const clientes = useMemo(
    () => [...new Set(projects.map((p) => p.client).filter((c): c is string => !!c))]
      .sort((a, b) => a.localeCompare(b, 'es')),
    [projects],
  );
  // Grupos por cliente en el orden del backend (por cliente, los sin cliente al final).
  const grupos = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const visibles = projects.filter((p) => {
      if (clienteSel === NO_CLIENT && p.client) return false;
      if (clienteSel && clienteSel !== NO_CLIENT && p.client !== clienteSel) return false;
      return !q || [p.name, p.description, p.client].some((v) => v?.toLowerCase().includes(q));
    });
    const mapa = new Map<string, Project[]>();
    for (const p of visibles) {
      const k = p.client ?? '';
      mapa.set(k, [...(mapa.get(k) ?? []), p]);
    }
    return [...mapa.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'es')));
  }, [projects, filtro, clienteSel]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {showWelcome && <WelcomeOverlay onClose={closeWelcome} />}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('projects_title')}
        </h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            {t('projects_new')}
          </button>
        )}
      </div>

      {loadError ? (
        <div className="card p-6 text-center" role="alert">
          <p className="mb-3" style={{ color: 'var(--color-danger)' }}>
            {t('f7_projects_load_error')}: {loadError}
          </p>
          <button className="btn btn-outline" onClick={() => { setLoading(true); fetchProjects(); }}>
            {t('f7_retry')}
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-8 text-center">
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {isAdmin
              ? t('projects_empty_admin')
              : t('projects_empty_user')}
          </p>
        </div>
      ) : (
        <>
        <div className="flex flex-wrap gap-2 mb-3" role="search">
          <input type="search" className="input" style={{ maxWidth: '22rem' }} data-testid="project-filter"
                 aria-label={t('f8_search_projects')} placeholder={t('f8_search_projects')}
                 value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          {clientes.length > 0 && (
            <select className="input" style={{ maxWidth: '16rem' }} data-testid="client-filter"
                    aria-label={t('f8_client')} value={clienteSel}
                    onChange={(e) => setClienteSel(e.target.value)}>
              <option value="">{t('f8_all_clients')}</option>
              {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={NO_CLIENT}>{t('f8_no_client')}</option>
            </select>
          )}
        </div>
        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('projects_description')}</th>
                <th>AQSOL</th>
                <th>{t('projects_created')}</th>
                <th>{t('projects_last_execution')}</th>
                {!isAdmin && <th>{t('f7_my_role')}</th>}
                {isAdmin && <th />}
              </tr>
            </thead>
            {grupos.length === 0 && (
              <tbody><tr><td colSpan={N_COLS} className="text-center text-sm py-6"
                             style={{ color: 'var(--color-text-secondary)' }}>{t('f8_no_matches')}</td></tr></tbody>
            )}
            {grupos.map(([cliente, lista]) => (
            <tbody key={cliente || NO_CLIENT} data-testid={`client-group-${cliente || NO_CLIENT}`}>
              {/* Separador por cliente: solo si hay más de un grupo o el único tiene nombre. */}
              {(grupos.length > 1 || cliente) && (
                <tr>
                  <th colSpan={N_COLS} scope="colgroup" className="text-left text-sm"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                    {cliente || t('f8_no_client')}
                    <span className="ml-2 font-normal text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('f8_n_projects').replace('{n}', String(lista.length))}
                    </span>
                  </th>
                </tr>
              )}
              {lista.map((project) => (
                <tr
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="font-medium">
                    {/* Enlace de verdad: se llega con Tab y se abre en otra pestaña. */}
                    <Link to={`/projects/${project.id}`} style={{ color: 'var(--color-primary)' }}
                          onClick={(e) => e.stopPropagation()}>
                      {project.name}
                    </Link>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {project.description || '-'}
                  </td>
                  <td className="font-mono text-sm">{project.aqsol_version ?? '-'}</td>
                  <td className="font-mono text-sm">{formatDate(project.created_at)}</td>
                  <td>
                    {project.last_execution_status ? (
                      <RunStatusBadge status={project.last_execution_status} />
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('projects_no_executions')}
                      </span>
                    )}
                  </td>
                  {!isAdmin && (
                    <td className="text-sm">
                      {project.my_role ? t(`f7_role_${project.my_role}` as never) : '–'}
                    </td>
                  )}
                  {isAdmin && (
                    <td onClick={(e) => e.stopPropagation()} className="text-right whitespace-nowrap">
                      {/* Borrar no compite con los datos: va en el menú de la fila. */}
                      {menu === project.id ? (
                        <span className="inline-flex gap-2">
                        <button className="btn btn-outline btn-sm" data-testid={`edit-project-${project.id}`}
                                onClick={() => { setEditando(project); setMenu(null); }}>
                          {t('f8_edit')}
                        </button>
                        <button className="btn btn-outline btn-sm" data-testid={`delete-project-${project.id}`}
                                style={{ borderColor: '#dc2626', color: '#b91c1c' }}
                                onClick={() => borrar(project.id)}>
                          {aBorrar === project.id ? t('f6_delete_confirm') : t('delete')}
                        </button>
                        </span>
                      ) : (
                        <button className="btn btn-outline btn-sm" aria-label={`${t('f7_row_actions')} ${project.name}`}
                                onClick={() => { setMenu(project.id); setABorrar(null); }}>⋯</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            ))}
          </table>
        </div>
        </>
      )}

      <ProjectEditModal
        project={editando}
        clients={clientes}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); fetchProjects(); }}
      />

      {/* Create Project Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('projects_new')}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('projects_name_label')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('projects_name_placeholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="new-client">{t('f8_client')}</label>
            <ClientInput id="new-client" value={newClient} onChange={setNewClient} clients={clientes} />
          </div>
          <div>
            <label className="label">{t('projects_desc_label')}</label>
            <textarea
              className="input"
              rows={3}
              placeholder={t('projects_desc_placeholder')}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('projects_aqsol_label')}</label>
            <select
              className="input"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value as '027' | '066')}
            >
              <option value="027">AQSOL 027</option>
              <option value="066">AQSOL 066</option>
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {t('projects_aqsol_fixed')}
            </p>
          </div>
          {createError && (
            <p className="text-sm" style={{ color: 'var(--color-danger, #b91c1c)' }}>{createError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? <LoadingSpinner size="sm" /> : null}
              {t('projects_create')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
