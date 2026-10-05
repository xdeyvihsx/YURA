import { Play } from 'lucide-react';
import { img, type SearchAll, type Track } from '@/services/youtube';
import { usePlayer } from '@/context/player';
import { HorizontalCarousel } from '@/components/horizontal-carousel';
import { ArtistLinks } from '@/components/artist-links';
import { DownloadButton } from '@/components/download-button';
import { TrackActions } from '@/components/track-actions';
import { formatTime } from '@/components/mini-player';

interface Props {
  data: SearchAll;
  onOpenArtist?: (id: string) => void;
  onOpenAlbum?: (id: string) => void;
}

export function SearchResults({ data, onOpenArtist, onOpenAlbum }: Props) {
  const { playTrack, current } = usePlayer();
  const { top, tracks, videos, albums, artists } = data;
  const play = (t: Track, list: Track[], video = false) => playTrack(t, list, { video });

  const empty = !top && !tracks.length && !albums.length && !artists.length && !videos.length;
  if (empty) return <p className="p-6 pt-24 text-muted-foreground">No se encontraron resultados.</p>;

  return (
    <div className="mobile-page flex h-full min-h-0 flex-col space-y-8 overflow-y-auto p-4 pb-32 pt-20 sm:space-y-10 sm:p-6 sm:pb-32 sm:pt-20">
      <div className="grid gap-8 lg:grid-cols-[minmax(280px,380px)_1fr]">
        {top && (
          <section>
            <h2 className="mb-4 text-2xl font-bold">Resultado principal</h2>
            {top.kind === 'artist' && (
              <button onClick={() => onOpenArtist?.(top.artist.id)} className="group flex w-full flex-col items-start gap-4 rounded-2xl bg-muted/40 p-5 text-left transition hover:bg-muted/70">
                <img src={top.artist.artworkUrl || ''} alt={top.artist.name} className="h-28 w-28 rounded-full object-cover shadow-xl" />
                <div><p className="text-3xl font-bold">{top.artist.name}</p><p className="text-sm text-muted-foreground">Artista</p></div>
              </button>
            )}
            {top.kind === 'album' && (
              <button onClick={() => onOpenAlbum?.(top.album.id)} className="group flex w-full flex-col items-start gap-4 rounded-2xl bg-muted/40 p-5 text-left transition hover:bg-muted/70">
                <img src={top.album.artworkUrl || ''} alt={top.album.title} className="h-28 w-28 rounded-lg object-cover shadow-xl" />
                <div><p className="line-clamp-2 text-3xl font-bold">{top.album.title}</p><p className="text-sm text-muted-foreground">Álbum{top.album.artistName ? ` · ${top.album.artistName}` : ''}</p></div>
              </button>
            )}
            {top.kind === 'track' && (
              <div onClick={() => play(top.track, [top.track, ...tracks.filter((t) => t.sourceId !== top.track.sourceId)])} className="group relative flex w-full cursor-pointer flex-col items-start gap-4 rounded-2xl bg-muted/40 p-5 transition hover:bg-muted/70">
                <img src={top.track.artworkUrl} alt={top.track.title} className="h-28 w-28 rounded-lg object-cover shadow-xl" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-3xl font-bold">{top.track.title}</p>
                  <p className="text-sm text-muted-foreground">Canción · <ArtistLinks artists={top.track.artists} fallbackName={top.track.artistName} fallbackId={top.track.artistId} onOpenArtist={onOpenArtist} /></p>
                </div>
                <span className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background opacity-0 shadow-xl transition group-hover:opacity-100"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
              </div>
            )}
          </section>
        )}

        {tracks.length > 0 && (
          <section className="min-w-0">
            <h2 className="mb-4 text-2xl font-bold">Canciones</h2>
            <div>
              {tracks.slice(0, 8).map((t) => (
                <div key={t.sourceId} onClick={() => play(t, tracks)} className={`group flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted/40 ${current?.sourceId === t.sourceId ? 'text-primary' : ''}`}>
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded">
                    <img src={t.artworkUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 hidden items-center justify-center bg-background/50 group-hover:flex"><Play className="h-4 w-4 fill-current" /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <ArtistLinks className="block truncate text-xs text-muted-foreground" artists={t.artists} fallbackName={t.artistName} fallbackId={t.artistId} onOpenArtist={onOpenArtist} />
                  </div>
                  {t.durationSeconds ? <span className="text-xs tabular-nums text-muted-foreground">{formatTime(t.durationSeconds)}</span> : null}
                  <span className="flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:has-[[data-state=open]]:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <TrackActions track={t} />
                  </span>
                  <DownloadButton track={t} className="hidden opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 sm:inline-flex" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {albums.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Álbumes</h2>
          <HorizontalCarousel ariaLabel="Álbumes" className="gap-4 pb-2">
            {albums.map((a) => (
              <button key={a.id} onClick={() => onOpenAlbum?.(a.id)} className="w-44 shrink-0 snap-start text-left">
                <img src={a.artworkUrl || ''} alt={a.title} className="mb-2 aspect-square w-full rounded-lg object-cover transition hover:opacity-90" />
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{[a.artistName, a.year].filter(Boolean).join(' · ') || a.subtitle}</p>
              </button>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {artists.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Artistas</h2>
          <HorizontalCarousel ariaLabel="Artistas" className="gap-4 pb-2">
            {artists.map((a) => (
              <button key={a.id} onClick={() => onOpenArtist?.(a.id)} className="group w-40 shrink-0 snap-start">
                <img src={a.artworkUrl || ''} alt={a.name} className="mb-3 h-40 w-40 rounded-full border-2 border-transparent object-cover transition group-hover:border-primary" />
                <p className="line-clamp-1 text-center text-sm font-semibold">{a.name}</p>
              </button>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Videos</h2>
          <HorizontalCarousel ariaLabel="Videos" className="gap-4 pb-2">
            {videos.map((v) => (
              <button key={v.sourceId} onClick={() => play(v, videos, true)} className="group w-72 shrink-0 snap-start text-left">
                <div className="relative mb-2 aspect-video overflow-hidden rounded-lg">
                  <img src={img(`https://i.ytimg.com/vi/${v.sourceId}/hqdefault.jpg`)} alt={v.title} className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/70 backdrop-blur"><Play className="ml-0.5 h-5 w-5 fill-current" /></span></span>
                </div>
                <p className="truncate text-sm font-semibold">{v.title}</p>
                <p className="truncate text-xs text-muted-foreground">{v.artistName}</p>
              </button>
            ))}
          </HorizontalCarousel>
        </section>
      )}
    </div>
  );
}
