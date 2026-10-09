import { applyAction, createGame } from '../engine/engine';
import type { Difficulty, Team } from '../engine/types';
import { planActivation } from './index';

export interface MatchResult {
  winner: Team | null;
  rounds: number;
}

/** Partita completa AI contro AI. Lancia un errore se un'AI propone un'azione illegale. */
export function playGame(seed: number, levels: Record<Team, Difficulty>, maxRounds = 30): MatchResult {
  let s = createGame(seed);
  let step = 0;
  while (!s.winner && s.round <= maxRounds) {
    const plan = planActivation(s, levels[s.activeTeam], seed * 7919 + step++);
    for (const a of plan) {
      const r = applyAction(s, a);
      if (!r.ok) throw new Error(`Azione illegale ${a.type}: ${r.error}`);
      s = r.state;
      if (s.winner) break;
    }
  }
  return { winner: s.winner, rounds: s.round };
}
