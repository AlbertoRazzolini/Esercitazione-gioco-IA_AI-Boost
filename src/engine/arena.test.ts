import { describe, expect, it } from 'vitest';
import { START_POSITIONS, createArena, inBounds, isSolid, posKey } from './arena';
import { reachable } from './movement';
import { makeState, unit } from './testUtils';

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

  it('contiene gli ostacoli solidi previsti', () => {
    const kinds = arena.props.filter((p) => p.solid).map((p) => p.kind).sort();
    expect(kinds).toEqual(['brazier', 'brazier', 'cart', 'crates', 'crates', 'fence', 'ruin', 'tent']);
    expect(isSolid(arena, { x: 4, y: 1 })).toBe(true); // tenda
    expect(isSolid(arena, { x: 5, y: 6 })).toBe(true); // rovina
    expect(isSolid(arena, { x: 2, y: 3 })).toBe(true); // braciere
  });

  it('gli ostacoli stanno nella mappa e non si sovrappongono', () => {
    const seen = new Set<string>();
    for (const prop of arena.props) {
      for (const cell of prop.cells) {
        expect(inBounds(arena, cell)).toBe(true);
        expect(seen.has(posKey(cell))).toBe(false);
        seen.add(posKey(cell));
      }
    }
  });

  it('la disposizione è simmetrica per punto: nessuno schieramento è avvantaggiato', () => {
    const solid = new Set<string>();
    for (let y = 0; y < arena.height; y++) {
      for (let x = 0; x < arena.width; x++) if (isSolid(arena, { x, y })) solid.add(posKey({ x, y }));
    }
    for (const key of solid) {
      const [x, y] = key.split(',').map(Number);
      expect(solid.has(posKey({ x: arena.width - 1 - x, y: arena.height - 1 - y }))).toBe(true);
    }
  });

  it('nessuna unità iniziale è intrappolata: ognuna raggiunge un nemico', () => {
    const units = [
      ...Object.entries(START_POSITIONS.player).map(([a, p]) => unit(`p-${a}`, 'player', a as 'guardian', p.x, p.y)),
      ...Object.entries(START_POSITIONS.ai).map(([a, p]) => unit(`a-${a}`, 'ai', a as 'guardian', p.x, p.y)),
    ];
    const state = makeState(units, { arena });
    // con un movimento molto ampio ogni unità deve poter arrivare vicino all'altra metà del campo
    for (const u of state.units) {
      const wide = makeState(
        state.units.map((x) => (x.id === u.id ? { ...x, moveBonus: 40 } : { ...x })),
        { arena },
      );
      const cells = reachable(wide, u.id);
      const enemyAdjacent = state.units
        .filter((e) => e.team !== u.team)
        .some((e) =>
          [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells.has(posKey({ x: e.pos.x + dx, y: e.pos.y + dy }))),
        );
      expect(enemyAdjacent).toBe(true);
    }
  });
});
