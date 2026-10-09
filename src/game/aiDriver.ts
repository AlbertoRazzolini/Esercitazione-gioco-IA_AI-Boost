import { planActivation } from '../ai';
import { applyAction } from '../engine/engine';
import type { AppThunk } from '../app/store';
import { cardPlayedEvents } from './cardFx';
import { playEvents } from './animator';
import { busySet, cardFxTriggered, gameUpdated, unitSelected } from './gameSlice';

export const aiTiming = { thinkDelayMs: 250 };

const MAX_AI_STEPS = 50;

export const runAiPhase = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const gameId = getState().game.gameId;
  const stillCurrent = () => getState().game.gameId === gameId;
  dispatch(busySet(true));
  dispatch(unitSelected(null));
  try {
    for (let step = 0; step < MAX_AI_STEPS; step++) {
      await new Promise((resolve) => setTimeout(resolve, aiTiming.thinkDelayMs));
      const ui = getState().game;
      const game = ui.game;
      if (!stillCurrent() || !game || game.winner || game.activeTeam !== 'ai') return;
      let current = game;
      for (const action of planActivation(game, ui.difficulty, game.rng + step)) {
        let result = applyAction(current, action);
        if (!result.ok) {
          console.warn('Azione AI rifiutata, chiudo la fase', action, result.error);
          result = applyAction(current, { type: 'EndPhase' });
          if (!result.ok) return;
        }
        for (const play of cardPlayedEvents(result.events)) dispatch(cardFxTriggered({ cardId: play.cardId, team: play.team }));
        const animation = playEvents(result.events);
        dispatch(gameUpdated(result.state));
        await animation;
        if (!stillCurrent()) return;
        current = result.state;
        if (current.winner || current.activeTeam !== 'ai') break;
      }
    }
    const game = getState().game.game;
    if (stillCurrent() && game && !game.winner && game.activeTeam === 'ai') {
      const result = applyAction(game, { type: 'EndPhase' });
      if (result.ok) dispatch(gameUpdated(result.state));
    }
  } finally {
    if (stillCurrent()) dispatch(busySet(false));
  }
};
