import { describe, expect, it } from 'vitest';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../engine/arena';
import { WORLD_H, WORLD_W, depthOf, toCell, toScreen } from './iso';

describe('iso', () => {
  it('andata e ritorno su tutte le celle', () => {
    for (let y = 0; y < ARENA_HEIGHT; y++) {
      for (let x = 0; x < ARENA_WIDTH; x++) {
        const s = toScreen({ x, y });
        expect(toCell(s.x, s.y)).toEqual({ x, y });
      }
    }
  });

  it('i punti interni al rombo appartengono alla cella', () => {
    const s = toScreen({ x: 4, y: 3 });
    expect(toCell(s.x + 20, s.y)).toEqual({ x: 4, y: 3 });
    expect(toCell(s.x, s.y + 12)).toEqual({ x: 4, y: 3 });
  });

  it('la mappa intera sta nel mondo', () => {
    for (const p of [
      { x: -0.5, y: ARENA_HEIGHT - 0.5 },
      { x: ARENA_WIDTH - 0.5, y: -0.5 },
      { x: -0.5, y: -0.5 },
      { x: ARENA_WIDTH - 0.5, y: ARENA_HEIGHT - 0.5 },
    ]) {
      const s = toScreen(p);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(WORLD_W);
      expect(s.y).toBeLessThanOrEqual(WORLD_H);
    }
  });

  it('più in basso nella scena significa più in primo piano', () => {
    expect(depthOf({ x: 1, y: 1 })).toBeGreaterThan(depthOf({ x: 1, y: 0 }));
  });
});
