import React, { createContext, useCallback, useContext, useState } from 'react';
import { getDecimalsOverride, setDecimalsOverride } from '../utils/numberFormat';

interface DecimalsContextValue {
  /** null = "Auto" (per-field default precision). */
  decimals: number | null;
  setDecimals: (v: number | null) => void;
}

const DecimalsContext = createContext<DecimalsContextValue | null>(null);

export function DecimalsProvider({ children }: { children: React.ReactNode }) {
  const [decimals, setDecimalsState] = useState<number | null>(() => getDecimalsOverride());
  const setDecimals = useCallback((v: number | null) => {
    setDecimalsOverride(v); // update the module-level override used by formatters
    setDecimalsState(v); // re-render consumers
  }, []);
  return (
    <DecimalsContext.Provider value={{ decimals, setDecimals }}>
      {children}
    </DecimalsContext.Provider>
  );
}

/**
 * Subscribe to the global decimals setting. Components that render formatted
 * tables call this so they re-render when the user changes the precision.
 * Falls back to the module override when no provider is present (e.g. tests).
 */
export function useDecimals(): DecimalsContextValue {
  return (
    useContext(DecimalsContext) ?? {
      decimals: getDecimalsOverride(),
      setDecimals: setDecimalsOverride,
    }
  );
}
