/* ============================================================
   Controles del eje X de los gráficos de serie temporal (dinámico).
   - Modo Días / Fechas (formato del tick).
   - Paso de días: cada cuántos días aparece una marca (separación de ticks).
   Ambos viven en un Context, así UN set de controles arriba afecta TODOS los
   gráficos a la vez. El eje sigue usando `day` como dataKey.
   ============================================================ */
import React, { createContext, useContext, useMemo, useState } from 'react';

export type XAxisMode = 'day' | 'date';
export type DayStep = number | 'auto';

type Ctx = {
  mode: XAxisMode;
  setMode: (m: XAxisMode) => void;
  dayStep: DayStep;
  setDayStep: (s: DayStep) => void;
};

const XAxisModeContext = createContext<Ctx>({
  mode: 'day',
  setMode: () => undefined,
  dayStep: 'auto',
  setDayStep: () => undefined,
});

/** Envuelve la vista de resultados: un único estado (modo + paso) para todos los charts. */
export function XAxisModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<XAxisMode>('day');
  const [dayStep, setDayStep] = useState<DayStep>('auto');
  const value = useMemo(() => ({ mode, setMode, dayStep, setDayStep }), [mode, dayStep]);
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
 * Formateo/paso de eje para una serie diaria. Lee modo y paso del Context.
 * Devuelve fmtX (tick/tooltip), hasDates y xInterval (prop `interval` de recharts:
 * 'preserveStartEnd' en auto, o step-1 para "una marca cada `step` días").
 */
export function useDayDateAxis(dayDates: Array<{ day: number; date?: string | null }>) {
  const { mode, dayStep } = useXAxisMode();
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

  const xInterval: number | 'preserveStartEnd' =
    dayStep === 'auto' ? 'preserveStartEnd' : Math.max(0, Math.round(dayStep) - 1);

  return { mode, fmtX, hasDates: dayToDate.size > 0, xInterval };
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

/** Selector de separación de días en el eje X (controla el Context). */
export function DayStepSelect({ label, autoLabel }: { label: string; autoLabel: string }) {
  const { dayStep, setDayStep } = useXAxisMode();
  const options: DayStep[] = ['auto', 10, 30, 60, 100, 200, 365];
  return (
    <label className="flex gap-1 items-center text-xs">
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}:</span>
      <select
        className="input text-xs"
        value={String(dayStep)}
        onChange={(e) => setDayStep(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {o === 'auto' ? autoLabel : `${o}`}
          </option>
        ))}
      </select>
    </label>
  );
}
