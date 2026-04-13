import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';
import { getProjects, createProject } from '../services/api';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function ProjectsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Proyectos
        </h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Nuevo Proyecto
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="card p-8 text-center">
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {isAdmin
              ? 'No hay proyectos creados. Cree uno nuevo para comenzar.'
              : 'No tiene proyectos asignados. Contacte al administrador.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripcion</th>
                <th>Creado</th>
                <th>Ultima ejecucion</th>
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
                        Sin ejecuciones
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
        title="Nuevo Proyecto"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del proyecto</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Simulacion Salar Q3 2026"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Descripcion (opcional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Descripcion del proyecto..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? <LoadingSpinner size="sm" /> : null}
              Crear Proyecto
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
