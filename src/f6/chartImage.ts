/**
 * Los gráficos de ECharts como imagen, para el zip de PNG y el PDF directo: se le pide a
 * cada instancia su imagen (`getDataURL`) en vez de fotografiar la pantalla. Sin
 * esperas atadas a `requestAnimationFrame` (que se congela con la pestaña oculta):
 * ECharts ya dibujó al recibir las opciones, y cada carga tiene su tiempo máximo.
 */
import { echarts, type EChartsInstance } from './echartsSetup';

/** Lado máximo de un lienzo (los navegadores no dibujan lienzos mucho mayores). */
const MAX_CANVAS = 16000;
const CABECERA = 28;
/** Tiempo máximo para cargar la imagen de un gráfico. */
export const IMAGE_TIMEOUT_MS = 15000;

/** La promesa, o un error con `mensaje` si tarda más de `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, mensaje: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_ok, mal) => { timer = setTimeout(() => mal(new Error(mensaje)), ms); });
  return Promise.race([p, limite]).finally(() => clearTimeout(timer));
}

/** Las instancias de ECharts dentro de un elemento, en el orden de la página. */
export function chartsIn(el: HTMLElement): EChartsInstance[] {
  return Array.from(el.querySelectorAll<HTMLElement>('.echarts-for-react'))
    .map((d) => echarts.getInstanceByDom(d))
    .filter((i): i is EChartsInstance => Boolean(i) && !i!.isDisposed());
}

function cargar(url: string): Promise<HTMLImageElement> {
  return withTimeout(new Promise<HTMLImageElement>((ok, mal) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => mal(new Error('No se pudo leer la imagen del gráfico'));
    im.src = url;
  }), IMAGE_TIMEOUT_MS, 'El gráfico tardó demasiado en convertirse en imagen');
}

/** Un gráfico como imagen (PNG del lienzo, o su SVG si se dibujó en SVG), sin la caja de
 * herramientas ni la barra de zoom. */
export function chartImage(inst: EChartsInstance, pixelRatio = 2): Promise<HTMLImageElement> {
  return cargar(inst.getDataURL({
    type: 'png', pixelRatio, backgroundColor: '#ffffff', excludeComponents: ['toolbox', 'dataZoom'],
  }));
}

/**
 * Los gráficos de un panel (uno debajo del otro) en un lienzo, con fondo blanco y su
 * título arriba. Un panel muy ancho (serie larga) baja la escala para no pasarse del
 * lienzo máximo. null si el panel no tiene gráficos.
 */
export async function panelCanvas(panel: HTMLElement, titulo: string, pixelRatio = 2): Promise<HTMLCanvasElement | null> {
  const charts = chartsIn(panel);
  if (charts.length === 0) return null;
  const medidas = charts.map((c) => ({ w: c.getWidth(), h: c.getHeight() }));
  const ancho = Math.max(...medidas.map((m) => m.w));
  const alto = medidas.reduce((a, m) => a + m.h, 0) + CABECERA;
  if (ancho <= 0 || alto <= CABECERA) return null;
  const escala = Math.min(pixelRatio, MAX_CANVAS / ancho, MAX_CANVAS / alto);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no entregó un lienzo para el gráfico');
  ctx.scale(escala, escala);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(titulo, 8, 18);
  let y = CABECERA;
  for (const [i, c] of charts.entries()) {
    const img = await chartImage(c, escala);
    ctx.drawImage(img, 0, y, medidas[i].w, medidas[i].h);
    y += medidas[i].h;
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return withTimeout(new Promise<Blob>((ok, mal) => canvas.toBlob(
    (b) => (b ? ok(b) : mal(new Error('No se pudo armar el PNG'))), 'image/png')),
  IMAGE_TIMEOUT_MS, 'El PNG tardó demasiado en armarse');
}
