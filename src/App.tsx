import { useAppSelector } from './app/hooks';
import { BattleScreen } from './ui/BattleScreen';
import { StartScreen } from './ui/StartScreen';

export default function App() {
  const screen = useAppSelector((s) => s.game.screen);
  return screen === 'start' ? <StartScreen /> : <BattleScreen />;
}
