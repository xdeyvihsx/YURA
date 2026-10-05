import { useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Play, Shuffle } from 'lucide-react';
import { getAlbum, type AlbumData } from '@/services/youtube';
import { usePlayer } from '@/context/player';
import { formatTime } from '@/components/mini-player';
import { ArtistLinks } from '@/components/artist-links';
import { DownloadButton } from '@/components/download-button';

export function AlbumView({ albumId, onBack, onOpenArtist }: { albumId: string; onBack: () => void; onOpenArtist?: (id: string) => void }) {
  const [data, setData] = useState<AlbumData | null>(null);
  const [failed, setFailed] = useState(false);
  const { playTrack, current } = usePlayer();

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getAlbum(albumId).then((d) => alive && setData(d)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [albumId]);

  const back = (
    <button onClick={onBack} aria-label="Volver" className="mobile-overlay-back absolute left-4 top-20 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background/60 backdrop-blur-xl hover:bg-background/80 sm:left-6">
      <ChevronLeft className="h-6 w-6" />
    </button>
  );

  if (failed) return <div className="relative h-full p-6 pt-32">{back}<p className="text-muted-foreground">No se pudo cargar este álbum.</p></div>;
  if (!data) return <div className="relative flex h-full items-center justify-center">{back}<Loader2 className="h-8 w-8 animate-spin" /></div>;

  const tracks = data.tracks;
  const total = tracks.reduce((s, t) => s + (t.durationSeconds || 0), 0);
  const shuffle = () => {
    if (!tracks.length) return;
    const list = [...tracks].sort(() => Math.random() - 0.5);
    playTrack(list[0], list);
  };

  return (
    <div className="mobile-page relative h-full overflow-y-auto px-4 pb-32 pt-20 sm:px-8">
      {back}
      <div className="flex flex-col items-center gap-8 pt-6 md:flex-row md:items-end">
        <img src={data.artworkUrl || ''} alt={data.title || ''} className="h-56 w-56 rounded-lg object-cover shadow-2xl sm:h-64 sm:w-64 sm:rounded-xl" />
        <div className="min-w-0 text-center md:text-left">
          <h1 className="text-3xl font-bold sm:text-4xl">{data.title}</h1>
          {data.artistName && (
            <button className="text-xl text-primary hover:underline" onClick={() => data.artistId && onOpenArtist?.(data.artistId)}>
              {data.artistName}
            </button>
          )}
          <p className="text-sm text-muted-foreground">
            {[data.subtitle, `${tracks.length} canciones`, total ? `${Math.round(total / 60)} min` : null].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-5 flex justify-center gap-3 md:justify-start">
            <button onClick={() => tracks[0] && playTrack(tracks[0], tracks)} className="flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 font-semibold text-background">
              <Play className="h-4 w-4 fill-current" /> Reproducir
            </button>
            <button onClick={shuffle} className="flex items-center gap-2 rounded-full bg-muted px-6 py-2.5 font-semibold">
              <Shuffle className="h-4 w-4" /> Aleatorio
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10">
        {tracks.map((t, i) => {
          const playing = current?.sourceId === t.sourceId;
          return (
            <button
              key={t.sourceId}
              onClick={() => playTrack(t, tracks)}
              className={`group flex w-full items-center gap-4 border-b border-border/30 px-2 py-3 text-left hover:bg-muted/30 ${playing ? 'text-primary' : ''}`}
            >
              <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">
                <span className="group-hover:hidden">{i + 1}</span>
                <Play className="hidden h-4 w-4 fill-current group-hover:inline" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                {t.artistName && t.artistName !== data.artistName && <ArtistLinks className="block truncate text-xs text-muted-foreground" artists={t.artists} fallbackName={t.artistName} fallbackId={t.artistId} onOpenArtist={onOpenArtist} />}
              </div>
              {t.isExplicit && <span className="rounded bg-muted px-1 text-[10px] font-bold">E</span>}
              <span className="text-sm tabular-nums text-muted-foreground">{t.durationSeconds ? formatTime(t.durationSeconds) : ''}</span>
              <DownloadButton track={t} className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
