import type { Archetype, Arena, Pos, Prop, Team, TerrainKind } from './types';

export const ARENA_WIDTH = 10;
export const ARENA_HEIGHT = 8;

const TERRAIN_ROWS = [
  'ggvgggggdg',
  'gggdddgggg',
  'gdddmddggg',
  'ddmmmmdddd',
  'dddmmmmmdd',
  'gggddmddgg',
  'ggvgdddggv',
  'gggggdgggg',
];

const TERRAIN_CODES: Record<string, TerrainKind> = { g: 'grass', d: 'dirt', m: 'mud', v: 'gravel' };

const PROPS: Prop[] = [
  { kind: 'tent', solid: true, cells: [{ x: 4, y: 1 }, { x: 5, y: 1 }, { x: 4, y: 2 }, { x: 5, y: 2 }] },
  { kind: 'ruin', solid: true, cells: [{ x: 5, y: 5 }, { x: 5, y: 6 }] },
  { kind: 'brazier', solid: true, cells: [{ x: 2, y: 3 }] },
  { kind: 'brazier', solid: true, cells: [{ x: 7, y: 4 }] },
  { kind: 'rock', solid: false, cells: [{ x: 3, y: 7 }] },
  { kind: 'rock', solid: false, cells: [{ x: 6, y: 0 }] },
  { kind: 'rock', solid: false, cells: [{ x: 8, y: 6 }] },
  { kind: 'tallgrass', solid: false, cells: [{ x: 1, y: 1 }] },
  { kind: 'tallgrass', solid: false, cells: [{ x: 8, y: 1 }] },
];

export const START_POSITIONS: Record<Team, Record<Archetype, Pos>> = {
  player: { guardian: { x: 1, y: 3 }, scout: { x: 1, y: 5 }, crossbow: { x: 0, y: 4 } },
  ai: { guardian: { x: 8, y: 4 }, scout: { x: 8, y: 2 }, crossbow: { x: 9, y: 3 } },
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
