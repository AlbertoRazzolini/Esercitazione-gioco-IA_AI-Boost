import type { Ticker } from 'pixi.js';

const reduced =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Con prefers-reduced-motion le animazioni durano quasi zero, ma le informazioni restano visibili. */
export const motion = { scale: reduced ? 0.05 : 1 };

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function tween(ticker: Ticker, ms: number, onUpdate: (t: number) => void): Promise<void> {
  const duration = ms * motion.scale;
  if (duration < 1) {
    onUpdate(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let elapsed = 0;
    const step = (t: Ticker) => {
      elapsed += t.deltaMS;
      const k = Math.min(1, elapsed / duration);
      onUpdate(k);
      if (k >= 1) {
        ticker.remove(step);
        resolve();
      }
    };
    ticker.add(step);
  });
}
