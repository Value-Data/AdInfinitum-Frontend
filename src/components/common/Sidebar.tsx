import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import logoHeader from '../../media/logo-header.png';

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const { pathname } = useLocation();
  const dentroDeProyectos = /^\/(executions|legacy-executions)\//.test(pathname);
  // Bajo 1024 px (tablet) el menú queda en una franja de íconos: el nombre de cada enlace
  // sigue ahí para lectores de pantalla y como tooltip.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-center lg:justify-start gap-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'text-white'
        : 'text-blue-200 hover:text-white'
    }`;
  const activeBg = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? { backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius)' }
      : {};

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col w-16 lg:w-56 z-40"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/10 hidden lg:block">
        <div className="bg-white rounded-md px-3 py-3 flex items-center justify-center">
          <img
            src={logoHeader}
            alt="AD-INFINITUM"
            className="w-full h-auto max-h-20 object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1">
        <NavLink to="/inicio" className={linkClass} style={activeBg} title={t('f8_nav_home')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          <span className="sr-only lg:not-sr-only">{t('f8_nav_home')}</span>
        </NavLink>

        {/* Una ejecución (nueva o de antes) es parte de Proyectos: queda marcado. */}
        <NavLink
          to="/projects"
          className={({ isActive }) => linkClass({ isActive: isActive || dentroDeProyectos })}
          style={({ isActive }) => activeBg({ isActive: isActive || dentroDeProyectos })}
          title={lang === 'en' ? 'Projects' : 'Proyectos'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="sr-only lg:not-sr-only">{lang === 'en' ? 'Projects' : 'Proyectos'}</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/users"
            className={linkClass}
            style={activeBg}
            title={lang === 'en' ? 'Users' : 'Usuarios'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            <span className="sr-only lg:not-sr-only">{lang === 'en' ? 'Users' : 'Usuarios'}</span>
          </NavLink>
        )}
      </nav>

      {/* Language toggle */}
      <div className="px-2 lg:px-4 py-3 border-t border-white/10" role="group" aria-label={t('language')}>
        <div className="text-xs text-blue-200 mb-1.5 hidden lg:block">{t('language')}</div>
        <div className="flex flex-col lg:flex-row rounded overflow-hidden border border-white/20 text-xs">
          <button
            type="button"
            onClick={() => setLang('es')}
            aria-pressed={lang === 'es'}
            className="flex-1 py-1.5 font-medium transition-colors"
            style={{
              backgroundColor:
                lang === 'es' ? 'var(--color-primary-light)' : 'transparent',
              color: 'white',
            }}
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className="flex-1 py-1.5 font-medium transition-colors"
            style={{
              backgroundColor:
                lang === 'en' ? 'var(--color-primary-light)' : 'transparent',
              color: 'white',
            }}
          >
            EN
          </button>
        </div>
      </div>

      {/* User Info + Logout */}
      <div className="px-2 lg:px-4 py-3 border-t border-white/10">
        <div className="text-sm text-white font-medium truncate hidden lg:block">
          {user?.username}
        </div>
        <div className="text-xs text-blue-200 capitalize mb-2 hidden lg:block">
          {user?.role}
        </div>
        <button
          onClick={handleLogout}
          title={lang === 'en' ? 'Sign out' : 'Cerrar sesión'}
          className="flex items-center justify-center lg:justify-start gap-1 w-full lg:w-auto py-1 lg:py-0 text-xs text-blue-200 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          <span className="sr-only lg:not-sr-only">{lang === 'en' ? 'Sign out' : 'Cerrar sesión'}</span>
        </button>
      </div>
    </aside>
  );
}
