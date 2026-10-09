import type { Action, GameState, Team } from '../engine/types';
import { evaluate } from './evaluate';
import { rankCandidates } from './medium';
import { runActions } from './run';

export interface HardOptions {
  topK: number;
  budgetMs: number;
}

export const DEFAULT_HARD: HardOptions = { topK: 6, budgetMs: 300 };

const MAX_PLAYOUT_STEPS = 8;

function greedyActivation(state: GameState): Action[] {
  return rankCandidates(state, false)[0]?.actions ?? [{ type: 'EndPhase' }];
}

/** Completa la fase di `team` e simula l'intera risposta avversaria (politica intermedia, senza carte). */
function playOut(state: GameState, team: Team, deadline: number): GameState {
  let s = state;
  let sawOpponent = s.activeTeam !== team;
  for (let step = 0; step < MAX_PLAYOUT_STEPS && !s.winner && Date.now() <= deadline; step++) {
    if (s.activeTeam === team && sawOpponent) break;
    const next = runActions(s, greedyActivation(s));
    if (!next) break;
    s = next;
    if (s.activeTeam !== team) sawOpponent = true;
  }
  return s;
}

export function planHard(state: GameState, options: HardOptions = DEFAULT_HARD): Action[] {
  const team = state.activeTeam;
  const deadline = Date.now() + options.budgetMs;
  const ranked = rankCandidates(state, true);
  if (ranked.length === 0) return [];
  let best = ranked[0];
  let bestScore = -Infinity;
  for (const candidate of ranked.slice(0, options.topK)) {
    if (Date.now() > deadline) break;
    const score = evaluate(playOut(candidate.state, team, deadline), team);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.actions;
}
