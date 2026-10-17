import React, { useEffect, useRef } from 'react';
import StaticReportDocument, { type StaticReportProps } from './StaticReportDocument';
import { generatePdfFromContainer } from '../utils/pdfReport';

/**
 * Genera el PDF del reporte estático de la ejecución actual. No tiene UI de
 * selección (a diferencia del dinámico): al abrirse renderiza el documento
 * offscreen, espera a que recharts asiente, y captura con el mismo motor pdfReport.
 */
export default function StaticReportModal({
  open,
  onClose,
  onError,
  data,
}: {
  open: boolean;
  onClose: () => void;
  onError?: (msg: string) => void;
  data: StaticReportProps;
}) {
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      // Dejar que recharts (ResponsiveContainer) termine de medir/animar.
      await new Promise((r) => setTimeout(r, 1600));
      if (cancelled || !reportRef.current) return;
      try {
        const safe = (data.projectName || 'reporte').replace(/[^a-z0-9-_]+/gi, '_');
        await generatePdfFromContainer(reportRef.current, `reporte_estatico_${safe}.pdf`);
      } catch (e) {
        onError?.(String((e as Error).message || e));
      } finally {
        if (!cancelled) onClose();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, data, onClose, onError]);

  if (!open) return null;
  return (
    <div
      aria-hidden
      style={{ position: 'fixed', left: -100000, top: 0, zIndex: -1, pointerEvents: 'none' }}
    >
      <div ref={reportRef}>
        <StaticReportDocument {...data} />
      </div>
    </div>
  );
}
