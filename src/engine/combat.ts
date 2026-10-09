import { manhattan } from './movement';
import { strikeProfile } from './targeting';
import type { StrikeKind } from './targeting';
import { COORDINATED_BONUS } from './units';
import type { GameEvent, GameState, Team, Unit } from './types';

export const FOCUS_FIRE_BONUS = 2;
export const PRECISION_DAMAGE_BONUS = 1;

/** Danno totale di un colpo, bonus inclusi, prima dell'assorbimento della guardia. */
export function strikeDamage(state: GameState, attacker: Unit, target: Unit, kind: StrikeKind): number {
  const profile = strikeProfile(attacker, kind);
  if (!profile) return 0;
  let damage = profile.damage;
  if (
    kind === 'ability' &&
    attacker.archetype === 'scout' &&
    state.units.some((u) => u.team === attacker.team && u.id !== attacker.id && manhattan(u.pos, target.pos) === 1)
  ) {
    damage += COORDINATED_BONUS;
  }
  if (profile.ranged && attacker.precisionBonus) damage += PRECISION_DAMAGE_BONUS;
  if (attacker.chargeBonus > 0 && attacker.cellsMoved >= 2) damage += attacker.chargeBonus;
  if (state.focusFireTargetId === target.id) damage += FOCUS_FIRE_BONUS;
  return damage;
}

export function applyDamage(
  state: GameState,
  target: Unit,
  amount: number,
  attackerTeam: Team,
  events: GameEvent[],
): void {
  const absorbed = Math.min(target.guard, amount);
  target.guard -= absorbed;
  const dealt = amount - absorbed;
  target.hp = Math.max(0, target.hp - dealt);
  events.push({ type: 'Damaged', unitId: target.id, amount: dealt, absorbed });
  if (target.hp > 0) return;
  state.units = state.units.filter((u) => u.id !== target.id);
  events.push({ type: 'Defeated', unitId: target.id });
  if (state.focusFireTargetId === target.id) state.focusFireTargetId = null;
  if (state.activeUnitId === target.id) state.activeUnitId = null;
  if (!state.units.some((u) => u.team === target.team)) {
    state.winner = attackerTeam;
    events.push({ type: 'GameOver', winner: attackerTeam });
  }
}
