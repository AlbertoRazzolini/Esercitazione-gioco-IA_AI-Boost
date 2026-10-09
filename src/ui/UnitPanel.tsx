import { useAppDispatch, useAppSelector } from '../app/hooks';
import { canAct, canGuard, strikeTargets } from '../engine/targeting';
import { UNIT_DEFS } from '../engine/units';
import { abilityPressed, endActivationPressed } from '../game/thunks';

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="bar" role="img" aria-label={`${label} ${value} su ${max}`}>
      <span className="bar__fill" style={{ width: `${(value / max) * 100}%` }} />
      <span className="bar__text">
        {label} {value}/{max}
      </span>
    </span>
  );
}

export function UnitPanel() {
  const dispatch = useAppDispatch();
  const ui = useAppSelector((s) => s.game);
  const game = ui.game;
  const unit = game?.units.find((u) => u.id === ui.selectedUnitId);

  if (!game || !unit) {
    return (
      <section className="unit-panel parchment unit-panel--empty">
        <p>Seleziona un soldato.</p>
      </section>
    );
  }

  const def = UNIT_DEFS[unit.archetype];
  const mine = unit.team === 'player';
  const canUse = mine && !ui.busy && canAct(game, unit);
  const abilityReady =
    def.ability.kind === 'guard' ? canGuard(game, unit.id) : strikeTargets(game, unit.id, 'ability').length > 0;
  const attack = def.attack.ranged ? `gittata ${def.attack.minRange}–${def.attack.maxRange}` : 'mischia';

  return (
    <section className="unit-panel parchment">
      <header>
        <h2>{def.name}</h2>
        <span className={`tag tag--${unit.team}`}>{mine ? 'Alleato' : 'Nemico'}</span>
      </header>
      <div className="stats">
        <Bar value={unit.hp} max={def.maxHp} label="HP" />
        {unit.guard > 0 && <span className="guard">Guardia {unit.guard}</span>}
        <span>
          Mov {def.move}
          {unit.moveBonus > 0 && ` +${unit.moveBonus}`}
        </span>
        <span>
          Attacco {def.attack.damage} ({attack})
        </span>
      </div>
      <p className="ability">
        <strong>{def.ability.name}</strong>: {def.ability.description}
        {unit.cooldown > 0 && <em> (in ricarica: {unit.cooldown})</em>}
      </p>
      {mine && (
        <div className="unit-panel__actions">
          <button
            className={`btn ${ui.mode === 'ability' ? 'btn--active' : ''}`}
            disabled={!canUse || !abilityReady}
            onClick={() => void dispatch(abilityPressed())}
          >
            {def.ability.name}
          </button>
          <button
            className="btn btn--ghost"
            disabled={ui.busy || game.activeTeam !== 'player' || unit.stage === 'done'}
            onClick={() => void dispatch(endActivationPressed())}
          >
            Fine attivazione
          </button>
        </div>
      )}
    </section>
  );
}
