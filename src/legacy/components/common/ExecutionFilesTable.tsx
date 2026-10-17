import React from 'react';
import type { ExecutionFile } from '../../types';
import { downloadExecutionFile } from '../../api';
import { formatEs } from '../../../utils/numberFormat';
import { useT } from '../../../i18n/LanguageContext';

/**
 * Artefactos en disco de una ejecución, con su descarga.
 *
 * Los tres modos escriben CSVs y metadata en el mismo lugar y los sirven por el
 * mismo endpoint, así que la tabla es una sola. Antes vivía dentro de
 * `DynamicResultsView`; se movió acá al aparecer el tercer modo.
 */
export default function ExecutionFilesTable({
  executionId,
  files,
}: {
  executionId: string;
  files: ExecutionFile[];
}) {
  const t = useT();

  const handleDownload = async (name: string) => {
    const blob = await downloadExecutionFile(executionId, name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (files.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('dynres_files_not_local')}
      </p>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t('dynres_file')}</th>
          <th>{t('dynres_size')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.name}>
            <td className="font-mono text-xs">{f.name}</td>
            <td className="font-mono text-xs">{formatEs(f.size_bytes / 1024, 1)} KB</td>
            <td>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(f.name)}>
                {t('download')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
