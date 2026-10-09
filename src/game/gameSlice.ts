import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CardId, Difficulty, GameState, Team } from '../engine/types';
import { loadUnlocked } from './progress';

export type Screen = 'start' | 'battle';
export type Mode = 'normal' | 'ability' | 'card';

export interface GameUiState {
  screen: Screen;
  difficulty: Difficulty;
  game: GameState | null;
  /** cambia a ogni nuova partita: i cicli asincroni lo usano per capire se sono ancora validi */
  gameId: number;
  selectedUnitId: string | null;
  mode: Mode;
  pendingCard: number | null;
  message: string | null;
  busy: boolean;
  /** livelli sbloccati dalla progressione */
  unlocked: Difficulty[];
  /** ultima carta giocata (per gli effetti visivi); l'id cresce a ogni giocata */
  cardFx: { id: number; cardId: CardId; team: Team } | null;
  /** contatore degli id di cardFx, non si azzera fra le partite */
  cardFxSeq: number;
}

const initialState: GameUiState = {
  screen: 'start',
  difficulty: 'easy',
  unlocked: loadUnlocked(),
  game: null,
  gameId: 0,
  selectedUnitId: null,
  mode: 'normal',
  pendingCard: null,
  message: null,
  busy: false,
  cardFx: null,
  cardFxSeq: 0,
};

function resetInteraction(state: GameUiState): void {
  state.selectedUnitId = null;
  state.mode = 'normal';
  state.pendingCard = null;
  state.message = null;
  state.busy = false;
  state.cardFx = null;
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    difficultySet(state, action: PayloadAction<Difficulty>) {
      if (state.unlocked.includes(action.payload)) state.difficulty = action.payload;
    },
    levelUnlocked(state, action: PayloadAction<Difficulty>) {
      if (!state.unlocked.includes(action.payload)) state.unlocked.push(action.payload);
    },
    gameStarted(state, action: PayloadAction<GameState>) {
      state.screen = 'battle';
      state.game = action.payload;
      state.gameId += 1;
      resetInteraction(state);
    },
    cardFxTriggered(state, action: PayloadAction<{ cardId: CardId; team: Team }>) {
      state.cardFxSeq += 1;
      state.cardFx = { id: state.cardFxSeq, ...action.payload };
    },
    gameUpdated(state, action: PayloadAction<GameState>) {
      state.game = action.payload;
    },
    unitSelected(state, action: PayloadAction<string | null>) {
      state.selectedUnitId = action.payload;
      state.mode = 'normal';
      state.pendingCard = null;
    },
    modeSet(state, action: PayloadAction<GameUiState['mode']>) {
      state.mode = action.payload;
      if (action.payload !== 'card') state.pendingCard = null;
    },
    cardSelected(state, action: PayloadAction<number | null>) {
      state.pendingCard = action.payload;
      state.mode = action.payload === null ? 'normal' : 'card';
    },
    messageSet(state, action: PayloadAction<string | null>) {
      state.message = action.payload;
    },
    busySet(state, action: PayloadAction<boolean>) {
      state.busy = action.payload;
    },
    returnedToStart(state) {
      state.screen = 'start';
      state.game = null;
      state.gameId += 1;
      resetInteraction(state);
    },
  },
});

export const {
  difficultySet,
  levelUnlocked,
  gameStarted,
  gameUpdated,
  cardFxTriggered,
  unitSelected,
  modeSet,
  cardSelected,
  messageSet,
  busySet,
  returnedToStart,
} = gameSlice.actions;

export default gameSlice.reducer;
