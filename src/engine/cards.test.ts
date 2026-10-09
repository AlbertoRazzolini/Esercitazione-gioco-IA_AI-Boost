import { describe, expect, it } from 'vitest';
import { cardBlockReason } from './cards';
import { applyAction } from './engine';
import { makeState, unit } from './testUtils';
import type { Action, ApplyResult, CardId, GameState, Unit } from './types';

function ok(r: ApplyResult): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const chain = (s: GameState, actions: Action[]) => actions.reduce((acc, a) => ok(applyAction(acc, a)), s);
const find = (s: GameState, id: string) => s.units.find((u) => u.id === id);

function withHand(units: Unit[], hand: CardId[], draw: CardId[] = ['rally', 'rally', 'rally']): GameState {
  return makeState(units, {
    decks: {
      player: { draw: [...draw], hand: [...hand], discard: [] },
      ai: { draw: [], hand: [], discard: [] },
    },
  });
}

const enemy = () => unit('e', 'ai', 'guardian', 9, 7);

describe('carte', () => {
  it('la carta giocata va negli scarti e ne viene pescata una nuova', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 5 }), enemy()], ['rally', 'charge', 'focusFire']);
    const r = applyAction(s, { type: 'PlayCard', handIndex: 0, targetId: 'g' });
    const after = ok(r);
    expect(find(after, 'g')!.hp).toBe(7);
    expect(after.decks.player.hand).toEqual(['charge', 'focusFire', 'rally']);
    expect(after.decks.player.discard).toEqual(['rally']);
    expect(after.cardPlayed).toBe(true);
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['CardPlayed', 'Healed']);
  });

  it('una sola carta per fase, di nuovo disponibile alla fase successiva', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 5 }), enemy()], ['rally', 'holdTheLine', 'rally']);
    const s1 = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }]);
    expect(applyAction(s1, { type: 'PlayCard', handIndex: 0, targetId: 'g' }).ok).toBe(false);
    const s2 = chain(s1, [{ type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(s2.cardPlayed).toBe(false);
    expect(applyAction(s2, { type: 'PlayCard', handIndex: 0, targetId: 'g' }).ok).toBe(true);
  });

  it('rimescola gli scarti quando il mazzo è vuoto', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 5 }), enemy()], ['rally'], []);
    s.decks.player.discard = ['charge'];
    const after = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }]);
    expect(after.decks.player.hand).toHaveLength(1);
    expect(after.decks.player.draw).toHaveLength(1);
    expect(after.decks.player.discard).toHaveLength(0);
  });

  it('valida i bersagli di ogni carta', () => {
    const units = [
      unit('g', 'player', 'guardian', 0, 0),
      unit('c', 'player', 'crossbow', 0, 2, { stage: 'acted' }),
      unit('s', 'player', 'scout', 2, 0, { stage: 'moved' }),
      enemy(),
    ];
    const s = withHand(units, ['rally', 'focusFire', 'charge']);
    const play = (handIndex: number, targetId: string) => applyAction(s, { type: 'PlayCard', handIndex, targetId }).ok;
    expect(play(0, 'g')).toBe(false); // HP pieni
    expect(play(1, 'g')).toBe(false); // fuoco concentrato su un alleato
    expect(play(2, 'c')).toBe(false); // carica su un'unità a distanza
    expect(play(2, 's')).toBe(false); // carica su un'unità già mossa
    const p = withHand(units, ['precision', 'forcedMarch']);
    expect(applyAction(p, { type: 'PlayCard', handIndex: 0, targetId: 'c' }).ok).toBe(false); // ha già sparato
    expect(applyAction(p, { type: 'PlayCard', handIndex: 1, targetId: 's' }).ok).toBe(false); // già mosso
    expect(applyAction(p, { type: 'PlayCard', handIndex: 7, targetId: 'g' }).ok).toBe(false); // indice inesistente
  });

  it('non si possono giocare carte fuori dal proprio turno', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0), enemy()], ['holdTheLine']);
    expect(cardBlockReason(s, 'ai', 'holdTheLine')).toBe('Non è il tuo turno.');
  });

  it('marcia forzata: +2 movimento in questa attivazione', () => {
    const s = withHand([unit('s', 'player', 'scout', 0, 0), enemy()], ['forcedMarch']);
    expect(applyAction(s, { type: 'Move', unitId: 's', to: { x: 6, y: 0 } }).ok).toBe(false);
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 's' },
      { type: 'Move', unitId: 's', to: { x: 6, y: 0 } },
    ]);
    expect(find(after, 's')!.pos).toEqual({ x: 6, y: 0 });
  });

  it('tenere la linea: +3 guardia fino alla prossima fase della squadra', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0), enemy()], ['holdTheLine']);
    const s1 = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }, { type: 'EndPhase' }]);
    expect(find(s1, 'g')!.guard).toBe(3);
    expect(find(chain(s1, [{ type: 'EndPhase' }]), 'g')!.guard).toBe(0);
  });

  it('fuoco concentrato: +2 al primo attacco contro il bersaglio, poi si consuma', () => {
    const s = withHand(
      [unit('g1', 'player', 'guardian', 3, 3), unit('g2', 'player', 'guardian', 5, 3), unit('e', 'ai', 'guardian', 4, 3)],
      ['focusFire'],
    );
    const s1 = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 'e' },
      { type: 'Attack', unitId: 'g1', targetId: 'e' },
    ]);
    expect(find(s1, 'e')!.hp).toBe(7);
    const s2 = chain(s1, [{ type: 'Attack', unitId: 'g2', targetId: 'e' }]);
    expect(find(s2, 'e')!.hp).toBe(4);
  });

  it('i bonus si applicano prima della guardia', () => {
    const s = withHand(
      [unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'guardian', 4, 3, { guard: 3 })],
      ['focusFire'],
    );
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 'e' },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(find(after, 'e')!.hp).toBe(10);
    expect(find(after, 'e')!.guard).toBe(0);
  });

  it('carica: +2 solo dopo un movimento di almeno 2 celle', () => {
    const units = () => [unit('g', 'player', 'guardian', 1, 3), unit('e', 'ai', 'guardian', 4, 3)];
    const charged = chain(withHand(units(), ['charge']), [
      { type: 'PlayCard', handIndex: 0, targetId: 'g' },
      { type: 'Move', unitId: 'g', to: { x: 3, y: 3 } },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(find(charged, 'e')!.hp).toBe(7);
    const short = [unit('g', 'player', 'guardian', 2, 3), unit('e', 'ai', 'guardian', 4, 3)];
    const noCharge = chain(withHand(short, ['charge']), [
      { type: 'PlayCard', handIndex: 0, targetId: 'g' },
      { type: 'Move', unitId: 'g', to: { x: 3, y: 3 } },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(find(noCharge, 'e')!.hp).toBe(9);
  });

  it('carica + fendente coordinato si sommano', () => {
    const s = withHand(
      [unit('s', 'player', 'scout', 1, 3), unit('a', 'player', 'guardian', 4, 4), unit('e', 'ai', 'guardian', 4, 3)],
      ['charge'],
    );
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 's' },
      { type: 'Move', unitId: 's', to: { x: 3, y: 3 } },
      { type: 'UseAbility', unitId: 's', targetId: 'e' },
    ]);
    expect(find(after, 'e')!.hp).toBe(12 - (4 + 1 + 2));
  });

  it('richiamare le forze non supera gli HP massimi', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 11 }), enemy()], ['rally']);
    expect(find(chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }]), 'g')!.hp).toBe(12);
  });

  it('ordine di precisione: +1 danno, +1 gittata, poi si consuma', () => {
    const s = withHand([unit('c', 'player', 'crossbow', 0, 0), unit('e', 'ai', 'guardian', 5, 0)], ['precision']);
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 'c' },
      { type: 'Attack', unitId: 'c', targetId: 'e' },
    ]);
    expect(find(after, 'e')!.hp).toBe(9);
    expect(find(after, 'c')!.precisionBonus).toBe(false);
  });

  it('i bonus delle carte scadono a fine fase', () => {
    const s = withHand([unit('s', 'player', 'scout', 0, 0), enemy()], ['forcedMarch']);
    const after = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 's' }, { type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(find(after, 's')!.moveBonus).toBe(0);
  });
});
