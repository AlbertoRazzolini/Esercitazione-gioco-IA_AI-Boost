import { Graphics, Text } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { CARD_DEFS } from '../engine/cards';
import type { CardId, GameEvent, GameState, Pos } from '../engine/types';
import type { Effects } from './effects';
import { WORLD_W, toScreen } from './iso';
import { IDLE_SPEED } from './scene';
import type { BattleScene, UnitView } from './scene';
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
    const anim = this.attackFrames(view, 0.3);
    await tween(this.ticker, 90, (k) => view.root.position.set(sx + dx * k, sy + dy * k));
    await tween(this.ticker, 140, (k) => view.root.position.set(sx + dx * (1 - k), sy + dy * (1 - k)));
    await anim;
  }

  /** Riproduce una volta i frame d'attacco (se esistono) e poi torna all'idle. Non resta mai appeso. */
  private async attackFrames(view: UnitView, speed: number): Promise<void> {
    const frames = view.art.attack;
    if (frames.length === 0) return;
    const body = view.body;
    body.textures = frames;
    body.loop = false;
    body.animationSpeed = speed;
    body.play();
    const ms = Math.min(1000, (frames.length / (speed * 60)) * 1000) + 60;
    await tween(this.ticker, ms, () => undefined);
    if (body.destroyed) return;
    body.textures = view.art.idle;
    body.loop = true;
    body.animationSpeed = IDLE_SPEED;
    body.play();
  }

  private async shoot(attackerId: string, targetId: string): Promise<void> {
    const view = this.scene.view(attackerId);
    const target = this.scene.view(targetId);
    if (!view || !target) return;
    this.scene.face(view, target.root.x - view.root.x);
    const from = { x: view.root.x, y: view.root.y - 34 };
    const to = { x: target.root.x, y: target.root.y - 30 };
    const { art } = view;
    const anim = this.attackFrames(view, art.attackSpeed ?? 0.4);
    // il proiettile parte a metà dell'animazione (tensione dell'arco, lancio dell'incantesimo)
    if (art.attack.length > 0) await tween(this.ticker, art.launchMs ?? 380, () => undefined);
    const fire = art.projectile === 'fire';
    const missile = fire ? this.fireball() : this.bolt();
    missile.rotation = fire ? 0 : Math.atan2(to.y - from.y, to.x - from.x);
    missile.position.set(from.x, from.y);
    this.scene.fx.addChild(missile);
    await tween(this.ticker, fire ? 300 : 220, (k) => {
      missile.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k));
      if (fire) missile.scale.set(1 + Math.sin(k * 14) * 0.12);
    });
    missile.destroy();
    if (fire) await this.burst(to);
    await anim;
  }

  private bolt(): Graphics {
    return new Graphics().rect(-7, -1, 14, 2).fill(0xe8dcc0).rect(5, -2, 3, 4).fill(0x9aa0b0);
  }

  private fireball(): Graphics {
    const g = new Graphics();
    g.circle(0, 0, 13).fill({ color: 0xff7a1f, alpha: 0.3 });
    g.circle(0, 0, 8).fill(0xf08a2a);
    g.circle(0, 0, 4).fill(0xffd36b);
    g.blendMode = 'add';
    return g;
  }

  /** Piccolo scoppio di fuoco all'impatto. */
  private async burst(at: { x: number; y: number }): Promise<void> {
    const ring = new Graphics();
    ring.position.set(at.x, at.y);
    ring.blendMode = 'add';
    this.scene.fx.addChild(ring);
    await tween(this.ticker, 220, (k) => {
      ring.clear();
      ring.circle(0, 0, 6 + 20 * k).fill({ color: 0xff8a2a, alpha: 0.55 * (1 - k) });
      ring.circle(0, 0, 3 + 10 * k).fill({ color: 0xffd36b, alpha: 0.8 * (1 - k) });
    });
    ring.destroy();
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
    view.body.tint = view.tint;
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
