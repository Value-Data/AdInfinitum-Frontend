/* ============================================================
   Descarga de gráficos como PNG.
   - downloadChartsZip: un PNG por gráfico, empaquetados en un ZIP.
   - downloadChartsPng: un único PNG con todo el contenedor (fallback/legacy).
   Usa html2canvas sobre el DOM ya renderizado en pantalla + jszip.
   ============================================================ */
import JSZip from 'jszip';

function sanitize(name: string): string {
  return (name || 'grafico')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'grafico';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Html2Canvas = (typeof import('html2canvas'))['default'];

async function elementToPngBlob(html2canvas: Html2Canvas, el: HTMLElement): Promise<Blob | null> {
  // El clon de html2canvas debe layoutearse con las dimensiones REALES de la página
  // (no del elemento), si no el ResponsiveContainer de recharts se re-mide más angosto
  // y el gráfico sale recortado (no llega al último día). Capturamos el elemento
  // completo (scrollWidth/Height) respetando el scroll actual de la página.
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: document.documentElement.offsetWidth,
    windowHeight: document.documentElement.offsetHeight,
  });
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Un PNG por gráfico (cada card con un chart), empaquetados en un ZIP. */
export async function downloadChartsZip(container: HTMLElement | null, baseName: string): Promise<void> {
  if (!container) return;
  const html2canvas = (await import('html2canvas')).default;
  // Cada gráfico se renderiza en una .card que contiene un <svg> de recharts.
  const cards = Array.from(container.querySelectorAll<HTMLElement>('.card')).filter(
    (c) => c.querySelector('svg'),
  );
  const targets = cards.length ? cards : [container];

  const zip = new JSZip();
  const used = new Set<string>();
  let i = 0;
  for (const el of targets) {
    i += 1;
    const rawTitle = el.querySelector('h4, h3')?.textContent?.trim() || `grafico_${i}`;
    let name = sanitize(rawTitle);
    // Evitar colisiones de nombre.
    let unique = name;
    let k = 1;
    while (used.has(unique)) {
      k += 1;
      unique = `${name}_${k}`;
    }
    used.add(unique);
    const blob = await elementToPngBlob(html2canvas, el);
    if (blob) zip.file(`${unique}.png`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, baseName.endsWith('.zip') ? baseName : `${baseName}.zip`);
}

/** Un único PNG con todo el contenedor de gráficos. */
export async function downloadChartsPng(el: HTMLElement | null, filename: string): Promise<void> {
  if (!el) return;
  const html2canvas = (await import('html2canvas')).default;
  const blob = await elementToPngBlob(html2canvas, el);
  if (blob) triggerDownload(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
}
