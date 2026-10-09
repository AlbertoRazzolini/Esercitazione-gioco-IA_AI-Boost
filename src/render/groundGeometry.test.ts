import { describe, expect, it } from 'vitest';
import { applyAffine, groundBounds, groundTransform } from './groundGeometry';
import { toScreen } from './iso';

const IMG_W = 1402;
const IMG_H = 1122;
const COLS = 12;
const ROWS = 9;

function expectPoint(actual: { x: number; y: number }, expected: { x: number; y: number }): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('groundGeometry', () => {
  const m = groundTransform(IMG_W, IMG_H, COLS, ROWS);

  it('gli angoli dell\'immagine finiscono sugli angoli del rombo della mappa', () => {
    expectPoint(applyAffine(m, 0, 0), toScreen({ x: -0.5, y: -0.5 }));
    expectPoint(applyAffine(m, IMG_W, 0), toScreen({ x: COLS - 0.5, y: -0.5 }));
    expectPoint(applyAffine(m, 0, IMG_H), toScreen({ x: -0.5, y: ROWS - 0.5 }));
    expectPoint(applyAffine(m, IMG_W, IMG_H), toScreen({ x: COLS - 0.5, y: ROWS - 0.5 }));
  });

  it('le due pozze di luce del prompt cadono sui due bracieri (celle 3,3 e 8,5)', () => {
    expectPoint(applyAffine(m, (3.5 / COLS) * IMG_W, (3.5 / ROWS) * IMG_H), toScreen({ x: 3, y: 3 }));
    expectPoint(applyAffine(m, (8.5 / COLS) * IMG_W, (5.5 / ROWS) * IMG_H), toScreen({ x: 8, y: 5 }));
  });

  it('il rettangolo che contiene il rombo è 672×336 a partire da (40, 84)', () => {
    expect(groundBounds(COLS, ROWS)).toEqual({ x: 40, y: 84, w: 672, h: 336 });
  });

  it('la trasformazione con scala 2 raddoppia le coordinate relative ai bounds', () => {
    const b = groundBounds(COLS, ROWS);
    const m2 = groundTransform(IMG_W, IMG_H, COLS, ROWS, { originX: b.x, originY: b.y, scale: 2 });
    const p = applyAffine(m2, IMG_W, IMG_H);
    const base = toScreen({ x: COLS - 0.5, y: ROWS - 0.5 });
    expectPoint(p, { x: (base.x - b.x) * 2, y: (base.y - b.y) * 2 });
  });
});
