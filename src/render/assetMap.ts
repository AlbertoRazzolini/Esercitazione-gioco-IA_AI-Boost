import { Assets, Rectangle, Texture } from 'pixi.js';
import type { Arena, Archetype, Team } from '../engine/types';
import { groundBounds, groundTransform } from './groundGeometry';
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

/** Risoluzione del terreno proiettato rispetto alle coordinate del mondo (2 = nitido anche su schermi densi). */
export const GROUND_SCALE = 2;
export const GROUND_URL = '/map/ground.png';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Immagine non caricata: ${url}`));
    img.src = url;
  });
}

/**
 * Terreno dipinto: l'immagine vista dall'alto viene proiettata una sola volta sul rombo isometrico
 * (con filtraggio di qualità) e restituita come texture. Se il caricamento fallisce restituisce null
 * e la scena usa il terreno disegnato da codice.
 */
export async function loadGround(arena: Arena): Promise<Texture | null> {
  try {
    const img = await loadImage(import.meta.env.BASE_URL + GROUND_URL.replace(/^\//, ''));
    const bounds = groundBounds(arena.width, arena.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bounds.w * GROUND_SCALE);
    canvas.height = Math.round(bounds.h * GROUND_SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const m = groundTransform(img.naturalWidth, img.naturalHeight, arena.width, arena.height, {
      originX: bounds.x,
      originY: bounds.y,
      scale: GROUND_SCALE,
    });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(img, 0, 0);
    return Texture.from(canvas);
  } catch (error) {
    console.warn('Terreno dipinto non caricato, uso quello procedurale:', error);
    return null;
  }
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
