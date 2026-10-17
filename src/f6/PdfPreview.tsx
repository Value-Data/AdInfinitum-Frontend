/**
 * Vista previa del PDF página por página: el PDF del servidor (el oficial) en el visor
 * del navegador, con sus páginas, zoom y búsqueda. Se pide solo al abrirla.
 */
import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/LanguageContext';

export function PdfPreview({ load }: { load: () => Promise<Blob> }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'busy' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const abrir = async () => {
    setEstado('busy');
    setError(null);
    try {
      const b = await load();
      setUrl(URL.createObjectURL(b));
      setEstado('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEstado('error');
    }
  };
  const cerrar = () => { if (url) URL.revokeObjectURL(url); setUrl(null); };
  return (
    <div className="no-print mb-4">
      {url === null ? (
        <button className="btn btn-outline" onClick={abrir} disabled={estado === 'busy'} data-testid="pdf-preview-open">
          {estado === 'busy' ? t('f6_pdf_server_busy') : t('f6_pdf_preview')}
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('f6_pdf_preview_hint')}</span>
            <div className="flex-1" />
            <button className="btn btn-outline btn-sm" onClick={cerrar}>{t('f6_pdf_preview_close')}</button>
          </div>
          <iframe title="pdf-preview" src={url} className="w-full card"
                  style={{ height: '85vh', border: '1px solid var(--color-border)' }} />
        </>
      )}
      {estado === 'error' && (
        <p role="alert" className="text-sm mt-2" style={{ color: 'var(--color-danger)' }}>
          {t('f6_pdf_error')} ({error})
        </p>
      )}
    </div>
  );
}
