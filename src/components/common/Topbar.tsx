import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';
import { useTrail } from './trail';

export default function Topbar() {
  const t = useT();
  const location = useLocation();

  const buildBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = '/' + parts.slice(0, i + 1).join('/');
      let label = part;

      if (part === 'projects') label = t('topbar_projects');
      else if (part === 'users') label = t('topbar_users');
      else if (part === 'executions') label = t('topbar_executions');
      else if (parts[i - 1] === 'projects' || parts[i - 1] === 'executions') {
        // UUID - show truncated
        label = part.length > 8 ? part.substring(0, 8) + '...' : part;
      }

      crumbs.push({ label, path });
    }

    return crumbs;
  };

  const declarada = useTrail(location.pathname);
  const crumbs = declarada
    ? declarada.map((c, i) => ({ label: c.label, path: c.path ?? `${location.pathname}#${i}` }))
    : buildBreadcrumbs();

  return (
    <header
      className="h-12 flex items-center px-6 border-b"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && (
              <span style={{ color: 'var(--color-text-secondary)' }}>/</span>
            )}
            {index === crumbs.length - 1 ? (
              <span style={{ color: 'var(--color-text)' }} className="font-medium">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:underline"
                style={{ color: 'var(--color-primary-light)' }}
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>
    </header>
  );
}
