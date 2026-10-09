import { drawCard } from './deck';
import { UNIT_DEFS } from './units';
import type { CardId, GameEvent, GameState, Team } from './types';

export interface CardDef {
  id: CardId;
  name: string;
  description: string;
  target: 'ally' | 'enemy';
}

export const FORCED_MARCH_BONUS = 2;
export const HOLD_GUARD = 3;
export const CHARGE_BONUS = 2;
export const RALLY_HEAL = 2;

export const CARD_DEFS: Record<CardId, CardDef> = {
  forcedMarch: {
    id: 'forcedMarch',
    name: 'Marcia forzata',
    description: 'Un alleato non ancora attivato ottiene +2 movimento per questa attivazione.',
    target: 'ally',
  },
  holdTheLine: {
    id: 'holdTheLine',
    name: 'Tenere la linea',
    description: 'Un alleato ottiene 3 punti guardia fino alla prossima fase della sua squadra.',
    target: 'ally',
  },
  focusFire: {
    id: 'focusFire',
    name: 'Fuoco concentrato',
    description: 'Il prossimo attacco alleato contro il nemico scelto infligge +2 danni (solo in questa fase).',
    target: 'enemy',
  },
  charge: {
    id: 'charge',
    name: 'Carica',
    description: 'Un alleato da mischia non ancora attivato: +2 danni al prossimo colpo, se prima si muove di almeno 2 celle.',
    target: 'ally',
  },
  rally: {
    id: 'rally',
    name: 'Richiamare le forze',
    description: 'Un alleato ferito recupera 2 HP.',
    target: 'ally',
  },
  precision: {
    id: 'precision',
    name: 'Ordine di precisione',
    description: 'Il prossimo tiro del Balestriere in questa fase: +1 danno e +1 gittata.',
    target: 'ally',
  },
};

export function cardTargets(state: GameState, team: Team, cardId: CardId): string[] {
  if (state.winner || state.activeTeam !== team || state.cardPlayed) return [];
  const allies = state.units.filter((u) => u.team === team);
  const enemies = state.units.filter((u) => u.team !== team);
  switch (cardId) {
    case 'forcedMarch':
      return allies.filter((u) => u.stage === 'idle').map((u) => u.id);
    case 'holdTheLine':
      return allies.map((u) => u.id);
    case 'focusFire':
      return enemies.map((u) => u.id);
    case 'charge':
      return allies.filter((u) => u.stage === 'idle' && !UNIT_DEFS[u.archetype].attack.ranged).map((u) => u.id);
    case 'rally':
      return allies.filter((u) => u.hp < UNIT_DEFS[u.archetype].maxHp).map((u) => u.id);
    case 'precision':
      return allies
        .filter((u) => u.archetype === 'crossbow' && (u.stage === 'idle' || u.stage === 'moved'))
        .map((u) => u.id);
  }
}

export function cardBlockReason(state: GameState, team: Team, cardId: CardId): string | null {
  if (state.winner) return 'La partita è finita.';
  if (state.activeTeam !== team) return 'Non è il tuo turno.';
  if (state.cardPlayed) return 'Hai già giocato una carta in questa fase.';
  if (cardTargets(state, team, cardId).length === 0) return 'Nessun bersaglio valido.';
  return null;
}

export function playCard(s: GameState, handIndex: number, targetId: string, events: GameEvent[]): string | null {
  const team = s.activeTeam;
  const deck = s.decks[team];
  const cardId = deck.hand[handIndex];
  if (cardId === undefined) return 'Carta non valida.';
  const reason = cardBlockReason(s, team, cardId);
  if (reason) return reason;
  if (!cardTargets(s, team, cardId).includes(targetId)) return 'Bersaglio non valido per questa carta.';
  const target = s.units.find((u) => u.id === targetId)!;
  deck.hand.splice(handIndex, 1);
  deck.discard.push(cardId);
  s.rng = drawCard(deck, s.rng);
  s.cardPlayed = true;
  events.push({ type: 'CardPlayed', team, cardId, targetId });
  switch (cardId) {
    case 'forcedMarch':
      target.moveBonus += FORCED_MARCH_BONUS;
      break;
    case 'holdTheLine':
      target.guard = Math.max(target.guard, HOLD_GUARD);
      events.push({ type: 'Guarded', unitId: target.id, amount: HOLD_GUARD });
      break;
    case 'focusFire':
      s.focusFireTargetId = target.id;
      break;
    case 'charge':
      target.chargeBonus = CHARGE_BONUS;
      break;
    case 'rally': {
      const heal = Math.min(RALLY_HEAL, UNIT_DEFS[target.archetype].maxHp - target.hp);
      target.hp += heal;
      events.push({ type: 'Healed', unitId: target.id, amount: heal });
      break;
    }
    case 'precision':
      target.precisionBonus = true;
      break;
  }
  return null;
}
