/**
 * Las sub-páginas de una ejecución (`?tab=`): primero los resultados (KPIs y tablas),
 * después los gráficos, la comparación con otras ejecuciones y los archivos. En el
 * dinámico, las series diarias (los gráficos que más se usan) van antes que los gráficos
 * del reporte, que ahí se llaman "Balance de masas". Nada se quita: solo se reparte en
 * pestañas.
 */
import type { TranslationKey } from '../i18n/translations';

export type ExecutionTab = 'results' | 'charts' | 'daily' | 'compare' | 'files';

export function executionTabs({ dynamic, chain, files, compare = true }: {
  dynamic: boolean; chain: boolean; files: boolean; compare?: boolean;
}): ExecutionTab[] {
  const tabs: ExecutionTab[] = dynamic ? ['results', 'daily', 'charts'] : ['results', 'charts'];
  // El cliente no compara con otras ejecuciones (plan F7, Fase 3).
  if (!chain && compare) tabs.push('compare');
  if (files) tabs.push('files');
  return tabs;
}

const TAB_LABEL: Record<ExecutionTab, TranslationKey> = {
  results: 'f6_tab_results', charts: 'f6_tab_charts', daily: 'f6_tab_daily', compare: 'f6_tab_compare',
  files: 'f6_tab_files',
};

/** El nombre de la pestaña: los gráficos del reporte del dinámico son el balance de Li y
 * el balance por poza ("Balance de masas"); en el estático, "Gráficos". */
export function tabLabelKey(tab: ExecutionTab, dynamic: boolean): TranslationKey {
  return tab === 'charts' && dynamic ? 'f6_tab_mass_balance' : TAB_LABEL[tab];
}

export function parseTab(value: string | null, tabs: ExecutionTab[]): ExecutionTab {
  return tabs.includes(value as ExecutionTab) ? (value as ExecutionTab) : 'results';
}

/** Si el rol del usuario en el proyecto permite `cap` (las capacidades vienen del
 * proyecto; mientras no llegan, no se ofrece lo que podría dar 403). */
export function canDo(caps: string[] | null | undefined, cap: string): boolean {
  return Boolean(caps && caps.includes(cap));
}
