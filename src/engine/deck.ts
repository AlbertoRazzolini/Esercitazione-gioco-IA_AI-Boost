import { shuffle } from './rng';
import type { CardId, DeckState } from './types';

export const ALL_CARDS: CardId[] = ['forcedMarch', 'holdTheLine', 'focusFire', 'charge', 'rally', 'precision'];
export const HAND_SIZE = 3;

export function drawCard(deck: DeckState, rng: number): number {
  let next = rng;
  if (deck.draw.length === 0) {
    if (deck.discard.length === 0) return next;
    const [reshuffled, r] = shuffle(deck.discard, next);
    deck.draw = reshuffled;
    deck.discard = [];
    next = r;
  }
  deck.hand.push(deck.draw.shift()!);
  return next;
}

export function createDeck(rng: number): [DeckState, number] {
  const [draw, r] = shuffle([...ALL_CARDS, ...ALL_CARDS], rng);
  const deck: DeckState = { draw, hand: [], discard: [] };
  let next = r;
  for (let i = 0; i < HAND_SIZE; i++) next = drawCard(deck, next);
  return [deck, next];
}
