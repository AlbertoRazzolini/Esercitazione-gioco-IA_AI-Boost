import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { CARD_DEFS, cardBlockReason } from '../engine/cards';
import { cardSelected, messageSet } from '../game/gameSlice';
import { CardIcon } from './CardIcon';

export function CardHand() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.game);
  const pending = useAppSelector((s) => s.game.pendingCard);
  const busy = useAppSelector((s) => s.game.busy);
  const fx = useAppSelector((s) => s.game.cardFx);
  // la carta pescata brilla solo per le giocate avvenute dopo che la mano è comparsa
  const [mountFxId] = useState(() => fx?.id ?? 0);
  const [expiredId, setExpiredId] = useState(0);
  const fxId = fx?.id ?? 0;
  useEffect(() => {
    if (fxId <= mountFxId) return;
    const timer = setTimeout(() => setExpiredId(fxId), 900);
    return () => clearTimeout(timer);
  }, [fxId, mountFxId]);
  const drawnActive = fx !== null && fx.team === 'player' && fx.id > mountFxId && fx.id !== expiredId;
  if (!game) return null;
  const deck = game.decks.player;

  return (
    <section className="hand" aria-label="Carte-ordine">
      {deck.hand.map((cardId, i) => {
        const drawn = drawnActive && i === deck.hand.length - 1;
        const def = CARD_DEFS[cardId];
        const reason = busy ? 'Attendi la fine dell’azione.' : cardBlockReason(game, 'player', cardId);
        const selected = pending === i;
        return (
          <button
            key={`${cardId}-${i}`}
            className={`card ${selected ? 'card--selected' : ''} ${drawn ? 'card--drawn' : ''}`}
            disabled={reason !== null}
            title={reason ?? def.description}
            aria-pressed={selected}
            onClick={() => {
              dispatch(cardSelected(selected ? null : i));
              if (!selected) {
                dispatch(messageSet(`${def.name}: scegli un ${def.target === 'enemy' ? 'nemico' : 'alleato'} evidenziato.`));
              }
            }}
          >
            <CardIcon id={cardId} />
            <span className="card__name">{def.name}</span>
            <span className="card__text">{def.description}</span>
            {reason && <span className="card__reason">{reason}</span>}
          </button>
        );
      })}
      <p className="hand__meta">
        Mazzo {deck.draw.length} · Scarti {deck.discard.length}
      </p>
    </section>
  );
}
