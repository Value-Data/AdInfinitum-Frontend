import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useT } from '../i18n/LanguageContext';

// Solo en desarrollo local: VITE_DEV_LOGINS="usuario:clave,usuario:clave" en .env.local
// (ignorado por git). En el build de producción import.meta.env.DEV es false y esto no
// existe.
function devLogins(): { username: string; password: string }[] {
  if (!import.meta.env.DEV) return [];
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return [];
  const raw = (import.meta.env.VITE_DEV_LOGINS as string | undefined) ?? '';
  return raw.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf(':');
    return { username: x.slice(0, i), password: x.slice(i + 1) };
  }).filter((x) => x.username && x.password);
}

export default function LoginPage() {
  const t = useT();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cuentasDev = devLogins();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t('login_error_required'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      // Trigger the one-time welcome overlay on the projects landing.
      sessionStorage.setItem('adinf_show_welcome', '1');
      navigate('/projects', { replace: true });
    } catch {
      setError(t('login_error_invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="card p-8 w-full" style={{ maxWidth: '400px' }}>
        {/* Logo */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-primary)' }}
          >
            AdInfinitum
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('login_subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="label">
              {t('login_username')}
            </label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder={t('login_username_placeholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              {t('login_password')}
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder={t('login_password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                {t('login_logging_in')}
              </>
            ) : (
              t('login_submit')
            )}
          </button>
        </form>

        {cuentasDev.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Desarrollo local: autollenar
            </p>
            <div className="flex flex-wrap gap-2">
              {cuentasDev.map((c) => (
                <button
                  key={c.username}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setUsername(c.username); setPassword(c.password); setError(null); }}
                >
                  {c.username}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
