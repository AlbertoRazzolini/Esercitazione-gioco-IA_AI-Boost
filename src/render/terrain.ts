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
