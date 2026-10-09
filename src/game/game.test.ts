import { beforeEach, describe, expect, it } from 'vitest';
import { makeStore } from '../app/store';
import { createGame } from '../engine/engine';
import { makeState, unit } from '../engine/testUtils';
import { aiTiming } from './aiDriver';
import { busySet, difficultySet, gameStarted } from './gameSlice';
import { computeOverlay } from './selectors';
import { clickCell, perform, startGame } from './thunks';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  aiTiming.thinkDelayMs = 0;
});

describe('store e thunk', () => {
  it('startGame apre la battaglia con una partita nuova', () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    const ui = store.getState().game;
    expect(ui.screen).toBe('battle');
    expect(ui.game).toEqual(createGame(42));
    expect(ui.busy).toBe(false);
  });

  it('azione illegale: messaggio e stato invariato', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    const before = store.getState().game.game;
    const ok = await store.dispatch(perform({ type: 'Move', unitId: 'ai-scout', to: { x: 7, y: 2 } }));
    expect(ok).toBe(false);
    expect(store.getState().game.message).toBe('Non è il turno di questa unità.');
    expect(store.getState().game.game).toBe(before);
  });

  it('ignora le azioni mentre è in corso un\'animazione o il turno AI', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    store.dispatch(busySet(true));
    const ok = await store.dispatch(perform({ type: 'Move', unitId: 'player-guardian', to: { x: 1, y: 2 } }));
    expect(ok).toBe(false);
  });

  it('fine fase: l\'AI gioca e restituisce il turno', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    await store.dispatch(perform({ type: 'EndPhase' }));
    const ui = store.getState().game;
    expect(ui.game!.activeTeam).toBe('player');
    expect(ui.game!.round).toBe(2);
    expect(ui.busy).toBe(false);
  });

  it('una nuova partita durante il turno AI ferma il vecchio ciclo', async () => {
    aiTiming.thinkDelayMs = 30;
    const store = makeStore();
    store.dispatch(startGame(42));
    const pending = store.dispatch(perform({ type: 'EndPhase' }));
    await sleep(5);
    store.dispatch(startGame(77));
    await pending;
    await sleep(60);
    expect(store.getState().game.game).toEqual(createGame(77));
    expect(store.getState().game.busy).toBe(false);
  });

  it('clic: seleziona, mostra l\'overlay e muove', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    await store.dispatch(clickCell({ x: 1, y: 3 }));
    expect(store.getState().game.selectedUnitId).toBe('player-guardian');
    const overlay = computeOverlay(store.getState().game);
    expect(overlay.reachable).toContainEqual({ x: 1, y: 2 });
    await store.dispatch(clickCell({ x: 1, y: 2 }));
    const g = store.getState().game.game!.units.find((u) => u.id === 'player-guardian')!;
    expect(g.pos).toEqual({ x: 1, y: 2 });
  });

  it('overlay vuoto durante busy e fuori turno', () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    store.dispatch(busySet(true));
    expect(computeOverlay(store.getState().game).reachable).toEqual([]);
  });
});

describe('progressione', () => {
  it('all\'inizio solo il facile; i livelli bloccati non si scelgono', () => {
    const store = makeStore();
    expect(store.getState().game.unlocked).toEqual(['easy']);
    store.dispatch(difficultySet('hard'));
    expect(store.getState().game.difficulty).toBe('easy');
  });

  it('una vittoria sblocca il livello successivo', async () => {
    const store = makeStore();
    store.dispatch(
      gameStarted(makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 4, 3, { hp: 1 })])),
    );
    await store.dispatch(perform({ type: 'Attack', unitId: 'g', targetId: 'e' }));
    expect(store.getState().game.game!.winner).toBe('player');
    expect(store.getState().game.unlocked).toEqual(['easy', 'medium']);
    store.dispatch(difficultySet('medium'));
    expect(store.getState().game.difficulty).toBe('medium');
  });
});
