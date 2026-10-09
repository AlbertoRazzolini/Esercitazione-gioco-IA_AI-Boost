import type { GameEvent } from '../engine/types';

type EventPlayer = (events: GameEvent[]) => Promise<void>;

export const ANIMATION_TIMEOUT_MS = 4000;

let player: EventPlayer | null = null;

/** Il renderer si registra qui; resta fuori dallo store perché contiene funzioni e oggetti PixiJS. */
export function registerAnimator(p: EventPlayer | null): void {
  player = p;
}

/** Riproduce gli eventi. Si risolve sempre, anche se l'animazione fallisce o si blocca. */
export function playEvents(events: GameEvent[]): Promise<void> {
  if (!player || events.length === 0) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ANIMATION_TIMEOUT_MS);
  });
  const run = player(events).catch((error: unknown) => console.warn('Animazione interrotta', error));
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}
