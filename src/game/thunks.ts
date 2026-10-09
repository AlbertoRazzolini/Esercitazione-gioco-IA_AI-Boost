import { createGame, applyAction } from '../engine/engine';
import { posKey, samePos } from '../engine/arena';
import { reachable } from '../engine/movement';
import { strikeTargets } from '../engine/targeting';
import { UNIT_DEFS } from '../engine/units';
import type { Action, Pos } from '../engine/types';
import type { AppThunk } from '../app/store';
import { runAiPhase } from './aiDriver';
import { cardPlayedEvents } from './cardFx';
import { playEvents } from './animator';
import {
  busySet,
  cardFxTriggered,
  cardSelected,
  difficultySet,
  gameStarted,
  gameUpdated,
  levelUnlocked,
  messageSet,
  modeSet,
  unitSelected,
} from './gameSlice';
import { nextLevel, saveUnlocked } from './progress';

export const startGame =
  (seed: number = Date.now() % 2147483647): AppThunk =>
  (dispatch) => {
    dispatch(gameStarted(createGame(seed)));
  };

/** Valida e applica un'azione del giocatore, attende l'animazione e, se tocca all'AI, avvia la sua fase. */
export const perform =
  (action: Action): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const ui = getState().game;
    if (!ui.game || ui.busy) return false;
    const result = applyAction(ui.game, action);
    if (!result.ok) {
      dispatch(messageSet(result.error));
      return false;
    }
    const gameId = ui.gameId;
    dispatch(busySet(true));
    // l'animazione parte prima dell'aggiornamento, così il renderer non salta alla posizione finale
    for (const play of cardPlayedEvents(result.events)) dispatch(cardFxTriggered({ cardId: play.cardId, team: play.team }));
    const animation = playEvents(result.events);
    dispatch(gameUpdated(result.state));
    await animation;
    if (getState().game.gameId !== gameId) return true;
    dispatch(busySet(false));
    if (result.state.winner === 'player') dispatch(recordVictory());
    if (result.state.activeTeam === 'ai' && !result.state.winner) await dispatch(runAiPhase());
    return true;
  };

/** Solo le azioni del giocatore possono dargli la vittoria, quindi basta controllarla in `perform`. */
export const recordVictory = (): AppThunk => (dispatch, getState) => {
  const next = nextLevel(getState().game.difficulty);
  if (!next) return;
  dispatch(levelUnlocked(next));
  saveUnlocked(getState().game.unlocked);
};

export const startNextLevel = (): AppThunk => (dispatch, getState) => {
  const next = nextLevel(getState().game.difficulty);
  if (next) dispatch(difficultySet(next));
  dispatch(startGame());
};

export const clickCell =
  (pos: Pos): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const ui = getState().game;
    const game = ui.game;
    if (!game || ui.busy || game.winner) return;
    const unitAt = game.units.find((u) => samePos(u.pos, pos));

    if (ui.mode === 'card' && ui.pendingCard !== null) {
      if (unitAt) {
        const ok = await dispatch(perform({ type: 'PlayCard', handIndex: ui.pendingCard, targetId: unitAt.id }));
        if (ok) dispatch(cardSelected(null));
      } else {
        dispatch(cardSelected(null));
      }
      return;
    }

    if (unitAt && (unitAt.team === 'player' || game.activeTeam !== 'player')) {
      dispatch(unitSelected(unitAt.id));
      return;
    }

    const selected = game.units.find((u) => u.id === ui.selectedUnitId && u.team === 'player');
    if (unitAt) {
      const kind = ui.mode === 'ability' ? 'ability' : 'attack';
      if (selected && strikeTargets(game, selected.id, kind).includes(unitAt.id)) {
        const action: Action =
          kind === 'attack'
            ? { type: 'Attack', unitId: selected.id, targetId: unitAt.id }
            : { type: 'UseAbility', unitId: selected.id, targetId: unitAt.id };
        const ok = await dispatch(perform(action));
        if (ok && !getState().game.game?.winner) await dispatch(perform({ type: 'EndActivation', unitId: selected.id }));
        return;
      }
      dispatch(unitSelected(unitAt.id));
      return;
    }

    if (selected && selected.stage === 'idle' && reachable(game, selected.id).has(posKey(pos))) {
      await dispatch(perform({ type: 'Move', unitId: selected.id, to: pos }));
      return;
    }
    dispatch(unitSelected(null));
  };

export const abilityPressed = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const ui = getState().game;
  const unit = ui.game?.units.find((u) => u.id === ui.selectedUnitId);
  if (!unit || unit.team !== 'player' || ui.busy) return;
  if (UNIT_DEFS[unit.archetype].ability.kind === 'guard') {
    const ok = await dispatch(perform({ type: 'UseAbility', unitId: unit.id }));
    if (ok) await dispatch(perform({ type: 'EndActivation', unitId: unit.id }));
    return;
  }
  dispatch(modeSet(ui.mode === 'ability' ? 'normal' : 'ability'));
};

export const endActivationPressed = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const id = getState().game.selectedUnitId;
  if (id) await dispatch(perform({ type: 'EndActivation', unitId: id }));
};

export const endPhasePressed = (): AppThunk<Promise<void>> => async (dispatch) => {
  dispatch(unitSelected(null));
  await dispatch(perform({ type: 'EndPhase' }));
};
