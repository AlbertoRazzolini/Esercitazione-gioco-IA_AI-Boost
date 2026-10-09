import { describe, expect, it } from 'vitest';
import { pickUnitAt } from './pick';

const u = (id: string, x: number, y: number, z = 0) => ({ id, x, y, z });

describe('pickUnitAt', () => {
  const units = [u('a', 100, 100)];
  it('il torso seleziona l\'unità', () => expect(pickUnitAt({ x: 100, y: 60 }, units)).toBe('a'));
  it('troppo a destra: nessuna', () => expect(pickUnitAt({ x: 130, y: 60 }, units)).toBeNull());
  it('troppo sotto i piedi: nessuna', () => expect(pickUnitAt({ x: 100, y: 120 }, units)).toBeNull());
  it('troppo sopra la testa: nessuna', () => expect(pickUnitAt({ x: 100, y: 20 }, units)).toBeNull());
  it('sovrapposte: vince lo z più alto', () => {
    expect(pickUnitAt({ x: 100, y: 90 }, [u('a', 100, 100, 1), u('b', 100, 110, 5), u('c', 100, 95, 3)])).toBe('b');
  });
  it('lista vuota', () => expect(pickUnitAt({ x: 0, y: 0 }, [])).toBeNull());
});
