import { AnimatedSprite, Container, Graphics } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { posKey } from '../engine/arena';
import { UNIT_DEFS } from '../engine/units';
import type { Arena, GameState, Pos, Unit } from '../engine/types';
import { EMPTY_OVERLAY } from '../game/selectors';
import type { Overlay } from '../game/selectors';
import { unitArt } from './assetMap';
import { pickUnitAt } from './pick';
import type { LoadedArt, PropArtMap, UnitArt } from './assetMap';
import { TILE_H, TILE_W, depthOf, toScreen } from './iso';
import { drawProp, drawTerrain } from './terrain';

export interface UnitView {
  root: Container;
  body: AnimatedSprite;
  art: UnitArt;
  /** tinta a riposo (squadra + già attivato); gli effetti la ripristinano */
  tint: number;
  bar: Graphics;
  /** copia locale usata per disegnare durante le animazioni */
  unit: Unit;
}

export const UNIT_DEPTH_OFFSET = 5;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
export const IDLE_SPEED = 0.1;

/** I due schieramenti hanno personaggi diversi, quindi nessuna tinta di squadra: solo i soldati già attivati sono più scuri. */
export function unitTint(done: boolean): number {
  return done ? 0x8a8a9a : 0xffffff;
}

export class BattleScene {
  readonly root = new Container();
  readonly world = new Container();
  readonly actors = new Container();
  readonly fx = new Container();
  private readonly overlayLayer = new Graphics();
  private readonly hoverLayer = new Graphics();
  private readonly views = new Map<string, UnitView>();
  private overlay: Overlay = EMPTY_OVERLAY;

  private readonly art: LoadedArt;

  constructor(arena: Arena, art: LoadedArt, ground: Texture | null = null, props: PropArtMap = {}) {
    this.art = art;
    this.actors.sortableChildren = true;
    this.root.addChild(this.world);
    this.world.addChild(drawTerrain(arena, ground), this.overlayLayer, this.hoverLayer, this.actors, this.fx);
    for (const prop of arena.props) this.actors.addChild(drawProp(prop, props));
  }

  view(id: string): UnitView | undefined {
    return this.views.get(id);
  }

  /** Cella dell'unità il cui corpo copre il punto (coordinate mondo), se c'è. */
  unitCellAt(point: { x: number; y: number }): Pos | null {
    const list = [...this.views].map(([id, v]) => ({ id, x: v.root.x, y: v.root.y, z: v.root.zIndex }));
    const id = pickUnitAt(point, list);
    return id ? { ...this.views.get(id)!.unit.pos } : null;
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
      view.tint = unitTint(unit.team === state.activeTeam && unit.stage === 'done');
      view.body.tint = view.tint;
      this.drawBar(view);
    }
  }

  placeAt(view: UnitView, p: { x: number; y: number }): void {
    const s = toScreen(p);
    view.root.position.set(s.x, s.y + 4);
    view.root.zIndex = depthOf(p) + UNIT_DEPTH_OFFSET;
  }

  face(view: UnitView, dx: number): void {
    if (dx !== 0) view.body.scale.x = Math.sign(dx) * (view.art.facesLeft ? -1 : 1) * view.art.scale;
  }

  drawBar(view: UnitView): void {
    const max = UNIT_DEFS[view.unit.archetype].maxHp;
    const w = 30;
    const g = view.bar;
    const { art } = view;
    const idle = art.idle[0]; // sempre l'idle: la barra non salta mentre si mostra la pose di corsa
    // altezza testa: dai piedi (ancora) al bordo alto, meno il margine vuoto dei frame delle sheet
    const top = -Math.round(idle.height * (idle.defaultAnchor?.y ?? 1) * art.scale - (art.attack.length > 0 ? 5 * art.scale : 0) + 8);
    g.clear();
    g.rect(-w / 2 - 1, top, w + 2, 6).fill(0x140e14);
    g.rect(-w / 2, top + 1, Math.max(0, (w * view.unit.hp) / max), 4).fill(view.unit.team === 'player' ? 0x6fb35a : 0xd0533f);
    if (view.unit.guard > 0) g.rect(-w / 2, top - 3, Math.min(w, view.unit.guard * 5), 2).fill(0x7fb2ff);
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
    const art = unitArt(unit.team, unit.archetype, this.art);
    const body = new AnimatedSprite({ textures: art.idle, animationSpeed: IDLE_SPEED, loop: true, updateAnchor: true });
    body.anchor.set(0.5, 1);
    const right = unit.team === 'ai' ? -1 : 1;
    body.scale.set(right * (art.facesLeft ? -1 : 1) * art.scale, art.scale);
    body.tint = unitTint(false);
    body.play();
    const bar = new Graphics();
    root.addChild(shadow, body, bar);
    this.actors.addChild(root);
    const view: UnitView = { root, body, art, tint: body.tint, bar, unit: { ...unit, pos: { ...unit.pos } } };
    this.views.set(unit.id, view);
    return view;
  }
}
