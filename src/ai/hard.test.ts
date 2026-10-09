import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/engine';
import type { Difficulty } from '../engine/types';
import { planActivation } from './index';
import { playGame } from './match';
import { runActions } from './run';

function wins(strong: Difficulty, weak: Difficulty, seeds: number[]): number {
  let count = 0;
  for (const seed of seeds) {
    if (playGame(seed, { player: strong, ai: weak }).winner === 'player') count++;
    if (playGame(seed, { player: weak, ai: strong }).winner === 'ai') count++;
  }
  return count;
}

describe('AI difficile', () => {
  it('rispetta il budget di calcolo', () => {
    const g = createGame(3);
    const start = performance.now();
    planActivation(g, 'hard', 1);
    expect(performance.now() - start).toBeLessThan(600);
  });

  it('è deterministica', () => {
    const g = createGame(8);
    expect(planActivation(g, 'hard', 1)).toEqual(planActivation(g, 'hard', 1));
  });

  it('il piano è legale', () => {
    const g = runActions(createGame(4), [{ type: 'EndPhase' }])!;
    expect(runActions(g, planActivation(g, 'hard', 1))).not.toBeNull();
  });
});

describe('verifica dei livelli (AI contro AI)', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const halfOfGames = seeds.length * 2 / 2; // ogni seed si gioca da entrambi i lati

  it('l\'intermedio batte il facile in più della metà delle partite', { timeout: 120_000 }, () => {
    expect(wins('medium', 'easy', seeds)).toBeGreaterThan(halfOfGames);
  });

  it('il difficile batte l\'intermedio in più della metà delle partite', { timeout: 300_000 }, () => {
    expect(wins('hard', 'medium', seeds)).toBeGreaterThan(halfOfGames);
  });
});
