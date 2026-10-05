import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import { usePlayer } from '@/context/player';
import { getLyrics, type Lyrics } from '@/services/youtube';
import { TrackActions } from '@/components/track-actions';
import { SeekBar, formatTime } from '@/components/mini-player';
import { ArtistLinks } from '@/components/artist-links';
import { DownloadButton } from '@/components/download-button';
import { RepeatButton, ShuffleButton } from '@/components/player-modes';

type VideoStatus = { videoId: string | null; failed: boolean };
function useVideoStatus(): VideoStatus {
  const [st, setSt] = useState<VideoStatus>(() => (window as any).__yuraVideoStatus ?? { videoId: null, failed: false });
  useEffect(() => {
    const on = (e: Event) => setSt((e as CustomEvent).detail);
    window.addEventListener('yura:video-status', on);
    return () => window.removeEventListener('yura:video-status', on);
  }, []);
  return st;
}

/* ---------- Lyrics ---------- */
function LyricsPane({ lyrics, loading }: { lyrics: Lyrics | null; loading: boolean }) {
  const { currentTime, seek } = usePlayer();
  const box = useRef<HTMLDivElement>(null);
  const synced = lyrics?.synced;
  let active = -1;
  if (synced) for (let i = 0; i < synced.length; i++) if (synced[i].time <= currentTime + 0.25) active = i;

  useEffect(() => {
    // Scroll only the lyrics box (scrollIntoView would also move the whole page near the end).
    const container = box.current;
    const el = container?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    if (!container || !el) return;
    const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [active]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!lyrics || (!synced?.length && !lyrics.plain)) return <p className="py-10 text-center text-muted-foreground">No hay letra disponible para esta canción.</p>;
  if (!synced?.length) return <p className="whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{lyrics.plain}</p>;
  return (
    <div ref={box} className="lyrics-stream no-scrollbar relative h-full space-y-5 overflow-y-auto overscroll-contain px-3 py-[35%] sm:space-y-7 lg:py-[30vh]">
      {synced.map((l, i) => (
        <button
          key={i}
          data-line={i}
          onClick={() => seek(l.time)}
          className={`lyrics-line block w-full origin-left py-1 text-left text-xl font-bold leading-snug sm:text-2xl ${i === active ? 'lyrics-line-active text-foreground' : Math.abs(i - active) <= 1 ? 'text-muted-foreground/60' : 'lyrics-line-distant text-muted-foreground/40 hover:text-muted-foreground'}`}
        >
          {l.text || '♪'}
        </button>
      ))}
    </div>
  );
}

/* ---------- Full player ---------- */
export function FullPlayer({ onClose, onOpenArtist }: { onClose: () => void; onOpenArtist?: (id: string) => void }) {
  const { current, queue, index, playAt, isPlaying, loading, toggle, next, prev, currentTime, duration, mode, setMode, error } = usePlayer();
  const [tab, setTab] = useState<'lyrics' | 'queue'>('queue');
  const video = useVideoStatus();
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (!current) return;
    let alive = true;
    setLyrics(null);
    setLyricsLoading(true);
    getLyrics(current).then((l) => alive && setLyrics(l)).finally(() => alive && setLyricsLoading(false));
    return () => { alive = false; };
  }, [current?.sourceId]);

  // Leaving the full player hands sound back to the song at the same second.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => () => { if (modeRef.current === 'video') setMode('audio'); }, [setMode]);

  if (!current) return null;
  const videoId = video.videoId;
  const switchTo = (m: 'audio' | 'video') => setMode(m);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <img src={current.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-3xl scale-110" />
      <div className="absolute inset-0 bg-background/60" />
      <div className="full-player-content relative flex h-full flex-col gap-5 overflow-y-auto px-4 pb-8 pt-16 sm:gap-8 sm:p-6 sm:pt-20 lg:flex-row lg:overflow-hidden">
        <button onClick={onClose} aria-label="Cerrar reproductor" className="full-player-close absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background/60 backdrop-blur-xl hover:bg-background/80 sm:left-6 sm:top-20">
          <ChevronDown className="h-6 w-6" />
        </button>

        {/* Left: artwork or video + controls */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-4 sm:gap-6 lg:justify-center lg:pb-24">
          <div className="inline-flex rounded-full bg-muted/70 p-1 backdrop-blur" role="tablist">
            <button role="tab" aria-selected={mode === 'audio'} onClick={() => switchTo('audio')} className={`rounded-full px-5 py-1.5 text-sm font-semibold ${mode === 'audio' ? 'bg-foreground text-background' : ''}`}>Canción</button>
            <button
              role="tab"
              aria-selected={mode === 'video'}
              disabled={!videoId}
              onClick={() => switchTo('video')}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold disabled:opacity-40 ${mode === 'video' ? 'bg-foreground text-background' : ''}`}
              title={!videoId ? 'Esta canción no tiene videoclip' : undefined}
            >
              Video
            </button>
          </div>

          <div className="w-full max-w-[640px]">
            {mode === 'video' && videoId && video.failed ? (
              <div className="aspect-video w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-3 text-center p-6">
                <p className="font-semibold">Video no disponible</p>
                <p className="text-sm text-muted-foreground">Este video no se puede mostrar aquí.</p>
                <button className="rounded-full bg-foreground text-background px-4 py-1.5 text-sm" onClick={() => setMode('audio')}>Escuchar la canción</button>
              </div>
            ) : mode === 'video' && videoId ? (
              <div data-video-slot className="aspect-video w-full rounded-lg bg-muted sm:rounded-2xl" />
            ) : (
              <img src={current.artworkUrl} alt={current.title} className="mx-auto aspect-square w-full max-w-[min(440px,42dvh)] rounded-lg object-cover shadow-2xl sm:rounded-2xl" />
            )}
          </div>

          <div className="w-full max-w-[520px] text-center">
            <h2 className="line-clamp-2 text-2xl font-bold sm:text-3xl">{current.title}</h2>
            <ArtistLinks className="text-base text-muted-foreground sm:text-lg" artists={current.artists} fallbackName={current.artistName} fallbackId={current.artistId} onOpenArtist={onOpenArtist} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="w-full max-w-[520px] space-y-2">
            <SeekBar />
            <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-center gap-2 sm:gap-5">
              <ShuffleButton size="h-5 w-5" className="h-11 w-11" />
              <button onClick={prev} aria-label="Anterior"><SkipBack className="h-7 w-7 fill-current" /></button>
              <button onClick={toggle} aria-label={isPlaying ? 'Pausar' : 'Reproducir'} className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background">
                {loading && !error && mode === 'audio' ? <Loader2 className="h-7 w-7 animate-spin" /> : isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
              </button>
              <button onClick={next} aria-label="Siguiente"><SkipForward className="h-7 w-7 fill-current" /></button>
              <RepeatButton size="h-5 w-5" className="h-11 w-11" />
              <DownloadButton track={current} className="hidden h-11 w-11 sm:inline-flex" />
              <span className="hidden sm:inline-flex"><TrackActions track={current} /></span>
            </div>
          </div>
        </div>

        {/* Right: lyrics / queue */}
        <div className="flex h-[62dvh] min-h-[420px] w-full shrink-0 flex-col lg:h-auto lg:min-h-0 lg:w-[420px] lg:shrink lg:pb-24">
          <div className="mb-4 flex gap-6 border-b border-border/40">
            {(['queue', 'lyrics'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-foreground' : 'text-muted-foreground'}`}>
                {t === 'queue' ? 'A continuación' : 'Letra'}
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {tab === 'lyrics' ? (
              <div className="lyrics-glass h-full overflow-hidden rounded-lg bg-background/10 backdrop-blur-sm"><LyricsPane lyrics={lyrics} loading={lyricsLoading} /></div>
            ) : (
              <div className="no-scrollbar h-full overflow-y-auto pb-40 pr-2">
                {queue.map((t, i) => (
                  <button key={t.sourceId + i} onClick={() => playAt(i)} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted/40 ${i === index ? 'bg-muted/60' : ''}`}>
                    <img src={t.artworkUrl} alt="" className="h-11 w-11 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${i === index ? 'text-primary' : ''}`}>{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.artistName}</p>
                    </div>
                    {t.durationSeconds ? <span className="text-xs tabular-nums text-muted-foreground">{formatTime(t.durationSeconds)}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
