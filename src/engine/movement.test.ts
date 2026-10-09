import { describe, expect, it } from 'vitest';
import { manhattan, reachable } from './movement';
import { blankArena, makeState, solidAt, unit } from './testUtils';
import type { Pos } from './types';

function isValidPath(path: Pos[]): boolean {
  return path.every((p, i) => i === 0 || manhattan(p, path[i - 1]) === 1);
}

describe('movement', () => {
  it('in campo aperto raggiunge tutte le celle entro il movimento (rombo)', () => {
    const s = makeState([unit('g', 'player', 'guardian', 5, 4)]);
    const r = reachable(s, 'g');
    // rombo di raggio 3: 1 + 4 + 8 + 12 = 25 celle
    expect(r.size).toBe(25);
    for (const path of r.values()) {
      expect(path.length - 1).toBeLessThanOrEqual(3);
      expect(isValidPath(path)).toBe(true);
    }
  });

  it('include la cella di partenza con percorso di lunghezza 1', () => {
    const s = makeState([unit('g', 'player', 'guardian', 5, 4)]);
    expect(reachable(s, 'g').get('5,4')).toEqual([{ x: 5, y: 4 }]);
  });

  it('il bonus di movimento estende la portata', () => {
    const s = makeState([unit('s', 'player', 'scout', 5, 4, { moveBonus: 2 })]);
    const r = reachable(s, 's');
    expect(r.has('9,6')).toBe(true); // distanza 6
    expect(r.has('0,7')).toBe(false); // distanza 8
  });

  it('non attraversa né occupa celle con unità', () => {
    const s = makeState([
      unit('g', 'player', 'guardian', 0, 0),
      unit('b', 'ai', 'guardian', 1, 0),
      unit('c', 'player', 'scout', 0, 1),
    ]);
    expect(reachable(s, 'g').size).toBe(1);
  });

  it('non attraversa gli ostacoli solidi', () => {
    const s = makeState([unit('g', 'player', 'guardian', 0, 0)], {
      arena: blankArena([solidAt(1, 0), solidAt(1, 1), solidAt(0, 2)]),
    });
    expect([...reachable(s, 'g').keys()].sort()).toEqual(['0,0', '0,1']);
  });

  it('non esce dai bordi della mappa', () => {
    const s = makeState([unit('g', 'player', 'guardian', 0, 0)]);
    for (const key of reachable(s, 'g').keys()) {
      const [x, y] = key.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('il percorso aggira un ostacolo', () => {
    const s = makeState([unit('s', 'player', 'scout', 0, 1)], {
      arena: blankArena([solidAt(1, 1)]),
    });
    const path = reachable(s, 's').get('2,1');
    expect(path).toBeDefined();
    expect(path!.length - 1).toBe(4);
    expect(isValidPath(path!)).toBe(true);
  });
});
