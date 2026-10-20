import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useLanguage } from '../i18n/LanguageContext';
import logoHeader from '../media/logo-header.png';
import PondsIllustration from '../media/PondsIllustration';

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
  const { lang, setLang, t } = useLanguage();
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
      // Sesión nueva: la portada (/inicio) consume la marca y hace de bienvenida.
      sessionStorage.setItem('adinf_show_welcome', '1');
      navigate('/inicio', { replace: true });
    } catch {
      setError(t('f8_login_error_invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* Marca: arriba en pantallas angostas, a la izquierda en escritorio. */}
      <section
        className="flex flex-col gap-8 px-6 py-6 sm:px-10 lg:w-1/2 lg:justify-between lg:px-14 lg:py-12"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <div className="flex items-center">
          <div className="bg-white px-4 py-2.5" style={{ borderRadius: 'var(--radius)' }}>
            <img src={logoHeader} alt="AD-INFINITUM" className="h-10 w-auto lg:h-12" />
          </div>
        </div>

        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight lg:text-5xl" style={{ color: 'var(--color-surface)' }}>
            AdInfinitum
          </h1>
          <p className="mt-3 text-base leading-relaxed lg:text-xl" style={{ color: 'var(--color-primary-lighter)' }}>
            {t('f8_login_tagline')}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-accent-light)' }}>
            {t('f8_login_stages')}
          </p>
        </div>

        <figure className="hidden lg:block">
          <div className="overflow-hidden" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)' }}>
            <PondsIllustration className="block w-full h-auto" title={t('f8_login_ponds_alt')} animated />
          </div>
          <figcaption className="mt-3 text-xs" style={{ color: 'var(--color-primary-lighter)' }}>
            {t('f8_login_engine')}
          </figcaption>
        </figure>
      </section>

      {/* Formulario */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="absolute right-6 top-6 flex text-xs overflow-hidden border"
             style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
             role="group" aria-label={t('language')}>
          {(['es', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className="min-w-[2.75rem] px-3 py-1.5 font-medium transition-colors"
              style={lang === l
                ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-surface)' }
                : { color: 'var(--color-text-secondary)' }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="adinf-fade-in w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{t('f8_login_title')}</h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('f8_login_hint')}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="label">
                {t('login_username')}
              </label>
              <input
                id="username"
                type="text"
                className="input h-11"
                placeholder={t('login_username_placeholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
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
                className="input h-11"
                placeholder={t('login_password_placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            {error && (
              <p id="login-error" role="alert" className="flex items-start gap-2 text-sm"
                 style={{ color: 'var(--color-danger)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20"
                     fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary h-11 w-full justify-center text-sm"
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
            <div className="mt-8 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
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
      </main>
    </div>
  );
}
