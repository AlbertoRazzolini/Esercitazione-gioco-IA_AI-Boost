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
