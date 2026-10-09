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
import { loadUnitArt } from './assetMap';
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
      .then(async () => {
        const art = await loadUnitArt();
        const game = store.getState().game.game;
        // StrictMode in sviluppo smonta il componente mentre init/caricamento sono ancora in corso
        if (disposed || !game) {
          app.destroy(true, { children: true });
          return;
        }
        initialized = true;
        host.appendChild(app.canvas);

        const scene = new BattleScene(game.arena, art);
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
