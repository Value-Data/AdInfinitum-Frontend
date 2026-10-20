/**
 * Pozas de evaporación vistas desde arriba: terrazas rectangulares sobre el salar, con la
 * salmuera pasando de azul (diluida) a turquesa y a amarillo pálido (concentrada). Esquema
 * plano, sin sombras: es la marca del login y de la portada.
 *
 * Los colores salen de los tokens (`tokens.css`) mezclados con `color-mix`; no hay hex
 * sueltos. El amarillo concentrado mezcla `--chart-series-4` con blanco: si esa serie
 * cambia (y su espejo en `f6/chartData.ts`), cambian también las últimas pozas. Un
 * navegador sin `color-mix` (anterior a 2023) recibe el token más cercano de cada color.
 */
import React from 'react';

/** Un color: la mezcla y el token puro que la reemplaza si no hay `color-mix`. */
type Color = [mezcla: string, token: string];

const AMARILLO = 'color-mix(in srgb, var(--chart-series-4) 40%, var(--color-surface))';
const hacia = (pct: number, token: string): Color =>
  [`color-mix(in srgb, var(--color-accent) ${pct}%, ${AMARILLO})`, token];

// Una poza: posición en el plano y color de la salmuera, en el orden en que la recorre
// (en zigzag: la fila del medio va de derecha a izquierda).
const POZAS: { x: number; y: number; w: number; h: number; color: Color }[] = [
  { x: 36, y: 34, w: 152, h: 86, color: ['var(--color-primary-light)', 'var(--color-primary-light)'] },
  { x: 196, y: 34, w: 152, h: 86,
    color: ['color-mix(in srgb, var(--color-primary-light) 50%, var(--color-accent))', 'var(--color-primary-light)'] },
  { x: 248, y: 128, w: 100, h: 64, color: ['var(--color-accent)', 'var(--color-accent)'] },
  { x: 142, y: 128, w: 98, h: 64, color: hacia(80, 'var(--color-accent)') },
  { x: 36, y: 128, w: 98, h: 64, color: hacia(60, 'var(--color-accent)') },
  { x: 36, y: 200, w: 72, h: 48, color: hacia(40, 'var(--color-accent-light)') },
  { x: 116, y: 200, w: 72, h: 48, color: hacia(25, 'var(--color-accent-light)') },
  { x: 196, y: 200, w: 72, h: 48, color: hacia(10, 'var(--color-warning-bg)') },
  { x: 276, y: 200, w: 72, h: 48, color: [AMARILLO, 'var(--color-warning-bg)'] },
];

// Costra del salar (gris arena) y pretiles de sal compactada, más claros que el suelo.
const SUELO_MEZCLA = 'color-mix(in srgb, var(--color-warning) 10%, var(--color-border))';
const SUELO: Color = [SUELO_MEZCLA, 'var(--color-border)'];
const PRETIL: Color = [`color-mix(in srgb, var(--color-surface) 70%, ${SUELO_MEZCLA})`, 'var(--color-surface)'];
const GRANO: Color = [`color-mix(in srgb, var(--color-text-secondary) 35%, ${SUELO_MEZCLA})`,
  'var(--color-text-secondary)'];

// Los tokens van en `style`: `var()` en un atributo de presentación no es seguro en todos
// los navegadores.
const TRAZO = { stroke: 'var(--color-primary)' };

/** `color-mix` con `var()` adentro no se descarta al parsear: hay que preguntarle al navegador. */
function conMezcla(): boolean {
  return typeof CSS !== 'undefined' && Boolean(CSS.supports?.('color', 'color-mix(in srgb, red 50%, blue)'));
}

function sinMovimiento(): boolean {
  return typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export default function PondsIllustration({ className, title, animated = false }: {
  className?: string;
  /** Con título es una imagen con nombre; sin él, decoración que el lector de pantalla salta. */
  title?: string;
  /** Las pozas se llenan una tras otra, en el orden en que pasa la salmuera. */
  animated?: boolean;
}) {
  const id = React.useId().replace(/:/g, '');
  const llenar = animated && !sinMovimiento();
  const i = conMezcla() ? 0 : 1;
  const pinta = (c: Color) => ({ fill: c[i] });
  const a11y = title ? { role: 'img', 'aria-labelledby': `${id}-t` } : { 'aria-hidden': true };
  return (
    <svg viewBox="0 0 384 282" className={className} xmlns="http://www.w3.org/2000/svg"
         preserveAspectRatio="xMidYMid slice" focusable="false" {...a11y}>
      {title && <title id={`${id}-t`}>{title}</title>}
      <defs>
        <pattern id={`${id}-grano`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="0.9" style={pinta(GRANO)} />
          <circle cx="10" cy="10" r="0.7" style={pinta(GRANO)} />
          <circle cx="11" cy="2" r="0.5" style={pinta(GRANO)} />
        </pattern>
      </defs>
      <rect width="384" height="282" style={pinta(SUELO)} />
      <rect width="384" height="282" fill={`url(#${id}-grano)`} opacity="0.7" />
      <g transform="rotate(-4 192 141)">
        {/* Pozos de bombeo y la línea que alimenta la primera poza. */}
        <path d="M30 17 H112 V31" fill="none" style={TRAZO} strokeWidth="1.5"
              strokeLinecap="round" opacity="0.6" />
        {[30, 54, 78].map((cx) => (
          <circle key={cx} cx={cx} cy="17" r="3" style={{ ...TRAZO, fill: 'var(--color-surface)' }}
                  strokeWidth="1.5" opacity="0.8" />
        ))}
        {POZAS.map((p, n) => (
          <g key={n} className={llenar ? 'adinf-fade-in' : undefined}
             style={llenar ? { animationDelay: `${120 + n * 70}ms`, animationDuration: '420ms' } : undefined}>
            <rect x={p.x - 3} y={p.y - 3} width={p.w + 6} height={p.h + 6} rx="3" style={pinta(PRETIL)} />
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="2" style={pinta(p.color)} />
            {/* Orilla baja: una franja más clara por dentro del pretil. */}
            <rect x={p.x + 2} y={p.y + 2} width={p.w - 4} height={p.h - 4} rx="1.5" fill="none"
                  style={{ stroke: 'var(--color-surface)' }} strokeWidth="1" opacity="0.25" />
          </g>
        ))}
        {/* Paso de la salmuera de una terraza a la siguiente. */}
        <path d="M188 77 H196 M300 120 V128 M240 160 H248 M134 160 H142 M72 192 V200
                 M108 224 H116 M188 224 H196 M268 224 H276"
              style={TRAZO} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </g>
    </svg>
  );
}
