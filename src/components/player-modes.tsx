import { Repeat, Repeat1, Shuffle } from 'lucide-react';
import { usePlayer } from '@/context/player';

const label = { off: 'Repetir: desactivado', all: 'Repetir lista', one: 'Repetir canción' } as const;

export function ShuffleButton({ size = 'h-4 w-4', className = '' }: { size?: string; className?: string }) {
  const { shuffle, toggleShuffle } = usePlayer();
  return (
    <button
      type="button"
      onClick={toggleShuffle}
      aria-pressed={shuffle}
      aria-label={shuffle ? 'Aleatorio activado' : 'Aleatorio'}
      title={shuffle ? 'Aleatorio activado' : 'Aleatorio'}
      className={`relative flex items-center justify-center rounded-full transition hover:bg-muted ${shuffle ? 'text-primary' : 'text-muted-foreground'} ${className}`}
    >
      <Shuffle className={size} />
      {shuffle && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
    </button>
  );
}

export function RepeatButton({ size = 'h-4 w-4', className = '' }: { size?: string; className?: string }) {
  const { repeat, cycleRepeat } = usePlayer();
  const Icon = repeat === 'one' ? Repeat1 : Repeat;
  return (
    <button
      type="button"
      onClick={cycleRepeat}
      aria-label={label[repeat]}
      title={label[repeat]}
      className={`relative flex items-center justify-center rounded-full transition hover:bg-muted ${repeat !== 'off' ? 'text-primary' : 'text-muted-foreground'} ${className}`}
    >
      <Icon className={size} />
      {repeat !== 'off' && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
    </button>
  );
}
