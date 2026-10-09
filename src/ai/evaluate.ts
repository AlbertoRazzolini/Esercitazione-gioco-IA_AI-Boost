import { manhattan } from '../engine/movement';
import { hasLineOfSight } from '../engine/targeting';
import { UNIT_DEFS } from '../engine/units';
import type { GameState, Team, Unit } from '../engine/types';

export const WEIGHTS = {
  alive: 15,
  guard: 0.5,
  threat: 0.6,
  approach: 0.3,
  crossbowGood: 2,
  crossbowAdjacent: 4,
  kill: 10,
};

function material(units: Unit[]): number {
  return units.reduce((sum, u) => sum + u.hp + WEIGHTS.guard * u.guard + WEIGHTS.alive, 0);
}

/** Stima dei danni che `attackers` possono infliggere nella loro prossima fase. */
export function threat(attackers: Unit[], victims: Unit[]): number {
  let total = 0;
  for (const a of attackers) {
    const def = UNIT_DEFS[a.archetype];
    const best = Math.max(def.attack.damage, def.ability.kind === 'strike' ? def.ability.damage : 0);
    const reach = def.move + Math.max(def.attack.maxRange, def.ability.maxRange);
    if (victims.some((v) => manhattan(a.pos, v.pos) <= reach)) total += best;
  }
  return total;
}

function positional(state: GameState, u: Unit, enemies: Unit[]): number {
  if (enemies.length === 0) return 0;
  const nearest = Math.min(...enemies.map((e) => manhattan(u.pos, e.pos)));
  if (u.archetype === 'crossbow') {
    if (nearest === 1) return -WEIGHTS.crossbowAdjacent;
    const hasShot = enemies.some((e) => {
      const d = manhattan(u.pos, e.pos);
      return d >= 2 && d <= 4 && hasLineOfSight(state.arena, u.pos, e.pos);
    });
    return hasShot ? WEIGHTS.crossbowGood : -WEIGHTS.approach * nearest;
  }
  return -WEIGHTS.approach * nearest;
}

export function evaluate(state: GameState, team: Team): number {
  if (state.winner) return state.winner === team ? 10000 : -10000;
  const mine = state.units.filter((u) => u.team === team);
  const theirs = state.units.filter((u) => u.team !== team);
  let score = material(mine) - material(theirs);
  score -= WEIGHTS.threat * threat(theirs, mine);
  for (const u of mine) score += positional(state, u, theirs);
  return score;
}

/** Valore immediato di un'azione: HP nemici tolti + bonus uccisioni. */
export function immediateGain(before: GameState, after: GameState, team: Team): number {
  if (after.winner === team) return 1000;
  const enemies = (s: GameState) => s.units.filter((u) => u.team !== team);
  const hp = (s: GameState) => enemies(s).reduce((n, u) => n + u.hp, 0);
  const kills = enemies(before).length - enemies(after).length;
  return hp(before) - hp(after) + WEIGHTS.kill * kills;
}
