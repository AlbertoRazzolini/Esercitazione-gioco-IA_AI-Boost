import type { Archetype, Arena, Pos, Prop, Team, TerrainKind } from './types';

export const ARENA_WIDTH = 12;
export const ARENA_HEIGHT = 9;

const TERRAIN_ROWS = [
  'ggvggggggdgg',
  'gggdddddgggg',
  'gdddmdddddgg',
  'ddmmmmmmmddd',
  'dddmmmmmmmdd',
  'ddmmmmmmmddd',
  'gggdddmddggg',
  'ggvgdddddggv',
  'gggggdgggggg',
];

const TERRAIN_CODES: Record<string, TerrainKind> = { g: 'grass', d: 'dirt', m: 'mud', v: 'gravel' };

/**
 * Disposizione simmetrica per punto (x,y) ↔ (11−x, 8−y): nessuno schieramento è avvantaggiato.
 * Gruppi distinti di ostacoli non sono mai adiacenti (diagonali comprese).
 */
const PROPS: Prop[] = [
  { kind: 'tent', solid: true, cells: [{ x: 5, y: 1 }, { x: 6, y: 1 }, { x: 5, y: 2 }, { x: 6, y: 2 }] },
  { kind: 'ruin', solid: true, cells: [{ x: 5, y: 6 }, { x: 6, y: 6 }, { x: 5, y: 7 }, { x: 6, y: 7 }] },
  { kind: 'cart', solid: true, cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
  { kind: 'fence', solid: true, cells: [{ x: 9, y: 7 }, { x: 10, y: 7 }] },
  { kind: 'crates', solid: true, cells: [{ x: 9, y: 1 }] },
  { kind: 'crates', solid: true, cells: [{ x: 2, y: 7 }] },
  { kind: 'brazier', solid: true, cells: [{ x: 3, y: 3 }] },
  { kind: 'brazier', solid: true, cells: [{ x: 8, y: 5 }] },
];

export const START_POSITIONS: Record<Team, Record<Archetype, Pos>> = {
  player: { guardian: { x: 2, y: 3 }, scout: { x: 2, y: 5 }, crossbow: { x: 1, y: 4 } },
  ai: { guardian: { x: 9, y: 5 }, scout: { x: 9, y: 3 }, crossbow: { x: 10, y: 4 } },
};

export function createArena(): Arena {
  return {
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    terrain: TERRAIN_ROWS.map((row) => [...row].map((c) => TERRAIN_CODES[c])),
    props: PROPS.map((p) => ({ ...p, cells: p.cells.map((c) => ({ ...c })) })),
  };
}

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(arena: Arena, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < arena.width && p.y < arena.height;
}

export function isSolid(arena: Arena, p: Pos): boolean {
  return arena.props.some((prop) => prop.solid && prop.cells.some((c) => samePos(c, p)));
}
