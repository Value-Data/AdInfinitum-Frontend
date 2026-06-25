import React, { useCallback, useEffect, useState } from 'react';
import type { UserResponse, Project } from '../types';
import {
  getUsers,
  createUser,
  updateUser,
  getProjects,
  getUserProjects,
  setUserProjects,
} from '../services/api';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useT } from '../i18n/LanguageContext';

export default function UsersPage() {
  const t = useT();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Assign projects modal
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignUserName, setAssignUserName] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersData, projectsData] = await Promise.all([
        getUsers(),
        getProjects(),
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      fetchData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { detail?: string } } }).response;
        setCreateError(resp?.data?.detail || t('users_create_error'));
      } else {
        setCreateError(t('users_create_error'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: UserResponse) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      fetchData();
    } catch {
      // handled
    }
  };

  const openAssignModal = async (user: UserResponse) => {
    setAssignUserId(user.id);
    setAssignUserName(user.username);
    setLoadingAssign(true);
    try {
      const userProjectIds = await getUserProjects(user.id);
      setSelectedProjects(userProjectIds);
    } catch {
      setSelectedProjects([]);
    } finally {
      setLoadingAssign(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const handleSaveProjects = async () => {
    if (!assignUserId) return;
    setLoadingAssign(true);
    try {
      await setUserProjects(assignUserId, selectedProjects);
      setAssignUserId(null);
      fetchData();
    } catch {
      // handled
    } finally {
      setLoadingAssign(false);
    }
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('users_title')}
        </h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {t('users_create')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>{t('users_username')}</th>
              <th>{t('users_role')}</th>
              <th>{t('users_state')}</th>
              <th>{t('projects_created')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-medium">{user.username}</td>
                <td>
                  <span
                    className="text-xs font-medium px-2 py-0.5 border"
                    style={{
                      borderRadius: 'var(--radius)',
                      borderColor: 'var(--color-border)',
                      color: user.role === 'admin' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      backgroundColor: user.role === 'admin' ? 'var(--color-primary-lighter)' : 'transparent',
                    }}
                  >
                    {user.role === 'admin' ? t('users_role_admin') : t('users_role_user')}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleToggleActive(user)}
                    className="relative inline-flex h-5 w-10 items-center transition-colors"
                    style={{
                      backgroundColor: user.is_active ? 'var(--color-success)' : 'var(--color-border)',
                      borderRadius: '9999px',
                    }}
                    title={user.is_active ? t('users_active_toggle_off') : t('users_inactive_toggle_on')}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 bg-white transition-transform ${
                        user.is_active ? 'translate-x-5' : 'translate-x-1'
                      }`}
                      style={{ borderRadius: '9999px' }}
                    />
                  </button>
                  <span
                    className="ml-2 text-xs"
                    style={{ color: user.is_active ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
                  >
                    {user.is_active ? t('users_active') : t('users_inactive')}
                  </span>
                </td>
                <td className="font-mono text-sm">
                  {new Date(user.created_at).toLocaleDateString('es-CL')}
                </td>
                <td>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => openAssignModal(user)}
                  >
                    {t('users_assign_projects')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateError(null);
        }}
        title={t('users_create')}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('users_username_label')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('users_username_placeholder')}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">{t('users_password_label')}</label>
            <input
              type="password"
              className="input"
              placeholder={t('users_password_placeholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('users_role')}</label>
            <select
              className="input"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">{t('users_role_user')}</option>
              <option value="admin">{t('users_role_admin_full')}</option>
            </select>
          </div>

          {createError && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              {createError}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateUser}
              disabled={!newUsername.trim() || !newPassword.trim() || creating}
            >
              {creating ? <LoadingSpinner size="sm" /> : null}
              {t('users_create_short')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Projects Modal */}
      <Modal
        open={!!assignUserId}
        onClose={() => setAssignUserId(null)}
        title={`${t('users_assign_projects')} - ${assignUserName}`}
        width="520px"
      >
        {loadingAssign ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : (
          <div>
            {projects.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('users_no_projects')}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="h-4 w-4"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-sm">{project.name}</span>
                    {project.description && (
                      <span
                        className="text-xs ml-auto"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {project.description}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-outline" onClick={() => setAssignUserId(null)}>
                {t('cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSaveProjects}>
                {t('save')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
