export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Quanto un pixel è vicino al magenta: alto per il fondo, basso o negativo per i colori degli oggetti. */
const MAGENTA_THRESHOLD = 60;
/** Sotto questa luminosità un pixel magenta è l'ombra di contatto, non il fondo. */
const SHADOW_MAX = 170;

/**
 * Toglie lo sfondo magenta del foglio generato. Il magenta brillante diventa trasparente, quello scuro
 * (ombra di contatto retinata) un'ombra scura semitrasparente, tutto il resto resta com'è.
 */
export function keyPixel(r: number, g: number, b: number): Rgba {
  const magenta = Math.min(r, b) - g;
  if (magenta <= MAGENTA_THRESHOLD) return { r, g, b, a: 255 };
  if (Math.max(r, b) < SHADOW_MAX) return { r: 20, g: 12, b: 28, a: 140 };
  return { r: 0, g: 0, b: 0, a: 0 };
}
