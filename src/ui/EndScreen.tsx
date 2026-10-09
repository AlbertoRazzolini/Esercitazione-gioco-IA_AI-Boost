import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { Team } from '../engine/types';
import { returnedToStart } from '../game/gameSlice';
import { nextLevel } from '../game/progress';
import { startGame, startNextLevel } from '../game/thunks';

const LEVEL_NAMES = { easy: 'Recluta', medium: 'Veterano', hard: 'Comandante' } as const;

export function EndScreen({ winner }: { winner: Team }) {
  const dispatch = useAppDispatch();
  const difficulty = useAppSelector((s) => s.game.difficulty);
  const won = winner === 'player';
  const next = won ? nextLevel(difficulty) : null;
  return (
    <div className="end" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className="end__panel parchment">
        <h2 id="end-title" className="title">
          {won ? 'Vittoria' : 'Sconfitta'}
        </h2>
        <p>{won ? 'Lo stendardo nemico è caduto.' : 'La tua squadra è stata sconfitta.'}</p>
        {next && <p className="end__unlock">Livello sbloccato: {LEVEL_NAMES[next]}</p>}
        <div className="end__actions">
          {next && (
            <button className="btn btn--primary" autoFocus onClick={() => dispatch(startNextLevel())}>
              Affronta il livello successivo
            </button>
          )}
          <button
            className={`btn ${next ? 'btn--ghost' : 'btn--primary'}`}
            autoFocus={!next}
            onClick={() => dispatch(startGame())}
          >
            {won ? 'Rigioca' : 'Riprova'}
          </button>
          <button className="btn btn--ghost" onClick={() => dispatch(returnedToStart())}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
