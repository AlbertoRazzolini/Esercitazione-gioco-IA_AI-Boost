import { nextRandom } from '../engine/rng';
import type { CardId } from '../engine/types';

/** Unica fonte dei colori degli effetti carta: `color` per Pixi, `css` per il DOM. */
export const CARD_FX: Record<CardId, { color: number; css: string }> = {
  forcedMarch: { color: 0xf3c45a, css: '#f3c45a' },
  charge: { color: 0xf08a2a, css: '#f08a2a' },
  holdTheLine: { color: 0x7fb2ff, css: '#7fb2ff' },
  focusFire: { color: 0xe0483c, css: '#e0483c' },
  rally: { color: 0x7fe08a, css: '#7fe08a' },
  precision: { color: 0xb88cff, css: '#b88cff' },
};

export interface SparkleSpec {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  duration: number;
}

/** Particelle deterministiche per seed: spostamento (px), dimensione (px), ritardo e durata (s). */
export function sparkleSpecs(count: number, seed: number): SparkleSpec[] {
  let state = seed | 0;
  const rand = (): number => {
    const [value, next] = nextRandom(state);
    state = next;
    return value;
  };
  const specs: SparkleSpec[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 70 + rand() * 70;
    specs.push({
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      size: 3 + Math.round(rand() * 4),
      delay: Math.round(rand() * 0.35 * 100) / 100,
      duration: Math.round((0.6 + rand() * 0.4) * 100) / 100,
    });
  }
  return specs;
}
