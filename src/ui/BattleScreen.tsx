import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { unitSelected } from '../game/gameSlice';
import { BattlefieldCanvas } from '../render/BattlefieldCanvas';
import { CardFxLayer } from './CardFxLayer';
import { CardHand } from './CardHand';
import { EndScreen } from './EndScreen';
import { Hud } from './Hud';
import { UnitPanel } from './UnitPanel';

export function BattleScreen() {
  const dispatch = useAppDispatch();
  const gameId = useAppSelector((s) => s.game.gameId);
  const winner = useAppSelector((s) => s.game.game?.winner ?? null);
  const busy = useAppSelector((s) => s.game.busy);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(unitSelected(null));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="battle">
      <Hud />
      <main className="battle__field">
        <BattlefieldCanvas key={gameId} />
      </main>
      <footer className="battle__bar">
        <UnitPanel />
        <CardHand />
      </footer>
      <CardFxLayer />
      {winner && !busy && <EndScreen winner={winner} />}
    </div>
  );
}
