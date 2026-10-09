import { isSolid } from './arena';
import { manhattan } from './movement';
import { UNIT_DEFS } from './units';
import type { StrikeStats } from './units';
import type { Arena, GameState, Pos, Unit } from './types';

export type StrikeKind = 'attack' | 'ability';

function traceClear(arena: Arena, a: Pos, b: Pos): boolean {
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  while (!(x === b.x && y === b.y)) {
    if (!(x === a.x && y === a.y) && isSolid(arena, { x, y })) return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return true;
}

export function hasLineOfSight(arena: Arena, a: Pos, b: Pos): boolean {
  return traceClear(arena, a, b) || traceClear(arena, b, a);
}

export function strikeProfile(unit: Unit, kind: StrikeKind): StrikeStats | null {
  const def = UNIT_DEFS[unit.archetype];
  let base: StrikeStats;
  if (kind === 'attack') {
    base = def.attack;
  } else {
    if (def.ability.kind !== 'strike' || unit.cooldown > 0) return null;
    base = def.ability;
  }
  const maxRange = base.ranged && unit.precisionBonus ? base.maxRange + 1 : base.maxRange;
  return { damage: base.damage, minRange: base.minRange, maxRange, ranged: base.ranged };
}

export function canAct(state: GameState, unit: Unit): boolean {
  return (
    state.winner === null &&
    unit.team === state.activeTeam &&
    (unit.stage === 'idle' || unit.stage === 'moved')
  );
}

export function hasAdjacentEnemy(state: GameState, unit: Unit): boolean {
  return state.units.some((u) => u.team !== unit.team && manhattan(u.pos, unit.pos) === 1);
}

export function strikeTargets(state: GameState, unitId: string, kind: StrikeKind): string[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || !canAct(state, unit)) return [];
  const profile = strikeProfile(unit, kind);
  if (!profile) return [];
  if (profile.ranged && hasAdjacentEnemy(state, unit)) return [];
  return state.units
    .filter((e) => e.team !== unit.team)
    .filter((e) => {
      const d = manhattan(unit.pos, e.pos);
      if (d < profile.minRange || d > profile.maxRange) return false;
      return !profile.ranged || hasLineOfSight(state.arena, unit.pos, e.pos);
    })
    .map((e) => e.id);
}

export function canGuard(state: GameState, unitId: string): boolean {
  const unit = state.units.find((u) => u.id === unitId);
  return !!unit && canAct(state, unit) && UNIT_DEFS[unit.archetype].ability.kind === 'guard';
}
