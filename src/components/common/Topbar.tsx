import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export default function Topbar() {
  const location = useLocation();

  const buildBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = '/' + parts.slice(0, i + 1).join('/');
      let label = part;

      if (part === 'projects') label = 'Proyectos';
      else if (part === 'users') label = 'Usuarios';
      else if (part === 'executions') label = 'Ejecuciones';
      else if (parts[i - 1] === 'projects' || parts[i - 1] === 'executions') {
        // UUID - show truncated
        label = part.length > 8 ? part.substring(0, 8) + '...' : part;
      }

      crumbs.push({ label, path });
    }

    return crumbs;
  };

  const crumbs = buildBreadcrumbs();

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
