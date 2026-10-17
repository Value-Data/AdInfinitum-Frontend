/**
 * Las sub-páginas de una ejecución (`?tab=`): primero los resultados (KPIs y tablas),
 * después los gráficos, las series diarias (dinámico), la comparación con otras
 * ejecuciones y los archivos. Nada se quita: solo se reparte en pestañas.
 */
export type ExecutionTab = 'results' | 'charts' | 'daily' | 'compare' | 'files';

export function executionTabs({ dynamic, chain, files, compare = true }: {
  dynamic: boolean; chain: boolean; files: boolean; compare?: boolean;
}): ExecutionTab[] {
  const tabs: ExecutionTab[] = ['results', 'charts'];
  if (dynamic) tabs.push('daily');
  // El cliente no compara con otras ejecuciones (plan F7, Fase 3).
  if (!chain && compare) tabs.push('compare');
  if (files) tabs.push('files');
  return tabs;
}

export function parseTab(value: string | null, tabs: ExecutionTab[]): ExecutionTab {
  return tabs.includes(value as ExecutionTab) ? (value as ExecutionTab) : 'results';
}

/** Si el rol del usuario en el proyecto permite `cap` (las capacidades vienen del
 * proyecto; mientras no llegan, no se ofrece lo que podría dar 403). */
export function canDo(caps: string[] | null | undefined, cap: string): boolean {
  return Boolean(caps && caps.includes(cap));
}
