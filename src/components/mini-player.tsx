import { useRef, useState } from 'react';
import { Play, Pause, X, SkipForward, SkipBack, Volume2, Volume1, VolumeX, Loader2 } from 'lucide-react';
import { usePlayer } from '@/context/player';
import { ArtistLinks } from '@/components/artist-links';
import { DownloadButton } from '@/components/download-button';
import { RepeatButton, ShuffleButton } from '@/components/player-modes';
import { HeartButton } from '@/components/track-actions';

interface MiniPlayerProps {
  onClose: () => void;
  onTitleClick?: () => void;
  onOpenArtist?: (id: string) => void;
}

export const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export function SeekBar({ className = '' }: { className?: string }) {
  const { currentTime, duration, seek } = usePlayer();
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <input
      type="range"
      aria-label="Progreso"
      min={0}
      max={duration || 0}
      step={0.5}
      value={Math.min(currentTime, duration || 0)}
      onChange={(e) => seek(Number(e.target.value))}
      className={`yura-range w-full ${className}`}
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  );
}

function VolumeControl() {
  const { volume, muted, setVolume, setMuted } = usePlayer();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 350); };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onWheel={(e) => { setVolume(level + (e.deltaY < 0 ? 0.05 : -0.05)); }}
    >
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
        onClick={() => { if (level === 0) setVolume(volume || 0.6); else setMuted(true); }}
        onFocus={show}
        aria-label={level === 0 ? 'Activar sonido' : 'Silenciar'}
      >
        <Icon className="h-4 w-4" />
      </button>
      {open && (
        // pb-3 keeps an invisible bridge between the icon and the slider so the cursor never "falls off".
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 animate-fade-in">
          <div className="flex h-32 w-10 items-center justify-center rounded-full border border-border/20 bg-background/90 shadow-xl backdrop-blur-xl">
            <input
              type="range"
              aria-label="Volumen"
              min={0}
              max={1}
              step={0.01}
              value={level}
              onChange={(e) => setVolume(Number(e.target.value))}
              onPointerDown={show}
              className="yura-range w-24 -rotate-90"
              style={{ ['--pct' as string]: `${level * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function MiniPlayer({ onClose, onTitleClick, onOpenArtist }: MiniPlayerProps) {
  const { current, isPlaying, loading, error, currentTime, duration, toggle, next, prev, mode } = usePlayer();
  if (!current) return null;
  const busy = loading && !error;

  return (
    <div
      className="mini-player fixed left-1/2 z-40 h-[64px] w-[calc(100vw-1rem)] -translate-x-1/2 rounded-lg border border-border/20 bg-background/85 text-foreground shadow-2xl backdrop-blur-xl md:bottom-4 md:h-[78px] md:w-[min(760px,calc(100vw-2rem))] md:rounded-full"
      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 500, fontSize: '13px', lineHeight: 1.6 }}
    >
        <div className="flex h-full items-center gap-2 px-2 md:gap-3">
        {/* Artwork doubles as the play / pause button */}
        <button
          type="button"
          className="group relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md md:h-14 md:w-14 md:rounded-full"
          onClick={toggle}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          <img
            src={current.artworkUrl}
            alt={current.title}
            className={`h-full w-full object-cover transition-transform duration-500 ${isPlaying ? 'group-hover:scale-110' : 'scale-105'}`}
          />
          <span
            className={`absolute inset-0 flex items-center justify-center bg-foreground/40 text-background transition-opacity duration-300 ${isPlaying && !busy ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
          >
            <span className="transition-transform duration-300 group-hover:scale-110 group-active:scale-90">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
            </span>
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2" onClick={onTitleClick}>
            <span className="truncate cursor-pointer text-sm font-semibold hover:underline" onClick={onTitleClick}>
              {current.title}
            </span>
            {mode === 'video' && <span className="text-[10px] uppercase text-primary">Video</span>}
          </div>
          <span className="block truncate text-xs text-muted-foreground">
            {error ? <span className="text-destructive">{error} · saltando…</span> : <ArtistLinks artists={current.artists} fallbackName={current.artistName} fallbackId={current.artistId} onOpenArtist={onOpenArtist} />}
          </span>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="w-9 text-[11px] tabular-nums text-muted-foreground">{formatTime(currentTime)}</span>
            <SeekBar />
            <span className="w-9 text-[11px] tabular-nums text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5 md:pr-2">
          <ShuffleButton className="hidden h-8 w-8 sm:flex" />
          <button className="hidden h-11 w-11 items-center justify-center rounded-full hover:bg-muted sm:flex" onClick={prev} aria-label="Anterior">
            <SkipBack className="h-4 w-4 fill-current" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted" onClick={next} aria-label="Siguiente">
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
          <RepeatButton className="hidden h-8 w-8 sm:flex" />
          <span className="hidden sm:inline-flex"><HeartButton track={current} /></span>
          <DownloadButton track={current} className="hidden sm:inline-flex" />
          <span className="hidden md:inline-flex"><VolumeControl /></span>
          <button className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-muted md:flex" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
