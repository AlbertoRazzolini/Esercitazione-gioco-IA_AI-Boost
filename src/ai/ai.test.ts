import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine/engine';
import { blankArena, makeState, solidAt, unit } from '../engine/testUtils';
import type { GameState } from '../engine/types';
import { planActivation } from './index';
import { playGame } from './match';
import { runActions } from './run';

describe('AI: legalità', () => {
  it.each([1, 2, 3])('partite facile contro intermedio senza azioni illegali (seed %i)', (seed) => {
    const result = playGame(seed, { player: 'easy', ai: 'medium' });
    expect(result.rounds).toBeGreaterThan(0);
  });

  it('intermedio contro sé stesso senza azioni illegali', () => {
    expect(() => playGame(4, { player: 'medium', ai: 'medium' })).not.toThrow();
  });
});

describe('AI: determinismo', () => {
  it('stesso stato e stesso seed producono lo stesso piano', () => {
    const g = createGame(5);
    expect(planActivation(g, 'easy', 11)).toEqual(planActivation(g, 'easy', 11));
    expect(planActivation(g, 'medium', 11)).toEqual(planActivation(g, 'medium', 11));
  });
});

describe('AI: casi limite', () => {
  it('chiude la fase se non ha unità attivabili', () => {
    const s = makeState([unit('p', 'player', 'guardian', 0, 0), unit('a', 'ai', 'guardian', 9, 7, { stage: 'done' })], {
      activeTeam: 'ai',
    });
    expect(planActivation(s, 'medium', 1)).toEqual([{ type: 'EndPhase' }]);
  });

  it('unità bloccata e nessuna carta: il piano è legale e passa il turno', () => {
    const s: GameState = makeState(
      [unit('p', 'player', 'guardian', 0, 0), unit('a', 'ai', 'scout', 9, 7)],
      { activeTeam: 'ai', arena: blankArena([solidAt(8, 7), solidAt(9, 6)]) },
    );
    for (const level of ['easy', 'medium'] as const) {
      const after = runActions(s, planActivation(s, level, 1));
      expect(after).not.toBeNull();
      expect(after!.activeTeam).toBe('player');
    }
  });

  it('il colpo che chiude la partita non è seguito da EndActivation', () => {
    const s = makeState([unit('p', 'player', 'crossbow', 3, 3, { hp: 1 }), unit('a', 'ai', 'scout', 5, 3)], {
      activeTeam: 'ai',
    });
    const plan = planActivation(s, 'medium', 1);
    expect(plan[plan.length - 1].type).not.toBe('EndActivation');
    const after = runActions(s, plan);
    expect(after?.winner).toBe('ai');
  });

  it('a partita finita non propone azioni', () => {
    const s = makeState([unit('a', 'ai', 'scout', 5, 3)], { activeTeam: 'ai', winner: 'ai' });
    expect(planActivation(s, 'easy', 1)).toEqual([]);
  });

  it('il piano facile è sempre applicabile', () => {
    let s = createGame(9);
    s = runActions(s, [{ type: 'EndPhase' }])!;
    for (let seed = 0; seed < 5; seed++) {
      const plan = planActivation(s, 'easy', seed);
      let cur = s;
      for (const a of plan) {
        const r = applyAction(cur, a);
        expect(r.ok).toBe(true);
        if (r.ok) cur = r.state;
      }
    }
  });
});
