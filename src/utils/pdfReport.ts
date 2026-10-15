/* ============================================================
   PDF del reporte (A4), como en la versión anterior: se captura el reporte bloque a
   bloque (`.pdf-block`) con html2canvas y se arma un jsPDF de varias páginas. Por
   bloques y no en un solo lienzo: evita el límite de alto de lienzo del navegador y
   corta mejor las páginas (un bloque que cabe no se parte; uno más alto que una
   página se rebana). `.pdf-page-break` fuerza página nueva. Lo marcado `no-print` o
   `data-pdf-ignore` no sale.

   jsPDF + html2canvas pesan (~1.3 MB): se cargan al pedir el PDF (import dinámico), en
   un chunk aparte del bundle principal.
   ============================================================ */

const A4_W = 210; // mm
const A4_H = 297; // mm
const MARGIN = 8; // mm
const GAP = 4; // mm entre bloques
const CONTENT_W = A4_W - MARGIN * 2;

type Html2Canvas = (typeof import('html2canvas'))['default'];

function ignorar(el: Element): boolean {
  return el.classList?.contains('no-print') || el.hasAttribute?.('data-pdf-ignore');
}

async function captureBlock(html2canvas: Html2Canvas, el: HTMLElement): Promise<HTMLCanvasElement> {
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
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import('jspdf'),
    import('html2canvas').then((m) => m.default),
  ]);
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
    const canvas = await captureBlock(html2canvas, block);
    if (canvas.width === 0 || canvas.height === 0) continue;
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
