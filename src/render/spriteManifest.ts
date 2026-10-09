import type { Archetype, Team } from '../engine/types';

export interface SheetSpec {
  url: string;
  cols: number;
  rows: number;
  frames: number;
  /** punto a terra (px nel frame) usato come ancora; default: centro orizzontale, bordo inferiore */
  footX?: number;
  footY?: number;
}

export interface ArchetypeSprites {
  idle: SheetSpec;
  attack: SheetSpec;
  /** altezza a schermo desiderata ≈ altezza del personaggio × scale */
  scale: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rettangoli dei primi `frames` frame di una sheet a griglia, in ordine di lettura. */
export function frameRects(width: number, height: number, spec: SheetSpec): Rect[] {
  const w = Math.floor(width / spec.cols);
  const h = Math.floor(height / spec.rows);
  const count = Math.min(spec.frames, spec.cols * spec.rows);
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    rects.push({ x: (i % spec.cols) * w, y: Math.floor(i / spec.cols) * h, w, h });
  }
  return rects;
}

/**
 * Sprite sheet in public/sprites/<squadra>/<classe>; i personaggi guardano a sinistra.
 * Giocatore: Tidus, Ramza, Fran. Nemico: Garland, Agrias, Lulu.
 */
export const SPRITE_MANIFEST: Record<Team, Record<Archetype, ArchetypeSprites>> = {
  player: {
    guardian: {
      scale: 1.3,
      idle: { url: '/sprites/player/guardian/idle.png', cols: 3, rows: 2, frames: 4, footX: 59, footY: 59 },
      attack: { url: '/sprites/player/guardian/atk.png', cols: 3, rows: 4, frames: 11, footX: 100, footY: 90 },
    },
    scout: {
      scale: 1.3,
      idle: { url: '/sprites/player/scout/idle.png', cols: 3, rows: 2, frames: 4, footX: 40, footY: 60 },
      attack: { url: '/sprites/player/scout/atk.png', cols: 3, rows: 4, frames: 12, footX: 80, footY: 65 },
    },
    crossbow: {
      scale: 1,
      idle: { url: '/sprites/player/crossbow/idle.png', cols: 3, rows: 2, frames: 4, footX: 24, footY: 80 },
      attack: { url: '/sprites/player/crossbow/atk.png', cols: 3, rows: 7, frames: 21, footX: 313, footY: 96 },
    },
  },
  ai: {
    guardian: {
      scale: 1.1,
      idle: { url: '/sprites/ai/guardian/idle.png', cols: 3, rows: 2, frames: 4, footX: 49, footY: 72 },
      attack: { url: '/sprites/ai/guardian/atk.png', cols: 3, rows: 4, frames: 11, footX: 105, footY: 78 },
    },
    scout: {
      scale: 1.3,
      idle: { url: '/sprites/ai/scout/idle.png', cols: 3, rows: 3, frames: 8, footX: 30, footY: 62 },
      attack: { url: '/sprites/ai/scout/atk.png', cols: 3, rows: 6, frames: 16, footX: 63, footY: 95 },
    },
    crossbow: {
      scale: 1.2,
      idle: { url: '/sprites/ai/crossbow/idle.png', cols: 3, rows: 2, frames: 4, footX: 31, footY: 66 },
      attack: { url: '/sprites/ai/crossbow/atk.png', cols: 3, rows: 9, frames: 26, footX: 138, footY: 95 },
    },
  },
};
