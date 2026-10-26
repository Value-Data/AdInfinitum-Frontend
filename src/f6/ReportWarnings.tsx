/**
 * Los avisos del reporte del dinámico de una etapa (cambios finales, puntos 6 y 14): una
 * poza que sube sin parar, un nivel sobre la berma, un balance de Li que no cierra. Van en
 * un recuadro al inicio de la etapa, como en el PDF del servidor. El texto viene redactado
 * del backend en los dos idiomas; el título de cada aviso es la etiqueta
 * `result.warning_<code>` del diccionario. El front no calcula nada.
 */
import React from 'react';
import type { ReportWarning } from '../types/report';
import { useLabels } from './labels';
import { useLanguage, useT } from '../i18n/LanguageContext';

export function ReportWarnings({ warnings, testId = 'report-warnings' }: {
  warnings: ReportWarning[]; testId?: string;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const { label } = useLabels();
  if (warnings.length === 0) return null;
  const titulo = label('result.report_warnings', t('f9_warnings_title'));
  const id = `${testId}-title`;
  return (
    <section className="card p-3 mb-4 text-sm pdf-block" data-testid={testId} aria-labelledby={id}
             style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
      <h4 id={id} className="text-sm font-semibold mb-2">
        {titulo} ({warnings.length})
      </h4>
      <ul className="space-y-2">
        {warnings.map((w, i) => (
          <li key={`${w.code}-${w.pond ?? ''}-${i}`} data-testid={`${testId}-item`} data-code={w.code}>
            <div className="font-semibold">
              {label(`result.warning_${w.code}`, t('f9_warning'))}
              {w.pond && <span className="font-normal"> · {w.pond}</span>}
            </div>
            <p style={{ maxWidth: '75ch' }}>{w.message[lang] ?? w.message.es ?? w.message.en ?? ''}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
