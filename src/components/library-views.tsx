import { useEffect, useState } from 'react';
import { Clock, Download, Heart, ListMusic, Loader2, Mic, Play, Search, Trash2, X } from 'lucide-react';
import { usePlayer } from '@/context/player';
import { ArtistLinks } from '@/components/artist-links';
import { DownloadButton } from '@/components/download-button';
import { TrackActions } from '@/components/track-actions';
import { formatTime } from '@/components/mini-player';
import { Button } from '@/components/ui/button';
import { getPodcasts, type Track } from '@/services/youtube';
import { removeFromPlaylist, removeSearch, useLibrary } from '@/services/library';

function TrackList({ tracks, onOpenArtist, onRemove }: { tracks: Track[]; onOpenArtist?: (id: string) => void; onRemove?: (t: Track) => void }) {
  const { playTrack, current } = usePlayer();
  return (
    <div>
      {tracks.map((t, i) => (
        <div key={t.sourceId} onClick={() => playTrack(t, tracks)} className={`group flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted/40 ${current?.sourceId === t.sourceId ? 'text-primary' : ''}`}>
          <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
            <img src={t.artworkUrl} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 hidden items-center justify-center bg-background/50 group-hover:flex"><Play className="h-4 w-4 fill-current" /></span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{t.title}</p>
            <ArtistLinks className="block truncate text-xs text-muted-foreground" artists={t.artists} fallbackName={t.artistName} fallbackId={t.artistId} onOpenArtist={onOpenArtist} />
          </div>
          {t.durationSeconds ? <span className="text-xs tabular-nums text-muted-foreground">{formatTime(t.durationSeconds)}</span> : null}
          <div className="flex items-center opacity-0 group-hover:opacity-100 has-[[data-state=open]]:opacity-100" onClick={(e) => e.stopPropagation()}>
            <TrackActions track={t} />
            <DownloadButton track={t} />
            {onRemove && (
              <button onClick={() => onRemove(t)} aria-label="Quitar de la playlist" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Page({ icon: Icon, title, subtitle, tracks, children }: { icon: typeof Heart; title: string; subtitle?: string; tracks?: Track[]; children: React.ReactNode }) {
  const { playTrack } = usePlayer();
  return (
    <div className="mobile-page h-full overflow-y-auto px-4 pb-32 pt-20 sm:px-6">
      <div className="mb-6 flex items-end gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/20 text-primary"><Icon className="h-9 w-9" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {tracks && tracks.length > 0 && (
          <button onClick={() => playTrack(tracks[0], tracks)} aria-label="Reproducir todo" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function LibraryHome({ onNavigate }: { onNavigate: (view: 'recents' | 'favorites' | 'playlists' | 'downloads') => void }) {
  const { recents, favorites, playlists } = useLibrary();
  const items = [
    { title: 'Recientes', detail: `${recents.length} canciones`, icon: Clock, view: 'recents' as const },
    { title: 'Favoritos', detail: `${favorites.length} canciones`, icon: Heart, view: 'favorites' as const },
    { title: 'Tus playlists', detail: `${playlists.length} playlists`, icon: ListMusic, view: 'playlists' as const },
    { title: 'Descargas', detail: 'Música disponible sin conexión', icon: Download, view: 'downloads' as const },
  ];
  return (
    <div className="mobile-page h-full overflow-y-auto px-4 pb-32 pt-20 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold">Tu biblioteca</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Button key={item.view} variant="ghost" onClick={() => onNavigate(item.view)} className="h-auto justify-start gap-4 rounded-lg bg-muted/35 p-4 text-left hover:bg-muted/60">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><item.icon className="h-6 w-6" /></span>
            <span className="min-w-0"><span className="block font-semibold">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function RecentsView({ onOpenArtist }: { onOpenArtist?: (id: string) => void }) {
  const { recents } = useLibrary();
  return (
    <Page icon={Clock} title="Recientes" subtitle={`${recents.length} canciones`} tracks={recents}>
      {recents.length ? <TrackList tracks={recents} onOpenArtist={onOpenArtist} /> : <p className="text-muted-foreground">Aún no has escuchado nada. Lo que reproduzcas aparecerá aquí.</p>}
    </Page>
  );
}

export function FavoritesView({ onOpenArtist }: { onOpenArtist?: (id: string) => void }) {
  const { favorites } = useLibrary();
  return (
    <Page icon={Heart} title="Favoritos" subtitle={`${favorites.length} canciones`} tracks={favorites}>
      {favorites.length ? <TrackList tracks={favorites} onOpenArtist={onOpenArtist} /> : <p className="text-muted-foreground">Toca el corazón en cualquier canción para guardarla aquí.</p>}
    </Page>
  );
}

export function PlaylistView({ id, onOpenArtist }: { id: string; onOpenArtist?: (id: string) => void }) {
  const { playlists } = useLibrary();
  const p = playlists.find((x) => x.id === id);
  if (!p) return <p className="p-6 pt-24 text-muted-foreground">Esta playlist ya no existe.</p>;
  return (
    <Page icon={ListMusic} title={p.name} subtitle={`${p.tracks.length} canciones`} tracks={p.tracks}>
      {p.tracks.length ? (
        <TrackList tracks={p.tracks} onOpenArtist={onOpenArtist} onRemove={(t) => removeFromPlaylist(p.id, t.sourceId)} />
      ) : (
        <p className="text-muted-foreground">Playlist vacía. Usa el botón "···" de cualquier canción y elige "Añadir a playlist".</p>
      )}
    </Page>
  );
}

export function PlaylistsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { playlists } = useLibrary();
  return (
    <Page icon={ListMusic} title="Tus playlists" subtitle={`${playlists.length} playlists`}>
      {!playlists.length && <p className="text-muted-foreground">Aún no tienes playlists. Usa "Crear playlist" en la barra lateral.</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {playlists.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)} className="rounded-xl bg-muted/40 p-3 text-left hover:bg-muted/70">
            <div className="mb-3 grid aspect-square grid-cols-2 overflow-hidden rounded-lg bg-muted">
              {p.tracks.slice(0, 4).map((t) => <img key={t.sourceId} src={t.artworkUrl} alt="" className="h-full w-full object-cover" />)}
              {!p.tracks.length && <ListMusic className="col-span-2 m-auto h-10 w-10 text-muted-foreground" />}
            </div>
            <p className="truncate font-semibold">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.tracks.length} canciones</p>
          </button>
        ))}
      </div>
    </Page>
  );
}

const GENRES = ['Reggaetón', 'Pop', 'Rock', 'Hip hop', 'Electrónica', 'Salsa', 'Bachata', 'Vallenato', 'Regional mexicano', 'Jazz', 'Lo-fi', 'Clásica'];

export function SearchHome({ onSearch }: { onSearch: (q: string) => void }) {
  const { searches } = useLibrary();
  return (
    <div className="mobile-page h-full overflow-y-auto px-4 pb-32 pt-20 sm:px-6">
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-bold"><Search className="h-7 w-7" /> Buscar</h1>
      {searches.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold">Búsquedas recientes</h2>
          <div className="flex flex-wrap gap-2">
            {searches.map((s) => (
              <span key={s} className="group inline-flex items-center gap-1 rounded-full bg-muted/60 py-1.5 pl-4 pr-2 text-sm">
                <button onClick={() => onSearch(s)} className="hover:underline">{s}</button>
                <button onClick={() => removeSearch(s)} aria-label={`Quitar ${s}`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        </section>
      )}
      <h2 className="mb-3 text-xl font-bold">Explorar géneros</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
        {GENRES.map((g, i) => (
          <button key={g} onClick={() => onSearch(g)} className="relative h-24 overflow-hidden rounded-xl p-4 text-left text-lg font-bold" style={{ background: `hsl(${(i * 37) % 360} 55% 32%)` }}>
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

const TOPICS = ['Podcast en español', 'Entrevistas', 'Comedia', 'Historia', 'Tecnología', 'Música', 'Deportes', 'Negocios'];

export function PodcastsView({ onOpenArtist }: { onOpenArtist?: (id: string) => void }) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [items, setItems] = useState<Track[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setItems(null);
    setFailed(false);
    getPodcasts(topic).then((t) => alive && setItems(t)).catch(() => { if (alive) { setItems([]); setFailed(true); } });
    return () => { alive = false; };
  }, [topic]);
  return (
    <Page icon={Mic} title="Podcasts" subtitle="Episodios para escuchar" tracks={items ?? undefined}>
      <div className="mb-6 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button key={t} onClick={() => setTopic(t)} className={`rounded-full px-4 py-1.5 text-sm ${t === topic ? 'bg-foreground text-background' : 'bg-muted/60 hover:bg-muted'}`}>{t}</button>
        ))}
      </div>
      {!items ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : items.length ? <TrackList tracks={items} onOpenArtist={onOpenArtist} />
        : <p className="text-muted-foreground">{failed ? 'No se pudieron cargar los podcasts. Revisa tu conexión.' : 'No hay episodios para este tema.'}</p>}
    </Page>
  );
}
