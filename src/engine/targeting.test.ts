import { describe, expect, it } from 'vitest';
import { canGuard, hasLineOfSight, strikeTargets } from './targeting';
import { blankArena, makeState, solidAt, unit } from './testUtils';

describe('targeting', () => {
  it('mischia: solo bersagli adiacenti ortogonali', () => {
    const s = makeState([
      unit('g', 'player', 'guardian', 3, 3),
      unit('e1', 'ai', 'scout', 4, 3),
      unit('e2', 'ai', 'scout', 4, 4),
      unit('a', 'player', 'scout', 3, 4),
    ]);
    expect(strikeTargets(s, 'g', 'attack')).toEqual(['e1']);
  });

  it('balestra: gittata 2-4 e nessun tiro con nemico adiacente', () => {
    const adjacent = makeState([
      unit('c', 'player', 'crossbow', 0, 0),
      unit('near', 'ai', 'scout', 0, 1),
      unit('far', 'ai', 'scout', 3, 0),
    ]);
    expect(strikeTargets(adjacent, 'c', 'attack')).toEqual([]);
    const s = makeState([
      unit('c', 'player', 'crossbow', 0, 0),
      unit('d2', 'ai', 'scout', 2, 0),
      unit('d4', 'ai', 'scout', 0, 4),
      unit('d5', 'ai', 'guardian', 5, 0),
    ]);
    expect(strikeTargets(s, 'c', 'attack').sort()).toEqual(['d2', 'd4']);
  });

  it('tiro mirato: gittata fino a 5 e ricarica', () => {
    const s = makeState([unit('c', 'player', 'crossbow', 0, 0), unit('d5', 'ai', 'guardian', 5, 0)]);
    expect(strikeTargets(s, 'c', 'ability')).toEqual(['d5']);
    const cooling = makeState([
      unit('c', 'player', 'crossbow', 0, 0, { cooldown: 1 }),
      unit('d5', 'ai', 'guardian', 5, 0),
    ]);
    expect(strikeTargets(cooling, 'c', 'ability')).toEqual([]);
  });

  it('ordine di precisione: +1 alla gittata massima', () => {
    const s = makeState([
      unit('c', 'player', 'crossbow', 0, 0, { precisionBonus: true }),
      unit('d5', 'ai', 'guardian', 5, 0),
    ]);
    expect(strikeTargets(s, 'c', 'attack')).toEqual(['d5']);
  });

  it('linea di vista bloccata da ostacoli solidi, non dalle unità', () => {
    const arena = blankArena([solidAt(2, 0)]);
    expect(hasLineOfSight(arena, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    expect(hasLineOfSight(arena, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true);
    const s = makeState(
      [
        unit('c', 'player', 'crossbow', 0, 0),
        unit('e', 'ai', 'scout', 4, 0),
        unit('e2', 'ai', 'guardian', 0, 3),
        unit('blocker', 'player', 'guardian', 0, 2),
      ],
      { arena },
    );
    expect(strikeTargets(s, 'c', 'attack')).toEqual(['e2']);
  });

  it('linea di vista simmetrica', () => {
    const arena = blankArena([solidAt(2, 1)]);
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 3 };
    expect(hasLineOfSight(arena, a, b)).toBe(hasLineOfSight(arena, b, a));
  });

  it('nessun bersaglio fuori dal proprio turno o dopo aver agito', () => {
    const base = [unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 4, 3)];
    expect(strikeTargets(makeState(base, { activeTeam: 'ai' }), 'g', 'attack')).toEqual([]);
    const acted = [unit('g', 'player', 'guardian', 3, 3, { stage: 'acted' }), unit('e', 'ai', 'scout', 4, 3)];
    expect(strikeTargets(makeState(acted), 'g', 'attack')).toEqual([]);
  });

  it('parata disponibile solo al guardiano attivabile', () => {
    const s = makeState([unit('g', 'player', 'guardian', 0, 0), unit('s', 'player', 'scout', 1, 0)]);
    expect(canGuard(s, 'g')).toBe(true);
    expect(canGuard(s, 's')).toBe(false);
  });
});
