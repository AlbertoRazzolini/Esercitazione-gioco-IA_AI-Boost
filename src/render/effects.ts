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

export interface EffectsOptions {
  /** disegna le fiamme da codice (false se il braciere dipinto ha già le sue) */
  flames: boolean;
  /** altezza della fiamma sopra la base del braciere, in pixel del mondo */
  fireHeight: number;
  /** intensità dell'alone luminoso (0–1): più bassa se il terreno ha già le pozze di luce dipinte */
  glow: number;
}

export const CODE_EFFECTS: EffectsOptions = { flames: true, fireHeight: 16, glow: 0.8 };
export const PAINTED_EFFECTS: EffectsOptions = { flames: false, fireHeight: 46, glow: 0.5 };

export class Effects {
  private readonly scene: BattleScene;
  private readonly ticker: Ticker;
  private readonly sources: { x: number; y: number }[] = [];
  private readonly flames: Graphics[] = [];
  private readonly glows: Sprite[] = [];
  private readonly embers: Ember[] = [];
  private time = 0;
  private readonly glowBase: number;

  constructor(scene: BattleScene, arena: Arena, ticker: Ticker, options: EffectsOptions = CODE_EFFECTS) {
    this.scene = scene;
    this.glowBase = options.glow;
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
      const source = { x: c.x, y: c.y - options.fireHeight };
      this.sources.push(source);
      const glow = new Sprite(glowTexture);
      glow.anchor.set(0.5);
      glow.position.set(source.x, source.y);
      glow.scale.set(2.2);
      glow.blendMode = 'add';
      scene.fx.addChild(glow);
      this.glows.push(glow);
      if (options.flames) {
        const flame = new Graphics();
        flame.position.set(source.x, source.y);
        flame.zIndex = depthOf(prop.cells[0]) + 1;
        scene.actors.addChild(flame);
        this.flames.push(flame);
      }
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
      g.alpha = this.glowBase + Math.sin(this.time / 140 + i) * 0.12;
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

  /** Scintille colorate e anello luminoso in (x, y). Si risolve sempre e non lascia oggetti. */
  async sparkleBurst(x: number, y: number, color: number): Promise<void> {
    const reducedMotion = motion.scale < 0.5;
    const ring = new Graphics();
    ring.position.set(x, y);
    ring.blendMode = 'add';
    this.scene.fx.addChild(ring);
    const parts: { g: Graphics; vx: number; vy: number }[] = [];
    if (!reducedMotion) {
      for (let i = 0; i < 14; i++) {
        const size = 2 + Math.round(Math.random());
        const g = new Graphics().rect(-size / 2, -size / 2, size, size).fill(color);
        g.blendMode = 'add';
        g.position.set(x, y);
        this.scene.fx.addChild(g);
        const angle = Math.random() * Math.PI * 2;
        const speed = 18 + Math.random() * 30;
        parts.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 14 });
      }
    }
    try {
      await tween(this.ticker, reducedMotion ? 600 : 700, (k) => {
        if (ring.destroyed) return;
        ring.clear();
        ring.circle(0, 0, 6 + 24 * k).fill({ color, alpha: 0.35 * (1 - k) });
        ring.circle(0, 0, 6 + 24 * k).stroke({ width: 2, color, alpha: 0.9 * (1 - k) });
        for (const p of parts) {
          if (p.g.destroyed) continue;
          p.g.position.set(x + p.vx * k, y + p.vy * k + 40 * k * k);
          p.g.alpha = 1 - k;
        }
      });
    } finally {
      ring.destroy();
      for (const p of parts) if (!p.g.destroyed) p.g.destroy();
    }
  }

  destroy(): void {
    this.ticker.remove(this.update);
  }
}
