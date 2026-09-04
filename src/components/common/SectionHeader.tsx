import React from 'react';
import Tip from './Tip';

/**
 * Sección colapsable de un editor de configuración.
 *
 * La usan los editores de los tres modos: con una configuración de decenas de
 * campos, mostrarlos todos a la vez hace ilegible la pantalla. Estaba dentro de
 * `DynamicConfigEditor`; se movió acá al aparecer el editor del modo con inventario.
 */
export default function SectionHeader({
  title,
  tooltip,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  tooltip?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-3 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-gray-50"
        style={{ color: 'var(--color-text)' }}
        onClick={onToggle}
      >
        <span>
          {title}
          {tooltip && <Tip text={tooltip} />}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
