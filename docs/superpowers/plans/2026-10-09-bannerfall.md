# Bannerfall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tactical RPG isometrico a turni (3 vs 3, carte-ordine, AI a 3 livelli) giocabile nel browser.

**Architecture:** Motore puro in TypeScript (`applyAction(state, action) → {state, events}`), Redux Toolkit come contenitore sottile dello stato, PixiJS v8 imperativo per la scena, che riproduce gli eventi del motore attraverso una coda di animazione. L'AI simula le mosse con lo stesso `applyAction`.

**Tech Stack:** React 19, TypeScript strict, Vite 8, @reduxjs/toolkit 2.13.0, react-redux 9.3.0, pixi.js 8.22.0, vitest 5.0.3.

**Spec:** `docs/superpowers/specs/2026-10-09-bannerfall-design.md`

## Global Constraints

- TypeScript `strict: true`. Il tsconfig ha `verbatimModuleSyntax` (usare `import type` per i tipi) ed `erasableSyntaxOnly` (vietati `enum` e parameter properties `constructor(private x)`).
- Nessuna dipendenza oltre a: `@reduxjs/toolkit`, `react-redux`, `pixi.js`, `vitest` (dev).
- Nello store Redux non entrano oggetti PixiJS, timer, promise o funzioni.
- Distanze Manhattan; adiacente = distanza 1; movimento in 4 direzioni.
- Tutti i valori di bilanciamento stanno in `src/engine/units.ts` e `src/engine/cards.ts`, non nei componenti.
- Nessuna emoji come personaggio o icona, nessuna base sotto le unità, griglia invisibile fuori dalle interazioni.
- Git: **l'utente committa con GitHub Desktop**. I passi "Checkpoint" indicano cosa committare e con quale messaggio; l'esecutore non esegue comandi git.
- Testi visibili in italiano.

## Review Focus

1. **Clic durante animazioni o turno AI**: devono essere ignorati, senza doppie attivazioni. Test nel Task 8 (`perform` mentre `busy` restituisce `false`).
2. **"Ricomincia" durante la fase AI**: il vecchio ciclo AI deve fermarsi e non scrivere sulla nuova partita. Test nel Task 8.
3. **Carta su un bersaglio diventato non valido** (es. Ordine di precisione su un Balestriere che ha già sparato): va rifiutata. Test nel Task 5.
4. **AI senza mosse utili** (unità bloccate, nessuna carta giocabile): deve chiudere la fase, non bloccarsi. Test nel Task 6.
5. **Colpo che chiude la partita**: dopo `GameOver` l'AI non deve inviare `EndActivation` (verrebbe rifiutato). Test nel Task 6.

## File Map

| File | Responsabilità |
|---|---|
| `src/engine/types.ts` | Tutti i tipi di dominio, azioni, eventi |
| `src/engine/units.ts` | Statistiche degli archetipi, `newUnit` |
| `src/engine/arena.ts` | Mappa 10×8, oggetti, posizioni iniziali, helper sulle celle |
| `src/engine/rng.ts` | PRNG mulberry32 con seed, shuffle |
| `src/engine/testUtils.ts` | Costruttori di stati per i test |
| `src/engine/movement.ts` | Distanza, celle bloccate, BFS raggiungibilità e percorsi |
| `src/engine/targeting.ts` | Linea di vista, profili d'attacco, bersagli validi |
| `src/engine/deck.ts` | Mazzo, pesca, rimescolamento |
| `src/engine/combat.ts` | Calcolo danni con bonus, applicazione danni e sconfitta |
| `src/engine/cards.ts` | Definizioni carte, bersagli validi, effetti |
| `src/engine/engine.ts` | `createGame`, `applyAction`, attivazioni e fasi |
| `src/ai/*.ts` | `run.ts` (sequenze di azioni), candidati, valutazione, tre livelli, `planActivation`, `match.ts` (partite AI contro AI) |
| `src/app/store.ts`, `hooks.ts` | Store e hook tipizzati |
| `src/game/gameSlice.ts` | Stato UI + partita |
| `src/game/animator.ts` | Ponte fra thunk e animazioni (fuori dallo store) |
| `src/game/thunks.ts` | `startGame`, `perform`, `clickCell` |
| `src/game/aiDriver.ts` | Ciclo della fase AI |
| `src/game/selectors.ts` | Overlay tattico derivato dallo stato |
| `src/render/iso.ts` | Proiezione isometrica e inversa |
| `src/render/spriteFactory.ts`, `assetMap.ts` | Sprite chibi procedurali, punto di sostituzione |
| `src/render/terrain.ts` | Terreno e oggetti |
| `src/render/scene.ts` | `BattleScene`: strati, viste delle unità, overlay |
| `src/render/effects.ts` | Luci, braci, vignettatura, testi fluttuanti |
| `src/render/tween.ts` | Tween sul ticker, `prefers-reduced-motion` |
| `src/render/animationQueue.ts` | `Animator`: eventi → tween |
| `src/render/BattlefieldCanvas.tsx` | Monta PixiJS, input, iscrizione allo store |
| `src/ui/*.tsx`, `ui.css` | Schermate e pannelli React |

---

### Task 1: Setup, tipi, dati e RNG

**Files:**
- Modify: `package.json`, `tsconfig.app.json`
- Create: `src/engine/types.ts`, `src/engine/units.ts`, `src/engine/arena.ts`, `src/engine/rng.ts`, `src/engine/testUtils.ts`
- Test: `src/engine/rng.test.ts`, `src/engine/arena.test.ts`

**Interfaces:**
- Produces: tutti i tipi di `types.ts`; `UNIT_DEFS`, `GUARD_AMOUNT`, `COORDINATED_BONUS`, `newUnit(id, team, archetype, pos)`; `createArena()`, `START_POSITIONS`, `inBounds(arena, p)`, `isSolid(arena, p)`, `posKey(p)`, `samePos(a, b)`; `nextRandom(state) → [value, nextState]`, `shuffle(items, state) → [items, nextState]`; in testUtils `unit(...)`, `blankArena(props?)`, `makeState(units, opts?)`, `solidAt(x, y)`.

- [ ] **Step 1: Installare le dipendenze**

Run:
```bash
npm install @reduxjs/toolkit@2.13.0 react-redux@9.3.0 pixi.js@8.22.0
npm install -D vitest@5.0.3
```

- [ ] **Step 2: Script di test e strict mode**

In `package.json`, dentro `"scripts"`, aggiungere `"test": "vitest run"`.

In `tsconfig.app.json`, dentro `"compilerOptions"` (sezione Linting), aggiungere `"strict": true,`.

- [ ] **Step 3: Creare `src/engine/types.ts`**

```ts
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
```

- [ ] **Step 4: Creare `src/engine/units.ts`**

```ts
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
```

- [ ] **Step 5: Creare `src/engine/rng.ts`**

```ts
/** mulberry32: restituisce [valore in [0,1), nuovo stato] */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, n] = nextRandom(s);
    s = n;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}
```

- [ ] **Step 6: Creare `src/engine/arena.ts`**

```ts
import type { Archetype, Arena, Pos, Prop, Team, TerrainKind } from './types';

export const ARENA_WIDTH = 10;
export const ARENA_HEIGHT = 8;

const TERRAIN_ROWS = [
  'ggvgggggdg',
  'gggdddgggg',
  'gdddmddggg',
  'ddmmmmdddd',
  'dddmmmmmdd',
  'gggddmddgg',
  'ggvgdddggv',
  'gggggdgggg',
];

const TERRAIN_CODES: Record<string, TerrainKind> = { g: 'grass', d: 'dirt', m: 'mud', v: 'gravel' };

const PROPS: Prop[] = [
  { kind: 'tent', solid: true, cells: [{ x: 4, y: 1 }, { x: 5, y: 1 }, { x: 4, y: 2 }, { x: 5, y: 2 }] },
  { kind: 'ruin', solid: true, cells: [{ x: 5, y: 5 }, { x: 5, y: 6 }] },
  { kind: 'brazier', solid: true, cells: [{ x: 2, y: 3 }] },
  { kind: 'brazier', solid: true, cells: [{ x: 7, y: 4 }] },
  { kind: 'rock', solid: false, cells: [{ x: 3, y: 7 }] },
  { kind: 'rock', solid: false, cells: [{ x: 6, y: 0 }] },
  { kind: 'rock', solid: false, cells: [{ x: 8, y: 6 }] },
  { kind: 'tallgrass', solid: false, cells: [{ x: 1, y: 1 }] },
  { kind: 'tallgrass', solid: false, cells: [{ x: 8, y: 1 }] },
];

export const START_POSITIONS: Record<Team, Record<Archetype, Pos>> = {
  player: { guardian: { x: 1, y: 3 }, scout: { x: 1, y: 5 }, crossbow: { x: 0, y: 4 } },
  ai: { guardian: { x: 8, y: 4 }, scout: { x: 8, y: 2 }, crossbow: { x: 9, y: 3 } },
};

export function createArena(): Arena {
  return {
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    terrain: TERRAIN_ROWS.map((row) => [...row].map((c) => TERRAIN_CODES[c])),
    props: PROPS.map((p) => ({ ...p, cells: p.cells.map((c) => ({ ...c })) })),
  };
}

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(arena: Arena, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < arena.width && p.y < arena.height;
}

export function isSolid(arena: Arena, p: Pos): boolean {
  return arena.props.some((prop) => prop.solid && prop.cells.some((c) => samePos(c, p)));
}
```

- [ ] **Step 7: Creare `src/engine/testUtils.ts`**

```ts
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
```

- [ ] **Step 8: Scrivere i test**

`src/engine/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { nextRandom, shuffle } from './rng';

describe('rng', () => {
  it('è deterministico per lo stesso seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(nextRandom(42)[0]).not.toEqual(nextRandom(43)[0]);
  });

  it('produce valori in [0,1)', () => {
    let s = 7;
    for (let i = 0; i < 1000; i++) {
      const [v, n] = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      s = n;
    }
  });

  it('shuffle è una permutazione deterministica', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [a] = shuffle(items, 99);
    const [b] = shuffle(items, 99);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
```

`src/engine/arena.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { START_POSITIONS, createArena, inBounds, isSolid, posKey } from './arena';

describe('arena', () => {
  const arena = createArena();

  it('ha dimensioni 10x8 e terreno completo', () => {
    expect(arena.terrain).toHaveLength(8);
    arena.terrain.forEach((row) => expect(row).toHaveLength(10));
    arena.terrain.flat().forEach((t) => expect(t).toBeDefined());
  });

  it('le posizioni iniziali sono valide, libere e distinte', () => {
    const all = [...Object.values(START_POSITIONS.player), ...Object.values(START_POSITIONS.ai)];
    all.forEach((p) => {
      expect(inBounds(arena, p)).toBe(true);
      expect(isSolid(arena, p)).toBe(false);
    });
    expect(new Set(all.map(posKey)).size).toBe(6);
  });

  it('distingue oggetti solidi e decorativi', () => {
    expect(isSolid(arena, { x: 4, y: 1 })).toBe(true);
    expect(isSolid(arena, { x: 3, y: 7 })).toBe(false);
  });
});
```

- [ ] **Step 9: Eseguire i test**

Run: `npm test`
Expected: PASS (6 test).

- [ ] **Step 10: Checkpoint**

L'utente committa con GitHub Desktop: `package.json`, `package-lock.json`, `tsconfig.app.json`, `src/engine/`. Messaggio: `feat(engine): tipi, dati delle unità, arena e rng`.

---

### Task 2: Movimento (BFS)

**Files:**
- Create: `src/engine/movement.ts`
- Test: `src/engine/movement.test.ts`

**Interfaces:**
- Consumes: `UNIT_DEFS`, `inBounds`, `isSolid`, `posKey`, `samePos`, tipi.
- Produces: `DIRS`, `manhattan(a, b): number`, `isBlocked(state, p, ignoreUnitId?): boolean`, `moveAllowance(unit): number`, `reachable(state, unitId): Map<string, Pos[]>` (chiave `posKey`, valore = percorso dalla cella di partenza inclusa alla destinazione; contiene sempre la cella di partenza con percorso `[start]`).

- [ ] **Step 1: Scrivere il test che fallisce**

`src/engine/movement.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { manhattan, reachable } from './movement';
import { blankArena, makeState, solidAt, unit } from './testUtils';
import type { Pos } from './types';

function isValidPath(path: Pos[]): boolean {
  return path.every((p, i) => i === 0 || manhattan(p, path[i - 1]) === 1);
}

describe('movement', () => {
  it('in campo aperto raggiunge tutte le celle entro il movimento (rombo)', () => {
    const s = makeState([unit('g', 'player', 'guardian', 5, 4)]);
    const r = reachable(s, 'g');
    // rombo di raggio 3: 1 + 4 + 8 + 12 = 25 celle
    expect(r.size).toBe(25);
    for (const path of r.values()) {
      expect(path.length - 1).toBeLessThanOrEqual(3);
      expect(isValidPath(path)).toBe(true);
    }
  });

  it('include la cella di partenza con percorso di lunghezza 1', () => {
    const s = makeState([unit('g', 'player', 'guardian', 5, 4)]);
    expect(reachable(s, 'g').get('5,4')).toEqual([{ x: 5, y: 4 }]);
  });

  it('il bonus di movimento estende la portata', () => {
    const s = makeState([unit('s', 'player', 'scout', 5, 4, { moveBonus: 2 })]);
    const r = reachable(s, 's');
    expect(r.has('9,6')).toBe(true); // distanza 6
    expect(r.has('0,7')).toBe(false); // distanza 8
  });

  it('non attraversa né occupa celle con unità', () => {
    const s = makeState([
      unit('g', 'player', 'guardian', 0, 0),
      unit('b', 'ai', 'guardian', 1, 0),
      unit('c', 'player', 'scout', 0, 1),
    ]);
    expect(reachable(s, 'g').size).toBe(1);
  });

  it('non attraversa gli ostacoli solidi', () => {
    const s = makeState([unit('g', 'player', 'guardian', 0, 0)], {
      arena: blankArena([solidAt(1, 0), solidAt(1, 1), solidAt(0, 2)]),
    });
    expect([...reachable(s, 'g').keys()].sort()).toEqual(['0,0', '0,1']);
  });

  it('non esce dai bordi della mappa', () => {
    const s = makeState([unit('g', 'player', 'guardian', 0, 0)]);
    for (const key of reachable(s, 'g').keys()) {
      const [x, y] = key.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('il percorso aggira un ostacolo', () => {
    const s = makeState([unit('s', 'player', 'scout', 0, 1)], {
      arena: blankArena([solidAt(1, 1)]),
    });
    const path = reachable(s, 's').get('2,1');
    expect(path).toBeDefined();
    expect(path!.length - 1).toBe(4);
    expect(isValidPath(path!)).toBe(true);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/engine/movement.test.ts`
Expected: FAIL, "Cannot find module './movement'".

- [ ] **Step 3: Implementare `src/engine/movement.ts`**

```ts
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
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run src/engine/movement.test.ts`
Expected: PASS (7 test).

---

### Task 3: Bersagli e linea di vista

**Files:**
- Create: `src/engine/targeting.ts`
- Test: `src/engine/targeting.test.ts`

**Interfaces:**
- Consumes: `manhattan`, `isSolid`, `UNIT_DEFS`, `StrikeStats`.
- Produces:
  - `hasLineOfSight(arena, a, b): boolean`, simmetrica: è vera se almeno uno dei due tracciati di Bresenham è libero;
  - `type StrikeKind = 'attack' | 'ability'`;
  - `strikeProfile(unit, kind): StrikeStats | null`: restituisce null se l'abilità non è un colpo o è in ricarica; applica il +1 alla gittata massima di Ordine di precisione;
  - `canAct(state, unit): boolean`: la partita è in corso, l'unità è della squadra attiva e ha stage `idle` o `moved`;
  - `hasAdjacentEnemy(state, unit): boolean`;
  - `strikeTargets(state, unitId, kind): string[]`;
  - `canGuard(state, unitId): boolean`.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/engine/targeting.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canGuard, hasLineOfSight, strikeTargets } from './targeting';
import { blankArena, makeState, solidAt, unit } from './testUtils';

describe('targeting', () => {
  it('mischia: solo bersagli adiacenti ortogonali', () => {
    const s = makeState([
      unit('g', 'player', 'guardian', 3, 3),
      unit('e1', 'ai', 'scout', 4, 3),
      unit('e2', 'ai', 'scout', 4, 4),
      unit('a', 'player', 'scout', 3, 4),
    ]);
    expect(strikeTargets(s, 'g', 'attack')).toEqual(['e1']);
  });

  it('balestra: gittata 2-4 e nessun tiro con nemico adiacente', () => {
    const adjacent = makeState([
      unit('c', 'player', 'crossbow', 0, 0),
      unit('near', 'ai', 'scout', 0, 1),
      unit('far', 'ai', 'scout', 3, 0),
    ]);
    expect(strikeTargets(adjacent, 'c', 'attack')).toEqual([]);
    const s = makeState([
      unit('c', 'player', 'crossbow', 0, 0),
      unit('d2', 'ai', 'scout', 2, 0),
      unit('d4', 'ai', 'scout', 0, 4),
      unit('d5', 'ai', 'guardian', 5, 0),
    ]);
    expect(strikeTargets(s, 'c', 'attack').sort()).toEqual(['d2', 'd4']);
  });

  it('tiro mirato: gittata fino a 5 e ricarica', () => {
    const s = makeState([unit('c', 'player', 'crossbow', 0, 0), unit('d5', 'ai', 'guardian', 5, 0)]);
    expect(strikeTargets(s, 'c', 'ability')).toEqual(['d5']);
    const cooling = makeState([
      unit('c', 'player', 'crossbow', 0, 0, { cooldown: 1 }),
      unit('d5', 'ai', 'guardian', 5, 0),
    ]);
    expect(strikeTargets(cooling, 'c', 'ability')).toEqual([]);
  });

  it('ordine di precisione: +1 alla gittata massima', () => {
    const s = makeState([
      unit('c', 'player', 'crossbow', 0, 0, { precisionBonus: true }),
      unit('d5', 'ai', 'guardian', 5, 0),
    ]);
    expect(strikeTargets(s, 'c', 'attack')).toEqual(['d5']);
  });

  it('linea di vista bloccata da ostacoli solidi, non dalle unità', () => {
    const arena = blankArena([solidAt(2, 0)]);
    expect(hasLineOfSight(arena, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    expect(hasLineOfSight(arena, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true);
    const s = makeState(
      [
        unit('c', 'player', 'crossbow', 0, 0),
        unit('e', 'ai', 'scout', 4, 0),
        unit('e2', 'ai', 'guardian', 0, 3),
        unit('blocker', 'player', 'guardian', 0, 2),
      ],
      { arena },
    );
    expect(strikeTargets(s, 'c', 'attack')).toEqual(['e2']);
  });

  it('linea di vista simmetrica', () => {
    const arena = blankArena([solidAt(2, 1)]);
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 3 };
    expect(hasLineOfSight(arena, a, b)).toBe(hasLineOfSight(arena, b, a));
  });

  it('nessun bersaglio fuori dal proprio turno o dopo aver agito', () => {
    const base = [unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 4, 3)];
    expect(strikeTargets(makeState(base, { activeTeam: 'ai' }), 'g', 'attack')).toEqual([]);
    const acted = [unit('g', 'player', 'guardian', 3, 3, { stage: 'acted' }), unit('e', 'ai', 'scout', 4, 3)];
    expect(strikeTargets(makeState(acted), 'g', 'attack')).toEqual([]);
  });

  it('parata disponibile solo al guardiano attivabile', () => {
    const s = makeState([unit('g', 'player', 'guardian', 0, 0), unit('s', 'player', 'scout', 1, 0)]);
    expect(canGuard(s, 'g')).toBe(true);
    expect(canGuard(s, 's')).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/engine/targeting.test.ts`
Expected: FAIL, "Cannot find module './targeting'".

- [ ] **Step 3: Implementare `src/engine/targeting.ts`**

```ts
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
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run src/engine/targeting.test.ts`
Expected: PASS (8 test).

- [ ] **Step 5: Checkpoint**

L'utente committa `src/engine/movement*.ts` e `src/engine/targeting*.ts`. Messaggio: `feat(engine): movimento BFS, linea di vista e bersagli`.

---

### Task 4: Mazzo, combattimento e motore (`applyAction`)

**Files:**
- Create: `src/engine/deck.ts`, `src/engine/combat.ts`, `src/engine/engine.ts`
- Test: `src/engine/deck.test.ts`, `src/engine/engine.test.ts`

**Interfaces:**
- Consumes: Task 1–3.
- Produces:
  - `ALL_CARDS: CardId[]`, `HAND_SIZE = 3`, `createDeck(rng): [DeckState, number]`, `drawCard(deck, rng): number` (modifica `deck`, restituisce il nuovo rng);
  - `FOCUS_FIRE_BONUS = 2`, `PRECISION_DAMAGE_BONUS = 1`, `strikeDamage(state, attacker, target, kind): number`, `applyDamage(state, target, amount, attackerTeam, events): void`;
  - `createGame(seed): GameState`, `applyAction(state, action): ApplyResult`, `cloneState(state): GameState`, `finishActivation(state, unitId): void`, `endPhase(state, events): void`.
  - In questo task `PlayCard` restituisce l'errore `'Carte non ancora disponibili.'`; il Task 5 lo sostituisce.

- [ ] **Step 1: Scrivere i test del mazzo**

`src/engine/deck.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, createDeck, drawCard } from './deck';
import type { DeckState } from './types';

describe('deck', () => {
  it('12 carte, 2 copie per tipo, mano iniziale di 3', () => {
    const [deck] = createDeck(5);
    expect(deck.hand).toHaveLength(3);
    expect(deck.draw).toHaveLength(9);
    const all = [...deck.hand, ...deck.draw];
    ALL_CARDS.forEach((c) => expect(all.filter((x) => x === c)).toHaveLength(2));
  });

  it('è deterministico per lo stesso seed', () => {
    expect(createDeck(5)[0]).toEqual(createDeck(5)[0]);
  });

  it('rimescola gli scarti quando il mazzo è vuoto', () => {
    const deck: DeckState = { draw: [], hand: ['rally'], discard: ['charge', 'focusFire'] };
    drawCard(deck, 3);
    expect(deck.hand).toHaveLength(2);
    expect(deck.discard).toHaveLength(0);
    expect(deck.draw).toHaveLength(1);
  });

  it('non pesca nulla se mazzo e scarti sono vuoti', () => {
    const deck: DeckState = { draw: [], hand: [], discard: [] };
    expect(drawCard(deck, 3)).toBe(3);
    expect(deck.hand).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implementare `src/engine/deck.ts`**

```ts
import { shuffle } from './rng';
import type { CardId, DeckState } from './types';

export const ALL_CARDS: CardId[] = ['forcedMarch', 'holdTheLine', 'focusFire', 'charge', 'rally', 'precision'];
export const HAND_SIZE = 3;

export function drawCard(deck: DeckState, rng: number): number {
  let next = rng;
  if (deck.draw.length === 0) {
    if (deck.discard.length === 0) return next;
    const [reshuffled, r] = shuffle(deck.discard, next);
    deck.draw = reshuffled;
    deck.discard = [];
    next = r;
  }
  deck.hand.push(deck.draw.shift()!);
  return next;
}

export function createDeck(rng: number): [DeckState, number] {
  const [draw, r] = shuffle([...ALL_CARDS, ...ALL_CARDS], rng);
  const deck: DeckState = { draw, hand: [], discard: [] };
  let next = r;
  for (let i = 0; i < HAND_SIZE; i++) next = drawCard(deck, next);
  return [deck, next];
}
```

Run: `npx vitest run src/engine/deck.test.ts`
Expected: PASS (4 test).

- [ ] **Step 3: Scrivere i test del motore**

`src/engine/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from './engine';
import { makeState, unit } from './testUtils';
import type { Action, ApplyResult, GameState } from './types';

function ok(r: ApplyResult): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function chain(state: GameState, actions: Action[]): GameState {
  return actions.reduce((s, a) => ok(applyAction(s, a)), state);
}

function hp(state: GameState, id: string): number | undefined {
  return state.units.find((u) => u.id === id)?.hp;
}

describe('createGame', () => {
  it('crea 6 unità, mani di 3 carte, inizia il giocatore', () => {
    const g = createGame(123);
    expect(g.units).toHaveLength(6);
    expect(g.activeTeam).toBe('player');
    expect(g.round).toBe(1);
    expect(g.decks.player.hand).toHaveLength(3);
    expect(g.decks.ai.hand).toHaveLength(3);
    expect(g.decks.player.draw).toHaveLength(9);
    expect(createGame(123)).toEqual(g);
  });
});

describe('applyAction', () => {
  const duel = () =>
    makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 6, 3)]);

  it('non modifica lo stato di partenza', () => {
    const s = duel();
    const before = structuredClone(s);
    applyAction(s, { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } });
    expect(s).toEqual(before);
  });

  it('movimento valido: posizione, stage ed evento con percorso', () => {
    const r = applyAction(duel(), { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } });
    const s = ok(r);
    const g = s.units.find((u) => u.id === 'g')!;
    expect(g.pos).toEqual({ x: 5, y: 3 });
    expect(g.stage).toBe('moved');
    expect(g.cellsMoved).toBe(2);
    expect(r.ok && r.events[0]).toMatchObject({ type: 'Moved', unitId: 'g' });
  });

  it('rifiuta destinazioni troppo lontane e un secondo movimento', () => {
    expect(applyAction(duel(), { type: 'Move', unitId: 'g', to: { x: 3, y: 7 } }).ok).toBe(false);
    const s = chain(duel(), [{ type: 'Move', unitId: 'g', to: { x: 4, y: 3 } }]);
    expect(applyAction(s, { type: 'Move', unitId: 'g', to: { x: 4, y: 4 } }).ok).toBe(false);
  });

  it('attacco in mischia: 3 danni, poi niente movimento', () => {
    const s = chain(duel(), [
      { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(hp(s, 'e')).toBe(5);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('acted');
    expect(applyAction(s, { type: 'Move', unitId: 'g', to: { x: 5, y: 4 } }).ok).toBe(false);
  });

  it('la guardia assorbe i danni prima degli HP', () => {
    const s = makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'guardian', 4, 3, { guard: 3 })]);
    const r = applyAction(s, { type: 'Attack', unitId: 'g', targetId: 'e' });
    expect(hp(ok(r), 'e')).toBe(12);
    expect(r.ok && r.events).toContainEqual({ type: 'Damaged', unitId: 'e', amount: 0, absorbed: 3 });
  });

  it('parata: +3 guardia, stage acted', () => {
    const r = applyAction(duel(), { type: 'UseAbility', unitId: 'g' });
    const g = ok(r).units.find((u) => u.id === 'g')!;
    expect(g.guard).toBe(3);
    expect(g.stage).toBe('acted');
  });

  it('fendente coordinato: 4 danni, 5 con un altro alleato adiacente al bersaglio', () => {
    const alone = makeState([unit('s', 'player', 'scout', 3, 3), unit('e', 'ai', 'guardian', 4, 3), unit('a', 'player', 'guardian', 0, 0)]);
    expect(hp(chain(alone, [{ type: 'UseAbility', unitId: 's', targetId: 'e' }]), 'e')).toBe(8);
    const flanked = makeState([unit('s', 'player', 'scout', 3, 3), unit('e', 'ai', 'guardian', 4, 3), unit('a', 'player', 'guardian', 4, 4)]);
    expect(hp(chain(flanked, [{ type: 'UseAbility', unitId: 's', targetId: 'e' }]), 'e')).toBe(7);
  });

  it('sconfitta, vittoria e blocco delle azioni a partita finita', () => {
    const s = makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 4, 3, { hp: 2 })]);
    const r = applyAction(s, { type: 'Attack', unitId: 'g', targetId: 'e' });
    const after = ok(r);
    expect(after.units.map((u) => u.id)).toEqual(['g']);
    expect(after.winner).toBe('player');
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['Attacked', 'Damaged', 'Defeated', 'GameOver']);
    expect(applyAction(after, { type: 'EndPhase' }).ok).toBe(false);
  });

  it('una sola attivazione per unità in una fase', () => {
    const s = chain(makeState([unit('g', 'player', 'guardian', 3, 3), unit('s', 'player', 'scout', 0, 0), unit('e', 'ai', 'scout', 9, 7)]), [
      { type: 'Move', unitId: 'g', to: { x: 4, y: 3 } },
      { type: 'EndActivation', unitId: 'g' },
    ]);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('done');
    expect(applyAction(s, { type: 'Move', unitId: 'g', to: { x: 5, y: 3 } }).ok).toBe(false);
    expect(applyAction(s, { type: 'EndActivation', unitId: 'g' }).ok).toBe(false);
  });

  it("agire con un'altra unità chiude l'attivazione aperta", () => {
    const s = chain(makeState([unit('g', 'player', 'guardian', 3, 3), unit('s', 'player', 'scout', 0, 0), unit('e', 'ai', 'scout', 9, 7)]), [
      { type: 'Move', unitId: 'g', to: { x: 4, y: 3 } },
      { type: 'Move', unitId: 's', to: { x: 1, y: 0 } },
    ]);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('done');
    expect(s.activeUnitId).toBe('s');
  });

  it('la fase finisce da sola quando tutte le unità sono attivate', () => {
    const r = applyAction(duel(), { type: 'EndActivation', unitId: 'g' });
    const s = ok(r);
    expect(s.activeTeam).toBe('ai');
    expect(r.ok && r.events).toContainEqual({ type: 'PhaseChanged', team: 'ai', round: 1 });
  });

  it('alternanza delle fasi, round e reset delle attivazioni', () => {
    const s = chain(duel(), [{ type: 'EndActivation', unitId: 'g' }, { type: 'EndPhase' }]);
    expect(s.activeTeam).toBe('player');
    expect(s.round).toBe(2);
    expect(s.units.find((u) => u.id === 'g')!.stage).toBe('idle');
  });

  it("rifiuta le azioni con unità dell'altra squadra o inesistenti", () => {
    expect(applyAction(duel(), { type: 'Move', unitId: 'e', to: { x: 6, y: 4 } }).ok).toBe(false);
    expect(applyAction(duel(), { type: 'Move', unitId: 'ghost', to: { x: 0, y: 0 } }).ok).toBe(false);
  });

  it('la guardia scade alla prossima fase della propria squadra', () => {
    const s1 = chain(duel(), [{ type: 'UseAbility', unitId: 'g' }, { type: 'EndActivation', unitId: 'g' }]);
    expect(s1.activeTeam).toBe('ai');
    expect(s1.units.find((u) => u.id === 'g')!.guard).toBe(3);
    const s2 = chain(s1, [{ type: 'EndPhase' }]);
    expect(s2.units.find((u) => u.id === 'g')!.guard).toBe(0);
  });

  it('tiro mirato: ricarica di 2, salta una fase', () => {
    const s = makeState([unit('c', 'player', 'crossbow', 0, 0), unit('e', 'ai', 'guardian', 5, 0)]);
    const s1 = chain(s, [{ type: 'UseAbility', unitId: 'c', targetId: 'e' }]);
    expect(s1.units.find((u) => u.id === 'c')!.cooldown).toBe(2);
    const s2 = chain(s1, [{ type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(s2.units.find((u) => u.id === 'c')!.cooldown).toBe(1);
    expect(applyAction(s2, { type: 'UseAbility', unitId: 'c', targetId: 'e' }).ok).toBe(false);
    const s3 = chain(s2, [{ type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(applyAction(s3, { type: 'UseAbility', unitId: 'c', targetId: 'e' }).ok).toBe(true);
  });
});
```

- [ ] **Step 4: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: FAIL, "Cannot find module './engine'".

- [ ] **Step 5: Implementare `src/engine/combat.ts`**

```ts
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
```

- [ ] **Step 6: Implementare `src/engine/engine.ts`**

```ts
import { START_POSITIONS, createArena, posKey } from './arena';
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
      return 'Carte non ancora disponibili.';
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
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS, compresi i 16 test di `engine.test.ts`.

- [ ] **Step 8: Checkpoint**

L'utente committa `src/engine/deck*.ts`, `src/engine/combat.ts` ed `src/engine/engine*.ts`. Messaggio: `feat(engine): mazzo, combattimento, attivazioni e fasi`.

---

### Task 5: Carte-ordine

**Files:**
- Create: `src/engine/cards.ts`
- Modify: `src/engine/engine.ts` (caso `PlayCard` di `run`)
- Test: `src/engine/cards.test.ts`

**Interfaces:**
- Consumes: `drawCard`, `UNIT_DEFS`, tipi.
- Produces: `CardDef { id, name, description, target: 'ally' | 'enemy' }`, `CARD_DEFS: Record<CardId, CardDef>`, `cardTargets(state, team, cardId): string[]`, `cardBlockReason(state, team, cardId): string | null`, `playCard(state, handIndex, targetId, events): string | null` (modifica lo stato clonato).

**Nota sulla spec:** la spec chiede di testare "Carica con Marcia forzata". Con una carta per fase e i bonus che scadono a fine fase, però, le due carte non possono mai essere attive insieme. Al loro posto si testano Carica + Fendente coordinato e Fuoco concentrato + guardia.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/engine/cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cardBlockReason } from './cards';
import { applyAction } from './engine';
import { makeState, unit } from './testUtils';
import type { Action, ApplyResult, CardId, GameState, Unit } from './types';

function ok(r: ApplyResult): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const chain = (s: GameState, actions: Action[]) => actions.reduce((acc, a) => ok(applyAction(acc, a)), s);
const find = (s: GameState, id: string) => s.units.find((u) => u.id === id);

function withHand(units: Unit[], hand: CardId[], draw: CardId[] = ['rally', 'rally', 'rally']): GameState {
  return makeState(units, {
    decks: {
      player: { draw: [...draw], hand: [...hand], discard: [] },
      ai: { draw: [], hand: [], discard: [] },
    },
  });
}

const enemy = () => unit('e', 'ai', 'guardian', 9, 7);

describe('carte', () => {
  it('la carta giocata va negli scarti e ne viene pescata una nuova', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 5 }), enemy()], ['rally', 'charge', 'focusFire']);
    const r = applyAction(s, { type: 'PlayCard', handIndex: 0, targetId: 'g' });
    const after = ok(r);
    expect(find(after, 'g')!.hp).toBe(7);
    expect(after.decks.player.hand).toEqual(['charge', 'focusFire', 'rally']);
    expect(after.decks.player.discard).toEqual(['rally']);
    expect(after.cardPlayed).toBe(true);
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['CardPlayed', 'Healed']);
  });

  it('una sola carta per fase, di nuovo disponibile alla fase successiva', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 5 }), enemy()], ['rally', 'holdTheLine', 'rally']);
    const s1 = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }]);
    expect(applyAction(s1, { type: 'PlayCard', handIndex: 0, targetId: 'g' }).ok).toBe(false);
    const s2 = chain(s1, [{ type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(s2.cardPlayed).toBe(false);
    expect(applyAction(s2, { type: 'PlayCard', handIndex: 0, targetId: 'g' }).ok).toBe(true);
  });

  it('rimescola gli scarti quando il mazzo è vuoto', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 5 }), enemy()], ['rally'], []);
    s.decks.player.discard = ['charge'];
    const after = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }]);
    expect(after.decks.player.hand).toHaveLength(1);
    expect(after.decks.player.draw).toHaveLength(1);
    expect(after.decks.player.discard).toHaveLength(0);
  });

  it('valida i bersagli di ogni carta', () => {
    const units = [
      unit('g', 'player', 'guardian', 0, 0),
      unit('c', 'player', 'crossbow', 0, 2, { stage: 'acted' }),
      unit('s', 'player', 'scout', 2, 0, { stage: 'moved' }),
      enemy(),
    ];
    const s = withHand(units, ['rally', 'focusFire', 'charge']);
    const play = (handIndex: number, targetId: string) => applyAction(s, { type: 'PlayCard', handIndex, targetId }).ok;
    expect(play(0, 'g')).toBe(false); // HP pieni
    expect(play(1, 'g')).toBe(false); // fuoco concentrato su un alleato
    expect(play(2, 'c')).toBe(false); // carica su un'unità a distanza
    expect(play(2, 's')).toBe(false); // carica su un'unità già mossa
    const p = withHand(units, ['precision', 'forcedMarch']);
    expect(applyAction(p, { type: 'PlayCard', handIndex: 0, targetId: 'c' }).ok).toBe(false); // ha già sparato
    expect(applyAction(p, { type: 'PlayCard', handIndex: 1, targetId: 's' }).ok).toBe(false); // già mosso
    expect(applyAction(p, { type: 'PlayCard', handIndex: 7, targetId: 'g' }).ok).toBe(false); // indice inesistente
  });

  it('non si possono giocare carte fuori dal proprio turno', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0), enemy()], ['holdTheLine']);
    expect(cardBlockReason(s, 'ai', 'holdTheLine')).toBe('Non è il tuo turno.');
  });

  it('marcia forzata: +2 movimento in questa attivazione', () => {
    const s = withHand([unit('s', 'player', 'scout', 0, 0), enemy()], ['forcedMarch']);
    expect(applyAction(s, { type: 'Move', unitId: 's', to: { x: 6, y: 0 } }).ok).toBe(false);
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 's' },
      { type: 'Move', unitId: 's', to: { x: 6, y: 0 } },
    ]);
    expect(find(after, 's')!.pos).toEqual({ x: 6, y: 0 });
  });

  it('tenere la linea: +3 guardia fino alla prossima fase della squadra', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0), enemy()], ['holdTheLine']);
    const s1 = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }, { type: 'EndPhase' }]);
    expect(find(s1, 'g')!.guard).toBe(3);
    expect(find(chain(s1, [{ type: 'EndPhase' }]), 'g')!.guard).toBe(0);
  });

  it('fuoco concentrato: +2 al primo attacco contro il bersaglio, poi si consuma', () => {
    const s = withHand(
      [unit('g1', 'player', 'guardian', 3, 3), unit('g2', 'player', 'guardian', 5, 3), unit('e', 'ai', 'guardian', 4, 3)],
      ['focusFire'],
    );
    const s1 = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 'e' },
      { type: 'Attack', unitId: 'g1', targetId: 'e' },
    ]);
    expect(find(s1, 'e')!.hp).toBe(7);
    const s2 = chain(s1, [{ type: 'Attack', unitId: 'g2', targetId: 'e' }]);
    expect(find(s2, 'e')!.hp).toBe(4);
  });

  it('i bonus si applicano prima della guardia', () => {
    const s = withHand(
      [unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'guardian', 4, 3, { guard: 3 })],
      ['focusFire'],
    );
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 'e' },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(find(after, 'e')!.hp).toBe(10);
    expect(find(after, 'e')!.guard).toBe(0);
  });

  it('carica: +2 solo dopo un movimento di almeno 2 celle', () => {
    const units = () => [unit('g', 'player', 'guardian', 1, 3), unit('e', 'ai', 'guardian', 4, 3)];
    const charged = chain(withHand(units(), ['charge']), [
      { type: 'PlayCard', handIndex: 0, targetId: 'g' },
      { type: 'Move', unitId: 'g', to: { x: 3, y: 3 } },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(find(charged, 'e')!.hp).toBe(7);
    const short = [unit('g', 'player', 'guardian', 2, 3), unit('e', 'ai', 'guardian', 4, 3)];
    const noCharge = chain(withHand(short, ['charge']), [
      { type: 'PlayCard', handIndex: 0, targetId: 'g' },
      { type: 'Move', unitId: 'g', to: { x: 3, y: 3 } },
      { type: 'Attack', unitId: 'g', targetId: 'e' },
    ]);
    expect(find(noCharge, 'e')!.hp).toBe(9);
  });

  it('carica + fendente coordinato si sommano', () => {
    const s = withHand(
      [unit('s', 'player', 'scout', 1, 3), unit('a', 'player', 'guardian', 4, 4), unit('e', 'ai', 'guardian', 4, 3)],
      ['charge'],
    );
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 's' },
      { type: 'Move', unitId: 's', to: { x: 3, y: 3 } },
      { type: 'UseAbility', unitId: 's', targetId: 'e' },
    ]);
    expect(find(after, 'e')!.hp).toBe(12 - (4 + 1 + 2));
  });

  it('richiamare le forze non supera gli HP massimi', () => {
    const s = withHand([unit('g', 'player', 'guardian', 0, 0, { hp: 11 }), enemy()], ['rally']);
    expect(find(chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 'g' }]), 'g')!.hp).toBe(12);
  });

  it('ordine di precisione: +1 danno, +1 gittata, poi si consuma', () => {
    const s = withHand([unit('c', 'player', 'crossbow', 0, 0), unit('e', 'ai', 'guardian', 5, 0)], ['precision']);
    const after = chain(s, [
      { type: 'PlayCard', handIndex: 0, targetId: 'c' },
      { type: 'Attack', unitId: 'c', targetId: 'e' },
    ]);
    expect(find(after, 'e')!.hp).toBe(9);
    expect(find(after, 'c')!.precisionBonus).toBe(false);
  });

  it('i bonus delle carte scadono a fine fase', () => {
    const s = withHand([unit('s', 'player', 'scout', 0, 0), enemy()], ['forcedMarch']);
    const after = chain(s, [{ type: 'PlayCard', handIndex: 0, targetId: 's' }, { type: 'EndPhase' }, { type: 'EndPhase' }]);
    expect(find(after, 's')!.moveBonus).toBe(0);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/engine/cards.test.ts`
Expected: FAIL, "Cannot find module './cards'".

- [ ] **Step 3: Implementare `src/engine/cards.ts`**

```ts
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
```

- [ ] **Step 4: Collegare la carta al motore**

In `src/engine/engine.ts` aggiungere l'import:
```ts
import { playCard } from './cards';
```
e sostituire nel `switch` di `run`:
```ts
    case 'PlayCard':
      return 'Carte non ancora disponibili.';
```
con:
```ts
    case 'PlayCard':
      return playCard(s, action.handIndex, action.targetId, events);
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS, compresi i 14 test di `cards.test.ts`.

- [ ] **Step 6: Checkpoint**

L'utente committa `src/engine/cards*.ts` ed `src/engine/engine.ts`. Messaggio: `feat(engine): carte-ordine`.

---

### Task 6: AI facile e intermedia

**Files:**
- Create: `src/ai/run.ts`, `src/ai/candidates.ts`, `src/ai/evaluate.ts`, `src/ai/easy.ts`, `src/ai/medium.ts`, `src/ai/index.ts`, `src/ai/match.ts`
- Test: `src/ai/ai.test.ts`

**Interfaces:**
- Consumes: `applyAction`, `createGame`, `reachable`, `manhattan`, `strikeTargets`, `canGuard`, `hasLineOfSight`, `cardTargets`, `nextRandom`, `UNIT_DEFS`.
- Produces:
  - `runActions(state, actions): GameState | null`;
  - `Candidate { unitId: string; actions: Action[]; state: GameState }`, `enumerateCandidates(state, withCards): Candidate[]`;
  - `WEIGHTS`, `evaluate(state, team): number`, `threat(attackers, victims): number`, `immediateGain(before, after, team): number`;
  - `planEasy(state, seed): Action[]`, `rankCandidates(state, withCards): Candidate[]`, `planMedium(state): Action[]`;
  - `planActivation(state, difficulty, seed): Action[]`: restituisce `[]` a partita finita, `[{type:'EndPhase'}]` se la squadra attiva non ha unità `idle`;
  - `playGame(seed, levels: Record<Team, Difficulty>, maxRounds = 30): { winner: Team | null; rounds: number }`, che lancia un errore se un'AI propone un'azione illegale.
  - In questo task `planActivation` gestisce `'hard'` come `'medium'`; il Task 7 lo sostituisce.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/ai/ai.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine/engine';
import { blankArena, makeState, solidAt, unit } from '../engine/testUtils';
import type { GameState } from '../engine/types';
import { planActivation } from './index';
import { playGame } from './match';
import { runActions } from './run';

describe('AI: legalità', () => {
  it.each([1, 2, 3])('partite facile contro intermedio senza azioni illegali (seed %i)', (seed) => {
    const result = playGame(seed, { player: 'easy', ai: 'medium' });
    expect(result.rounds).toBeGreaterThan(0);
  });

  it('intermedio contro sé stesso senza azioni illegali', () => {
    expect(() => playGame(4, { player: 'medium', ai: 'medium' })).not.toThrow();
  });
});

describe('AI: determinismo', () => {
  it('stesso stato e stesso seed producono lo stesso piano', () => {
    const g = createGame(5);
    expect(planActivation(g, 'easy', 11)).toEqual(planActivation(g, 'easy', 11));
    expect(planActivation(g, 'medium', 11)).toEqual(planActivation(g, 'medium', 11));
  });
});

describe('AI: casi limite', () => {
  it('chiude la fase se non ha unità attivabili', () => {
    const s = makeState([unit('p', 'player', 'guardian', 0, 0), unit('a', 'ai', 'guardian', 9, 7, { stage: 'done' })], {
      activeTeam: 'ai',
    });
    expect(planActivation(s, 'medium', 1)).toEqual([{ type: 'EndPhase' }]);
  });

  it('unità bloccata e nessuna carta: il piano è legale e passa il turno', () => {
    const s: GameState = makeState(
      [unit('p', 'player', 'guardian', 0, 0), unit('a', 'ai', 'scout', 9, 7)],
      { activeTeam: 'ai', arena: blankArena([solidAt(8, 7), solidAt(9, 6)]) },
    );
    for (const level of ['easy', 'medium'] as const) {
      const after = runActions(s, planActivation(s, level, 1));
      expect(after).not.toBeNull();
      expect(after!.activeTeam).toBe('player');
    }
  });

  it('il colpo che chiude la partita non è seguito da EndActivation', () => {
    const s = makeState([unit('p', 'player', 'crossbow', 3, 3, { hp: 1 }), unit('a', 'ai', 'scout', 5, 3)], {
      activeTeam: 'ai',
    });
    const plan = planActivation(s, 'medium', 1);
    expect(plan[plan.length - 1].type).not.toBe('EndActivation');
    const after = runActions(s, plan);
    expect(after?.winner).toBe('ai');
  });

  it('a partita finita non propone azioni', () => {
    const s = makeState([unit('a', 'ai', 'scout', 5, 3)], { activeTeam: 'ai', winner: 'ai' });
    expect(planActivation(s, 'easy', 1)).toEqual([]);
  });

  it('il piano facile è sempre applicabile', () => {
    let s = createGame(9);
    s = runActions(s, [{ type: 'EndPhase' }])!;
    for (let seed = 0; seed < 5; seed++) {
      const plan = planActivation(s, 'easy', seed);
      let cur = s;
      for (const a of plan) {
        const r = applyAction(cur, a);
        expect(r.ok).toBe(true);
        if (r.ok) cur = r.state;
      }
    }
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/ai/ai.test.ts`
Expected: FAIL, "Cannot find module './index'".

- [ ] **Step 3: Implementare `src/ai/run.ts`**

```ts
import { applyAction } from '../engine/engine';
import type { Action, GameState } from '../engine/types';

/** Applica una sequenza di azioni; restituisce null alla prima azione rifiutata. */
export function runActions(state: GameState, actions: Action[]): GameState | null {
  let s = state;
  for (const a of actions) {
    const r = applyAction(s, a);
    if (!r.ok) return null;
    s = r.state;
  }
  return s;
}
```

- [ ] **Step 4: Implementare `src/ai/candidates.ts`**

```ts
import { cardTargets } from '../engine/cards';
import { reachable } from '../engine/movement';
import { canGuard, strikeTargets } from '../engine/targeting';
import type { Action, GameState } from '../engine/types';
import { runActions } from './run';

export interface Candidate {
  unitId: string;
  actions: Action[];
  state: GameState;
}

function cardPrefixes(state: GameState, unitId: string, withCards: boolean): Action[][] {
  const prefixes: Action[][] = [[]];
  if (!withCards || state.cardPlayed) return prefixes;
  const team = state.activeTeam;
  state.decks[team].hand.forEach((cardId, handIndex) => {
    const targets = cardTargets(state, team, cardId);
    if (cardId === 'focusFire') {
      targets.forEach((t) => prefixes.push([{ type: 'PlayCard', handIndex, targetId: t }]));
    } else if (targets.includes(unitId)) {
      prefixes.push([{ type: 'PlayCard', handIndex, targetId: unitId }]);
    }
  });
  return prefixes;
}

function strikeOptions(state: GameState, unitId: string): Action[][] {
  const options: Action[][] = [[]];
  for (const t of strikeTargets(state, unitId, 'attack')) options.push([{ type: 'Attack', unitId, targetId: t }]);
  if (canGuard(state, unitId)) options.push([{ type: 'UseAbility', unitId }]);
  for (const t of strikeTargets(state, unitId, 'ability')) options.push([{ type: 'UseAbility', unitId, targetId: t }]);
  return options;
}

/** Tutte le attivazioni complete (carta? → movimento? → colpo? → chiusura) delle unità idle. */
export function enumerateCandidates(state: GameState, withCards: boolean): Candidate[] {
  const out: Candidate[] = [];
  const actors = state.units.filter((u) => u.team === state.activeTeam && u.stage === 'idle');
  for (const actor of actors) {
    for (const prefix of cardPrefixes(state, actor.id, withCards)) {
      const base = runActions(state, prefix);
      if (!base) continue;
      for (const path of reachable(base, actor.id).values()) {
        const move: Action[] =
          path.length > 1 ? [{ type: 'Move', unitId: actor.id, to: path[path.length - 1] }] : [];
        const moved = runActions(base, move);
        if (!moved) continue;
        for (const strike of strikeOptions(moved, actor.id)) {
          const struck = runActions(moved, strike);
          if (!struck) continue;
          const close: Action[] = struck.winner ? [] : [{ type: 'EndActivation', unitId: actor.id }];
          const end = runActions(struck, close);
          if (!end) continue;
          out.push({ unitId: actor.id, actions: [...prefix, ...move, ...strike, ...close], state: end });
        }
      }
    }
  }
  return out;
}
```

- [ ] **Step 5: Implementare `src/ai/evaluate.ts`**

```ts
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
```

- [ ] **Step 6: Implementare `src/ai/easy.ts` e `src/ai/medium.ts`**

`src/ai/easy.ts`:
```ts
import { cardTargets } from '../engine/cards';
import { manhattan } from '../engine/movement';
import { nextRandom } from '../engine/rng';
import { UNIT_DEFS } from '../engine/units';
import type { Action, GameState, Team } from '../engine/types';
import { enumerateCandidates } from './candidates';
import { immediateGain } from './evaluate';

function approachDistance(state: GameState, team: Team): number {
  const enemies = state.units.filter((u) => u.team !== team);
  if (enemies.length === 0) return 0;
  return state.units
    .filter((u) => u.team === team)
    .reduce((sum, u) => sum + Math.min(...enemies.map((e) => manhattan(u.pos, e.pos))), 0);
}

/** Unica carta che il facile usa: cura su un alleato sotto metà HP. */
function obviousCard(state: GameState, team: Team): Action[] {
  const handIndex = state.decks[team].hand.indexOf('rally');
  if (handIndex < 0) return [];
  const targets = cardTargets(state, team, 'rally');
  const wounded = state.units.find(
    (u) => u.team === team && u.hp * 2 < UNIT_DEFS[u.archetype].maxHp && targets.includes(u.id),
  );
  return wounded ? [{ type: 'PlayCard', handIndex, targetId: wounded.id }] : [];
}

export function planEasy(state: GameState, seed: number): Action[] {
  const team = state.activeTeam;
  const candidates = enumerateCandidates(state, false);
  if (candidates.length === 0) return [];
  const scored = candidates
    .map((c) => ({ c, score: immediateGain(state, c.state, team) - 0.1 * approachDistance(c.state, team) }))
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const [r] = nextRandom(seed);
  const pick = top[Math.floor(r * top.length)].c;
  return [...obviousCard(state, team), ...pick.actions];
}
```

`src/ai/medium.ts`:
```ts
import type { Action, GameState } from '../engine/types';
import { enumerateCandidates } from './candidates';
import type { Candidate } from './candidates';
import { evaluate } from './evaluate';

/** Candidati ordinati per valutazione (ordinamento stabile: a parità vince l'ordine di enumerazione). */
export function rankCandidates(state: GameState, withCards: boolean): Candidate[] {
  const team = state.activeTeam;
  return enumerateCandidates(state, withCards)
    .map((c) => ({ c, score: evaluate(c.state, team) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

export function planMedium(state: GameState): Action[] {
  return rankCandidates(state, true)[0]?.actions ?? [];
}
```

- [ ] **Step 7: Implementare `src/ai/index.ts` e `src/ai/match.ts`**

`src/ai/index.ts`:
```ts
import type { Action, Difficulty, GameState } from '../engine/types';
import { planEasy } from './easy';
import { planMedium } from './medium';

export function planActivation(state: GameState, difficulty: Difficulty, seed: number): Action[] {
  if (state.winner) return [];
  const team = state.activeTeam;
  if (!state.units.some((u) => u.team === team && u.stage === 'idle')) return [{ type: 'EndPhase' }];
  const plan = difficulty === 'easy' ? planEasy(state, seed) : planMedium(state);
  return plan.length > 0 ? plan : [{ type: 'EndPhase' }];
}
```

`src/ai/match.ts`:
```ts
import { applyAction, createGame } from '../engine/engine';
import type { Difficulty, Team } from '../engine/types';
import { planActivation } from './index';

export interface MatchResult {
  winner: Team | null;
  rounds: number;
}

/** Partita completa AI contro AI. Lancia un errore se un'AI propone un'azione illegale. */
export function playGame(seed: number, levels: Record<Team, Difficulty>, maxRounds = 30): MatchResult {
  let s = createGame(seed);
  let step = 0;
  while (!s.winner && s.round <= maxRounds) {
    const plan = planActivation(s, levels[s.activeTeam], seed * 7919 + step++);
    for (const a of plan) {
      const r = applyAction(s, a);
      if (!r.ok) throw new Error(`Azione illegale ${a.type}: ${r.error}`);
      s = r.state;
      if (s.winner) break;
    }
  }
  return { winner: s.winner, rounds: s.round };
}
```

- [ ] **Step 8: Eseguire i test e verificare che passino**

Run: `npx vitest run src/ai/ai.test.ts`
Expected: PASS (10 test). Se un test di legalità fallisce, il messaggio indica l'azione rifiutata: correggere il generatore di candidati, non il motore.

- [ ] **Step 9: Checkpoint**

L'utente committa `src/ai/`. Messaggio: `feat(ai): candidati, valutazione, livelli facile e intermedio`.

---

### Task 7: AI difficile e torneo

**Files:**
- Create: `src/ai/hard.ts`
- Modify: `src/ai/index.ts`
- Test: `src/ai/hard.test.ts`

**Interfaces:**
- Consumes: `rankCandidates`, `evaluate`, `runActions`, `playGame`, `planActivation`.
- Produces: `HardOptions { topK: number; budgetMs: number }`, `DEFAULT_HARD = { topK: 6, budgetMs: 300 }`, `planHard(state, options?): Action[]`. Il lavoro è limitato in modo deterministico da `topK` (fino a 8 attivazioni simulate ciascuno); `budgetMs` è solo un tetto di sicurezza. Se scatta, il risultato può dipendere dalla velocità della macchina.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/ai/hard.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/engine';
import type { Difficulty } from '../engine/types';
import { planActivation } from './index';
import { playGame } from './match';
import { runActions } from './run';

function wins(strong: Difficulty, weak: Difficulty, seeds: number[]): number {
  let count = 0;
  for (const seed of seeds) {
    if (playGame(seed, { player: strong, ai: weak }).winner === 'player') count++;
    if (playGame(seed, { player: weak, ai: strong }).winner === 'ai') count++;
  }
  return count;
}

describe('AI difficile', () => {
  it('rispetta il budget di calcolo', () => {
    const g = createGame(3);
    const start = performance.now();
    planActivation(g, 'hard', 1);
    expect(performance.now() - start).toBeLessThan(600);
  });

  it('è deterministica', () => {
    const g = createGame(8);
    expect(planActivation(g, 'hard', 1)).toEqual(planActivation(g, 'hard', 1));
  });

  it('il piano è legale', () => {
    const g = runActions(createGame(4), [{ type: 'EndPhase' }])!;
    expect(runActions(g, planActivation(g, 'hard', 1))).not.toBeNull();
  });
});

describe('verifica dei livelli (AI contro AI)', () => {
  it('l\'intermedio batte il facile', { timeout: 120_000 }, () => {
    expect(wins('medium', 'easy', [1, 2, 3])).toBeGreaterThanOrEqual(4);
  });

  it('il difficile batte l\'intermedio', { timeout: 300_000 }, () => {
    expect(wins('hard', 'medium', [1, 2])).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/ai/hard.test.ts`
Expected: FAIL. Il test sul difficile contro l'intermedio fallisce oppure va in pareggio, perché `'hard'` per ora è uguale a `'medium'`.

- [ ] **Step 3: Implementare `src/ai/hard.ts`**

```ts
import type { Action, GameState, Team } from '../engine/types';
import { evaluate } from './evaluate';
import { rankCandidates } from './medium';
import { runActions } from './run';

export interface HardOptions {
  topK: number;
  budgetMs: number;
}

export const DEFAULT_HARD: HardOptions = { topK: 6, budgetMs: 300 };

const MAX_PLAYOUT_STEPS = 8;

function greedyActivation(state: GameState): Action[] {
  return rankCandidates(state, false)[0]?.actions ?? [{ type: 'EndPhase' }];
}

/** Completa la fase di `team` e simula l'intera risposta avversaria (politica intermedia, senza carte). */
function playOut(state: GameState, team: Team, deadline: number): GameState {
  let s = state;
  let sawOpponent = s.activeTeam !== team;
  for (let step = 0; step < MAX_PLAYOUT_STEPS && !s.winner && Date.now() <= deadline; step++) {
    if (s.activeTeam === team && sawOpponent) break;
    const next = runActions(s, greedyActivation(s));
    if (!next) break;
    s = next;
    if (s.activeTeam !== team) sawOpponent = true;
  }
  return s;
}

export function planHard(state: GameState, options: HardOptions = DEFAULT_HARD): Action[] {
  const team = state.activeTeam;
  const deadline = Date.now() + options.budgetMs;
  const ranked = rankCandidates(state, true);
  if (ranked.length === 0) return [];
  let best = ranked[0];
  let bestScore = -Infinity;
  for (const candidate of ranked.slice(0, options.topK)) {
    if (Date.now() > deadline) break;
    const score = evaluate(playOut(candidate.state, team, deadline), team);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.actions;
}
```

- [ ] **Step 4: Collegare il difficile in `src/ai/index.ts`**

Aggiungere `import { planHard } from './hard';` e sostituire:
```ts
  const plan = difficulty === 'easy' ? planEasy(state, seed) : planMedium(state);
```
con:
```ts
  const plan =
    difficulty === 'easy' ? planEasy(state, seed) : difficulty === 'medium' ? planMedium(state) : planHard(state);
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npx vitest run src/ai/hard.test.ts`
Expected: PASS (5 test).

Se il torneo fallisce, si tara in quest'ordine e dopo ogni modifica si rilanciano entrambi i file di test dell'AI:
1. In `src/ai/hard.ts`, `DEFAULT_HARD.topK` da 6 a 8.
2. In `src/ai/evaluate.ts`, `WEIGHTS.threat` da 0.6 a 0.9.
3. Se il facile batte l'intermedio, in `src/ai/easy.ts` si riduce la selezione da `slice(0, 3)` a `slice(0, 4)`, così il facile sbaglia di più.

Se il budget supera 600 ms, si porta `topK` a 4.

- [ ] **Step 6: Checkpoint**

L'utente committa `src/ai/`. Messaggio: `feat(ai): livello difficile con risposta simulata e torneo`.

---

### Task 8: Store Redux, thunk, driver AI e overlay

**Files:**
- Create: `src/app/store.ts`, `src/app/hooks.ts`, `src/game/gameSlice.ts`, `src/game/animator.ts`, `src/game/thunks.ts`, `src/game/aiDriver.ts`, `src/game/selectors.ts`
- Test: `src/game/game.test.ts`

**Interfaces:**
- Consumes: `createGame`, `applyAction`, `reachable`, `strikeTargets`, `cardTargets`, `samePos`, `posKey`, `UNIT_DEFS`, `planActivation`.
- Produces:
  - `makeStore()`, `store`, tipi `RootState`, `AppDispatch`, `AppThunk<R>`; `useAppDispatch`, `useAppSelector`;
  - `GameUiState { screen: 'start' | 'battle'; difficulty; game: GameState | null; gameId: number; selectedUnitId; mode: 'normal' | 'ability' | 'card'; pendingCard: number | null; message: string | null; busy: boolean }`;
  - action creator: `difficultySet`, `gameStarted`, `gameUpdated`, `unitSelected`, `modeSet`, `cardSelected`, `messageSet`, `busySet`, `returnedToStart`;
  - `registerAnimator(player | null)`, `playEvents(events): Promise<void>` (si risolve sempre, timeout 4 s);
  - thunk: `startGame(seed?)`, `perform(action): Promise<boolean>`, `clickCell(pos)`, `abilityPressed()`, `endActivationPressed()`, `endPhasePressed()`, `runAiPhase()`; `aiTiming.thinkDelayMs`;
  - `Overlay { selected: Pos | null; reachable: Pos[]; paths: Record<string, Pos[]>; targets: Pos[]; cardTargets: Pos[] }`, `EMPTY_OVERLAY`, `computeOverlay(ui): Overlay`.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/game/game.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { makeStore } from '../app/store';
import { createGame } from '../engine/engine';
import { makeState, unit } from '../engine/testUtils';
import { aiTiming } from './aiDriver';
import { busySet, difficultySet, gameStarted } from './gameSlice';
import { computeOverlay } from './selectors';
import { clickCell, perform, startGame } from './thunks';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  aiTiming.thinkDelayMs = 0;
});

describe('store e thunk', () => {
  it('startGame apre la battaglia con una partita nuova', () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    const ui = store.getState().game;
    expect(ui.screen).toBe('battle');
    expect(ui.game).toEqual(createGame(42));
    expect(ui.busy).toBe(false);
  });

  it('azione illegale: messaggio e stato invariato', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    const before = store.getState().game.game;
    const ok = await store.dispatch(perform({ type: 'Move', unitId: 'ai-scout', to: { x: 7, y: 2 } }));
    expect(ok).toBe(false);
    expect(store.getState().game.message).toBe('Non è il turno di questa unità.');
    expect(store.getState().game.game).toBe(before);
  });

  it('ignora le azioni mentre è in corso un\'animazione o il turno AI', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    store.dispatch(busySet(true));
    const ok = await store.dispatch(perform({ type: 'Move', unitId: 'player-guardian', to: { x: 1, y: 2 } }));
    expect(ok).toBe(false);
  });

  it('fine fase: l\'AI gioca e restituisce il turno', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    await store.dispatch(perform({ type: 'EndPhase' }));
    const ui = store.getState().game;
    expect(ui.game!.activeTeam).toBe('player');
    expect(ui.game!.round).toBe(2);
    expect(ui.busy).toBe(false);
  });

  it('una nuova partita durante il turno AI ferma il vecchio ciclo', async () => {
    aiTiming.thinkDelayMs = 30;
    const store = makeStore();
    store.dispatch(startGame(42));
    const pending = store.dispatch(perform({ type: 'EndPhase' }));
    await sleep(5);
    store.dispatch(startGame(77));
    await pending;
    await sleep(60);
    expect(store.getState().game.game).toEqual(createGame(77));
    expect(store.getState().game.busy).toBe(false);
  });

  it('clic: seleziona, mostra l\'overlay e muove', async () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    await store.dispatch(clickCell({ x: 1, y: 3 }));
    expect(store.getState().game.selectedUnitId).toBe('player-guardian');
    const overlay = computeOverlay(store.getState().game);
    expect(overlay.reachable).toContainEqual({ x: 1, y: 2 });
    await store.dispatch(clickCell({ x: 1, y: 2 }));
    const g = store.getState().game.game!.units.find((u) => u.id === 'player-guardian')!;
    expect(g.pos).toEqual({ x: 1, y: 2 });
  });

  it('overlay vuoto durante busy e fuori turno', () => {
    const store = makeStore();
    store.dispatch(startGame(42));
    store.dispatch(busySet(true));
    expect(computeOverlay(store.getState().game).reachable).toEqual([]);
  });
});

describe('progressione', () => {
  it('all\'inizio solo il facile; i livelli bloccati non si scelgono', () => {
    const store = makeStore();
    expect(store.getState().game.unlocked).toEqual(['easy']);
    store.dispatch(difficultySet('hard'));
    expect(store.getState().game.difficulty).toBe('easy');
  });

  it('una vittoria sblocca il livello successivo', async () => {
    const store = makeStore();
    store.dispatch(
      gameStarted(makeState([unit('g', 'player', 'guardian', 3, 3), unit('e', 'ai', 'scout', 4, 3, { hp: 1 })])),
    );
    await store.dispatch(perform({ type: 'Attack', unitId: 'g', targetId: 'e' }));
    expect(store.getState().game.game!.winner).toBe('player');
    expect(store.getState().game.unlocked).toEqual(['easy', 'medium']);
    store.dispatch(difficultySet('medium'));
    expect(store.getState().game.difficulty).toBe('medium');
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/game/game.test.ts`
Expected: FAIL, "Cannot find module '../app/store'".

- [ ] **Step 2b: Implementare `src/game/progress.ts`**

```ts
import type { Difficulty } from '../engine/types';

export const LEVEL_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const STORAGE_KEY = 'bannerfall.unlocked';

export function nextLevel(level: Difficulty): Difficulty | null {
  return LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1] ?? null;
}

/** Livelli sbloccati salvati nel browser; se il salvataggio non è disponibile resta solo il facile. */
export function loadUnlocked(): Difficulty[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const levels = LEVEL_ORDER.filter((l) => parsed.includes(l));
      if (levels.includes('easy')) return levels;
    }
  } catch {
    // storage bloccato o dati corrotti: si riparte dal facile
  }
  return ['easy'];
}

export function saveUnlocked(levels: Difficulty[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // non critico: la progressione vale solo per questa sessione
  }
}
```

- [ ] **Step 3: Implementare `src/game/gameSlice.ts`**

```ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Difficulty, GameState } from '../engine/types';
import { loadUnlocked } from './progress';

export type Screen = 'start' | 'battle';
export type Mode = 'normal' | 'ability' | 'card';

export interface GameUiState {
  screen: Screen;
  difficulty: Difficulty;
  game: GameState | null;
  /** cambia a ogni nuova partita: i cicli asincroni lo usano per capire se sono ancora validi */
  gameId: number;
  selectedUnitId: string | null;
  mode: Mode;
  pendingCard: number | null;
  message: string | null;
  busy: boolean;
  /** livelli sbloccati dalla progressione */
  unlocked: Difficulty[];
}

const initialState: GameUiState = {
  screen: 'start',
  difficulty: 'easy',
  unlocked: loadUnlocked(),
  game: null,
  gameId: 0,
  selectedUnitId: null,
  mode: 'normal',
  pendingCard: null,
  message: null,
  busy: false,
};

function resetInteraction(state: GameUiState): void {
  state.selectedUnitId = null;
  state.mode = 'normal';
  state.pendingCard = null;
  state.message = null;
  state.busy = false;
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    difficultySet(state, action: PayloadAction<Difficulty>) {
      if (state.unlocked.includes(action.payload)) state.difficulty = action.payload;
    },
    levelUnlocked(state, action: PayloadAction<Difficulty>) {
      if (!state.unlocked.includes(action.payload)) state.unlocked.push(action.payload);
    },
    gameStarted(state, action: PayloadAction<GameState>) {
      state.screen = 'battle';
      state.game = action.payload;
      state.gameId += 1;
      resetInteraction(state);
    },
    gameUpdated(state, action: PayloadAction<GameState>) {
      state.game = action.payload;
    },
    unitSelected(state, action: PayloadAction<string | null>) {
      state.selectedUnitId = action.payload;
      state.mode = 'normal';
      state.pendingCard = null;
    },
    modeSet(state, action: PayloadAction<GameUiState['mode']>) {
      state.mode = action.payload;
      if (action.payload !== 'card') state.pendingCard = null;
    },
    cardSelected(state, action: PayloadAction<number | null>) {
      state.pendingCard = action.payload;
      state.mode = action.payload === null ? 'normal' : 'card';
    },
    messageSet(state, action: PayloadAction<string | null>) {
      state.message = action.payload;
    },
    busySet(state, action: PayloadAction<boolean>) {
      state.busy = action.payload;
    },
    returnedToStart(state) {
      state.screen = 'start';
      state.game = null;
      state.gameId += 1;
      resetInteraction(state);
    },
  },
});

export const {
  difficultySet,
  levelUnlocked,
  gameStarted,
  gameUpdated,
  unitSelected,
  modeSet,
  cardSelected,
  messageSet,
  busySet,
  returnedToStart,
} = gameSlice.actions;

export default gameSlice.reducer;
```

- [ ] **Step 4: Implementare `src/app/store.ts` e `src/app/hooks.ts`**

`src/app/store.ts`:
```ts
import { configureStore } from '@reduxjs/toolkit';
import type { Action, ThunkAction } from '@reduxjs/toolkit';
import gameReducer from '../game/gameSlice';

export function makeStore() {
  return configureStore({ reducer: { game: gameReducer } });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<R = void> = ThunkAction<R, RootState, unknown, Action>;
```

`src/app/hooks.ts`:
```ts
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

- [ ] **Step 5: Implementare `src/game/animator.ts`**

```ts
import type { GameEvent } from '../engine/types';

type EventPlayer = (events: GameEvent[]) => Promise<void>;

export const ANIMATION_TIMEOUT_MS = 4000;

let player: EventPlayer | null = null;

/** Il renderer si registra qui; resta fuori dallo store perché contiene funzioni e oggetti PixiJS. */
export function registerAnimator(p: EventPlayer | null): void {
  player = p;
}

/** Riproduce gli eventi. Si risolve sempre, anche se l'animazione fallisce o si blocca. */
export function playEvents(events: GameEvent[]): Promise<void> {
  if (!player || events.length === 0) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ANIMATION_TIMEOUT_MS);
  });
  const run = player(events).catch((error: unknown) => console.warn('Animazione interrotta', error));
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}
```

- [ ] **Step 6: Implementare `src/game/aiDriver.ts`**

```ts
import { planActivation } from '../ai';
import { applyAction } from '../engine/engine';
import type { AppThunk } from '../app/store';
import { playEvents } from './animator';
import { busySet, gameUpdated, unitSelected } from './gameSlice';

export const aiTiming = { thinkDelayMs: 250 };

const MAX_AI_STEPS = 50;

export const runAiPhase = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const gameId = getState().game.gameId;
  const stillCurrent = () => getState().game.gameId === gameId;
  dispatch(busySet(true));
  dispatch(unitSelected(null));
  try {
    for (let step = 0; step < MAX_AI_STEPS; step++) {
      await new Promise((resolve) => setTimeout(resolve, aiTiming.thinkDelayMs));
      const ui = getState().game;
      const game = ui.game;
      if (!stillCurrent() || !game || game.winner || game.activeTeam !== 'ai') return;
      let current = game;
      for (const action of planActivation(game, ui.difficulty, game.rng + step)) {
        let result = applyAction(current, action);
        if (!result.ok) {
          console.warn('Azione AI rifiutata, chiudo la fase', action, result.error);
          result = applyAction(current, { type: 'EndPhase' });
          if (!result.ok) return;
        }
        const animation = playEvents(result.events);
        dispatch(gameUpdated(result.state));
        await animation;
        if (!stillCurrent()) return;
        current = result.state;
        if (current.winner || current.activeTeam !== 'ai') break;
      }
    }
    const game = getState().game.game;
    if (stillCurrent() && game && !game.winner && game.activeTeam === 'ai') {
      const result = applyAction(game, { type: 'EndPhase' });
      if (result.ok) dispatch(gameUpdated(result.state));
    }
  } finally {
    if (stillCurrent()) dispatch(busySet(false));
  }
};
```

- [ ] **Step 7: Implementare `src/game/thunks.ts`**

```ts
import { createGame, applyAction } from '../engine/engine';
import { posKey, samePos } from '../engine/arena';
import { reachable } from '../engine/movement';
import { strikeTargets } from '../engine/targeting';
import { UNIT_DEFS } from '../engine/units';
import type { Action, Pos } from '../engine/types';
import type { AppThunk } from '../app/store';
import { runAiPhase } from './aiDriver';
import { playEvents } from './animator';
import {
  busySet,
  cardSelected,
  difficultySet,
  gameStarted,
  gameUpdated,
  levelUnlocked,
  messageSet,
  modeSet,
  unitSelected,
} from './gameSlice';
import { nextLevel, saveUnlocked } from './progress';

export const startGame =
  (seed: number = Date.now() % 2147483647): AppThunk =>
  (dispatch) => {
    dispatch(gameStarted(createGame(seed)));
  };

/** Valida e applica un'azione del giocatore, attende l'animazione e, se tocca all'AI, avvia la sua fase. */
export const perform =
  (action: Action): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const ui = getState().game;
    if (!ui.game || ui.busy) return false;
    const result = applyAction(ui.game, action);
    if (!result.ok) {
      dispatch(messageSet(result.error));
      return false;
    }
    const gameId = ui.gameId;
    dispatch(busySet(true));
    // l'animazione parte prima dell'aggiornamento, così il renderer non salta alla posizione finale
    const animation = playEvents(result.events);
    dispatch(gameUpdated(result.state));
    await animation;
    if (getState().game.gameId !== gameId) return true;
    dispatch(busySet(false));
    if (result.state.winner === 'player') dispatch(recordVictory());
    if (result.state.activeTeam === 'ai' && !result.state.winner) await dispatch(runAiPhase());
    return true;
  };

/** Solo le azioni del giocatore possono dargli la vittoria, quindi basta controllarla in `perform`. */
export const recordVictory = (): AppThunk => (dispatch, getState) => {
  const next = nextLevel(getState().game.difficulty);
  if (!next) return;
  dispatch(levelUnlocked(next));
  saveUnlocked(getState().game.unlocked);
};

export const startNextLevel = (): AppThunk => (dispatch, getState) => {
  const next = nextLevel(getState().game.difficulty);
  if (next) dispatch(difficultySet(next));
  dispatch(startGame());
};

export const clickCell =
  (pos: Pos): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const ui = getState().game;
    const game = ui.game;
    if (!game || ui.busy || game.winner) return;
    const unitAt = game.units.find((u) => samePos(u.pos, pos));

    if (ui.mode === 'card' && ui.pendingCard !== null) {
      if (unitAt) {
        const ok = await dispatch(perform({ type: 'PlayCard', handIndex: ui.pendingCard, targetId: unitAt.id }));
        if (ok) dispatch(cardSelected(null));
      } else {
        dispatch(cardSelected(null));
      }
      return;
    }

    if (unitAt && (unitAt.team === 'player' || game.activeTeam !== 'player')) {
      dispatch(unitSelected(unitAt.id));
      return;
    }

    const selected = game.units.find((u) => u.id === ui.selectedUnitId && u.team === 'player');
    if (unitAt) {
      const kind = ui.mode === 'ability' ? 'ability' : 'attack';
      if (selected && strikeTargets(game, selected.id, kind).includes(unitAt.id)) {
        const action: Action =
          kind === 'attack'
            ? { type: 'Attack', unitId: selected.id, targetId: unitAt.id }
            : { type: 'UseAbility', unitId: selected.id, targetId: unitAt.id };
        const ok = await dispatch(perform(action));
        if (ok && !getState().game.game?.winner) await dispatch(perform({ type: 'EndActivation', unitId: selected.id }));
        return;
      }
      dispatch(unitSelected(unitAt.id));
      return;
    }

    if (selected && selected.stage === 'idle' && reachable(game, selected.id).has(posKey(pos))) {
      await dispatch(perform({ type: 'Move', unitId: selected.id, to: pos }));
      return;
    }
    dispatch(unitSelected(null));
  };

export const abilityPressed = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const ui = getState().game;
  const unit = ui.game?.units.find((u) => u.id === ui.selectedUnitId);
  if (!unit || unit.team !== 'player' || ui.busy) return;
  if (UNIT_DEFS[unit.archetype].ability.kind === 'guard') {
    const ok = await dispatch(perform({ type: 'UseAbility', unitId: unit.id }));
    if (ok) await dispatch(perform({ type: 'EndActivation', unitId: unit.id }));
    return;
  }
  dispatch(modeSet(ui.mode === 'ability' ? 'normal' : 'ability'));
};

export const endActivationPressed = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const id = getState().game.selectedUnitId;
  if (id) await dispatch(perform({ type: 'EndActivation', unitId: id }));
};

export const endPhasePressed = (): AppThunk<Promise<void>> => async (dispatch) => {
  dispatch(unitSelected(null));
  await dispatch(perform({ type: 'EndPhase' }));
};
```

- [ ] **Step 8: Implementare `src/game/selectors.ts`**

```ts
import { cardTargets } from '../engine/cards';
import { reachable } from '../engine/movement';
import { strikeTargets } from '../engine/targeting';
import type { GameState, Pos } from '../engine/types';
import type { GameUiState } from './gameSlice';

export interface Overlay {
  selected: Pos | null;
  reachable: Pos[];
  /** percorso per ogni destinazione raggiungibile, chiave `posKey` */
  paths: Record<string, Pos[]>;
  targets: Pos[];
  cardTargets: Pos[];
}

export const EMPTY_OVERLAY: Overlay = { selected: null, reachable: [], paths: {}, targets: [], cardTargets: [] };

const positionsOf = (game: GameState, ids: string[]): Pos[] =>
  ids.flatMap((id) => game.units.filter((u) => u.id === id).map((u) => u.pos));

export function computeOverlay(ui: GameUiState): Overlay {
  const game = ui.game;
  if (!game || ui.busy || game.winner) return EMPTY_OVERLAY;
  const selected = game.units.find((u) => u.id === ui.selectedUnitId) ?? null;
  const base: Overlay = { ...EMPTY_OVERLAY, selected: selected ? selected.pos : null };
  if (game.activeTeam !== 'player') return base;

  if (ui.mode === 'card' && ui.pendingCard !== null) {
    const cardId = game.decks.player.hand[ui.pendingCard];
    return { ...base, cardTargets: cardId ? positionsOf(game, cardTargets(game, 'player', cardId)) : [] };
  }
  if (!selected || selected.team !== 'player') return base;

  const paths: Record<string, Pos[]> = {};
  const reach: Pos[] = [];
  if (selected.stage === 'idle') {
    for (const [key, path] of reachable(game, selected.id)) {
      if (path.length < 2) continue;
      paths[key] = path;
      reach.push(path[path.length - 1]);
    }
  }
  const kind = ui.mode === 'ability' ? 'ability' : 'attack';
  return { ...base, reachable: reach, paths, targets: positionsOf(game, strikeTargets(game, selected.id, kind)) };
}
```

- [ ] **Step 9: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS, compresi i 9 test di `game.test.ts`. In Node `localStorage` non esiste: `loadUnlocked` restituisce `['easy']`, come previsto.

- [ ] **Step 10: Checkpoint**

L'utente committa `src/app/` e `src/game/`. Messaggio: `feat(game): store, thunk, driver AI e overlay`.

---

### Task 9: Proiezione isometrica, sprite, terreno e scena

**Files:**
- Create: `src/render/iso.ts`, `src/render/spriteFactory.ts`, `src/render/assetMap.ts`, `src/render/terrain.ts`, `src/render/scene.ts`
- Test: `src/render/iso.test.ts`

**Interfaces:**
- Consumes: tipi del motore, `UNIT_DEFS`, `posKey`, `Overlay`, `EMPTY_OVERLAY`.
- Produces:
  - `TILE_W = 64`, `TILE_H = 32`, `WORLD_W = 680`, `WORLD_H = 430`, `ORIGIN`, `toScreen(p)` (accetta coordinate frazionarie), `toCell(sx, sy): Pos`, `depthOf(p): number`;
  - `SPRITE_SCALE = 4`, `proceduralUnitTexture(team, archetype): Texture`, `assetMap.unit(team, archetype): Texture`;
  - `drawTerrain(arena): Container`, `drawProp(prop): Container`;
  - `class BattleScene { root; world; actors; fx; constructor(arena); view(id): UnitView | undefined; sync(state); placeAt(view, p); face(view, dx); drawBar(view); setOverlay(o); setHover(p | null); removeView(id) }`, `UnitView { root: Container; body: Sprite; bar: Graphics; unit: Unit }`, `UNIT_DEPTH_OFFSET`.

- [ ] **Step 1: Scrivere il test della proiezione**

`src/render/iso.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { WORLD_H, WORLD_W, depthOf, toCell, toScreen } from './iso';

describe('iso', () => {
  it('andata e ritorno su tutte le celle', () => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 10; x++) {
        const s = toScreen({ x, y });
        expect(toCell(s.x, s.y)).toEqual({ x, y });
      }
    }
  });

  it('i punti interni al rombo appartengono alla cella', () => {
    const s = toScreen({ x: 4, y: 3 });
    expect(toCell(s.x + 20, s.y)).toEqual({ x: 4, y: 3 });
    expect(toCell(s.x, s.y + 12)).toEqual({ x: 4, y: 3 });
  });

  it('la mappa intera sta nel mondo', () => {
    for (const p of [{ x: -0.5, y: 7.5 }, { x: 9.5, y: -0.5 }, { x: -0.5, y: -0.5 }, { x: 9.5, y: 7.5 }]) {
      const s = toScreen(p);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(WORLD_W);
      expect(s.y).toBeLessThanOrEqual(WORLD_H);
    }
  });

  it('più in basso nella scena significa più in primo piano', () => {
    expect(depthOf({ x: 1, y: 1 })).toBeGreaterThan(depthOf({ x: 1, y: 0 }));
  });
});
```

Run: `npx vitest run src/render/iso.test.ts`
Expected: FAIL, "Cannot find module './iso'".

- [ ] **Step 2: Implementare `src/render/iso.ts`**

```ts
import type { Pos } from '../engine/types';

export const TILE_W = 64;
export const TILE_H = 32;
export const WORLD_W = 680;
export const WORLD_H = 430;
export const ORIGIN = { x: 308, y: 100 };

/** Centro del rombo della cella (anche con coordinate frazionarie, per le interpolazioni). */
export function toScreen(p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (p.x - p.y) * (TILE_W / 2) + ORIGIN.x,
    y: (p.x + p.y) * (TILE_H / 2) + ORIGIN.y,
  };
}

export function toCell(sx: number, sy: number): Pos {
  const a = (sx - ORIGIN.x) / (TILE_W / 2);
  const b = (sy - ORIGIN.y) / (TILE_H / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

export function depthOf(p: { x: number; y: number }): number {
  return (p.x + p.y) * 10 + p.x;
}
```

Run: `npx vitest run src/render/iso.test.ts`
Expected: PASS (4 test).

- [ ] **Step 3: Implementare `src/render/spriteFactory.ts`**

```ts
import { Texture } from 'pixi.js';
import type { Archetype, Team } from '../engine/types';

export const SPRITE_W = 12;
export const SPRITE_H = 16;
export const SPRITE_SCALE = 4;

const BASE: Record<string, string> = {
  k: '#1b1424', // contorno
  s: '#e9b48f', // pelle
  S: '#b07a63', // pelle in ombra
  m: '#c3c7d4', // metallo
  M: '#6f7389', // metallo scuro
  b: '#7a5236', // cuoio
  B: '#45302a', // cuoio scuro
  h: '#3b2b2e', // capelli
  w: '#9a6a40', // legno
};

const TEAM_COLORS: Record<Team, { T: string; t: string }> = {
  player: { T: '#3f6fb5', t: '#284a80' },
  ai: { T: '#b0463c', t: '#742a27' },
};

/** Matrici 12×16: T/t = colore di squadra, '.' = trasparente. */
const TEMPLATES: Record<Archetype, string[]> = {
  guardian: [
    '....kkkk....',
    '...kmmmmk...',
    '..kmmmmmmk..',
    '..kmkkkkMk..',
    '..kksssSkk..',
    '...kssSSk...',
    '.kkkTTTTkk..',
    'kmmkTTTtkMk.',
    'kmTkTTttkMk.',
    'kmTkMMMMksk.',
    'kmmkTTtTkk..',
    '.kkkTTttk...',
    '...kttktk...',
    '...kBkkBk...',
    '..kBBkkBBk..',
    '..kkk..kkk..',
  ],
  scout: [
    '....kkkk....',
    '...kttttk...',
    '..ktTTTTtk..',
    '..kTkkkkTk..',
    '..kksssSkk.m',
    '...kssSSk.mk',
    '..kkTTTTkmk.',
    '.kTkTTtTkk..',
    '.ksktbbbkk..',
    '..kktTTtk...',
    '...ktTTtk...',
    '...kTttTk...',
    '...kbkkbk...',
    '...kbk.kbk..',
    '..kBBk.kBBk.',
    '..kkk..kkk..',
  ],
  crossbow: [
    '............',
    '....kkkk....',
    '...kbbbbk...',
    '..kbbbbbbk..',
    '..khkkkkhk..',
    '..khsssShk..',
    '...kssSSk...',
    '..kkTTTTkk..',
    '.kTkTTtTkwwk',
    '.kskTTtTkMwk',
    '..kkbbbbkwk.',
    '...kTTtTk...',
    '...kTttTk...',
    '...kbkkbk...',
    '..kBBk.kBBk.',
    '..kkk..kkk..',
  ],
};

const cache = new Map<string, Texture>();

/** Sprite provvisori disegnati da codice. Vedi `assetMap.ts` per sostituirli. */
export function proceduralUnitTexture(team: Team, archetype: Archetype): Texture {
  const key = `${team}:${archetype}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W;
  canvas.height = SPRITE_H;
  const ctx = canvas.getContext('2d')!;
  TEMPLATES[archetype].forEach((row, y) => {
    for (let x = 0; x < SPRITE_W; x++) {
      const ch = row[x] ?? '.';
      const color = ch === 'T' || ch === 't' ? TEAM_COLORS[team][ch] : BASE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  cache.set(key, texture);
  return texture;
}
```

- [ ] **Step 4: Implementare `src/render/assetMap.ts`**

```ts
import type { Texture } from 'pixi.js';
import type { Archetype, Team } from '../engine/types';
import { proceduralUnitTexture } from './spriteFactory';

/**
 * Unico punto di sostituzione degli sprite. Per usare sprite definitivi: caricare le texture
 * (es. `Assets.load`) e restituirle qui. Le regole di gioco non dipendono da questo file.
 * Le texture sono disegnate con i piedi sul bordo inferiore (anchor 0.5, 1).
 */
export const assetMap = {
  unit: (team: Team, archetype: Archetype): Texture => proceduralUnitTexture(team, archetype),
};
```

- [ ] **Step 5: Implementare `src/render/terrain.ts`**

```ts
import { Container, Graphics } from 'pixi.js';
import type { Arena, Prop, TerrainKind } from '../engine/types';
import { TILE_H, TILE_W, depthOf, toScreen } from './iso';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

const TERRAIN_COLORS: Record<TerrainKind, { base: number; light: number; dark: number }> = {
  grass: { base: 0x3f4a35, light: 0x55613f, dark: 0x2f3829 },
  dirt: { base: 0x4e3d33, light: 0x64503f, dark: 0x3a2d27 },
  mud: { base: 0x3a2e2e, light: 0x4a3b37, dark: 0x2a2124 },
  gravel: { base: 0x4d4a52, light: 0x66626b, dark: 0x37343c },
};

/** Pseudo-casuale stabile per cella: lo stesso terreno a ogni avvio. */
function hash(x: number, y: number, i: number): number {
  let h = (x * 374761393 + y * 668265263 + i * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawTerrain(arena: Arena): Container {
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  const left = toScreen({ x: -0.5, y: arena.height - 0.5 });
  const bottom = toScreen({ x: arena.width - 0.5, y: arena.height - 0.5 });
  const right = toScreen({ x: arena.width - 0.5, y: -0.5 });
  const depth = 14;
  g.poly([left.x, left.y, bottom.x, bottom.y, bottom.x, bottom.y + depth, left.x, left.y + depth]).fill(0x221a22);
  g.poly([bottom.x, bottom.y, right.x, right.y, right.x, right.y + depth, bottom.x, bottom.y + depth]).fill(0x1a141c);
  for (let y = 0; y < arena.height; y++) {
    for (let x = 0; x < arena.width; x++) {
      const c = toScreen({ x, y });
      const col = TERRAIN_COLORS[arena.terrain[y][x]];
      g.poly([c.x, c.y - HH, c.x + HW, c.y, c.x, c.y + HH, c.x - HW, c.y]).fill(col.base);
      for (let i = 0; i < 12; i++) {
        const u = hash(x, y, i) * 2 - 1;
        const v = hash(x, y, i + 31) * 2 - 1;
        if (Math.abs(u) + Math.abs(v) > 0.9) continue;
        g.rect(Math.round(c.x + u * HW), Math.round(c.y + v * HH), 2, 2).fill(i % 2 ? col.light : col.dark);
      }
    }
  }
  return layer;
}

function isoBox(
  g: Graphics,
  c: { x: number; y: number },
  hw: number,
  hh: number,
  h: number,
  colors: { top: number; left: number; right: number },
): void {
  g.poly([c.x - hw, c.y - h, c.x, c.y + hh - h, c.x, c.y + hh, c.x - hw, c.y]).fill(colors.left);
  g.poly([c.x, c.y + hh - h, c.x + hw, c.y - h, c.x + hw, c.y, c.x, c.y + hh]).fill(colors.right);
  g.poly([c.x, c.y - hh - h, c.x + hw, c.y - h, c.x, c.y + hh - h, c.x - hw, c.y - h]).fill(colors.top);
}

const mid = (a: { x: number; y: number }, b: { x: number; y: number }, t = 0.5) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

function drawTent(g: Graphics, prop: Prop): void {
  const xs = prop.cells.map((c) => c.x);
  const ys = prop.cells.map((c) => c.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const N = toScreen({ x: minX - 0.5, y: minY - 0.5 });
  const E = toScreen({ x: maxX + 0.5, y: minY - 0.5 });
  const S = toScreen({ x: maxX + 0.5, y: maxY + 0.5 });
  const W = toScreen({ x: minX - 0.5, y: maxY + 0.5 });
  const lift = 46;
  const A = { x: (N.x + W.x) / 2, y: (N.y + W.y) / 2 - lift };
  const B = { x: (E.x + S.x) / 2, y: (E.y + S.y) / 2 - lift };
  const outline = { width: 2, color: 0x2a1d1a };
  g.poly([N.x, N.y, E.x, E.y, B.x, B.y, A.x, A.y]).fill(0xb9a88a).stroke(outline);
  g.poly([W.x, W.y, S.x, S.y, B.x, B.y, A.x, A.y]).fill(0x8c7a62).stroke(outline);
  g.poly([E.x, E.y, S.x, S.y, B.x, B.y]).fill(0x6f5f4d).stroke(outline);
  for (let i = 1; i < 4; i++) {
    const from = mid(W, S, i / 4);
    const to = mid(A, B, i / 4);
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 2, color: 0x7a2c2a });
  }
  g.rect(A.x - 1, A.y - 24, 2, 26).fill(0x3a2a20);
  g.poly([A.x + 1, A.y - 24, A.x + 18, A.y - 19, A.x + 1, A.y - 14]).fill(0x9c3a33);
}

export function drawProp(prop: Prop): Container {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);
  const deepest = prop.cells.reduce((a, b) => (depthOf(b) > depthOf(a) ? b : a));
  container.zIndex = depthOf(deepest);
  switch (prop.kind) {
    case 'tent':
      drawTent(g, prop);
      break;
    case 'ruin':
      prop.cells.forEach((cell, i) => {
        const c = toScreen(cell);
        isoBox(g, c, HW, HH, i % 2 ? 18 : 28, { top: 0x7a7480, left: 0x4e4a56, right: 0x3c3944 });
        g.moveTo(c.x - 10, c.y - 14).lineTo(c.x - 4, c.y - 6).stroke({ width: 1, color: 0x2a2730 });
      });
      break;
    case 'brazier': {
      const c = toScreen(prop.cells[0]);
      isoBox(g, c, 10, 5, 12, { top: 0x3a3236, left: 0x2a2326, right: 0x1f1a1c });
      g.ellipse(c.x, c.y - 13, 11, 5).fill(0x2a2224);
      g.ellipse(c.x, c.y - 14, 8, 3).fill(0xd9622b);
      break;
    }
    case 'rock': {
      const c = toScreen(prop.cells[0]);
      g.ellipse(c.x, c.y - 3, 11, 6).fill(0x5a5660);
      g.ellipse(c.x - 3, c.y - 6, 4, 2).fill(0x7c7783);
      break;
    }
    case 'tallgrass': {
      const c = toScreen(prop.cells[0]);
      for (let i = -3; i <= 3; i++) {
        g.moveTo(c.x + i * 4, c.y + 2)
          .lineTo(c.x + i * 4 + (i % 2), c.y - 8 - Math.abs(i * 3) % 5)
          .stroke({ width: 2, color: 0x5f6e44 });
      }
      break;
    }
  }
  return container;
}
```

- [ ] **Step 6: Implementare `src/render/scene.ts`**

```ts
import { Container, Graphics, Sprite } from 'pixi.js';
import { posKey } from '../engine/arena';
import { UNIT_DEFS } from '../engine/units';
import type { Arena, GameState, Pos, Unit } from '../engine/types';
import { EMPTY_OVERLAY } from '../game/selectors';
import type { Overlay } from '../game/selectors';
import { assetMap } from './assetMap';
import { TILE_H, TILE_W, depthOf, toScreen } from './iso';
import { SPRITE_SCALE } from './spriteFactory';
import { drawProp, drawTerrain } from './terrain';

export interface UnitView {
  root: Container;
  body: Sprite;
  bar: Graphics;
  /** copia locale usata per disegnare durante le animazioni */
  unit: Unit;
}

export const UNIT_DEPTH_OFFSET = 5;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export class BattleScene {
  readonly root = new Container();
  readonly world = new Container();
  readonly actors = new Container();
  readonly fx = new Container();
  private readonly overlayLayer = new Graphics();
  private readonly hoverLayer = new Graphics();
  private readonly views = new Map<string, UnitView>();
  private overlay: Overlay = EMPTY_OVERLAY;

  constructor(arena: Arena) {
    this.actors.sortableChildren = true;
    this.root.addChild(this.world);
    this.world.addChild(drawTerrain(arena), this.overlayLayer, this.hoverLayer, this.actors, this.fx);
    for (const prop of arena.props) this.actors.addChild(drawProp(prop));
  }

  view(id: string): UnitView | undefined {
    return this.views.get(id);
  }

  /** Allinea la scena allo stato autorevole; chiamata solo quando non ci sono animazioni in corso. */
  sync(state: GameState): void {
    const alive = new Set(state.units.map((u) => u.id));
    for (const id of [...this.views.keys()]) if (!alive.has(id)) this.removeView(id);
    for (const unit of state.units) {
      const view = this.views.get(unit.id) ?? this.createView(unit);
      view.unit = { ...unit, pos: { ...unit.pos } };
      this.placeAt(view, unit.pos);
      view.root.alpha = 1;
      view.body.position.set(0, 0);
      view.body.tint = unit.team === state.activeTeam && unit.stage === 'done' ? 0x8a8a9a : 0xffffff;
      this.drawBar(view);
    }
  }

  placeAt(view: UnitView, p: { x: number; y: number }): void {
    const s = toScreen(p);
    view.root.position.set(s.x, s.y + 4);
    view.root.zIndex = depthOf(p) + UNIT_DEPTH_OFFSET;
  }

  face(view: UnitView, dx: number): void {
    if (dx !== 0) view.body.scale.x = Math.sign(dx) * SPRITE_SCALE;
  }

  drawBar(view: UnitView): void {
    const max = UNIT_DEFS[view.unit.archetype].maxHp;
    const w = 30;
    const g = view.bar;
    g.clear();
    g.rect(-w / 2 - 1, -72, w + 2, 6).fill(0x140e14);
    g.rect(-w / 2, -71, Math.max(0, (w * view.unit.hp) / max), 4).fill(view.unit.team === 'player' ? 0x6fb35a : 0xd0533f);
    if (view.unit.guard > 0) g.rect(-w / 2, -75, Math.min(w, view.unit.guard * 5), 2).fill(0x7fb2ff);
  }

  setOverlay(overlay: Overlay): void {
    this.overlay = overlay;
    const g = this.overlayLayer;
    g.clear();
    for (const p of overlay.reachable) this.diamond(g, p, 0xe8c26a, 0.16, 0.45);
    for (const p of overlay.targets) this.diamond(g, p, 0xd0533f, 0.3, 0.8);
    for (const p of overlay.cardTargets) this.diamond(g, p, 0xb48ce0, 0.3, 0.8);
    if (overlay.selected) {
      const s = toScreen(overlay.selected);
      g.ellipse(s.x, s.y + 4, 18, 8).stroke({ width: 2, color: 0xf3e2a6, alpha: 0.9 });
    }
  }

  setHover(p: Pos | null): void {
    const g = this.hoverLayer;
    g.clear();
    if (!p) return;
    const path = this.overlay.paths[posKey(p)];
    if (path) {
      for (const step of path.slice(1)) {
        const s = toScreen(step);
        g.circle(s.x, s.y, 3).fill({ color: 0xf3e2a6, alpha: 0.85 });
      }
    }
    const s = toScreen(p);
    g.poly([s.x, s.y - HH, s.x + HW, s.y, s.x, s.y + HH, s.x - HW, s.y]).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  }

  removeView(id: string): void {
    const view = this.views.get(id);
    if (!view) return;
    view.root.destroy({ children: true });
    this.views.delete(id);
  }

  private diamond(g: Graphics, p: Pos, color: number, fillAlpha: number, lineAlpha: number): void {
    const s = toScreen(p);
    const pts = [s.x, s.y - HH + 2, s.x + HW - 4, s.y, s.x, s.y + HH - 2, s.x - HW + 4, s.y];
    g.poly(pts).fill({ color, alpha: fillAlpha }).stroke({ width: 1, color, alpha: lineAlpha });
  }

  private createView(unit: Unit): UnitView {
    const root = new Container();
    // ombra morbida a terra: fa poggiare il soldato sul terreno, non è una base
    const shadow = new Graphics().ellipse(0, 0, 13, 4).fill({ color: 0x000000, alpha: 0.3 });
    const body = new Sprite(assetMap.unit(unit.team, unit.archetype));
    body.anchor.set(0.5, 1);
    body.scale.set(unit.team === 'ai' ? -SPRITE_SCALE : SPRITE_SCALE, SPRITE_SCALE);
    const bar = new Graphics();
    root.addChild(shadow, body, bar);
    this.actors.addChild(root);
    const view: UnitView = { root, body, bar, unit: { ...unit, pos: { ...unit.pos } } };
    this.views.set(unit.id, view);
    return view;
  }
}
```

- [ ] **Step 7: Verificare i tipi**

Run: `npx tsc -b`
Expected: nessun errore. In questo task i file PixiJS non sono ancora usati da nessuna pagina, quindi la verifica visiva arriva nel Task 10.

- [ ] **Step 8: Checkpoint**

L'utente committa `src/render/`. Messaggio: `feat(render): proiezione isometrica, sprite procedurali, terreno e scena`.

---

### Task 10: Effetti, animazioni e canvas PixiJS

**Files:**
- Create: `src/render/tween.ts`, `src/render/effects.ts`, `src/render/animationQueue.ts`, `src/render/BattlefieldCanvas.tsx`

**Interfaces:**
- Consumes: `BattleScene`, `UnitView`, `toScreen`, `toCell`, `WORLD_W`, `WORLD_H`, `depthOf`, `CARD_DEFS`, `inBounds`, `store`, `registerAnimator`, `computeOverlay`, `clickCell`.
- Produces:
  - `motion.scale` (0.05 con `prefers-reduced-motion`, altrimenti 1), `tween(ticker, ms, onUpdate): Promise<void>`, `lerp(a, b, t)`;
  - `class Effects { constructor(scene, arena, ticker); floatText(x, y, text, color): Promise<void>; destroy() }`;
  - `class Animator { animating: boolean; constructor(scene, ticker, effects, getState); play(events): Promise<void> }`;
  - componente `BattlefieldCanvas` (nessuna prop; legge lo store).

- [ ] **Step 1: Implementare `src/render/tween.ts`**

```ts
import type { Ticker } from 'pixi.js';

const reduced =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Con prefers-reduced-motion le animazioni durano quasi zero, ma le informazioni restano visibili. */
export const motion = { scale: reduced ? 0.05 : 1 };

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function tween(ticker: Ticker, ms: number, onUpdate: (t: number) => void): Promise<void> {
  const duration = ms * motion.scale;
  if (duration < 1) {
    onUpdate(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let elapsed = 0;
    const step = (t: Ticker) => {
      elapsed += t.deltaMS;
      const k = Math.min(1, elapsed / duration);
      onUpdate(k);
      if (k >= 1) {
        ticker.remove(step);
        resolve();
      }
    };
    ticker.add(step);
  });
}
```

- [ ] **Step 2: Implementare `src/render/effects.ts`**

```ts
import { Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { Arena } from '../engine/types';
import { WORLD_H, WORLD_W, depthOf, toScreen } from './iso';
import type { BattleScene } from './scene';
import { motion, tween } from './tween';

function gradientTexture(
  width: number,
  height: number,
  stops: [number, string][],
  radius: number,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  return Texture.from(canvas);
}

interface Ember {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export class Effects {
  private readonly scene: BattleScene;
  private readonly ticker: Ticker;
  private readonly sources: { x: number; y: number }[] = [];
  private readonly flames: Graphics[] = [];
  private readonly glows: Sprite[] = [];
  private readonly embers: Ember[] = [];
  private time = 0;

  constructor(scene: BattleScene, arena: Arena, ticker: Ticker) {
    this.scene = scene;
    this.ticker = ticker;
    const glowTexture = gradientTexture(
      128,
      128,
      [
        [0, 'rgba(255,170,80,0.55)'],
        [0.4, 'rgba(255,120,40,0.22)'],
        [1, 'rgba(255,90,30,0)'],
      ],
      64,
    );
    for (const prop of arena.props.filter((p) => p.kind === 'brazier')) {
      const c = toScreen(prop.cells[0]);
      const source = { x: c.x, y: c.y - 16 };
      this.sources.push(source);
      const glow = new Sprite(glowTexture);
      glow.anchor.set(0.5);
      glow.position.set(source.x, source.y);
      glow.scale.set(2.2);
      glow.blendMode = 'add';
      scene.fx.addChild(glow);
      this.glows.push(glow);
      const flame = new Graphics();
      flame.position.set(source.x, source.y);
      flame.zIndex = depthOf(prop.cells[0]) + 1;
      scene.actors.addChild(flame);
      this.flames.push(flame);
    }
    const vignette = new Sprite(
      gradientTexture(
        WORLD_W,
        WORLD_H,
        [
          [0, 'rgba(8,4,12,0)'],
          [0.6, 'rgba(8,4,12,0.15)'],
          [1, 'rgba(8,4,12,0.8)'],
        ],
        Math.max(WORLD_W, WORLD_H) * 0.62,
      ),
    );
    scene.world.addChild(vignette);
    ticker.add(this.update);
  }

  private readonly update = (t: Ticker): void => {
    this.time += t.deltaMS;
    this.flames.forEach((g, i) => {
      const h = 11 + Math.sin(this.time / 90 + i * 2) * 2 + Math.random() * 2;
      g.clear();
      g.poly([-6, 0, -2, -h * 0.6, 0, -h, 3, -h * 0.5, 6, 0]).fill(0xf08a2a);
      g.poly([-3, 0, 0, -h * 0.6, 3, 0]).fill(0xffd36b);
    });
    this.glows.forEach((g, i) => {
      g.alpha = 0.8 + Math.sin(this.time / 140 + i) * 0.12;
    });
    if (motion.scale === 1 && this.embers.length < 28 && this.sources.length > 0 && Math.random() < 0.25) {
      const src = this.sources[Math.floor(Math.random() * this.sources.length)];
      const g = new Graphics().rect(0, 0, 2, 2).fill(Math.random() < 0.5 ? 0xffa040 : 0xffd36b);
      g.position.set(src.x + (Math.random() - 0.5) * 10, src.y - 8);
      g.blendMode = 'add';
      this.scene.fx.addChild(g);
      const max = 60 + Math.random() * 70;
      this.embers.push({ g, vx: (Math.random() - 0.5) * 0.4, vy: -0.4 - Math.random() * 0.5, life: max, max });
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life -= t.deltaTime;
      e.g.x += e.vx * t.deltaTime + Math.sin((this.time + i * 100) / 300) * 0.15;
      e.g.y += e.vy * t.deltaTime;
      e.g.alpha = Math.max(0, e.life / e.max);
      if (e.life <= 0) {
        e.g.destroy();
        this.embers.splice(i, 1);
      }
    }
  };

  floatText(x: number, y: number, text: string, color: number): Promise<void> {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Pixelify Sans, monospace',
        fontSize: 15,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x140e14, width: 4 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(x, y);
    this.scene.fx.addChild(label);
    return tween(this.ticker, 750, (k) => {
      label.y = y - 26 * k;
      label.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }).then(() => label.destroy());
  }

  destroy(): void {
    this.ticker.remove(this.update);
  }
}
```

- [ ] **Step 3: Implementare `src/render/animationQueue.ts`**

```ts
import { Graphics, Text } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { CARD_DEFS } from '../engine/cards';
import type { CardId, GameEvent, GameState, Pos } from '../engine/types';
import type { Effects } from './effects';
import { WORLD_W, toScreen } from './iso';
import type { BattleScene } from './scene';
import { lerp, tween } from './tween';

const HEAD = 70;

/** Traduce gli eventi del motore in animazioni, in sequenza. Non modifica mai lo stato di gioco. */
export class Animator {
  animating = false;
  private readonly scene: BattleScene;
  private readonly ticker: Ticker;
  private readonly effects: Effects;
  private readonly getState: () => GameState | null;

  constructor(scene: BattleScene, ticker: Ticker, effects: Effects, getState: () => GameState | null) {
    this.scene = scene;
    this.ticker = ticker;
    this.effects = effects;
    this.getState = getState;
  }

  async play(events: GameEvent[]): Promise<void> {
    this.animating = true;
    try {
      for (const event of events) {
        try {
          await this.playOne(event);
        } catch (error) {
          console.warn('Animazione saltata', event.type, error);
        }
      }
    } finally {
      this.animating = false;
      const state = this.getState();
      if (state) this.scene.sync(state);
    }
  }

  private playOne(e: GameEvent): Promise<void> {
    switch (e.type) {
      case 'Moved':
        return this.walk(e.unitId, e.path);
      case 'Attacked':
        return e.kind === 'melee' ? this.lunge(e.unitId, e.targetId) : this.shoot(e.unitId, e.targetId);
      case 'Damaged':
        return this.hit(e.unitId, e.amount, e.absorbed);
      case 'Guarded':
        return this.guard(e.unitId, e.amount);
      case 'Healed':
        return this.heal(e.unitId, e.amount);
      case 'CardPlayed':
        return this.card(e.cardId, e.targetId);
      case 'Defeated':
        return this.defeat(e.unitId);
      case 'PhaseChanged':
        return this.banner(e.team === 'player' ? 'Il tuo turno' : 'Turno nemico');
      case 'GameOver':
        return Promise.resolve();
    }
  }

  private async walk(id: string, path: Pos[]): Promise<void> {
    const view = this.scene.view(id);
    if (!view || path.length < 2) return;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      this.scene.face(view, toScreen(b).x - toScreen(a).x);
      await tween(this.ticker, 150, (k) => {
        this.scene.placeAt(view, { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
        view.body.y = -Math.sin(Math.PI * k) * 5;
      });
    }
    view.body.y = 0;
    view.unit.pos = { ...path[path.length - 1] };
  }

  private async lunge(attackerId: string, targetId: string): Promise<void> {
    const view = this.scene.view(attackerId);
    const target = this.scene.view(targetId);
    if (!view || !target) return;
    this.scene.face(view, target.root.x - view.root.x);
    const sx = view.root.x;
    const sy = view.root.y;
    const dx = (target.root.x - sx) * 0.4;
    const dy = (target.root.y - sy) * 0.4;
    await tween(this.ticker, 90, (k) => view.root.position.set(sx + dx * k, sy + dy * k));
    await tween(this.ticker, 140, (k) => view.root.position.set(sx + dx * (1 - k), sy + dy * (1 - k)));
  }

  private async shoot(attackerId: string, targetId: string): Promise<void> {
    const view = this.scene.view(attackerId);
    const target = this.scene.view(targetId);
    if (!view || !target) return;
    this.scene.face(view, target.root.x - view.root.x);
    const from = { x: view.root.x, y: view.root.y - 34 };
    const to = { x: target.root.x, y: target.root.y - 30 };
    const bolt = new Graphics().rect(-7, -1, 14, 2).fill(0xe8dcc0).rect(5, -2, 3, 4).fill(0x9aa0b0);
    bolt.rotation = Math.atan2(to.y - from.y, to.x - from.x);
    bolt.position.set(from.x, from.y);
    this.scene.fx.addChild(bolt);
    await tween(this.ticker, 220, (k) => bolt.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k)));
    bolt.destroy();
  }

  private async hit(id: string, amount: number, absorbed: number): Promise<void> {
    const view = this.scene.view(id);
    if (!view) return;
    view.unit.hp = Math.max(0, view.unit.hp - amount);
    view.unit.guard = Math.max(0, view.unit.guard - absorbed);
    this.scene.drawBar(view);
    const x = view.root.x;
    const y = view.root.y - HEAD;
    void this.effects.floatText(x, y, amount > 0 ? `-${amount}` : 'parato', amount > 0 ? 0xff6a55 : 0x9cc3ff);
    if (absorbed > 0 && amount > 0) void this.effects.floatText(x + 22, y + 10, `guardia -${absorbed}`, 0x9cc3ff);
    view.body.tint = 0xff7070;
    await tween(this.ticker, 240, (k) => {
      view.body.x = Math.sin(k * Math.PI * 6) * 3 * (1 - k);
    });
    view.body.x = 0;
    view.body.tint = 0xffffff;
  }

  private async guard(id: string, amount: number): Promise<void> {
    const view = this.scene.view(id);
    if (!view) return;
    view.unit.guard = Math.max(view.unit.guard, amount);
    this.scene.drawBar(view);
    void this.effects.floatText(view.root.x, view.root.y - HEAD, `+${amount} guardia`, 0x9cc3ff);
    const ring = new Graphics();
    ring.position.set(view.root.x, view.root.y - 28);
    this.scene.fx.addChild(ring);
    await tween(this.ticker, 360, (k) => {
      ring.clear();
      ring.ellipse(0, 0, 14 + 14 * k, 22 + 10 * k).stroke({ width: 2, color: 0x7fb2ff, alpha: 1 - k });
    });
    ring.destroy();
  }

  private async heal(id: string, amount: number): Promise<void> {
    const view = this.scene.view(id);
    if (!view) return;
    view.unit.hp += amount;
    this.scene.drawBar(view);
    await this.effects.floatText(view.root.x, view.root.y - HEAD, `+${amount}`, 0x7fe08a);
  }

  private async card(cardId: CardId, targetId: string): Promise<void> {
    const view = this.scene.view(targetId);
    if (!view) return;
    await this.effects.floatText(view.root.x, view.root.y - HEAD - 12, CARD_DEFS[cardId].name, 0xf3c45a);
  }

  private async defeat(id: string): Promise<void> {
    const view = this.scene.view(id);
    if (!view) return;
    await tween(this.ticker, 480, (k) => {
      view.root.alpha = 1 - k;
      view.body.y = k * 6;
      view.body.rotation = (view.body.scale.x > 0 ? 1 : -1) * k * 0.5;
    });
    this.scene.removeView(id);
  }

  private async banner(text: string): Promise<void> {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Pixelify Sans, monospace',
        fontSize: 30,
        fill: 0xf3e2a6,
        stroke: { color: 0x140e14, width: 6 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(WORLD_W / 2, 44);
    label.alpha = 0;
    this.scene.fx.addChild(label);
    await tween(this.ticker, 200, (k) => (label.alpha = k));
    await tween(this.ticker, 450, () => undefined);
    await tween(this.ticker, 200, (k) => (label.alpha = 1 - k));
    label.destroy();
  }
}
```

- [ ] **Step 4: Implementare `src/render/BattlefieldCanvas.tsx`**

```tsx
import { Application } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { store } from '../app/store';
import { inBounds } from '../engine/arena';
import type { Pos } from '../engine/types';
import { registerAnimator } from '../game/animator';
import { computeOverlay } from '../game/selectors';
import { clickCell } from '../game/thunks';
import { Animator } from './animationQueue';
import { Effects } from './effects';
import { WORLD_H, WORLD_W, toCell } from './iso';
import { BattleScene } from './scene';

export function BattlefieldCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let initialized = false;
    let disposed = false;
    let teardown = () => {};

    void app
      .init({
        resizeTo: host,
        background: '#120d18',
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        roundPixels: true,
      })
      .then(() => {
        initialized = true;
        const game = store.getState().game.game;
        // StrictMode in sviluppo smonta il componente mentre init è ancora in corso
        if (disposed || !game) {
          app.destroy(true, { children: true });
          return;
        }
        host.appendChild(app.canvas);

        const scene = new BattleScene(game.arena);
        app.stage.addChild(scene.root);
        const effects = new Effects(scene, game.arena, app.ticker);
        const animator = new Animator(scene, app.ticker, effects, () => store.getState().game.game);
        registerAnimator((events) => animator.play(events));

        const fit = () => {
          const s = Math.min(app.screen.width / WORLD_W, app.screen.height / WORLD_H);
          scene.root.scale.set(s);
          scene.root.position.set((app.screen.width - WORLD_W * s) / 2, (app.screen.height - WORLD_H * s) / 2);
        };
        fit();
        app.renderer.on('resize', fit);

        const render = () => {
          const ui = store.getState().game;
          if (ui.game && !animator.animating) scene.sync(ui.game);
          scene.setOverlay(computeOverlay(ui));
        };
        render();
        const unsubscribe = store.subscribe(render);

        const cellAt = (e: FederatedPointerEvent): Pos | null => {
          const local = scene.world.toLocal(e.global);
          const cell = toCell(local.x, local.y);
          const current = store.getState().game.game;
          return current && inBounds(current.arena, cell) ? cell : null;
        };
        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;
        app.stage.on('pointermove', (e) => scene.setHover(cellAt(e)));
        app.stage.on('pointerleave', () => scene.setHover(null));
        app.stage.on('pointertap', (e) => {
          const cell = cellAt(e);
          if (cell) void store.dispatch(clickCell(cell));
        });

        teardown = () => {
          unsubscribe();
          registerAnimator(null);
          effects.destroy();
          app.renderer.off('resize', fit);
        };
      });

    return () => {
      disposed = true;
      teardown();
      // se init non è finito, ci pensa la sua callback a distruggere l'app
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  return <div className="battlefield" ref={hostRef} />;
}
```

- [ ] **Step 5: Verificare i tipi**

Run: `npx tsc -b`
Expected: nessun errore. La verifica visiva si fa nel Task 11, quando il canvas viene montato.

- [ ] **Step 6: Checkpoint**

L'utente committa `src/render/`. Messaggio: `feat(render): animazioni, effetti di luce e canvas PixiJS`.

---

### Task 11: Interfaccia React e collegamento

**Files:**
- Create: `src/ui/StartScreen.tsx`, `src/ui/BattleScreen.tsx`, `src/ui/Hud.tsx`, `src/ui/UnitPanel.tsx`, `src/ui/CardHand.tsx`, `src/ui/CardIcon.tsx`, `src/ui/EndScreen.tsx`, `src/ui/ui.css`
- Modify: `src/main.tsx`, `src/App.tsx`, `index.html`
- Delete: `src/App.css`, `src/index.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`

**Interfaces:**
- Consumes: `store`, `useAppDispatch`, `useAppSelector`, i thunk e gli action creator del Task 8, `UNIT_DEFS`, `CARD_DEFS`, `cardBlockReason`, `canAct`, `canGuard`, `strikeTargets`, `BattlefieldCanvas`.
- Produces: l'app completa e giocabile.

- [ ] **Step 1: Pulizia dello scaffold e `index.html`**

Eliminare `src/App.css`, `src/index.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`.

In `index.html` impostare `<title>Bannerfall</title>` e aggiungere nel `<head>`:
```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: `src/main.tsx` e `src/App.tsx`**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App.tsx';
import { store } from './app/store';
import './ui/ui.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
import { useAppSelector } from './app/hooks';
import { BattleScreen } from './ui/BattleScreen';
import { StartScreen } from './ui/StartScreen';

export default function App() {
  const screen = useAppSelector((s) => s.game.screen);
  return screen === 'start' ? <StartScreen /> : <BattleScreen />;
}
```

- [ ] **Step 3: `src/ui/StartScreen.tsx`**

```tsx
import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { Difficulty } from '../engine/types';
import { difficultySet } from '../game/gameSlice';
import { startGame } from '../game/thunks';

const LEVELS: { id: Difficulty; name: string; text: string }[] = [
  { id: 'easy', name: 'Recluta', text: 'Il nemico cerca il colpo più facile e a volte sbaglia.' },
  { id: 'medium', name: 'Veterano', text: 'Valuta minacce e posizioni, usa le carte con criterio.' },
  { id: 'hard', name: 'Comandante', text: 'Prevede la tua risposta prima di muovere.' },
];

export function StartScreen() {
  const dispatch = useAppDispatch();
  const difficulty = useAppSelector((s) => s.game.difficulty);
  const unlocked = useAppSelector((s) => s.game.unlocked);
  return (
    <div className="start">
      <div className="start__panel parchment">
        <h1 className="title">Bannerfall</h1>
        <p className="start__lead">Tre soldati, un accampamento in fiamme, ordini da impartire.</p>
        <fieldset className="levels">
          <legend>Difficoltà</legend>
          {LEVELS.map((level) => {
            const locked = !unlocked.includes(level.id);
            return (
              <label
                key={level.id}
                className={`level ${difficulty === level.id ? 'level--active' : ''} ${locked ? 'level--locked' : ''}`}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={level.id}
                  checked={difficulty === level.id}
                  disabled={locked}
                  onChange={() => dispatch(difficultySet(level.id))}
                />
                <strong>{level.name}</strong>
                <span>{locked ? 'Bloccato: vinci al livello precedente per sbloccarlo.' : level.text}</span>
              </label>
            );
          })}
        </fieldset>
        <button className="btn btn--primary" onClick={() => dispatch(startGame())}>
          Inizia la battaglia
        </button>
        <section className="howto">
          <h2>Come si gioca</h2>
          <ul>
            <li>Clicca un tuo soldato, poi una casella evidenziata per muoverlo.</li>
            <li>Clicca un nemico evidenziato in rosso per attaccarlo.</li>
            <li>Ogni soldato agisce una volta per fase. Puoi giocare una carta-ordine per fase.</li>
            <li>Esc annulla la selezione.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/ui/BattleScreen.tsx` e `src/ui/EndScreen.tsx`**

`src/ui/BattleScreen.tsx`:
```tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { unitSelected } from '../game/gameSlice';
import { BattlefieldCanvas } from '../render/BattlefieldCanvas';
import { CardHand } from './CardHand';
import { EndScreen } from './EndScreen';
import { Hud } from './Hud';
import { UnitPanel } from './UnitPanel';

export function BattleScreen() {
  const dispatch = useAppDispatch();
  const gameId = useAppSelector((s) => s.game.gameId);
  const winner = useAppSelector((s) => s.game.game?.winner ?? null);
  const busy = useAppSelector((s) => s.game.busy);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(unitSelected(null));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="battle">
      <Hud />
      <main className="battle__field">
        <BattlefieldCanvas key={gameId} />
      </main>
      <footer className="battle__bar">
        <UnitPanel />
        <CardHand />
      </footer>
      {winner && !busy && <EndScreen winner={winner} />}
    </div>
  );
}
```

`src/ui/EndScreen.tsx`:
```tsx
import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { Team } from '../engine/types';
import { returnedToStart } from '../game/gameSlice';
import { nextLevel } from '../game/progress';
import { startGame, startNextLevel } from '../game/thunks';

const LEVEL_NAMES = { easy: 'Recluta', medium: 'Veterano', hard: 'Comandante' } as const;

export function EndScreen({ winner }: { winner: Team }) {
  const dispatch = useAppDispatch();
  const difficulty = useAppSelector((s) => s.game.difficulty);
  const won = winner === 'player';
  const next = won ? nextLevel(difficulty) : null;
  return (
    <div className="end" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className="end__panel parchment">
        <h2 id="end-title" className="title">
          {won ? 'Vittoria' : 'Sconfitta'}
        </h2>
        <p>{won ? 'Lo stendardo nemico è caduto.' : 'La tua squadra è stata sconfitta.'}</p>
        {next && <p className="end__unlock">Livello sbloccato: {LEVEL_NAMES[next]}</p>}
        <div className="end__actions">
          {next && (
            <button className="btn btn--primary" autoFocus onClick={() => dispatch(startNextLevel())}>
              Affronta il livello successivo
            </button>
          )}
          <button
            className={`btn ${next ? 'btn--ghost' : 'btn--primary'}`}
            autoFocus={!next}
            onClick={() => dispatch(startGame())}
          >
            {won ? 'Rigioca' : 'Riprova'}
          </button>
          <button className="btn btn--ghost" onClick={() => dispatch(returnedToStart())}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `src/ui/Hud.tsx`**

```tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { UNIT_DEFS } from '../engine/units';
import { messageSet, returnedToStart, unitSelected } from '../game/gameSlice';
import { endPhasePressed, startGame } from '../game/thunks';

export function Hud() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.game);
  const busy = useAppSelector((s) => s.game.busy);
  const message = useAppSelector((s) => s.game.message);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => dispatch(messageSet(null)), 2500);
    return () => clearTimeout(timer);
  }, [message, dispatch]);

  if (!game) return null;
  const myTurn = game.activeTeam === 'player' && !game.winner;
  const roster = game.units.filter((u) => u.team === 'player');

  return (
    <header className="hud">
      <div className="hud__turn">
        <span className="hud__round">Round {game.round}</span>
        <span className={`hud__team ${myTurn ? 'hud__team--player' : 'hud__team--ai'}`}>
          {myTurn ? 'Il tuo turno' : 'Turno nemico'}
        </span>
      </div>
      <ul className="hud__roster">
        {roster.map((u) => (
          <li key={u.id} className={u.stage === 'done' ? 'is-done' : ''}>
            <button onClick={() => dispatch(unitSelected(u.id))}>
              {UNIT_DEFS[u.archetype].name}{' '}
              <small>
                {u.hp}/{UNIT_DEFS[u.archetype].maxHp}
              </small>{' '}
              <em>{u.stage === 'done' ? 'attivato' : 'pronto'}</em>
            </button>
          </li>
        ))}
      </ul>
      <p className="hud__message" role="status">
        {message ?? (busy && !myTurn ? 'Il nemico sta manovrando…' : '')}
      </p>
      <div className="hud__actions">
        <button className="btn" disabled={!myTurn || busy} onClick={() => void dispatch(endPhasePressed())}>
          Fine fase
        </button>
        <button className="btn btn--ghost" onClick={() => dispatch(startGame())}>
          Ricomincia
        </button>
        <button className="btn btn--ghost" onClick={() => dispatch(returnedToStart())}>
          Menu
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: `src/ui/UnitPanel.tsx`**

```tsx
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { canAct, canGuard, strikeTargets } from '../engine/targeting';
import { UNIT_DEFS } from '../engine/units';
import { abilityPressed, endActivationPressed } from '../game/thunks';

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="bar" role="img" aria-label={`${label} ${value} su ${max}`}>
      <span className="bar__fill" style={{ width: `${(value / max) * 100}%` }} />
      <span className="bar__text">
        {label} {value}/{max}
      </span>
    </span>
  );
}

export function UnitPanel() {
  const dispatch = useAppDispatch();
  const ui = useAppSelector((s) => s.game);
  const game = ui.game;
  const unit = game?.units.find((u) => u.id === ui.selectedUnitId);

  if (!game || !unit) {
    return (
      <section className="unit-panel parchment unit-panel--empty">
        <p>Seleziona un soldato.</p>
      </section>
    );
  }

  const def = UNIT_DEFS[unit.archetype];
  const mine = unit.team === 'player';
  const canUse = mine && !ui.busy && canAct(game, unit);
  const abilityReady =
    def.ability.kind === 'guard' ? canGuard(game, unit.id) : strikeTargets(game, unit.id, 'ability').length > 0;
  const attack = def.attack.ranged ? `gittata ${def.attack.minRange}–${def.attack.maxRange}` : 'mischia';

  return (
    <section className="unit-panel parchment">
      <header>
        <h2>{def.name}</h2>
        <span className={`tag tag--${unit.team}`}>{mine ? 'Alleato' : 'Nemico'}</span>
      </header>
      <div className="stats">
        <Bar value={unit.hp} max={def.maxHp} label="HP" />
        {unit.guard > 0 && <span className="guard">Guardia {unit.guard}</span>}
        <span>
          Mov {def.move}
          {unit.moveBonus > 0 && ` +${unit.moveBonus}`}
        </span>
        <span>
          Attacco {def.attack.damage} ({attack})
        </span>
      </div>
      <p className="ability">
        <strong>{def.ability.name}</strong>: {def.ability.description}
        {unit.cooldown > 0 && <em> (in ricarica: {unit.cooldown})</em>}
      </p>
      {mine && (
        <div className="unit-panel__actions">
          <button
            className={`btn ${ui.mode === 'ability' ? 'btn--active' : ''}`}
            disabled={!canUse || !abilityReady}
            onClick={() => void dispatch(abilityPressed())}
          >
            {def.ability.name}
          </button>
          <button
            className="btn btn--ghost"
            disabled={ui.busy || game.activeTeam !== 'player' || unit.stage === 'done'}
            onClick={() => void dispatch(endActivationPressed())}
          >
            Fine attivazione
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: `src/ui/CardIcon.tsx` e `src/ui/CardHand.tsx`**

`src/ui/CardIcon.tsx`:
```tsx
import type { CardId } from '../engine/types';

const ICONS: Record<CardId, string> = {
  forcedMarch: 'M3 17h4l3-6 3 6h4L12 7h-4z M3 21h18v-2H3z',
  holdTheLine: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  focusFire: 'M11 2h2v5h-2z M11 17h2v5h-2z M2 11h5v2H2z M17 11h5v2h-5z M12 9a3 3 0 110 6 3 3 0 010-6z',
  charge: 'M2 20L17 5h-3V3h7v7h-2V7L4 22z',
  rally: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  precision: 'M12 3l9 9-9 9-9-9z M12 8l-4 4 4 4 4-4z',
};

export function CardIcon({ id }: { id: CardId }) {
  return (
    <svg className="card__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[id]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
```

`src/ui/CardHand.tsx`:
```tsx
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { CARD_DEFS, cardBlockReason } from '../engine/cards';
import { cardSelected, messageSet } from '../game/gameSlice';
import { CardIcon } from './CardIcon';

export function CardHand() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.game);
  const pending = useAppSelector((s) => s.game.pendingCard);
  const busy = useAppSelector((s) => s.game.busy);
  if (!game) return null;
  const deck = game.decks.player;

  return (
    <section className="hand" aria-label="Carte-ordine">
      {deck.hand.map((cardId, i) => {
        const def = CARD_DEFS[cardId];
        const reason = busy ? 'Attendi la fine dell’azione.' : cardBlockReason(game, 'player', cardId);
        const selected = pending === i;
        return (
          <button
            key={`${cardId}-${i}`}
            className={`card ${selected ? 'card--selected' : ''}`}
            disabled={reason !== null}
            title={reason ?? def.description}
            aria-pressed={selected}
            onClick={() => {
              dispatch(cardSelected(selected ? null : i));
              if (!selected) {
                dispatch(messageSet(`${def.name}: scegli un ${def.target === 'enemy' ? 'nemico' : 'alleato'} evidenziato.`));
              }
            }}
          >
            <CardIcon id={cardId} />
            <span className="card__name">{def.name}</span>
            <span className="card__text">{def.description}</span>
            {reason && <span className="card__reason">{reason}</span>}
          </button>
        );
      })}
      <p className="hand__meta">
        Mazzo {deck.draw.length} · Scarti {deck.discard.length}
      </p>
    </section>
  );
}
```

- [ ] **Step 8: `src/ui/ui.css`**

```css
:root {
  --bg: #120d18;
  --ink: #2a1d14;
  --parch: #e6d3a3;
  --parch-2: #d4bd86;
  --frame: #3b2a20;
  --frame-2: #5a4030;
  --ember: #e0782a;
  --ember-2: #f3b34c;
  --blue: #3f6fb5;
  --red: #b0463c;
  --muted: #9a8daa;
  --text: #efe6d2;
  --font-title: 'Pixelify Sans', ui-monospace, monospace;
  --font-body: Georgia, 'Times New Roman', serif;
  color-scheme: dark;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: radial-gradient(ellipse at 50% 30%, #2a1b2c 0%, var(--bg) 70%);
  color: var(--text);
  font-family: var(--font-body);
}
button { font: inherit; }
.title { font-family: var(--font-title); letter-spacing: 0.04em; margin: 0; }

.parchment {
  background: linear-gradient(180deg, var(--parch), var(--parch-2));
  color: var(--ink);
  border: 3px solid var(--frame);
  box-shadow: inset 0 0 0 2px var(--frame-2), 0 6px 0 #0006;
  border-radius: 4px;
}

.btn {
  font-family: var(--font-title);
  background: var(--frame);
  color: var(--parch);
  border: 2px solid #000;
  box-shadow: inset 0 -3px 0 #0007, inset 0 2px 0 #fff2;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  border-radius: 3px;
}
.btn:hover:not(:disabled) { background: var(--frame-2); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn--primary { background: #8a3a22; color: #fff1d6; }
.btn--primary:hover:not(:disabled) { background: #a2472a; }
.btn--ghost { background: transparent; color: var(--text); border-color: #ffffff33; }
.btn--active { background: var(--ember); color: #1b0f08; }
.btn:focus-visible, .card:focus-visible, .level:focus-within, .hud__roster button:focus-visible {
  outline: 2px solid var(--ember-2);
  outline-offset: 2px;
}

/* schermata iniziale */
.start { min-height: 100%; display: grid; place-items: center; padding: 16px; }
.start__panel { width: min(560px, 100%); padding: 28px; display: grid; gap: 18px; }
.start .title { font-size: clamp(2.6rem, 9vw, 4rem); color: #6b2316; text-align: center; }
.start__lead { text-align: center; margin: 0; font-style: italic; }
.levels { border: 0; padding: 0; margin: 0; display: grid; gap: 8px; }
.levels legend { font-family: var(--font-title); margin-bottom: 6px; }
.level {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  padding: 10px 12px;
  border: 2px solid #3b2a2055;
  border-radius: 3px;
  cursor: pointer;
}
.level input { grid-row: span 2; accent-color: #8a3a22; }
.level span { font-size: 0.9rem; }
.level--active { border-color: var(--frame); background: #fff3; }
.level--locked { opacity: 0.55; cursor: not-allowed; border-style: dashed; }
.end__unlock { margin: 0; font-family: var(--font-title); color: #8a3a22; }
.howto h2 { font-family: var(--font-title); font-size: 1rem; margin: 0 0 6px; }
.howto ul { margin: 0; padding-left: 18px; font-size: 0.9rem; }

/* battaglia */
.battle { height: 100%; display: grid; grid-template-rows: auto 1fr auto; }
.battle__field { position: relative; min-height: 260px; }
.battlefield { position: absolute; inset: 0; }
.battle__bar { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 12px; padding: 0 16px 12px; }

.hud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 10px 16px;
  background: #0b0710cc;
  border-bottom: 2px solid #000;
}
.hud__turn { display: flex; gap: 10px; align-items: baseline; font-family: var(--font-title); }
.hud__round { color: var(--muted); }
.hud__team { padding: 2px 10px; border-radius: 2px; }
.hud__team--player { background: var(--blue); }
.hud__team--ai { background: var(--red); }
.hud__roster { display: flex; gap: 6px; list-style: none; margin: 0; padding: 0; }
.hud__roster button {
  background: #ffffff10;
  color: var(--text);
  border: 1px solid #ffffff22;
  padding: 3px 8px;
  cursor: pointer;
  border-radius: 2px;
  font-size: 0.85rem;
}
.hud__roster em { color: var(--ember-2); font-style: normal; font-size: 0.75rem; }
.hud__roster .is-done button { opacity: 0.55; }
.hud__roster .is-done em { color: var(--muted); }
.hud__message { flex: 1; min-width: 160px; margin: 0; color: var(--ember-2); font-style: italic; min-height: 1.2em; }
.hud__actions { display: flex; gap: 8px; }

.unit-panel { padding: 12px 14px; display: grid; gap: 8px; align-content: start; }
.unit-panel header { display: flex; justify-content: space-between; align-items: center; }
.unit-panel h2 { font-family: var(--font-title); margin: 0; font-size: 1.15rem; }
.unit-panel--empty { place-items: center; color: #2a1d1499; }
.tag { font-size: 0.75rem; padding: 1px 6px; color: #fff; border-radius: 2px; }
.tag--player { background: var(--blue); }
.tag--ai { background: var(--red); }
.stats { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 0.85rem; align-items: center; }
.bar { position: relative; display: inline-block; width: 120px; height: 16px; background: #2a1d14; border: 1px solid #000; }
.bar__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(#7fbf62, #4f8a3e); }
.bar__text { position: relative; font-size: 0.7rem; color: #fff; padding-left: 4px; line-height: 16px; font-family: var(--font-title); }
.guard { color: #2c4f8a; font-weight: bold; }
.ability { margin: 0; font-size: 0.85rem; }
.unit-panel__actions { display: flex; gap: 8px; flex-wrap: wrap; }

.hand { display: flex; gap: 10px; align-items: stretch; overflow-x: auto; padding-top: 10px; }
.card {
  width: 150px;
  flex: 0 0 auto;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 4px;
  text-align: left;
  padding: 10px;
  cursor: pointer;
  background: linear-gradient(180deg, #efe0b8, #d8c08a);
  color: var(--ink);
  border: 3px solid var(--frame);
  box-shadow: inset 0 0 0 2px #8a3a2244, 0 4px 0 #0007;
  border-radius: 4px;
  transition: transform 0.12s;
}
.card:hover:not(:disabled) { transform: translateY(-4px); }
.card--selected { transform: translateY(-8px); border-color: var(--ember); box-shadow: inset 0 0 0 2px var(--ember), 0 0 14px #e0782a88; }
.card:disabled { filter: grayscale(0.7); opacity: 0.6; cursor: not-allowed; }
.card__icon { width: 22px; height: 22px; color: #6b2316; }
.card__name { font-family: var(--font-title); font-size: 0.95rem; }
.card__text { font-size: 0.75rem; line-height: 1.25; }
.card__reason { font-size: 0.7rem; color: #6b2316; font-style: italic; }
.hand__meta { align-self: end; color: var(--muted); font-size: 0.8rem; margin: 0; white-space: nowrap; }

.end { position: fixed; inset: 0; background: #07040acc; display: grid; place-items: center; padding: 16px; }
.end__panel { padding: 28px 32px; text-align: center; display: grid; gap: 14px; width: min(420px, 100%); }
.end__panel .title { font-size: 2.6rem; color: #6b2316; }
.end__actions { display: flex; gap: 10px; justify-content: center; }
.end .btn--ghost { color: var(--ink); border-color: #3b2a2066; }

@media (max-width: 760px) {
  .battle__bar { grid-template-columns: 1fr; }
  .hud__roster { order: 3; width: 100%; overflow-x: auto; }
  .card { width: 132px; }
}

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
}
```

- [ ] **Step 9: Build, lint e test**

Run: `npm run build`, poi `npm run lint`, poi `npm test`
Expected: tutti e tre senza errori. Se il lint segnala `react-refresh/only-export-components`, spostare in un file `.ts` le costanti esportate dal componente.

- [ ] **Step 10: Verifica nel browser**

Run: `npm run dev` e aprire l'URL indicato (di solito `http://localhost:5173`).

Controlli, tutti con la console del browser aperta:
1. La schermata iniziale mostra il titolo, 3 livelli e "Inizia la battaglia".
2. Il campo è isometrico, la griglia è invisibile, le unità poggiano sul terreno senza basi, i bracieri fanno luce, si vedono braci e vignettatura.
3. Clic su un soldato: compaiono indicatore, celle raggiungibili e percorso al passaggio del mouse. Il soldato cammina cella per cella.
4. Attacco in mischia e a distanza: si vedono lo scatto, il quadrello, il lampo e il numero di danno.
5. Una carta: appaiono i bersagli viola, poi l'effetto. Una seconda carta nella stessa fase risulta disattivata con il motivo.
6. "Fine fase": banner, poi il turno AI animato e il ritorno al giocatore. Durante il turno AI i clic non hanno effetto.
7. "Ricomincia" durante il turno AI: parte una partita pulita, senza azioni AI residue.
8. Partita completa fino a vittoria o sconfitta. Una vittoria a Recluta sblocca Veterano: "Affronta il livello successivo" avvia Veterano. Ricaricando la pagina, Veterano resta sbloccato.
9. Finestra stretta (circa 400 px): nessuno scroll orizzontale della pagina, il pannello va sotto il campo.
10. Con "Emula prefers-reduced-motion" negli strumenti di sviluppo, le animazioni sono quasi istantanee e il gioco resta comprensibile.
11. In console non ci sono errori, a parte eventuali warning di StrictMode.

Ogni problema trovato si corregge prima del checkpoint.

- [ ] **Step 11: Checkpoint**

L'utente committa tutto (`src/`, `index.html`, file eliminati). Messaggio: `feat(ui): interfaccia di gioco completa`.

---

### Task 12: Verifica finale e documentazione

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: tutto il progetto.
- Produces: README con avvio, regole, architettura, asset provvisori e limiti.

- [ ] **Step 1: Sostituire `README.md`**

````markdown
# Bannerfall

Tactical RPG isometrico a turni nel browser: tre soldati contro tre, carte-ordine e un'AI a tre livelli.

## Avvio

```bash
npm install
npm run dev      # sviluppo, http://localhost:5173
npm test         # test del motore e delle AI
npm run build    # build di produzione in dist/
```

## Come si gioca

- Clicca un tuo soldato, poi una casella evidenziata per muoverlo (una volta per attivazione).
- Clicca un nemico evidenziato in rosso per attaccarlo; il pulsante dell'abilità attiva la modalità abilità.
- Ogni soldato agisce una volta per fase. "Fine fase" passa il turno al nemico.
- Una carta-ordine per fase: selezionala e clicca un bersaglio evidenziato in viola.
- Vince chi elimina tutte le unità avversarie.

## Regole in breve

| Unità | HP | Mov | Attacco | Abilità |
|---|---|---|---|---|
| Guardiano | 12 | 3 | mischia 3 | Parata: +3 guardia |
| Esploratore | 8 | 4 | mischia 3 | Fendente coordinato: 4 danni, 5 con un altro alleato adiacente al bersaglio |
| Balestriere | 7 | 3 | distanza 2–4, 2 danni | Tiro mirato: 3 danni a distanza 2–5, ricarica 2 |

- Distanze Manhattan, movimento in 4 direzioni.
- Linea di vista bloccata solo da ostacoli solidi.
- Il Balestriere non tira se ha un nemico adiacente.
- La guardia assorbe i danni prima degli HP e scade all'inizio della successiva fase della squadra.
- I valori sono in `src/engine/units.ts` e `src/engine/cards.ts`.

## Architettura

- `src/engine/`: motore puro e deterministico. `applyAction(state, action)` valida e restituisce `{ state, events }`.
- `src/ai/`: facile (avido con scelta casuale a seed fra i 3 migliori), intermedio (valutazione su un livello), difficile (migliori 6 candidati, simulazione della risposta avversaria, budget di 300 ms).
- `src/game/`: Redux Toolkit (stato serializzabile), thunk, driver della fase AI.
- `src/render/`: PixiJS v8. La scena riproduce gli eventi del motore con una coda di animazione, che non modifica mai lo stato.
- `src/ui/`: componenti React.

## Asset provvisori

Tutta la grafica è generata da codice ed è **provvisoria**:

- soldati: matrici di pixel 12×16 in `src/render/spriteFactory.ts`;
- terreno e oggetti: `src/render/terrain.ts`;
- luci, braci e vignettatura: `src/render/effects.ts`.

Per sostituire gli sprite basta modificare `src/render/assetMap.ts`, che deve restituire texture con i piedi sul bordo inferiore. Le regole non cambiano.

Il riferimento stilistico è `docs/references/battlefield-reference.png`.

## Limiti noti

- Nessun audio.
- Niente animazioni a fotogrammi degli sprite: idle e camminata sono interpolazioni.
- L'AI difficile usa una ricerca limitata, non un minimax completo. Se scatta il tetto di tempo, la scelta può dipendere dalla velocità della macchina.
- L'ordinamento in profondità della tenda (2×2) è approssimato.
- Le carte Carica e Marcia forzata non si combinano mai, per via del limite di una carta per fase.
````

- [ ] **Step 2: Verifica completa**

Run: `npm test`
Expected: PASS su tutti i file di test. Annotare il numero di test e la durata.

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

Run: `npm run lint`
Expected: nessun errore.

Riportare all'utente i risultati reali di questi comandi, senza dichiarare superato nulla che non sia stato eseguito.

- [ ] **Step 3: Checkpoint finale**

L'utente committa `README.md`. Messaggio: `docs: README con avvio, regole, architettura e limiti`.
