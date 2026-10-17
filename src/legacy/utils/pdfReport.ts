/* ============================================================
   PDF report generation for the dynamic model.
   Captures a flat report DOM (rendered by DynamicReportDocument) block by
   block with html2canvas and lays the images into a multi-page A4 jsPDF.

   Block-wise (instead of one giant canvas) avoids the browser per-canvas
   height limit and produces cleaner page breaks: each `.pdf-block` is kept
   together on a page when it fits; blocks taller than a page are sliced.
   ============================================================ */

// jsPDF + html2canvas are heavy (~1.3 MB). Load them on demand (dynamic import)
// so they land in a lazy chunk instead of the main bundle.

const A4_W = 210; // mm
const A4_H = 297; // mm
const MARGIN = 8; // mm
const GAP = 4; // mm between blocks
const CONTENT_W = A4_W - MARGIN * 2;

type Html2Canvas = (typeof import('html2canvas'))['default'];

async function captureBlock(
  html2canvas: Html2Canvas,
  el: HTMLElement,
): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });
}

function sliceCanvas(
  canvas: HTMLCanvasElement,
  sy: number,
  sliceHpx: number,
): string {
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

/**
 * Generate a multi-page A4 PDF from a container and download it.
 * Captures each direct `.pdf-block` descendant; if none are found, captures
 * the whole container as a single block.
 */
export async function generatePdfFromContainer(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import('jspdf'),
    import('html2canvas').then((m) => m.default),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableH = A4_H - MARGIN; // bottom limit (y where content must end)

  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('.pdf-block'),
  );
  const targets = blocks.length > 0 ? blocks : [container];

  let cursorY = MARGIN;
  let firstPlacement = true;

  for (const block of targets) {
    if (block.offsetWidth === 0 || block.offsetHeight === 0) continue;

    // Force a new page before blocks marked with `pdf-page-break` (e.g. each
    // stage header), so processes don't run together across the page.
    if (block.classList.contains('pdf-page-break') && cursorY > MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }

    const canvas = await captureBlock(html2canvas, block);
    if (canvas.width === 0 || canvas.height === 0) continue;

    const imgH = (canvas.height * CONTENT_W) / canvas.width; // mm

    if (imgH <= A4_H - MARGIN * 2) {
      // Fits on a single page — keep block intact, paginate if needed.
      if (!firstPlacement && cursorY + imgH > usableH) {
        doc.addPage();
        cursorY = MARGIN;
      }
      doc.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        MARGIN,
        cursorY,
        CONTENT_W,
        imgH,
      );
      cursorY += imgH + GAP;
    } else {
      // Taller than a page — slice into page-height chunks, each on its own page.
      const pageHpx = (canvas.width * (A4_H - MARGIN * 2)) / CONTENT_W;
      let sy = 0;
      while (sy < canvas.height) {
        const sliceHpx = Math.min(pageHpx, canvas.height - sy);
        const sliceImgH = (sliceHpx * CONTENT_W) / canvas.width;
        if (!firstPlacement) {
          doc.addPage();
        }
        doc.addImage(
          sliceCanvas(canvas, sy, sliceHpx),
          'PNG',
          MARGIN,
          MARGIN,
          CONTENT_W,
          sliceImgH,
        );
        cursorY = MARGIN + sliceImgH + GAP;
        firstPlacement = false;
        sy += sliceHpx;
      }
    }
    firstPlacement = false;
  }

  doc.save(filename);
}
