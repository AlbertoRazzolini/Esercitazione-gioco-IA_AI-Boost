import { describe, expect, it } from 'vitest';
import { SPRITE_MANIFEST, frameRects } from './spriteManifest';

describe('frameRects', () => {
  it('divide la sheet in celle uguali in ordine di lettura', () => {
    expect(frameRects(156, 176, { url: 'x', cols: 3, rows: 2, frames: 4 })).toEqual([
      { x: 0, y: 0, w: 52, h: 88 },
      { x: 52, y: 0, w: 52, h: 88 },
      { x: 104, y: 0, w: 52, h: 88 },
      { x: 0, y: 88, w: 52, h: 88 },
    ]);
  });

  it('prende solo i primi `frames` quando ci sono meno frame che celle', () => {
    const rects = frameRects(501, 400, { url: 'x', cols: 3, rows: 4, frames: 11 });
    expect(rects).toHaveLength(11);
    expect(rects[10]).toEqual({ x: 167, y: 300, w: 167, h: 100 });
  });

  it('arrotonda per difetto la dimensione del frame', () => {
    const [first, second] = frameRects(10, 7, { url: 'x', cols: 3, rows: 2, frames: 2 });
    expect(first).toEqual({ x: 0, y: 0, w: 3, h: 3 });
    expect(second.x).toBe(3);
  });

  it('non produce mai più frame delle celle', () => {
    expect(frameRects(30, 10, { url: 'x', cols: 3, rows: 1, frames: 9 })).toHaveLength(3);
  });
});

describe('SPRITE_MANIFEST', () => {
  const archetypes = ['guardian', 'scout', 'crossbow'] as const;

  it('descrive tre classi per ogni squadra con sheet coerenti', () => {
    for (const team of ['player', 'ai'] as const) {
      expect(Object.keys(SPRITE_MANIFEST[team]).sort()).toEqual([...archetypes].sort());
      for (const spec of Object.values(SPRITE_MANIFEST[team])) {
        for (const sheet of [spec.idle, spec.attack, ...(spec.move ? [spec.move] : [])]) {
          expect(sheet.frames).toBeGreaterThan(0);
          expect(sheet.frames).toBeLessThanOrEqual(sheet.cols * sheet.rows);
        }
      }
    }
  });

  it('ogni classe ha una sheet di corsa coerente', () => {
    for (const team of ['player', 'ai'] as const) {
      for (const a of archetypes) {
        const move = SPRITE_MANIFEST[team][a].move;
        expect(move).toBeDefined();
        expect(move!.url).toBe(`/sprites/${team}/${a}/move.png`);
        expect(move!.frames).toBeGreaterThanOrEqual(1);
        expect(move!.frames).toBeLessThanOrEqual(move!.cols * move!.rows);
      }
    }
  });

  it('il balestriere nemico (Lulu) lancia fuoco con la sua animazione di incantesimo', () => {
    const lulu = SPRITE_MANIFEST.ai.crossbow;
    expect(lulu.projectile).toBe('fire');
    expect(lulu.attack.url).toBe('/sprites/ai/crossbow/magic.png');
    expect(lulu.attack.frames).toBe(4);
    expect(SPRITE_MANIFEST.player.crossbow.projectile ?? 'bolt').toBe('bolt');
  });

  it('i tempi di lancio, se indicati, sono positivi', () => {
    for (const team of ['player', 'ai'] as const) {
      for (const spec of Object.values(SPRITE_MANIFEST[team])) {
        if (spec.attackSpeed !== undefined) expect(spec.attackSpeed).toBeGreaterThan(0);
        if (spec.launchMs !== undefined) expect(spec.launchMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('il nemico usa personaggi diversi da quelli del giocatore', () => {
    for (const a of archetypes) {
      expect(SPRITE_MANIFEST.ai[a].idle.url).not.toBe(SPRITE_MANIFEST.player[a].idle.url);
      expect(SPRITE_MANIFEST.ai[a].attack.url).not.toBe(SPRITE_MANIFEST.player[a].attack.url);
    }
  });
});
