/* ============================================================
   PDF del reporte (A4), como en la versión anterior: se captura el reporte bloque a
   bloque (`.pdf-block`) con html2canvas y se arma un jsPDF de varias páginas. Por
   bloques y no en un solo lienzo: evita el límite de alto de lienzo del navegador y
   corta mejor las páginas (un bloque que cabe no se parte; uno más alto que una
   página se rebana). `.pdf-page-break` fuerza página nueva. Lo marcado `no-print` o
   `data-pdf-ignore` no sale.

   Los paneles de gráficos (`[data-chart-title]`) no pasan por html2canvas: cada
   gráfico de ECharts entrega su imagen (`getDataURL`, a 2x) y se compone con su título.
   Nada espera a `requestAnimationFrame` (con la pestaña oculta no corre): cada bloque
   tiene un tiempo máximo y, si se pasa, el PDF falla con un error que dice cuál.

   jsPDF + html2canvas pesan (~1.3 MB): se cargan al pedir el PDF (import dinámico), en
   un chunk aparte del bundle principal.
   ============================================================ */

import { panelCanvas, withTimeout } from '../f6/chartImage';

const A4_W = 210; // mm
const A4_H = 297; // mm
const MARGIN = 8; // mm
const GAP = 4; // mm entre bloques
const CONTENT_W = A4_W - MARGIN * 2;

/** Tiempo máximo para capturar un bloque. */
export const BLOCK_TIMEOUT_MS = 30000;

type Html2Canvas = (typeof import('html2canvas'))['default'];

function ignorar(el: Element): boolean {
  return el.classList?.contains('no-print') || el.hasAttribute?.('data-pdf-ignore');
}

function nombreBloque(el: HTMLElement): string {
  const texto = el.dataset.chartTitle ?? el.querySelector('h1,h2,h3,h4')?.textContent ?? el.textContent ?? '';
  return texto.trim().slice(0, 60) || el.tagName.toLowerCase();
}

async function captureBlock(html2canvas: Html2Canvas, el: HTMLElement): Promise<HTMLCanvasElement | null> {
  const titulo = el.dataset.chartTitle;
  if (titulo !== undefined) {
    const lienzo = await panelCanvas(el, titulo);
    if (lienzo) return lienzo;
  }
  return html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
    ignoreElements: ignorar,
  });
}

function sliceCanvas(canvas: HTMLCanvasElement, sy: number, sliceHpx: number): string {
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = sliceHpx;
  const ctx = tmp.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
  }
  return tmp.toDataURL('image/png');
}

/** Bloques a capturar: los `.pdf-block` que no están dentro de otro `.pdf-block` (ni de
 * algo ignorado); sin ninguno, el contenedor entero. */
export function pdfBlocks(container: HTMLElement): HTMLElement[] {
  const todos = Array.from(container.querySelectorAll<HTMLElement>('.pdf-block'));
  const bloques = todos.filter((b) => !b.parentElement?.closest('.pdf-block')
    && !b.closest('.no-print, [data-pdf-ignore]'));
  return bloques.length > 0 ? bloques : [container];
}

/** Arma un PDF A4 vertical de varias páginas con el contenedor y lo baja. */
export async function generatePdfFromContainer(container: HTMLElement, filename: string): Promise<void> {
  const [{ jsPDF }, html2canvas] = await withTimeout(Promise.all([
    import('jspdf'),
    import('html2canvas').then((m) => m.default),
  ]), BLOCK_TIMEOUT_MS, 'PDF: no se pudieron cargar las librerías del PDF (¿sin conexión?)');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableH = A4_H - MARGIN;

  let cursorY = MARGIN;
  let firstPlacement = true;

  for (const block of pdfBlocks(container)) {
    if (block.offsetWidth === 0 || block.offsetHeight === 0) continue;
    if (block.classList.contains('pdf-page-break') && cursorY > MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }
    const canvas = await withTimeout(captureBlock(html2canvas, block), BLOCK_TIMEOUT_MS,
      `PDF: el bloque "${nombreBloque(block)}" tardó más de ${BLOCK_TIMEOUT_MS / 1000} s en capturarse`);
    if (!canvas || canvas.width === 0 || canvas.height === 0) continue;
    const imgH = (canvas.height * CONTENT_W) / canvas.width; // mm

    if (imgH <= A4_H - MARGIN * 2) {
      if (!firstPlacement && cursorY + imgH > usableH) {
        doc.addPage();
        cursorY = MARGIN;
      }
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN, cursorY, CONTENT_W, imgH);
      cursorY += imgH + GAP;
    } else {
      const pageHpx = (canvas.width * (A4_H - MARGIN * 2)) / CONTENT_W;
      let sy = 0;
      while (sy < canvas.height) {
        const sliceHpx = Math.min(pageHpx, canvas.height - sy);
        const sliceImgH = (sliceHpx * CONTENT_W) / canvas.width;
        if (!firstPlacement) doc.addPage();
        doc.addImage(sliceCanvas(canvas, sy, sliceHpx), 'PNG', MARGIN, MARGIN, CONTENT_W, sliceImgH);
        cursorY = MARGIN + sliceImgH + GAP;
        firstPlacement = false;
        sy += sliceHpx;
      }
    }
    firstPlacement = false;
  }

  doc.save(filename);
}
