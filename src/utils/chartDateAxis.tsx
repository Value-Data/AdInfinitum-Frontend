/* ============================================================
   Toggle Días / Fechas para el eje X de los gráficos de serie temporal.
   El modo vive en un Context, así UN solo botón (arriba) controla TODOS los
   gráficos a la vez. El eje sigue usando `day` como dataKey (numérico, ticks
   parejos); solo cambia el FORMATO del tick/tooltip a dd-mm-aaaa en modo 'date'.
   ============================================================ */
import React, { createContext, useContext, useMemo, useState } from 'react';

export type XAxisMode = 'day' | 'date';

const XAxisModeContext = createContext<{ mode: XAxisMode; setMode: (m: XAxisMode) => void }>({
  mode: 'day',
  setMode: () => undefined,
});

/** Envuelve la vista de resultados: un único estado día/fecha para todos los charts. */
export function XAxisModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<XAxisMode>('day');
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <XAxisModeContext.Provider value={value}>{children}</XAxisModeContext.Provider>;
}

export function useXAxisMode() {
  return useContext(XAxisModeContext);
}

/** ISO ("2025-04-13" o "2025-04-13T..") -> "13-04-2025". */
export function formatDMY(iso: string | undefined | null): string {
  if (!iso) return '';
  const datePart = String(iso).split('T')[0].split(' ')[0];
  const [y, m, d] = datePart.split('-');
  return d && m && y ? `${d}-${m}-${y}` : String(iso);
}

/**
 * Formateador de eje/tooltip para una serie diaria. Lee el modo del Context.
 * Recibe filas con {day, date?}; devuelve fmtX (tick/tooltip) y si hay fechas.
 */
export function useDayDateAxis(dayDates: Array<{ day: number; date?: string | null }>) {
  const { mode } = useXAxisMode();
  const dayToDate = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of dayDates) {
      if (r && r.date && !m.has(r.day)) m.set(r.day, formatDMY(r.date));
    }
    return m;
  }, [dayDates]);

  const fmtX = (d: number | string) => {
    const n = typeof d === 'number' ? d : Number(d);
    return mode === 'date' ? dayToDate.get(n) ?? String(d) : String(d);
  };

  return { mode, fmtX, hasDates: dayToDate.size > 0 };
}

/** Botón único Días | Fechas (controla el Context => todos los gráficos). */
export function DayDateToggle({ labels }: { labels: { day: string; date: string } }) {
  const { mode, setMode } = useXAxisMode();
  const base = 'px-3 py-1 rounded border text-xs font-medium';
  const on = 'bg-blue-50 border-blue-300';
  const off = 'border-gray-200';
  return (
    <div className="flex gap-1 items-center">
      <button type="button" className={`${base} ${mode === 'day' ? on : off}`} onClick={() => setMode('day')}>
        {labels.day}
      </button>
      <button type="button" className={`${base} ${mode === 'date' ? on : off}`} onClick={() => setMode('date')}>
        {labels.date}
      </button>
    </div>
  );
}
