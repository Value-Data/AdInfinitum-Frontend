import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';
import { getProjects, createProject } from '../services/api';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import WelcomeOverlay from '../components/common/WelcomeOverlay';
import { useT } from '../i18n/LanguageContext';

export default function ProjectsPage() {
  const t = useT();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
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
    } catch {
      // handled by interceptor
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
      await createProject({ name: newName, description: newDesc || undefined });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      fetchProjects();
    } catch {
      // handled
    } finally {
      setCreating(false);
    }
  };

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

      {projects.length === 0 ? (
        <div className="card p-8 text-center">
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {isAdmin
              ? t('projects_empty_admin')
              : t('projects_empty_user')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('projects_description')}</th>
                <th>{t('projects_created')}</th>
                <th>{t('projects_last_execution')}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="font-medium" style={{ color: 'var(--color-primary)' }}>
                    {project.name}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {project.description || '-'}
                  </td>
                  <td className="font-mono text-sm">{formatDate(project.created_at)}</td>
                  <td>
                    {project.last_execution_status ? (
                      <StatusBadge status={project.last_execution_status} />
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('projects_no_executions')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
            <label className="label">{t('projects_desc_label')}</label>
            <textarea
              className="input"
              rows={3}
              placeholder={t('projects_desc_placeholder')}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
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
