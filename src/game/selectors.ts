import { cardTargets } from '../engine/cards';
import { reachable } from '../engine/movement';
import { strikeTargets } from '../engine/targeting';
import type { GameState, Pos } from '../engine/types';
import type { GameUiState } from './gameSlice';

export interface Overlay {
  selected: Pos | null;
  reachable: Pos[];
  /** percorso per ogni destinazione raggiungibile, chiave `posKey` */
  paths: Record<string, Pos[]>;
  targets: Pos[];
  cardTargets: Pos[];
}

export const EMPTY_OVERLAY: Overlay = { selected: null, reachable: [], paths: {}, targets: [], cardTargets: [] };

const positionsOf = (game: GameState, ids: string[]): Pos[] =>
  ids.flatMap((id) => game.units.filter((u) => u.id === id).map((u) => u.pos));

export function computeOverlay(ui: GameUiState): Overlay {
  const game = ui.game;
  if (!game || ui.busy || game.winner) return EMPTY_OVERLAY;
  const selected = game.units.find((u) => u.id === ui.selectedUnitId) ?? null;
  const base: Overlay = { ...EMPTY_OVERLAY, selected: selected ? selected.pos : null };
  if (game.activeTeam !== 'player') return base;

  if (ui.mode === 'card' && ui.pendingCard !== null) {
    const cardId = game.decks.player.hand[ui.pendingCard];
    return { ...base, cardTargets: cardId ? positionsOf(game, cardTargets(game, 'player', cardId)) : [] };
  }
  if (!selected || selected.team !== 'player') return base;

  const paths: Record<string, Pos[]> = {};
  const reach: Pos[] = [];
  if (selected.stage === 'idle') {
    for (const [key, path] of reachable(game, selected.id)) {
      if (path.length < 2) continue;
      paths[key] = path;
      reach.push(path[path.length - 1]);
    }
  }
  const kind = ui.mode === 'ability' ? 'ability' : 'attack';
  return { ...base, reachable: reach, paths, targets: positionsOf(game, strikeTargets(game, selected.id, kind)) };
}
