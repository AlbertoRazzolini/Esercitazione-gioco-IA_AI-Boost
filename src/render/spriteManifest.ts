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
  /** corsa/camminata: una pose singola (frames: 1) oppure un ciclo; se manca si usa l'idle */
  move?: SheetSpec;
  /** altezza a schermo desiderata ≈ altezza del personaggio × scale */
  scale: number;
  /** proiettile degli attacchi a distanza (default: quadrello) */
  projectile?: 'bolt' | 'fire';
  /** velocità dei frame d'attacco (frame per tick; default 0.3 mischia, 0.4 distanza) */
  attackSpeed?: number;
  /** ms dopo i quali parte il proiettile, a partire dall'inizio dell'animazione (default 380) */
  launchMs?: number;
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
      move: { url: '/sprites/player/guardian/move.png', cols: 1, rows: 1, frames: 1, footX: 41, footY: 57 },
    },
    scout: {
      scale: 1.3,
      idle: { url: '/sprites/player/scout/idle.png', cols: 3, rows: 2, frames: 4, footX: 40, footY: 60 },
      attack: { url: '/sprites/player/scout/atk.png', cols: 3, rows: 4, frames: 12, footX: 80, footY: 65 },
      move: { url: '/sprites/player/scout/move.png', cols: 3, rows: 2, frames: 4, footX: 36, footY: 50 },
    },
    crossbow: {
      scale: 1,
      idle: { url: '/sprites/player/crossbow/idle.png', cols: 3, rows: 2, frames: 4, footX: 24, footY: 80 },
      attack: { url: '/sprites/player/crossbow/atk.png', cols: 3, rows: 7, frames: 21, footX: 313, footY: 96 },
      move: { url: '/sprites/player/crossbow/move.png', cols: 3, rows: 2, frames: 4, footX: 25, footY: 74 },
    },
  },
  ai: {
    guardian: {
      scale: 1.1,
      idle: { url: '/sprites/ai/guardian/idle.png', cols: 3, rows: 2, frames: 4, footX: 49, footY: 72 },
      attack: { url: '/sprites/ai/guardian/atk.png', cols: 3, rows: 4, frames: 11, footX: 105, footY: 78 },
      move: { url: '/sprites/ai/guardian/move.png', cols: 1, rows: 1, frames: 1, footX: 49, footY: 63 },
    },
    scout: {
      scale: 1.3,
      idle: { url: '/sprites/ai/scout/idle.png', cols: 3, rows: 3, frames: 8, footX: 30, footY: 62 },
      attack: { url: '/sprites/ai/scout/atk.png', cols: 3, rows: 6, frames: 16, footX: 63, footY: 95 },
      move: { url: '/sprites/ai/scout/move.png', cols: 1, rows: 1, frames: 1, footX: 39, footY: 57 },
    },
    // Lulu: lancia Fuoco con l'animazione di incantesimo (magic.png); il foglio atk.png lancia una bambola ed esce dal frame
    crossbow: {
      scale: 1.2,
      projectile: 'fire',
      attackSpeed: 0.12,
      launchMs: 330,
      idle: { url: '/sprites/ai/crossbow/idle.png', cols: 3, rows: 2, frames: 4, footX: 31, footY: 66 },
      attack: { url: '/sprites/ai/crossbow/magic.png', cols: 3, rows: 2, frames: 4, footX: 31, footY: 84 },
      move: { url: '/sprites/ai/crossbow/move.png', cols: 1, rows: 1, frames: 1, footX: 27, footY: 66 },
    },
  },
};
