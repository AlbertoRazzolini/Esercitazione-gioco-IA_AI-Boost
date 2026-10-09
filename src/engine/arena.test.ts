import { describe, expect, it } from 'vitest';
import { START_POSITIONS, createArena, inBounds, isSolid, posKey } from './arena';

describe('arena', () => {
  const arena = createArena();

  it('ha dimensioni 10x8 e terreno completo', () => {
    expect(arena.terrain).toHaveLength(8);
    arena.terrain.forEach((row) => expect(row).toHaveLength(10));
    arena.terrain.flat().forEach((t) => expect(t).toBeDefined());
  });

  it('le posizioni iniziali sono valide, libere e distinte', () => {
    const all = [...Object.values(START_POSITIONS.player), ...Object.values(START_POSITIONS.ai)];
    all.forEach((p) => {
      expect(inBounds(arena, p)).toBe(true);
      expect(isSolid(arena, p)).toBe(false);
    });
    expect(new Set(all.map(posKey)).size).toBe(6);
  });

  it('distingue oggetti solidi e decorativi', () => {
    expect(isSolid(arena, { x: 4, y: 1 })).toBe(true);
    expect(isSolid(arena, { x: 3, y: 7 })).toBe(false);
  });
});
