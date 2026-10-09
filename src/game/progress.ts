import type { Difficulty } from '../engine/types';

export const LEVEL_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const STORAGE_KEY = 'bannerfall.unlocked';

export function nextLevel(level: Difficulty): Difficulty | null {
  return LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1] ?? null;
}

/** Livelli sbloccati salvati nel browser; se il salvataggio non è disponibile resta solo il facile. */
export function loadUnlocked(): Difficulty[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const levels = LEVEL_ORDER.filter((l) => parsed.includes(l));
      if (levels.includes('easy')) return levels;
    }
  } catch {
    // storage bloccato o dati corrotti: si riparte dal facile
  }
  return ['easy'];
}

export function saveUnlocked(levels: Difficulty[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // non critico: la progressione vale solo per questa sessione
  }
}
