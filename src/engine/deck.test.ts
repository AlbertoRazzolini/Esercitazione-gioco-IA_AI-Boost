import { describe, expect, it } from 'vitest';
import { ALL_CARDS, createDeck, drawCard } from './deck';
import type { DeckState } from './types';

describe('deck', () => {
  it('12 carte, 2 copie per tipo, mano iniziale di 3', () => {
    const [deck] = createDeck(5);
    expect(deck.hand).toHaveLength(3);
    expect(deck.draw).toHaveLength(9);
    const all = [...deck.hand, ...deck.draw];
    ALL_CARDS.forEach((c) => expect(all.filter((x) => x === c)).toHaveLength(2));
  });

  it('è deterministico per lo stesso seed', () => {
    expect(createDeck(5)[0]).toEqual(createDeck(5)[0]);
  });

  it('rimescola gli scarti quando il mazzo è vuoto', () => {
    const deck: DeckState = { draw: [], hand: ['rally'], discard: ['charge', 'focusFire'] };
    drawCard(deck, 3);
    expect(deck.hand).toHaveLength(2);
    expect(deck.discard).toHaveLength(0);
    expect(deck.draw).toHaveLength(1);
  });

  it('non pesca nulla se mazzo e scarti sono vuoti', () => {
    const deck: DeckState = { draw: [], hand: [], discard: [] };
    expect(drawCard(deck, 3)).toBe(3);
    expect(deck.hand).toHaveLength(0);
  });
});
