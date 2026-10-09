import { START_POSITIONS, createArena, posKey } from './arena';
import { playCard } from './cards';
import { applyDamage, strikeDamage } from './combat';
import { createDeck } from './deck';
import { reachable } from './movement';
import { canGuard, strikeProfile, strikeTargets } from './targeting';
import type { StrikeKind } from './targeting';
import { GUARD_AMOUNT, UNIT_DEFS, newUnit } from './units';
import type { Action, ApplyResult, Archetype, DeckState, GameEvent, GameState, Pos, Team, Unit } from './types';

const TEAMS: Team[] = ['player', 'ai'];
const ARCHETYPES: Archetype[] = ['guardian', 'scout', 'crossbow'];

export function createGame(seed: number): GameState {
  const units = TEAMS.flatMap((team) =>
    ARCHETYPES.map((a) => newUnit(`${team}-${a}`, team, a, START_POSITIONS[team][a])),
  );
  const [player, r1] = createDeck(seed >>> 0 || 1);
  const [ai, r2] = createDeck(r1);
  return {
    arena: createArena(),
    units,
    activeTeam: 'player',
    round: 1,
    activeUnitId: null,
    cardPlayed: false,
    focusFireTargetId: null,
    decks: { player, ai },
    rng: r2,
    winner: null,
  };
}

const cloneDeck = (d: DeckState): DeckState => ({ draw: [...d.draw], hand: [...d.hand], discard: [...d.discard] });

/** L'arena non viene mai modificata, quindi resta condivisa. */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    units: s.units.map((u) => ({ ...u, pos: { ...u.pos } })),
    decks: { player: cloneDeck(s.decks.player), ai: cloneDeck(s.decks.ai) },
  };
}

export function applyAction(state: GameState, action: Action): ApplyResult {
  if (state.winner) return { ok: false, error: 'La partita è finita.' };
  const s = cloneState(state);
  const events: GameEvent[] = [];
  const error = run(s, action, events);
  return error ? { ok: false, error } : { ok: true, state: s, events };
}

function run(s: GameState, action: Action, events: GameEvent[]): string | null {
  switch (action.type) {
    case 'Move':
      return doMove(s, action.unitId, action.to, events);
    case 'Attack':
      return doStrike(s, action.unitId, action.targetId, 'attack', events);
    case 'UseAbility':
      return doAbility(s, action.unitId, action.targetId, events);
    case 'PlayCard':
      return playCard(s, action.handIndex, action.targetId, events);
    case 'EndActivation':
      return doEndActivation(s, action.unitId, events);
    case 'EndPhase':
      endPhase(s, events);
      return null;
  }
}

function claimActor(s: GameState, unitId: string): Unit | string {
  const u = s.units.find((x) => x.id === unitId);
  if (!u) return 'Unità non trovata.';
  if (u.team !== s.activeTeam) return 'Non è il turno di questa unità.';
  if (u.stage === 'done') return 'Questa unità è già stata attivata in questa fase.';
  if (u.stage === 'acted') return 'Questa unità ha già agito.';
  return u;
}

function openActivation(s: GameState, u: Unit): void {
  if (s.activeUnitId && s.activeUnitId !== u.id) finishActivation(s, s.activeUnitId);
  s.activeUnitId = u.id;
}

export function finishActivation(s: GameState, unitId: string): void {
  const u = s.units.find((x) => x.id === unitId);
  if (u) {
    u.stage = 'done';
    u.moveBonus = 0;
    u.chargeBonus = 0;
    u.cellsMoved = 0;
  }
  if (s.activeUnitId === unitId) s.activeUnitId = null;
}

function doMove(s: GameState, unitId: string, to: Pos, events: GameEvent[]): string | null {
  const u = claimActor(s, unitId);
  if (typeof u === 'string') return u;
  if (u.stage !== 'idle') return 'Questa unità si è già mossa.';
  const path = reachable(s, u.id).get(posKey(to));
  if (!path) return 'Destinazione non raggiungibile.';
  if (path.length === 1) return "L'unità si trova già lì.";
  openActivation(s, u);
  u.pos = { ...to };
  u.cellsMoved = path.length - 1;
  u.stage = 'moved';
  events.push({ type: 'Moved', unitId: u.id, path });
  return null;
}

function doStrike(s: GameState, unitId: string, targetId: string, kind: StrikeKind, events: GameEvent[]): string | null {
  const u = claimActor(s, unitId);
  if (typeof u === 'string') return u;
  if (!strikeTargets(s, u.id, kind).includes(targetId)) return 'Bersaglio non valido.';
  const target = s.units.find((x) => x.id === targetId)!;
  const ranged = strikeProfile(u, kind)!.ranged;
  const damage = strikeDamage(s, u, target, kind);
  openActivation(s, u);
  events.push({ type: 'Attacked', unitId: u.id, targetId, kind: ranged ? 'ranged' : 'melee' });
  if (s.focusFireTargetId === targetId) s.focusFireTargetId = null;
  if (ranged) u.precisionBonus = false;
  u.chargeBonus = 0;
  if (kind === 'ability') u.cooldown = UNIT_DEFS[u.archetype].ability.cooldown;
  u.stage = 'acted';
  applyDamage(s, target, damage, u.team, events);
  return null;
}

function doAbility(s: GameState, unitId: string, targetId: string | undefined, events: GameEvent[]): string | null {
  const u = claimActor(s, unitId);
  if (typeof u === 'string') return u;
  if (UNIT_DEFS[u.archetype].ability.kind === 'guard') {
    if (!canGuard(s, u.id)) return 'Abilità non disponibile.';
    openActivation(s, u);
    u.guard = Math.max(u.guard, GUARD_AMOUNT);
    u.stage = 'acted';
    events.push({ type: 'Guarded', unitId: u.id, amount: GUARD_AMOUNT });
    return null;
  }
  if (!targetId) return 'Serve un bersaglio.';
  return doStrike(s, unitId, targetId, 'ability', events);
}

function doEndActivation(s: GameState, unitId: string, events: GameEvent[]): string | null {
  const u = s.units.find((x) => x.id === unitId);
  if (!u) return 'Unità non trovata.';
  if (u.team !== s.activeTeam) return 'Non è il turno di questa unità.';
  if (u.stage === 'done') return 'Questa unità è già stata attivata in questa fase.';
  finishActivation(s, u.id);
  if (s.units.filter((x) => x.team === s.activeTeam).every((x) => x.stage === 'done')) endPhase(s, events);
  return null;
}

export function endPhase(s: GameState, events: GameEvent[]): void {
  if (s.activeUnitId) finishActivation(s, s.activeUnitId);
  const next: Team = s.activeTeam === 'player' ? 'ai' : 'player';
  if (next === 'player') s.round += 1;
  s.activeTeam = next;
  s.cardPlayed = false;
  s.focusFireTargetId = null;
  for (const u of s.units) {
    u.precisionBonus = false;
    u.moveBonus = 0;
    u.chargeBonus = 0;
    u.cellsMoved = 0;
    if (u.team === next) {
      u.guard = 0;
      u.cooldown = Math.max(0, u.cooldown - 1);
      u.stage = 'idle';
    }
  }
  events.push({ type: 'PhaseChanged', team: next, round: s.round });
}
