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
  it('descrive i tre archetipi con sheet coerenti', () => {
    for (const spec of Object.values(SPRITE_MANIFEST)) {
      for (const sheet of [spec.idle, spec.attack]) {
        expect(sheet.frames).toBeGreaterThan(0);
        expect(sheet.frames).toBeLessThanOrEqual(sheet.cols * sheet.rows);
      }
    }
  });
});
