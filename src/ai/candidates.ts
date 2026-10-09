import { cardTargets } from '../engine/cards';
import { reachable } from '../engine/movement';
import { canGuard, strikeTargets } from '../engine/targeting';
import type { Action, GameState } from '../engine/types';
import { runActions } from './run';

export interface Candidate {
  unitId: string;
  actions: Action[];
  state: GameState;
}

function cardPrefixes(state: GameState, unitId: string, withCards: boolean): Action[][] {
  const prefixes: Action[][] = [[]];
  if (!withCards || state.cardPlayed) return prefixes;
  const team = state.activeTeam;
  state.decks[team].hand.forEach((cardId, handIndex) => {
    const targets = cardTargets(state, team, cardId);
    if (cardId === 'focusFire') {
      targets.forEach((t) => prefixes.push([{ type: 'PlayCard', handIndex, targetId: t }]));
    } else if (targets.includes(unitId)) {
      prefixes.push([{ type: 'PlayCard', handIndex, targetId: unitId }]);
    }
  });
  return prefixes;
}

function strikeOptions(state: GameState, unitId: string): Action[][] {
  const options: Action[][] = [[]];
  for (const t of strikeTargets(state, unitId, 'attack')) options.push([{ type: 'Attack', unitId, targetId: t }]);
  if (canGuard(state, unitId)) options.push([{ type: 'UseAbility', unitId }]);
  for (const t of strikeTargets(state, unitId, 'ability')) options.push([{ type: 'UseAbility', unitId, targetId: t }]);
  return options;
}

/** Tutte le attivazioni complete (carta? → movimento? → colpo? → chiusura) delle unità idle. */
export function enumerateCandidates(state: GameState, withCards: boolean): Candidate[] {
  const out: Candidate[] = [];
  const actors = state.units.filter((u) => u.team === state.activeTeam && u.stage === 'idle');
  for (const actor of actors) {
    for (const prefix of cardPrefixes(state, actor.id, withCards)) {
      const base = runActions(state, prefix);
      if (!base) continue;
      for (const path of reachable(base, actor.id).values()) {
        const move: Action[] =
          path.length > 1 ? [{ type: 'Move', unitId: actor.id, to: path[path.length - 1] }] : [];
        const moved = runActions(base, move);
        if (!moved) continue;
        for (const strike of strikeOptions(moved, actor.id)) {
          const struck = runActions(moved, strike);
          if (!struck) continue;
          const close: Action[] = struck.winner ? [] : [{ type: 'EndActivation', unitId: actor.id }];
          const end = runActions(struck, close);
          if (!end) continue;
          out.push({ unitId: actor.id, actions: [...prefix, ...move, ...strike, ...close], state: end });
        }
      }
    }
  }
  return out;
}
