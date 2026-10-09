import type { Texture } from 'pixi.js';
import type { Archetype, Team } from '../engine/types';
import { proceduralUnitTexture } from './spriteFactory';

/**
 * Unico punto di sostituzione degli sprite. Per usare sprite definitivi: caricare le texture
 * (es. `Assets.load`) e restituirle qui. Le regole di gioco non dipendono da questo file.
 * Le texture sono disegnate con i piedi sul bordo inferiore (anchor 0.5, 1).
 */
export const assetMap = {
  unit: (team: Team, archetype: Archetype): Texture => proceduralUnitTexture(team, archetype),
};
