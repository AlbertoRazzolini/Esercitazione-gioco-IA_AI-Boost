import type { Archetype, Pos, Team, Unit } from './types';

export interface StrikeStats {
  damage: number;
  minRange: number;
  maxRange: number;
  ranged: boolean;
}

export interface UnitDef {
  name: string;
  maxHp: number;
  move: number;
  attack: StrikeStats;
  ability: StrikeStats & {
    name: string;
    description: string;
    kind: 'guard' | 'strike';
    cooldown: number;
  };
}

export const GUARD_AMOUNT = 3;
export const COORDINATED_BONUS = 1;

export const UNIT_DEFS: Record<Archetype, UnitDef> = {
  guardian: {
    name: 'Guardiano',
    maxHp: 12,
    move: 3,
    attack: { damage: 3, minRange: 1, maxRange: 1, ranged: false },
    ability: {
      name: 'Parata',
      description: 'Ottiene 3 punti guardia fino alla prossima fase della sua squadra.',
      kind: 'guard',
      damage: 0,
      minRange: 0,
      maxRange: 0,
      ranged: false,
      cooldown: 0,
    },
  },
  scout: {
    name: 'Esploratore',
    maxHp: 8,
    move: 4,
    attack: { damage: 3, minRange: 1, maxRange: 1, ranged: false },
    ability: {
      name: 'Fendente coordinato',
      description: '4 danni in mischia, 5 se un altro alleato è adiacente al bersaglio.',
      kind: 'strike',
      damage: 4,
      minRange: 1,
      maxRange: 1,
      ranged: false,
      cooldown: 0,
    },
  },
  crossbow: {
    name: 'Balestriere',
    maxHp: 7,
    move: 3,
    attack: { damage: 2, minRange: 2, maxRange: 4, ranged: true },
    ability: {
      name: 'Tiro mirato',
      description: '3 danni a distanza 2–5. Ricarica: salta la fase successiva.',
      kind: 'strike',
      damage: 3,
      minRange: 2,
      maxRange: 5,
      ranged: true,
      cooldown: 2,
    },
  },
};

export function newUnit(id: string, team: Team, archetype: Archetype, pos: Pos): Unit {
  return {
    id,
    team,
    archetype,
    pos: { ...pos },
    hp: UNIT_DEFS[archetype].maxHp,
    guard: 0,
    cooldown: 0,
    stage: 'idle',
    cellsMoved: 0,
    moveBonus: 0,
    chargeBonus: 0,
    precisionBonus: false,
  };
}
