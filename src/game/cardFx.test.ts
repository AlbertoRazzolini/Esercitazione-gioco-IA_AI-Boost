import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../engine/types';
import { cardPlayedEvents } from './cardFx';

describe('cardPlayedEvents', () => {
  it('estrae solo CardPlayed mantenendo i campi', () => {
    const events: GameEvent[] = [
      { type: 'Healed', unitId: 'a', amount: 2 },
      { type: 'CardPlayed', team: 'ai', cardId: 'rally', targetId: 'x' },
      { type: 'GameOver', winner: 'player' },
      { type: 'CardPlayed', team: 'player', cardId: 'charge', targetId: 'y' },
    ];
    expect(cardPlayedEvents(events)).toEqual([
      { cardId: 'rally', team: 'ai', targetId: 'x' },
      { cardId: 'charge', team: 'player', targetId: 'y' },
    ]);
  });

  it('altri eventi: lista vuota', () => {
    expect(cardPlayedEvents([{ type: 'Healed', unitId: 'a', amount: 1 }])).toEqual([]);
    expect(cardPlayedEvents([])).toEqual([]);
  });
});
