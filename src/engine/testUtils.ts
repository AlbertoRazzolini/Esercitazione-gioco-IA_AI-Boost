import { newUnit } from './units';
import type { Archetype, Arena, GameState, Prop, Team, Unit } from './types';

export function unit(
  id: string,
  team: Team,
  archetype: Archetype,
  x: number,
  y: number,
  extra: Partial<Unit> = {},
): Unit {
  return { ...newUnit(id, team, archetype, { x, y }), ...extra };
}

export function blankArena(props: Prop[] = []): Arena {
  return {
    width: 10,
    height: 8,
    terrain: Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => 'grass' as const)),
    props,
  };
}

export function solidAt(x: number, y: number): Prop {
  return { kind: 'ruin', solid: true, cells: [{ x, y }] };
}

export function makeState(units: Unit[], opts: Partial<GameState> = {}): GameState {
  return {
    arena: blankArena(),
    units,
    activeTeam: 'player',
    round: 1,
    activeUnitId: null,
    cardPlayed: false,
    focusFireTargetId: null,
    decks: {
      player: { draw: [], hand: [], discard: [] },
      ai: { draw: [], hand: [], discard: [] },
    },
    rng: 1,
    winner: null,
    ...opts,
  };
}
