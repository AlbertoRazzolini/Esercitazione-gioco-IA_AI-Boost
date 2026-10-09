import { applyAction } from '../engine/engine';
import type { Action, GameState } from '../engine/types';

/** Applica una sequenza di azioni; restituisce null alla prima azione rifiutata. */
export function runActions(state: GameState, actions: Action[]): GameState | null {
  let s = state;
  for (const a of actions) {
    const r = applyAction(s, a);
    if (!r.ok) return null;
    s = r.state;
  }
  return s;
}
