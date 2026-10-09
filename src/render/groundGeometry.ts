import { toScreen } from './iso';

/** Matrice affine 2D come nel canvas: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface GroundOptions {
  /** angolo in alto a sinistra del canvas di destinazione, in coordinate del mondo (default: origine) */
  originX?: number;
  originY?: number;
  /** fattore di risoluzione del canvas di destinazione (default 1) */
  scale?: number;
}

/**
 * Proietta un'immagine vista dall'alto (una cella = imgW/cols × imgH/rows pixel) sul rombo isometrico
 * della mappa. L'angolo (0,0) dell'immagine va sull'angolo alto del rombo, e il centro di ogni cella
 * sul centro della cella isometrica.
 */
export function groundTransform(
  imgW: number,
  imgH: number,
  cols: number,
  rows: number,
  options: GroundOptions = {},
): Affine {
  const { originX = 0, originY = 0, scale = 1 } = options;
  const cellW = imgW / cols;
  const cellH = imgH / rows;
  const top = toScreen({ x: -0.5, y: -0.5 });
  const right = toScreen({ x: cols - 0.5, y: -0.5 });
  const left = toScreen({ x: -0.5, y: rows - 0.5 });
  // asse u (verso destra nell'immagine) → lato alto-destra del rombo; asse v (verso il basso) → lato alto-sinistra
  const du = { x: (right.x - top.x) / (cellW * cols), y: (right.y - top.y) / (cellW * cols) };
  const dv = { x: (left.x - top.x) / (cellH * rows), y: (left.y - top.y) / (cellH * rows) };
  return {
    a: du.x * scale,
    b: du.y * scale,
    c: dv.x * scale,
    d: dv.y * scale,
    e: (top.x - originX) * scale,
    f: (top.y - originY) * scale,
  };
}

export function applyAffine(m: Affine, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** Rettangolo del mondo che contiene il rombo della mappa. */
export function groundBounds(cols: number, rows: number): { x: number; y: number; w: number; h: number } {
  const corners = [
    toScreen({ x: -0.5, y: -0.5 }),
    toScreen({ x: cols - 0.5, y: -0.5 }),
    toScreen({ x: -0.5, y: rows - 0.5 }),
    toScreen({ x: cols - 0.5, y: rows - 0.5 }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
