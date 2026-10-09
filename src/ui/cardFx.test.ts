import { describe, expect, it } from 'vitest';
import { CARD_DEFS } from '../engine/cards';
import type { CardId } from '../engine/types';
import { CARD_FX, sparkleSpecs } from './cardFx';

const IDS = Object.keys(CARD_DEFS) as CardId[];

describe('CARD_FX', () => {
  it('copre tutte le carte con colori distinti e formati validi', () => {
    expect(Object.keys(CARD_FX).sort()).toEqual([...IDS].sort());
    const colors = IDS.map((id) => CARD_FX[id].color);
    expect(new Set(colors).size).toBe(IDS.length);
    for (const id of IDS) {
      expect(CARD_FX[id].css).toMatch(/^#[0-9a-f]{6}$/);
      expect(parseInt(CARD_FX[id].css.slice(1), 16)).toBe(CARD_FX[id].color);
    }
  });
});

describe('sparkleSpecs', () => {
  it('restituisce count elementi, deterministici per seed', () => {
    const a = sparkleSpecs(18, 5);
    expect(a).toHaveLength(18);
    expect(sparkleSpecs(18, 5)).toEqual(a);
    expect(sparkleSpecs(18, 6)).not.toEqual(a);
    expect(sparkleSpecs(0, 5)).toEqual([]);
  });

  it('i valori restano negli intervalli', () => {
    for (const s of sparkleSpecs(200, 123)) {
      expect(Math.abs(s.dx)).toBeLessThanOrEqual(140);
      expect(Math.abs(s.dy)).toBeLessThanOrEqual(140);
      expect(s.size).toBeGreaterThanOrEqual(3);
      expect(s.size).toBeLessThanOrEqual(7);
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThanOrEqual(0.35);
      expect(s.duration).toBeGreaterThanOrEqual(0.6);
      expect(s.duration).toBeLessThanOrEqual(1.0);
    }
  });
});
