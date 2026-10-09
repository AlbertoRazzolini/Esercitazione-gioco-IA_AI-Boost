import { Assets, Rectangle, Texture } from 'pixi.js';
import type { Arena, Archetype, PropKind, Team } from '../engine/types';
import { MISPLACED_GLOWS, neutralizeGlow } from './groundGlow';
import { groundBounds, groundTransform } from './groundGeometry';
import { keyPixel } from './propKey';
import { PROPS_URL, PROP_SPRITES } from './propManifest';
import type { PropSprite } from './propManifest';
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
  /** corsa/camminata; vuoto se la sheet manca (si usa l'idle) */
  move: Texture[];
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
    const [idle, attack, move] = await Promise.all([
      loadSheet(m.idle),
      loadSheet(m.attack),
      // una sheet di corsa che non si carica non deve far scartare idle e attacco
      m.move ? loadSheet(m.move).catch(() => [] as Texture[]) : Promise.resolve([] as Texture[]),
    ]);
    if (idle.length === 0) return null;
    return {
      idle,
      attack,
      move,
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
    // sorgente intermedia: qui si spengono le pozze di luce dipinte fuori posto
    const source = document.createElement('canvas');
    source.width = img.naturalWidth;
    source.height = img.naturalHeight;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) return null;
    sourceCtx.drawImage(img, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
    for (const spot of MISPLACED_GLOWS) neutralizeGlow(pixels.data, source.width, source.height, spot);
    sourceCtx.putImageData(pixels, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(source, 0, 0);
    return Texture.from(canvas);
  } catch (error) {
    console.warn('Terreno dipinto non caricato, uso quello procedurale:', error);
    return null;
  }
}

export interface PropArt {
  texture: Texture;
  /** punto a terra nella texture, in frazioni (0–1) */
  anchor: { x: number; y: number };
  /** scala con cui disegnare la texture nel mondo */
  scale: number;
}

export type PropArtMap = Partial<Record<PropKind, PropArt>>;

/** Gli oggetti vengono ridotti alla scala di gioco una volta sola, a questa risoluzione (come il terreno). */
export const PROP_RENDER = 2;

/**
 * Oggetti dipinti: toglie lo sfondo magenta dal foglio, ritaglia ogni oggetto e lo riduce con filtraggio
 * di qualità. Se il caricamento fallisce restituisce una mappa vuota e la scena li disegna da codice.
 */
export async function loadPropArt(): Promise<PropArtMap> {
  try {
    const img = await loadImage(import.meta.env.BASE_URL + PROPS_URL.replace(/^\//, ''));
    const sheet = document.createElement('canvas');
    sheet.width = img.naturalWidth;
    sheet.height = img.naturalHeight;
    const sheetCtx = sheet.getContext('2d', { willReadFrequently: true });
    if (!sheetCtx) return {};
    sheetCtx.drawImage(img, 0, 0);
    const pixels = sheetCtx.getImageData(0, 0, sheet.width, sheet.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const k = keyPixel(data[i], data[i + 1], data[i + 2]);
      data[i] = k.r;
      data[i + 1] = k.g;
      data[i + 2] = k.b;
      data[i + 3] = k.a;
    }
    sheetCtx.putImageData(pixels, 0, 0);

    const result: PropArtMap = {};
    for (const [kind, spec] of Object.entries(PROP_SPRITES) as [PropKind, PropSprite][]) {
      const k = spec.scale * PROP_RENDER;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(spec.rect.w * k));
      canvas.height = Math.max(1, Math.round(spec.rect.h * k));
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sheet, spec.rect.x, spec.rect.y, spec.rect.w, spec.rect.h, 0, 0, canvas.width, canvas.height);
      result[kind] = {
        texture: Texture.from(canvas),
        anchor: { x: (spec.foot.x - spec.rect.x) / spec.rect.w, y: (spec.foot.y - spec.rect.y) / spec.rect.h },
        scale: 1 / PROP_RENDER,
      };
    }
    return result;
  } catch (error) {
    console.warn('Oggetti dipinti non caricati, uso quelli procedurali:', error);
    return {};
  }
}

export function unitArt(team: Team, archetype: Archetype, loaded: LoadedArt): UnitArt {
  return (
    loaded[team][archetype] ?? {
      idle: [proceduralUnitTexture(team, archetype)],
      attack: [],
      move: [],
      scale: SPRITE_SCALE,
      facesLeft: false,
      projectile: 'bolt',
    }
  );
}
