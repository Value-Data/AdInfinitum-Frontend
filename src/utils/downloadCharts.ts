/* ============================================================
   Descarga los gráficos visibles (contenedor) como una imagen PNG.
   Usa html2canvas (carga diferida) sobre el DOM ya renderizado en pantalla.
   ============================================================ */
export async function downloadChartsPng(el: HTMLElement | null, filename: string): Promise<void> {
  if (!el) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
