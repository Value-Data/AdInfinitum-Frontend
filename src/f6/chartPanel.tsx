/**
 * Piezas comunes de los gráficos: el panel con su título (que nombra el PNG del zip y es
 * un bloque del PDF), las pestañas chicas y los textos de la caja de herramientas.
 */
import React from 'react';
import { useT } from '../i18n/LanguageContext';
import type { ToolLabels } from './chartOptions';

/** Nombre de archivo a partir del título de un gráfico. */
export const nombreArchivo = (titulo: string) => titulo.replace(/[^\w\-]+/g, '_').slice(0, 60);

/** Textos de la caja de herramientas de los gráficos. */
export function useTools(): ToolLabels {
  const t = useT();
  return {
    savePng: t('f6_chart_save_png'), zoom: t('f6_chart_zoom'),
    zoomBack: t('f6_chart_zoom_back'), restore: t('f6_chart_restore'),
  };
}

/**
 * Un gráfico con su título (el título nombra el PNG del zip). Varios hijos = varios
 * gráficos uno debajo del otro, con el mismo eje X (en vez de dos ejes Y). `minWidth`
 * > 0 ensancha el gráfico y aparece la barra de desplazamiento horizontal.
 */
export function Panel({ title, children, minWidth = 0, height = 280, wide = false, notes = [] }: {
  title: string; children: React.ReactNode; minWidth?: number; height?: number;
  /** Todo el ancho de la grilla (sin ensanchar el gráfico). */
  wide?: boolean;
  /** Notas al pie (de dónde sale cada serie); también van en el PNG y en el PDF. */
  notes?: string[];
}) {
  const graficos = React.Children.toArray(children).filter(Boolean) as React.ReactElement<{ height?: number }>[];
  const alto = graficos.length > 1 ? Math.round(height * 0.62) : height;
  return (
    <div className="card p-3 mb-4 pdf-block" data-chart-title={title}
         style={{ minWidth: 0, gridColumn: minWidth || wide ? '1 / -1' : undefined }}>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div style={{ overflowX: minWidth ? 'auto' : 'visible', width: '100%' }} data-testid="chart-scroll">
        <div style={{ width: minWidth ? `${minWidth}px` : '100%', minWidth: '100%' }}>
          {graficos.map((g, i) => (
            <div key={i} style={{ width: '100%', height: alto }}>{React.cloneElement(g, { height: alto })}</div>
          ))}
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {notes.map((n) => <li key={n} data-chart-note>ⓘ {n}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Botones de una sola elección (pestañas chicas). */
export function Toggle<K extends string>({ value, options, onChange, testId }: {
  value: K; options: [K, string][]; onChange: (k: K) => void; testId?: string;
}) {
  return (
    <div className="flex gap-1" role="tablist" data-testid={testId}>
      {options.map(([k, texto]) => (
        <button key={k} role="tab" aria-selected={value === k} style={{ textTransform: 'none' }}
                className={`btn btn-sm ${value === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => onChange(k)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Curva o recta en los gráficos de líneas del reporte (lo elige el usuario; por defecto
 * curva, como antes). */
export const SmoothContext = React.createContext(true);
export const useSmooth = () => React.useContext(SmoothContext);
