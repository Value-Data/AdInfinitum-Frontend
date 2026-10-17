/**
 * Las sub-páginas de una ejecución (`?tab=`): primero los resultados (KPIs y tablas),
 * después los gráficos, las series diarias (dinámico), la comparación con otras
 * ejecuciones y los archivos. Nada se quita: solo se reparte en pestañas.
 */
export type ExecutionTab = 'results' | 'charts' | 'daily' | 'compare' | 'files';

export function executionTabs({ dynamic, chain, files }: {
  dynamic: boolean; chain: boolean; files: boolean;
}): ExecutionTab[] {
  const tabs: ExecutionTab[] = ['results', 'charts'];
  if (dynamic) tabs.push('daily');
  if (!chain) tabs.push('compare');
  if (files) tabs.push('files');
  return tabs;
}

export function parseTab(value: string | null, tabs: ExecutionTab[]): ExecutionTab {
  return tabs.includes(value as ExecutionTab) ? (value as ExecutionTab) : 'results';
}
