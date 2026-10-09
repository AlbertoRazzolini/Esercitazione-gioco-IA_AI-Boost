/** Ellisse, in frazioni dell'immagine, che circonda una pozza di luce dipinta. */
export interface GlowSpot {
  /** centro: frazione della larghezza e dell'altezza dell'immagine */
  u: number;
  v: number;
  /** semiassi: frazione della larghezza e dell'altezza */
  rx: number;
  ry: number;
}

/**
 * Pozze di luce dipinte nel terreno che non cadono su un braciere e quindi vanno spente.
 * Il prompt chiedeva due pozze sotto i bracieri (3,3) e (8,5); il generatore ha messo la prima
 * (circa 25% da sinistra, 18% dall'alto) sotto il carro. La seconda cade bene e resta.
 */
export const MISPLACED_GLOWS: GlowSpot[] = [{ u: 0.255, v: 0.184, rx: 0.16, ry: 0.19 }];

const RING_FROM = 1.15;
const RING_TO = 1.4;
const FADE_START = 0.6;

const luminance = (r: number, g: number, b: number): number => 0.3 * r + 0.59 * g + 0.11 * b;

/**
 * Spegne una pozza di luce dipinta: porta i colori verso quelli del terreno intorno (anello esterno)
 * mantenendo la variazione di luminosità, quindi la texture resta leggibile. Modifica `data` (RGBA)
 * sul posto e non tocca l'opacità.
 */
export function neutralizeGlow(data: Uint8ClampedArray, width: number, height: number, spot: GlowSpot): void {
  const cx = spot.u * width;
  const cy = spot.v * height;
  const rx = spot.rx * width;
  const ry = spot.ry * height;
  const dist = (x: number, y: number) => Math.hypot((x - cx) / rx, (y - cy) / ry);
  const minX = Math.max(0, Math.floor(cx - rx * RING_TO));
  const maxX = Math.min(width - 1, Math.ceil(cx + rx * RING_TO));
  const minY = Math.max(0, Math.floor(cy - ry * RING_TO));
  const maxY = Math.min(height - 1, Math.ceil(cy + ry * RING_TO));

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = dist(x, y);
      if (d <= RING_FROM || d >= RING_TO) continue;
      const i = (y * width + x) * 4;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      count++;
    }
  }
  if (count === 0) return;
  const ring = [sumR / count, sumG / count, sumB / count];
  const ringLum = Math.max(1, luminance(ring[0], ring[1], ring[2]));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = dist(x, y);
      if (d >= RING_FROM) continue;
      let a = d < FADE_START ? 1 : 1 - (d - FADE_START) / (RING_FROM - FADE_START);
      a = a * a * (3 - 2 * a);
      const i = (y * width + x) * 4;
      const k = Math.min(1.6, Math.max(0.55, (luminance(data[i], data[i + 1], data[i + 2]) / ringLum) * 0.55));
      for (let c = 0; c < 3; c++) {
        data[i + c] = data[i + c] * (1 - a) + ring[c] * k * a;
      }
    }
  }
}
