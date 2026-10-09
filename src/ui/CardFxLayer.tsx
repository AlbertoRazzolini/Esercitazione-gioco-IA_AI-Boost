import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppSelector } from '../app/hooks';
import { CARD_DEFS } from '../engine/cards';
import { CardIcon } from './CardIcon';
import { CARD_FX, sparkleSpecs } from './cardFx';

export const GHOST_MS = 1100;
const PARTICLES = 18;

/** Copia transitoria della carta giocata, con scintille. Visiva e non interattiva. */
export function CardFxLayer() {
  const fx = useAppSelector((s) => s.game.cardFx);
  const [doneId, setDoneId] = useState(0);
  const id = fx?.id ?? 0;

  useEffect(() => {
    if (id === 0) return;
    const timer = setTimeout(() => setDoneId(id), GHOST_MS + 100);
    return () => clearTimeout(timer);
  }, [id]);

  const specs = useMemo(() => sparkleSpecs(PARTICLES, id), [id]);
  if (!fx || fx.id === doneId) return null;

  const def = CARD_DEFS[fx.cardId];
  const enemy = fx.team === 'ai';
  const style = { '--fx': CARD_FX[fx.cardId].css } as CSSProperties;
  return (
    <div
      key={fx.id}
      className={`card-ghost ${enemy ? 'card-ghost--enemy' : 'card-ghost--player'}`}
      style={style}
      aria-hidden="true"
    >
      <div className="card-ghost__card">
        {enemy && <span className="card-ghost__caption">Il nemico gioca</span>}
        <CardIcon id={fx.cardId} />
        <span className="card__name">{def.name}</span>
      </div>
      {specs.map((p, i) => (
        <span
          key={i}
          className="card-ghost__spark"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--size': `${p.size}px`,
              '--delay': `${p.delay}s`,
              '--dur': `${p.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
