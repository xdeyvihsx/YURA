import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Play, Star } from 'lucide-react';
import type { ArtistData, ArtistCardItem, Track } from '@/services/youtube';

type Section = ArtistData['sections'][number];

interface ArtistViewProps {
  data: ArtistData | null;
  loading: boolean;
  onBack: () => void;
  onPlayTrack: (track: Track, list?: Track[], opts?: { video?: boolean }) => void;
  onOpenArtist: (id: string) => void;
  onOpenAlbum?: (id: string) => void;
}

const ROW_LIMIT = 10;

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <button
      type="button"
      onClick={onMore}
      disabled={!onMore}
      className="group mb-4 flex items-center gap-1 text-xl font-bold tracking-tight text-foreground disabled:cursor-default"
    >
      {title}
      {onMore && <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

function Card({ item, kind, onOpenArtist, onActivate }: { item: ArtistCardItem; kind: Section['kind']; onOpenArtist: (id: string) => void; onActivate?: (item: ArtistCardItem, kind: Section['kind']) => void }) {
  if (kind === 'related') {
    return (
      <button type="button" onClick={() => onOpenArtist(item.id)} className="group w-36 shrink-0 text-center">
        <div className="aspect-square overflow-hidden rounded-full bg-muted">
          <img src={item.artworkUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        </div>
        <p className="mt-3 truncate text-sm font-medium">{item.title}</p>
      </button>
    );
  }
  const wide = kind === 'videos';
  return (
    <div onClick={() => onActivate?.(item, kind)} className={`group shrink-0 cursor-pointer ${wide ? 'w-80' : 'w-48'}`}>
      <div className={`relative overflow-hidden rounded-lg bg-muted ${wide ? 'aspect-video' : 'aspect-square'}`}>
        <img src={item.artworkUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-10 w-10 fill-current text-foreground" />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium">{item.title}</p>
      <p className="text-xs text-muted-foreground">{item.year ?? item.subtitle ?? ''}</p>
    </div>
  );
}

function Row({ section, onMore, onOpenArtist, onActivate }: { section: Section; onMore: () => void; onOpenArtist: (id: string) => void; onActivate?: (item: ArtistCardItem, kind: Section['kind']) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="group/row relative">
      <SectionHeader title={section.title} onMore={section.items.length > ROW_LIMIT ? onMore : undefined} />
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2">
        {section.items.slice(0, ROW_LIMIT).map((item) => (
          <Card key={item.id} item={item} kind={section.kind} onOpenArtist={onOpenArtist} onActivate={onActivate} />
        ))}
      </div>
      <button type="button" onClick={() => scroll(-1)} aria-label="Anterior" className="carousel-arrow -left-4">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => scroll(1)} aria-label="Siguiente" className="carousel-arrow -right-4">
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}

function SongRow({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group flex w-full items-center gap-3 border-b border-border/40 py-2 text-left">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded">
        <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100">
          <Play className="h-4 w-4 fill-current" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">{[track.albumName, track.artistName].filter(Boolean).join(' · ')}</p>
      </div>
    </button>
  );
}

export function ArtistView({ data, loading, onBack, onPlayTrack, onOpenArtist, onOpenAlbum }: ArtistViewProps) {
  const activate = (item: ArtistCardItem, kind: Section['kind']) => {
    if (!data) return;
    if (/^(MPRE|OLAK|VL|PL|RD)/.test(item.id)) {
      if (item.id.startsWith('MPRE')) onOpenAlbum?.(item.id);
      return;
    }
    if (/^[\w-]{11}$/.test(item.id)) {
      const toT = (i: ArtistCardItem): Track => ({ id: `youtube:${i.id}`, source: 'youtube', sourceId: i.id, title: i.title, artistName: data.name, artistId: data.id ?? null, artists: [{ name: data.name, id: data.id ?? null }], albumName: null, albumId: null, durationSeconds: null, artworkUrl: i.artworkUrl, isExplicit: false });
      const sec = data.sections.find((s) => s.items.some((x) => x.id === item.id));
      const list = (sec?.items || [item]).filter((x) => /^[\w-]{11}$/.test(x.id)).map(toT);
      onPlayTrack(toT(item), list, { video: kind === 'videos' });
    }
  };
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        {loading ? (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        ) : (
          <p className="text-muted-foreground">No se pudo cargar la información del artista</p>
        )}
      </div>
    );
  }

  const back = (
    <button type="button" onClick={expanded ? () => setExpanded(null) : onBack} aria-label="Volver"
      className="mobile-overlay-back absolute left-4 top-20 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-background/60 backdrop-blur-xl hover:bg-background/80 sm:left-6">
      <ChevronLeft className="h-6 w-6" />
    </button>
  );

  // "Ver todo": full list of one section, as a grid.
  if (expanded) {
    const isSongs = expanded === 'songs';
    const section = data.sections.find((s) => s.kind + s.order === expanded);
    return (
      <div className="mobile-page relative h-full overflow-y-auto px-4 pb-32 pt-20 sm:px-8">
        {back}
        <h1 className="mb-8 pl-14 text-2xl font-bold sm:text-3xl">{data.name} · {isSongs ? 'Top canciones' : section?.title}</h1>
        {isSongs ? (
          <div className="grid gap-x-8 md:grid-cols-2">{data.topSongs.map((t) => <SongRow key={t.id} track={t} onPlay={() => onPlayTrack(t, data.topSongs)} />)}</div>
        ) : section ? (
          <div className="flex flex-wrap gap-6">{section.items.map((i) => <Card key={i.id} item={i} kind={section.kind} onOpenArtist={onOpenArtist} onActivate={activate} />)}</div>
        ) : null}
      </div>
    );
  }

  const latest = data.latestRelease;
  return (
    <div className="relative h-full overflow-y-auto pb-32">
      {back}
      {/* Hero */}
       <div className="relative h-[62dvh] min-h-[390px] w-full overflow-hidden sm:h-[70vh] sm:min-h-[420px]">
        <img src={data.artworkUrl} alt={data.name} className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-5 text-center">
          <h1 className="px-4 text-4xl font-bold tracking-normal md:text-6xl">{data.name}</h1>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setShowAbout((v) => !v)} aria-label="Información" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70 backdrop-blur">
              <Info className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => data.topSongs[0] && onPlayTrack(data.topSongs[0], data.topSongs)} aria-label="Reproducir" className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </button>
            <button type="button" aria-label="Favorito" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70 backdrop-blur">
              <Star className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-10 px-4 sm:space-y-12 sm:px-8">
        {showAbout && data.description && (
          <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">{data.description}</p>
        )}

        {/* Nuevo lanzamiento + Top canciones */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr]">
          {latest && (
            <section>
              <SectionHeader title="Nuevo lanzamiento" />
              <div className="flex items-center gap-4">
                <img src={latest.artworkUrl} alt={latest.title} className="h-40 w-40 rounded-lg object-cover" />
                <div className="min-w-0">
                  {latest.year && <p className="text-xs text-muted-foreground">{latest.year}</p>}
                  <p className="line-clamp-3 font-semibold">{latest.title}</p>
                  {latest.subtitle && <p className="line-clamp-1 text-sm text-muted-foreground">{latest.subtitle}</p>}
                </div>
              </div>
            </section>
          )}
          {data.topSongs.length > 0 && (
            <section className="min-w-0">
              <SectionHeader title="Top canciones" onMore={data.topSongs.length > 9 ? () => setExpanded('songs') : undefined} />
              <div className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
                {data.topSongs.slice(0, 9).map((t) => <SongRow key={t.id} track={t} onPlay={() => onPlayTrack(t, data.topSongs)} />)}
              </div>
            </section>
          )}
        </div>

        {data.sections.filter((s) => s.items.length > 0).map((section) => (
          <Row key={section.kind + section.order} section={section} onMore={() => setExpanded(section.kind + section.order)} onOpenArtist={onOpenArtist} onActivate={activate} />
        ))}

        {(data.description || data.subscribers) && (
          <section>
            <SectionHeader title={`Acerca de ${data.name}`} />
            <div className="max-w-3xl rounded-xl bg-muted/40 p-6">
              {data.subscribers && <p className="mb-2 text-sm font-semibold">{data.subscribers}</p>}
              {data.description && <p className="line-clamp-6 text-sm leading-relaxed text-muted-foreground">{data.description}</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
