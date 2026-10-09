export type Team = 'player' | 'ai';
export type Archetype = 'guardian' | 'scout' | 'crossbow';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Stage = 'idle' | 'moved' | 'acted' | 'done';
export type CardId = 'forcedMarch' | 'holdTheLine' | 'focusFire' | 'charge' | 'rally' | 'precision';
export type TerrainKind = 'grass' | 'dirt' | 'mud' | 'gravel';
export type PropKind = 'tent' | 'ruin' | 'brazier' | 'rock' | 'tallgrass';

export interface Pos {
  x: number;
  y: number;
}

export interface Unit {
  id: string;
  team: Team;
  archetype: Archetype;
  pos: Pos;
  hp: number;
  guard: number;
  cooldown: number;
  stage: Stage;
  /** celle percorse nell'attivazione corrente */
  cellsMoved: number;
  /** Marcia forzata: movimento extra nell'attivazione corrente */
  moveBonus: number;
  /** Carica: danni extra al prossimo colpo dell'attivazione corrente */
  chargeBonus: number;
  /** Ordine di precisione: +1 danno e +1 gittata al prossimo colpo a distanza della fase */
  precisionBonus: boolean;
}

export interface Prop {
  kind: PropKind;
  cells: Pos[];
  solid: boolean;
}

export interface Arena {
  width: number;
  height: number;
  /** terrain[y][x] */
  terrain: TerrainKind[][];
  props: Prop[];
}

export interface DeckState {
  draw: CardId[];
  hand: CardId[];
  discard: CardId[];
}

export interface GameState {
  arena: Arena;
  units: Unit[];
  activeTeam: Team;
  round: number;
  /** unità con un'attivazione aperta (stage 'moved' o 'acted') */
  activeUnitId: string | null;
  cardPlayed: boolean;
  focusFireTargetId: string | null;
  decks: Record<Team, DeckState>;
  rng: number;
  winner: Team | null;
}

export type Action =
  | { type: 'Move'; unitId: string; to: Pos }
  | { type: 'Attack'; unitId: string; targetId: string }
  | { type: 'UseAbility'; unitId: string; targetId?: string }
  | { type: 'PlayCard'; handIndex: number; targetId: string }
  | { type: 'EndActivation'; unitId: string }
  | { type: 'EndPhase' };

export type GameEvent =
  | { type: 'Moved'; unitId: string; path: Pos[] }
  | { type: 'Attacked'; unitId: string; targetId: string; kind: 'melee' | 'ranged' }
  | { type: 'Damaged'; unitId: string; amount: number; absorbed: number }
  | { type: 'Guarded'; unitId: string; amount: number }
  | { type: 'Healed'; unitId: string; amount: number }
  | { type: 'CardPlayed'; team: Team; cardId: CardId; targetId: string }
  | { type: 'Defeated'; unitId: string }
  | { type: 'PhaseChanged'; team: Team; round: number }
  | { type: 'GameOver'; winner: Team };

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };
