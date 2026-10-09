import { describe, expect, it } from 'vitest';
import { neutralizeGlow } from './groundGlow';

const W = 100;
const H = 100;
const SPOT = { u: 0.5, v: 0.5, rx: 0.2, ry: 0.2 };

/** Sfondo marrone scuro con un disco arancione brillante al centro. */
function image(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inside = Math.hypot(x - 50, y - 50) < 12;
      data[i] = inside ? 240 : 46;
      data[i + 1] = inside ? 140 : 31;
      data[i + 2] = inside ? 40 : 29;
      data[i + 3] = 255;
    }
  }
  return data;
}

const pixel = (data: Uint8ClampedArray, x: number, y: number) => {
  const i = (y * W + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
};

describe('neutralizeGlow', () => {
  it('riporta il centro della pozza al colore del terreno intorno', () => {
    const data = image();
    neutralizeGlow(data, W, H, SPOT);
    const c = pixel(data, 50, 50);
    expect(c.r).toBeLessThan(120);
    expect(c.r - c.b).toBeLessThan(60); // non più arancione acceso
  });

  it('non tocca i pixel fuori dall\'area della pozza', () => {
    const data = image();
    const before = pixel(data, 5, 5);
    const farRight = pixel(data, 95, 50);
    neutralizeGlow(data, W, H, SPOT);
    expect(pixel(data, 5, 5)).toEqual(before);
    expect(pixel(data, 95, 50)).toEqual(farRight);
  });

  it('lascia invariata l\'opacità', () => {
    const data = image();
    neutralizeGlow(data, W, H, SPOT);
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });

  it('è sicura vicino ai bordi dell\'immagine', () => {
    const data = image();
    expect(() => neutralizeGlow(data, W, H, { u: 0.02, v: 0.02, rx: 0.2, ry: 0.2 })).not.toThrow();
    expect(() => neutralizeGlow(data, W, H, { u: 0.98, v: 0.98, rx: 0.2, ry: 0.2 })).not.toThrow();
  });

  it('non fa niente se la zona è uniforme (nessuna pozza)', () => {
    const data = new Uint8ClampedArray(W * H * 4).fill(60);
    neutralizeGlow(data, W, H, SPOT);
    expect(pixel(data, 50, 50).r).toBeGreaterThan(25);
    expect(pixel(data, 50, 50).r).toBeLessThan(90);
  });
});
