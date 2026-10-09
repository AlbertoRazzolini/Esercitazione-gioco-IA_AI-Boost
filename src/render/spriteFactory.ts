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
