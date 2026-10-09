import { describe, expect, it } from 'vitest';
import { nextRandom, shuffle } from './rng';

describe('rng', () => {
  it('è deterministico per lo stesso seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(nextRandom(42)[0]).not.toEqual(nextRandom(43)[0]);
  });

  it('produce valori in [0,1)', () => {
    let s = 7;
    for (let i = 0; i < 1000; i++) {
      const [v, n] = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      s = n;
    }
  });

  it('shuffle è una permutazione deterministica', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [a] = shuffle(items, 99);
    const [b] = shuffle(items, 99);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
