import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { Difficulty } from '../engine/types';
import { difficultySet } from '../game/gameSlice';
import { startGame } from '../game/thunks';

const LEVELS: { id: Difficulty; name: string; text: string }[] = [
  { id: 'easy', name: 'Recluta', text: 'Il nemico cerca il colpo più facile e a volte sbaglia.' },
  { id: 'medium', name: 'Veterano', text: 'Valuta minacce e posizioni, usa le carte con criterio.' },
  { id: 'hard', name: 'Comandante', text: 'Prevede la tua risposta prima di muovere.' },
];

export function StartScreen() {
  const dispatch = useAppDispatch();
  const difficulty = useAppSelector((s) => s.game.difficulty);
  const unlocked = useAppSelector((s) => s.game.unlocked);
  return (
    <div className="start">
      <div className="start__panel parchment">
        <h1 className="title">Bannerfall</h1>
        <p className="start__lead">Tre soldati, un accampamento in fiamme, ordini da impartire.</p>
        <fieldset className="levels">
          <legend>Difficoltà</legend>
          {LEVELS.map((level) => {
            const locked = !unlocked.includes(level.id);
            return (
              <label
                key={level.id}
                className={`level ${difficulty === level.id ? 'level--active' : ''} ${locked ? 'level--locked' : ''}`}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={level.id}
                  checked={difficulty === level.id}
                  disabled={locked}
                  onChange={() => dispatch(difficultySet(level.id))}
                />
                <strong>{level.name}</strong>
                <span>{locked ? 'Bloccato: vinci al livello precedente per sbloccarlo.' : level.text}</span>
              </label>
            );
          })}
        </fieldset>
        <button className="btn btn--primary" onClick={() => dispatch(startGame())}>
          Inizia la battaglia
        </button>
        <section className="howto">
          <h2>Come si gioca</h2>
          <ul>
            <li>Clicca un tuo soldato, poi una casella evidenziata per muoverlo.</li>
            <li>Clicca un nemico evidenziato in rosso per attaccarlo.</li>
            <li>Ogni soldato agisce una volta per fase. Puoi giocare una carta-ordine per fase.</li>
            <li>Esc annulla la selezione.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
