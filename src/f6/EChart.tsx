/**
 * Un gráfico de ECharts. En pantalla dibuja en lienzo; dentro de `ChartPrintContext`
 * (la vista de impresión) en SVG, que sale vectorial en el papel. Las opciones se
 * reemplazan enteras (`notMerge`): al quitar una especie o cambiar de poza no quedan
 * series fantasma. Se ajusta al ancho de su caja y, antes y después de imprimir, al
 * de la página.
 */
import React, { createContext, useContext, useEffect, useRef } from 'react';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import type { EChartsOption } from 'echarts';
import { echarts, type EChartsInstance } from './echartsSetup';

/** true: los gráficos son para imprimir o el PDF (SVG, sin zoom ni herramientas). */
export const ChartPrintContext = createContext(false);
export const useChartPrint = () => useContext(ChartPrintContext);

export function EChart({ option, height, group }: {
  option: EChartsOption;
  height: number;
  /** Gráficos del mismo grupo mueven juntos el cursor y el tooltip (mismo eje X). */
  group?: string;
}) {
  const print = useChartPrint();
  const ref = useRef<ReactEChartsCore>(null);

  useEffect(() => {
    // El navegador aplica el ancho del papel antes de `beforeprint`: se redibuja a ese ancho.
    const ajustar = () => ref.current?.getEchartsInstance()?.resize();
    window.addEventListener('beforeprint', ajustar);
    window.addEventListener('afterprint', ajustar);
    return () => {
      window.removeEventListener('beforeprint', ajustar);
      window.removeEventListener('afterprint', ajustar);
    };
  }, []);

  const listo = (inst: EChartsInstance) => {
    if (group) {
      inst.group = group;
      echarts.connect(group);
    }
  };

  return (
    <ReactEChartsCore ref={ref} echarts={echarts} option={option} notMerge lazyUpdate={false}
                      opts={{ renderer: print ? 'svg' : 'canvas' }} onChartReady={listo}
                      style={{ width: '100%', height }} />
  );
}
