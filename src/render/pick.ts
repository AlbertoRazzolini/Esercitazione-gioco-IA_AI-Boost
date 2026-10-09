export const HIT_HALF_WIDTH = 22;
export const HIT_HEIGHT = 72;
export const HIT_BELOW = 8;

export interface PickableUnit {
  id: string;
  /** posizione dei piedi in coordinate mondo */
  x: number;
  y: number;
  z: number;
}

/** Id dell'unità il cui corpo contiene il punto (la più "davanti" se sovrapposte), o null. */
export function pickUnitAt(point: { x: number; y: number }, units: PickableUnit[]): string | null {
  let best: PickableUnit | null = null;
  for (const u of units) {
    const hit =
      point.x >= u.x - HIT_HALF_WIDTH && point.x <= u.x + HIT_HALF_WIDTH && point.y >= u.y - HIT_HEIGHT && point.y <= u.y + HIT_BELOW;
    if (hit && (!best || u.z > best.z)) best = u;
  }
  return best ? best.id : null;
}
