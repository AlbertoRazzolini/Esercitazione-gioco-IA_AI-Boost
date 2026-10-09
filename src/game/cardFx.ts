import type { CardId, GameEvent, Team } from '../engine/types';

export interface CardPlay {
  cardId: CardId;
  team: Team;
  targetId: string;
}

export function cardPlayedEvents(events: GameEvent[]): CardPlay[] {
  const plays: CardPlay[] = [];
  for (const e of events) {
    if (e.type === 'CardPlayed') plays.push({ cardId: e.cardId, team: e.team, targetId: e.targetId });
  }
  return plays;
}
