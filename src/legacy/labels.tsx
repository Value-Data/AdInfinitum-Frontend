/** Etiquetas y banner de las ejecuciones de la versión anterior. */
import React from 'react';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

const TYPE_LABEL: Record<string, TranslationKey> = {
  preconcentracion: 'runsim_preconcentracion',
  proceso_completo: 'runsim_proceso_completo',
  modelo_dinamico_cascade: 'cascade_label',
  modelo_dinamico_encalado: 'encalado_label',
  modelo_dinamico_postliming: 'postliming_label',
};

export function isLegacyDynamic(tipo: string): boolean {
  return tipo.startsWith('modelo_dinamico_');
}

/** "Estático · Proceso Completo", "Dinámico · Concentración (Pz10-Pz18)". */
export function legacyTypeLabel(tipo: string, t: (k: TranslationKey) => string): string {
  const k = TYPE_LABEL[tipo];
  if (!k) return tipo;
  const motor = t(isLegacyDynamic(tipo) ? 'f6_type_dynamic_precon' : 'f6_type_static_full')
    .split('·')[0].trim();
  return `${motor} · ${t(k)}`;
}

export function LegacyBanner() {
  const t = useT();
  return (
    <div className="card p-3 mb-4 text-sm font-medium" role="status" data-testid="legacy-banner"
         style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
      {t('legacy_banner')}
    </div>
  );
}
