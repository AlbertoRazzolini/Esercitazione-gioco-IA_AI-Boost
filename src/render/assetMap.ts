import { Assets, Rectangle, Texture } from 'pixi.js';
import type { Archetype, Team } from '../engine/types';
import { SPRITE_SCALE, proceduralUnitTexture } from './spriteFactory';
import { SPRITE_MANIFEST, frameRects } from './spriteManifest';
import type { SheetSpec } from './spriteManifest';

/**
 * Unico punto di sostituzione degli sprite. Le sheet in `public/sprites` (vedi `spriteManifest.ts`)
 * hanno la precedenza; se un caricamento fallisce si usano gli sprite procedurali.
 * Le regole di gioco non dipendono da questo file.
 */
export interface UnitArt {
  idle: Texture[];
  attack: Texture[];
  scale: number;
  /** true se l'immagine originale guarda a sinistra */
  facesLeft: boolean;
  projectile: 'bolt' | 'fire';
  /** frame per tick dell'animazione d'attacco; se assente decide l'animatore */
  attackSpeed?: number;
  /** ms dopo i quali parte il proiettile; se assente decide l'animatore */
  launchMs?: number;
}

export type LoadedArt = Record<Team, Record<Archetype, UnitArt | null>>;

const TEAMS: Team[] = ['player', 'ai'];
const ARCHETYPES: Archetype[] = ['guardian', 'scout', 'crossbow'];

async function loadSheet(spec: SheetSpec): Promise<Texture[]> {
  const sheet = await Assets.load<Texture>(import.meta.env.BASE_URL + spec.url.replace(/^\//, ''));
  const source = sheet.source;
  source.scaleMode = 'nearest';
  return frameRects(source.width, source.height, spec).map(
    (r) =>
      new Texture({
        source,
        frame: new Rectangle(r.x, r.y, r.w, r.h),
        defaultAnchor: { x: (spec.footX ?? r.w / 2) / r.w, y: (spec.footY ?? r.h) / r.h },
      }),
  );
}

async function loadArchetype(team: Team, archetype: Archetype): Promise<UnitArt | null> {
  try {
    const m = SPRITE_MANIFEST[team][archetype];
    const [idle, attack] = await Promise.all([loadSheet(m.idle), loadSheet(m.attack)]);
    if (idle.length === 0) return null;
    return {
      idle,
      attack,
      scale: m.scale,
      facesLeft: true,
      projectile: m.projectile ?? 'bolt',
      attackSpeed: m.attackSpeed,
      launchMs: m.launchMs,
    };
  } catch (error) {
    console.warn('Sprite non caricati, uso quelli procedurali:', team, archetype, error);
    return null;
  }
}

export async function loadUnitArt(): Promise<LoadedArt> {
  const entries = await Promise.all(
    TEAMS.map(async (team) => {
      const byClass = await Promise.all(ARCHETYPES.map(async (a) => [a, await loadArchetype(team, a)] as const));
      return [team, Object.fromEntries(byClass)] as const;
    }),
  );
  return Object.fromEntries(entries) as LoadedArt;
}

export function unitArt(team: Team, archetype: Archetype, loaded: LoadedArt): UnitArt {
  return (
    loaded[team][archetype] ?? {
      idle: [proceduralUnitTexture(team, archetype)],
      attack: [],
      scale: SPRITE_SCALE,
      facesLeft: false,
      projectile: 'bolt',
    }
  );
}
