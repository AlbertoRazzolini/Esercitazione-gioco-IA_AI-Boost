import type { Action, Difficulty, GameState } from '../engine/types';
import { planEasy } from './easy';
import { planHard } from './hard';
import { planMedium } from './medium';

export function planActivation(state: GameState, difficulty: Difficulty, seed: number): Action[] {
  if (state.winner) return [];
  const team = state.activeTeam;
  if (!state.units.some((u) => u.team === team && u.stage === 'idle')) return [{ type: 'EndPhase' }];
  const plan =
    difficulty === 'easy' ? planEasy(state, seed) : difficulty === 'medium' ? planMedium(state) : planHard(state);
  return plan.length > 0 ? plan : [{ type: 'EndPhase' }];
}
