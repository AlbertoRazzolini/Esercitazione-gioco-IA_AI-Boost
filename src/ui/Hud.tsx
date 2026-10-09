import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { UNIT_DEFS } from '../engine/units';
import { messageSet, returnedToStart, unitSelected } from '../game/gameSlice';
import { endPhasePressed, startGame } from '../game/thunks';

export function Hud() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.game);
  const busy = useAppSelector((s) => s.game.busy);
  const message = useAppSelector((s) => s.game.message);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => dispatch(messageSet(null)), 2500);
    return () => clearTimeout(timer);
  }, [message, dispatch]);

  if (!game) return null;
  const myTurn = game.activeTeam === 'player' && !game.winner;
  const roster = game.units.filter((u) => u.team === 'player');

  return (
    <header className="hud">
      <div className="hud__turn">
        <span className="hud__round">Round {game.round}</span>
        <span className={`hud__team ${myTurn ? 'hud__team--player' : 'hud__team--ai'}`}>
          {myTurn ? 'Il tuo turno' : 'Turno nemico'}
        </span>
      </div>
      <ul className="hud__roster">
        {roster.map((u) => (
          <li key={u.id} className={u.stage === 'done' ? 'is-done' : ''}>
            <button onClick={() => dispatch(unitSelected(u.id))}>
              {UNIT_DEFS[u.archetype].name}{' '}
              <small>
                {u.hp}/{UNIT_DEFS[u.archetype].maxHp}
              </small>{' '}
              <em>{u.stage === 'done' ? 'attivato' : 'pronto'}</em>
            </button>
          </li>
        ))}
      </ul>
      <p className="hud__message" role="status">
        {message ?? (busy && !myTurn ? 'Il nemico sta manovrando…' : '')}
      </p>
      <div className="hud__actions">
        <button className="btn" disabled={!myTurn || busy} onClick={() => void dispatch(endPhasePressed())}>
          Fine fase
        </button>
        <button className="btn btn--ghost" onClick={() => dispatch(startGame())}>
          Ricomincia
        </button>
        <button className="btn btn--ghost" onClick={() => dispatch(returnedToStart())}>
          Menu
        </button>
      </div>
    </header>
  );
}
