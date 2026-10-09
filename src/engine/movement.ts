import { inBounds, isSolid, posKey, samePos } from './arena';
import { UNIT_DEFS } from './units';
import type { GameState, Pos, Unit } from './types';

export const DIRS: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isBlocked(state: GameState, p: Pos, ignoreUnitId?: string): boolean {
  if (!inBounds(state.arena, p) || isSolid(state.arena, p)) return true;
  return state.units.some((u) => u.id !== ignoreUnitId && samePos(u.pos, p));
}

export function moveAllowance(unit: Unit): number {
  return UNIT_DEFS[unit.archetype].move + unit.moveBonus;
}

export function reachable(state: GameState, unitId: string): Map<string, Pos[]> {
  const result = new Map<string, Pos[]>();
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return result;
  const max = moveAllowance(unit);
  result.set(posKey(unit.pos), [{ ...unit.pos }]);
  let frontier: Pos[][] = [[{ ...unit.pos }]];
  for (let step = 0; step < max; step++) {
    const next: Pos[][] = [];
    for (const path of frontier) {
      const last = path[path.length - 1];
      for (const d of DIRS) {
        const p = { x: last.x + d.x, y: last.y + d.y };
        const key = posKey(p);
        if (result.has(key) || isBlocked(state, p, unit.id)) continue;
        const newPath = [...path, p];
        result.set(key, newPath);
        next.push(newPath);
      }
    }
    frontier = next;
  }
  return result;
}
