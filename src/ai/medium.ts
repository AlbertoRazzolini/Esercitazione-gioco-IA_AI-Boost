import type { Action, GameState } from '../engine/types';
import { enumerateCandidates } from './candidates';
import type { Candidate } from './candidates';
import { evaluate } from './evaluate';

/** Candidati ordinati per valutazione (ordinamento stabile: a parità vince l'ordine di enumerazione). */
export function rankCandidates(state: GameState, withCards: boolean): Candidate[] {
  const team = state.activeTeam;
  return enumerateCandidates(state, withCards)
    .map((c) => ({ c, score: evaluate(c.state, team) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

export function planMedium(state: GameState): Action[] {
  return rankCandidates(state, true)[0]?.actions ?? [];
}
