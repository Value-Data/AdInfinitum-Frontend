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
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
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
      className="fixed left-0 top-0 bottom-0 flex flex-col w-56 z-40"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/10">
        <div className="bg-white rounded-md px-3 py-3 flex items-center justify-center">
          <img
            src={logoHeader}
            alt="AD-INFINITUM"
            className="w-full h-auto max-h-20 object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {/* Una ejecución (nueva o de antes) es parte de Proyectos: queda marcado. */}
        <NavLink
          to="/projects"
          className={({ isActive }) => linkClass({ isActive: isActive || dentroDeProyectos })}
          style={({ isActive }) => activeBg({ isActive: isActive || dentroDeProyectos })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          {lang === 'en' ? 'Projects' : 'Proyectos'}
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/users"
            className={linkClass}
            style={activeBg}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            {lang === 'en' ? 'Users' : 'Usuarios'}
          </NavLink>
        )}
      </nav>

      {/* Language toggle */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="text-xs text-blue-200 mb-1.5">{t('language')}</div>
        <div className="flex rounded overflow-hidden border border-white/20 text-xs">
          <button
            type="button"
            onClick={() => setLang('es')}
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
      <div className="px-4 py-3 border-t border-white/10">
        <div className="text-sm text-white font-medium truncate">
          {user?.username}
        </div>
        <div className="text-xs text-blue-200 capitalize mb-2">
          {user?.role}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          {lang === 'en' ? 'Sign out' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  );
}
