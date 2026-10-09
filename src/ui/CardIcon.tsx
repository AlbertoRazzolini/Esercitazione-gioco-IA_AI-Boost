import type { CardId } from '../engine/types';

const ICONS: Record<CardId, string> = {
  forcedMarch: 'M3 17h4l3-6 3 6h4L12 7h-4z M3 21h18v-2H3z',
  holdTheLine: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  focusFire: 'M11 2h2v5h-2z M11 17h2v5h-2z M2 11h5v2H2z M17 11h5v2h-5z M12 9a3 3 0 110 6 3 3 0 010-6z',
  charge: 'M2 20L17 5h-3V3h7v7h-2V7L4 22z',
  rally: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  precision: 'M12 3l9 9-9 9-9-9z M12 8l-4 4 4 4 4-4z',
};

export function CardIcon({ id }: { id: CardId }) {
  return (
    <svg className="card__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[id]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
