import React, { useEffect, useState } from 'react';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useT } from '../i18n/LanguageContext';
import { apiError, updateProjectV2, type ProjectV2 } from '../services/apiV2';

interface Props {
  /** El proyecto a editar; `null` cierra el modal. */
  project: { id: string; name: string; description?: string | null; client?: string | null } | null;
  /** Clientes ya usados, para sugerirlos (`datalist`). */
  clients?: string[];
  onClose: () => void;
  onSaved: (p: ProjectV2) => void;
}

/** Nombre, descripción y cliente de un proyecto (F8, solo admin). Vaciar la
 *  descripción o el cliente los deja en `null`. */
export default function ProjectEditModal({ project, clients = [], onClose, onSaved }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [client, setClient] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDesc(project.description ?? '');
    setClient(project.client ?? '');
    setError(null);
  }, [project]);

  const guardar = async () => {
    if (!project || !name.trim()) return;
    setSaving(true);
    try {
      const p = await updateProjectV2(project.id, {
        name: name.trim(),
        description: desc.trim() || null,
        client: client.trim() || null,
      });
      onSaved(p);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={project !== null} onClose={onClose} title={t('f8_project_edit')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div>
          <label className="label" htmlFor="pe-name">{t('projects_name_label')}</label>
          <input id="pe-name" type="text" className="input" value={name} autoFocus
                 onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pe-client">{t('f8_client')}</label>
          <ClientInput id="pe-client" value={client} onChange={setClient} clients={clients} />
        </div>
        <div>
          <label className="label" htmlFor="pe-desc">{t('projects_desc_label')}</label>
          <textarea id="pe-desc" className="input" rows={3} value={desc}
                    onChange={(e) => setDesc(e.target.value)} />
        </div>
        {error && <p className="text-sm" role="alert" style={{ color: 'var(--color-danger, #b91c1c)' }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || saving}>
            {saving ? <LoadingSpinner size="sm" /> : null}
            {t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Texto libre con los clientes existentes como sugerencia. */
export function ClientInput({ id, value, onChange, clients }: {
  id: string; value: string; onChange: (v: string) => void; clients: string[];
}) {
  const t = useT();
  return (
    <>
      <input id={id} type="text" className="input" list={`${id}-list`} maxLength={120}
             placeholder={t('f8_client_placeholder')} value={value}
             onChange={(e) => onChange(e.target.value)} />
      <datalist id={`${id}-list`}>
        {clients.map((c) => <option key={c} value={c} />)}
      </datalist>
    </>
  );
}
