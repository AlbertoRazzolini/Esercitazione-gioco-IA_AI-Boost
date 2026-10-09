import { cardTargets } from '../engine/cards';
import { manhattan } from '../engine/movement';
import { nextRandom } from '../engine/rng';
import { UNIT_DEFS } from '../engine/units';
import type { Action, GameState, Team } from '../engine/types';
import { enumerateCandidates } from './candidates';
import { immediateGain } from './evaluate';

function approachDistance(state: GameState, team: Team): number {
  const enemies = state.units.filter((u) => u.team !== team);
  if (enemies.length === 0) return 0;
  return state.units
    .filter((u) => u.team === team)
    .reduce((sum, u) => sum + Math.min(...enemies.map((e) => manhattan(u.pos, e.pos))), 0);
}

/** Unica carta che il facile usa: cura su un alleato sotto metà HP. */
function obviousCard(state: GameState, team: Team): Action[] {
  const handIndex = state.decks[team].hand.indexOf('rally');
  if (handIndex < 0) return [];
  const targets = cardTargets(state, team, 'rally');
  const wounded = state.units.find(
    (u) => u.team === team && u.hp * 2 < UNIT_DEFS[u.archetype].maxHp && targets.includes(u.id),
  );
  return wounded ? [{ type: 'PlayCard', handIndex, targetId: wounded.id }] : [];
}

export function planEasy(state: GameState, seed: number): Action[] {
  const team = state.activeTeam;
  const candidates = enumerateCandidates(state, false);
  if (candidates.length === 0) return [];
  const scored = candidates
    .map((c) => ({ c, score: immediateGain(state, c.state, team) - 0.1 * approachDistance(c.state, team) }))
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const [r] = nextRandom(seed);
  const pick = top[Math.floor(r * top.length)].c;
  return [...obviousCard(state, team), ...pick.actions];
}
