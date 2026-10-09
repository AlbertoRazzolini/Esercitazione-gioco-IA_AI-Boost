import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from './engine';
import { makeState, unit } from './testUtils';
import type { Action, ApplyResult, GameState } from './types';

function ok(r: ApplyResult): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function chain(state: GameState, actions: Action[]): GameState {
  return actions.reduce((s, a) => ok(applyAction(s, a)), state);
}

function hp(state: GameState, id: string): number | undefined {
  return state.units.find((u) => u.id === id)?.hp;
}

describe('createGame', () => {
  it('crea 6 unità, mani di 3 carte, inizia il giocatore', () => {
    const g = createGame(123);
    expect(g.units).toHaveLength(6);
    expect(g.activeTeam).toBe('player');
    expect(g.round).toBe(1);
    expect(g.decks.player.hand).toHaveLength(3);
    expect(g.decks.ai.hand).toHaveLength(3);
    expect(g.decks.player.draw).toHaveLength(9);
    expect(createGame(123)).toEqual(g);
  });
});

describe('applyAction', () => {
  const duel = () =>
    makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 6, 3)]);

  it('non modifica lo stato di partenza', () => {
    const s = duel();
    const before = structuredClone(s);
    applyAction(s, { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } });
    expect(s).toEqual(before);
  });

  it('movimento valido: posizione, stage ed evento con percorso', () => {
    const r = applyAction(duel(), { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } });
    const s = ok(r);
    const g = s.units.find((u) => u.id === 'g')!;
    expect(g.pos).toEqual({ x: 5, y: 3 });
    expect(g.stage).toBe('moved');
    expect(g.cellsMoved).toBe(2);
    expect(r.ok && r.events[0]).toMatchObject({ type: 'Moved', unitId: 'g' });
  });

  it('rifiuta destinazioni troppo lontane e un secondo movimento', () => {
    expect(applyAction(duel(), { type: 'Move', unitId: 'g', to: { x: 3, y: 7 } }).ok).toBe(false);
    const s = chain(duel(), [{ type: 'Move', unitId: 'g', to: { x: 4, y: 3 } }]);
    expect(applyAction(s, { type: 'Move', unitId: 'g', to: { x: 4, y: 4 } }).ok).toBe(false);
  });

  it('attacco in mischia: 3 danni, poi niente movimento', () => {
    const s = chain(duel(), [
      { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(hp(s, 'e')).toBe(5);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('acted');
    expect(applyAction(s, { type: 'Move', unitId: 'g', to: { x: 5, y: 4 } }).ok).toBe(false);
  });

  it('la guardia assorbe i danni prima degli HP', () => {
    const s = makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'guardian', 4, 3, { guard: 3 })]);
    const r = applyAction(s, { type: 'Attack', unitId: 'g', targetId: 'e' });
    expect(hp(ok(r), 'e')).toBe(12);
    expect(r.ok && r.events).toContainEqual({ type: 'Damaged', unitId: 'e', amount: 0, absorbed: 3 });
  });

  it('parata: +3 guardia, stage acted', () => {
    const r = applyAction(duel(), { type: 'UseAbility', unitId: 'g' });
    const g = ok(r).units.find((u) => u.id === 'g')!;
    expect(g.guard).toBe(3);
    expect(g.stage).toBe('acted');
  });

  it('fendente coordinato: 4 danni, 5 con un altro alleato adiacente al bersaglio', () => {
    const alone = makeState([unit('s', 'player', 'scout', 3, 3), unit('e', 'ai', 'guardian', 4, 3), unit('a', 'player', 'guardian', 0, 0)]);
    expect(hp(chain(alone, [{ type: 'UseAbility', unitId: 's', targetId: 'e' }]), 'e')).toBe(8);
    const flanked = makeState([unit('s', 'player', 'scout', 3, 3), unit('e', 'ai', 'guardian', 4, 3), unit('a', 'player', 'guardian', 4, 4)]);
    expect(hp(chain(flanked, [{ type: 'UseAbility', unitId: 's', targetId: 'e' }]), 'e')).toBe(7);
  });

  it('sconfitta, vittoria e blocco delle azioni a partita finita', () => {
    const s = makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 4, 3, { hp: 2 })]);
    const r = applyAction(s, { type: 'Attack', unitId: 'g', targetId: 'e' });
    const after = ok(r);
    expect(after.units.map((u) => u.id)).toEqual(['g']);
    expect(after.winner).toBe('player');
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['Attacked', 'Damaged', 'Defeated', 'GameOver']);
    expect(applyAction(after, { type: 'EndPhase' }).ok).toBe(false);
  });

  it('una sola attivazione per unità in una fase', () => {
    const s = chain(makeState([unit('g', 'player', 'guardian', 3, 3), unit('s', 'player', 'scout', 0, 0), unit('e', 'ai', 'scout', 9, 7)]), [
      { type: 'Move', unitId: 'g', to: { x: 4, y: 3 } },
      { type: 'EndActivation', unitId: 'g' },
    ]);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('done');
    expect(applyAction(s, { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } }).ok).toBe(false);
    expect(applyAction(s, { type: 'EndActivation', unitId: 'g' }).ok).toBe(false);
  });

  it("agire con un'altra unità chiude l'attivazione aperta", () => {
    const s = chain(makeState([unit('g', 'player', 'guardian', 3, 3), unit('s', 'player', 'scout', 0, 0), unit('e', 'ai', 'scout', 9, 7)]), [
      { type: 'Move', unitId: 'g', to: { x: 4, y: 3 } },
      { type: 'Move', unitId: 's', to: { x: 1, y: 0 } },
    ]);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('done');
    expect(s.activeUnitId).toBe('s');
  });

  it('la fase finisce da sola quando tutte le unità sono attivate', () => {
    const r = applyAction(duel(), { type: 'EndActivation', unitId: 'g' });
    const s = ok(r);
    expect(s.activeTeam).toBe('ai');
    expect(r.ok && r.events).toContainEqual({ type: 'PhaseChanged', team: 'ai', round: 1 });
  });

  it('alternanza delle fasi, round e reset delle attivazioni', () => {
    const s = chain(duel(), [{ type: 'EndActivation', unitId: 'g' }, { type: 'EndPhase' }]);
    expect(s.activeTeam).toBe('player');
    expect(s.round).toBe(2);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('idle');
  });

  it("rifiuta le azioni con unità dell'altra squadra o inesistenti", () => {
    expect(applyAction(duel(), { type: 'Move', unitId: 'e', to: { x: 6, y: 4 } }).ok).toBe(false);
    expect(applyAction(duel(), { type: 'Move', unitId: 'ghost', to: { x: 0, y: 0 } }).ok).toBe(false);
  });

  it('la guardia scade alla prossima fase della propria squadra', () => {
    const s1 = chain(duel(), [{ type: 'UseAbility', unitId: 'g' }, { type: 'EndActivation', unitId: 'g' }]);
    expect(s1.activeTeam).toBe('ai');
    expect(s1.units.find((u) => u.id === 'g')!.guard).toBe(3);
    const s2 = chain(s1, [{ type: 'EndPhase' }]);
    expect(s2.units.find((u) => u.id === 'g')!.guard).toBe(0);
  });

  it('tiro mirato: ricarica di 2, salta una fase', () => {
    const s = makeState([unit('c', 'player', 'crossbow', 0, 0), unit('e', 'ai', 'guardian', 5, 0)]);
    const s1 = chain(s, [{ type: 'UseAbility', unitId: 'c', targetId: 'e' }]);
    expect(s1.units.find((u) => u.id === 'c')!.cooldown).toBe(2);
    const s2 = chain(s1, [{ type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(s2.units.find((u) => u.id === 'c')!.cooldown).toBe(1);
    expect(applyAction(s2, { type: 'UseAbility', unitId: 'c', targetId: 'e' }).ok).toBe(false);
    const s3 = chain(s2, [{ type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(applyAction(s3, { type: 'UseAbility', unitId: 'c', targetId: 'e' }).ok).toBe(true);
  });
});
