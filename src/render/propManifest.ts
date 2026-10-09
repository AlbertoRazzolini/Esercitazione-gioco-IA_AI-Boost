import type { PropKind } from '../engine/types';

export const PROPS_URL = '/map/props.png';
/** Dimensioni del foglio generato; servono solo per controllare i riquadri. */
export const PROPS_SHEET = { width: 1536, height: 1024 };

export interface PropSprite {
  /** riquadro dell'oggetto nel foglio, in pixel */
  rect: { x: number; y: number; w: number; h: number };
  /** punto a terra (centro della base) nel foglio, in pixel; coincide con il centro delle caselle occupate */
  foot: { x: number; y: number };
  /** pixel del mondo per pixel del foglio */
  scale: number;
}

/**
 * Oggetti del foglio `public/map/props.png` (sfondo magenta). I riquadri non seguono la griglia 3×2:
 * la tenda sconfina nella cella accanto. Per aggiustare dimensioni e allineamento basta cambiare
 * `scale` e `foot`: le regole di gioco non dipendono da questi valori.
 */
export const PROP_SPRITES: Partial<Record<PropKind, PropSprite>> = {
  tent: { rect: { x: 32, y: 80, w: 496, h: 400 }, foot: { x: 295, y: 345 }, scale: 0.31 },
  brazier: { rect: { x: 680, y: 160, w: 168, h: 280 }, foot: { x: 765, y: 398 }, scale: 0.24 },
  ruin: { rect: { x: 1048, y: 96, w: 448, h: 400 }, foot: { x: 1270, y: 395 }, scale: 0.3 },
  cart: { rect: { x: 72, y: 592, w: 400, h: 304 }, foot: { x: 270, y: 790 }, scale: 0.27 },
  crates: { rect: { x: 616, y: 608, w: 296, h: 304 }, foot: { x: 765, y: 835 }, scale: 0.22 },
  fence: { rect: { x: 1080, y: 584, w: 376, h: 328 }, foot: { x: 1268, y: 835 }, scale: 0.26 },
};
