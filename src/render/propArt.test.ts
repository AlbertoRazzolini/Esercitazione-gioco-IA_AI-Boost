import { describe, expect, it } from 'vitest';
import { keyPixel } from './propKey';
import { PROPS_SHEET, PROP_SPRITES } from './propManifest';

describe('keyPixel', () => {
  it('lo sfondo magenta diventa trasparente', () => {
    expect(keyPixel(255, 0, 255).a).toBe(0);
    expect(keyPixel(240, 0, 240).a).toBe(0);
    expect(keyPixel(224, 0, 224).a).toBe(0);
    expect(keyPixel(208, 8, 224).a).toBe(0);
  });

  it('il magenta scuro (ombra di contatto) diventa un\'ombra scura semitrasparente', () => {
    const shadow = keyPixel(96, 0, 96);
    expect(shadow.a).toBeGreaterThan(0);
    expect(shadow.a).toBeLessThan(255);
    expect(shadow.r).toBeLessThan(60);
    expect(shadow.b).toBeLessThan(60);
  });

  it('i colori degli oggetti restano intatti e opachi', () => {
    for (const [r, g, b] of [
      [100, 60, 40], // legno
      [180, 80, 80], // strisce rosse della tenda
      [230, 220, 200], // tela chiara
      [90, 40, 100], // ombra violacea dentro un oggetto
      [240, 140, 30], // fiamma
      [20, 20, 30], // contorno scuro
    ]) {
      expect(keyPixel(r, g, b)).toEqual({ r, g, b, a: 255 });
    }
  });
});

describe('PROP_SPRITES', () => {
  const entries = Object.entries(PROP_SPRITES);

  it('descrive tenda, rovina, braciere, carro, casse e staccionata', () => {
    expect(Object.keys(PROP_SPRITES).sort()).toEqual(['brazier', 'cart', 'crates', 'fence', 'ruin', 'tent']);
  });

  it('ogni riquadro sta dentro il foglio e ha il punto a terra al suo interno', () => {
    for (const [, s] of entries) {
      expect(s.rect.x).toBeGreaterThanOrEqual(0);
      expect(s.rect.y).toBeGreaterThanOrEqual(0);
      expect(s.rect.x + s.rect.w).toBeLessThanOrEqual(PROPS_SHEET.width);
      expect(s.rect.y + s.rect.h).toBeLessThanOrEqual(PROPS_SHEET.height);
      expect(s.foot.x).toBeGreaterThanOrEqual(s.rect.x);
      expect(s.foot.x).toBeLessThanOrEqual(s.rect.x + s.rect.w);
      expect(s.foot.y).toBeGreaterThanOrEqual(s.rect.y);
      expect(s.foot.y).toBeLessThanOrEqual(s.rect.y + s.rect.h);
      expect(s.scale).toBeGreaterThan(0);
    }
  });

  it('i riquadri non si sovrappongono', () => {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i][1].rect;
        const b = entries[j][1].rect;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${entries[i][0]} e ${entries[j][0]}`).toBe(false);
      }
    }
  });
});
