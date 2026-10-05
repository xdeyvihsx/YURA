import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { detectCountry, getHomeData, HomeData, Track } from '@/services/youtube';
import { usePlayer } from '@/context/player';
import { HorizontalCarousel } from '@/components/horizontal-carousel';

interface HomeViewProps {
  onOpenArtist?: (artistId: string) => void;
}

const regionName = (gl: string) => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(gl) || gl;
  } catch {
    return gl;
  }
};

export function HomeView({ onOpenArtist }: HomeViewProps) {
  const player = usePlayer();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const gl = await detectCountry();
        const home = await getHomeData(gl);
        if (alive) setData(home);
      } catch (e) {
        console.error('Error loading home:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const play = (t: Track) => {
    const list = data ? (data.trending.some((x) => x.sourceId === t.sourceId) ? data.trending : data.topSongs) : [t];
    player.playTrack(t, list);
  };

  if (loading) {
    return (
      <div className="mobile-page space-y-8 p-4 pt-20 sm:p-6 sm:pt-20">
        <div className="h-8 w-64 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 pt-20 text-muted-foreground">No se pudo cargar el inicio. Inténtalo de nuevo.</div>;
  }

  const country = regionName(data.country);
  const [hero, ...restTrending] = data.trending;

  return (
    <div className="mobile-page flex h-full min-h-0 flex-col space-y-8 overflow-y-auto p-4 pt-20 sm:space-y-10 sm:p-6 sm:pt-20">
      <header>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Lo que suena en {country}</p>
        <h1 className="text-3xl font-bold">Inicio</h1>
      </header>

      {hero && (
        <section
          className="group relative h-[240px] shrink-0 w-full cursor-pointer overflow-hidden rounded-lg bg-muted sm:h-[320px] sm:rounded-2xl"
          onClick={() => play(hero)}
        >
          <img src={hero.artworkUrl} alt={hero.title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <p className="text-sm text-muted-foreground">#1 en {data.trendingTitle}</p>
            <h2 className="text-3xl font-bold line-clamp-2">{hero.title}</h2>
            <p className="text-lg text-muted-foreground">{hero.artistName}</p>
          </div>
          <div className="absolute right-6 bottom-6 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
        </section>
      )}

      {data.topArtists.length > 0 && (
        <section>
            <h2 className="mb-4 text-xl font-bold sm:text-2xl">Artistas populares en {country}</h2>
          <HorizontalCarousel ariaLabel={`Artistas populares en ${country}`} className="gap-5 pb-3">
            {data.topArtists.map((a) => (
              <button key={a.id} className="w-36 shrink-0 snap-start group text-center" onClick={() => onOpenArtist?.(a.id)}>
                <img
                  src={a.artworkUrl || ''}
                  alt={a.name}
                  className="w-36 h-36 rounded-full object-cover border-2 border-transparent group-hover:border-primary transition-all"
                />
                <p className="mt-2 text-sm font-semibold line-clamp-1">{a.name}</p>
              </button>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {restTrending.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">{data.trendingTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {restTrending.slice(0, 10).map((t) => (
              <button key={t.id} className="group text-left" onClick={() => play(t)}>
                <div className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={t.artworkUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/40 transition-opacity">
                    <Play className="w-10 h-10 fill-current" />
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold line-clamp-1">{t.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{t.artistName}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.topSongs.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">{data.topTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6">
            {data.topSongs.slice(0, 15).map((t, i) => (
              <button
                key={t.id}
                className="flex items-center gap-3 py-2 border-b border-border/30 text-left hover:bg-muted/30 rounded px-1"
                onClick={() => play(t)}
              >
                <span className="w-6 text-sm text-muted-foreground text-right">{i + 1}</span>
                <img src={t.artworkUrl} alt={t.title} className="w-12 h-12 rounded object-cover" />
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{t.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{t.artistName}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.playlists.map((shelf) => (
        <section key={shelf.title}>
          <h2 className="text-2xl font-bold mb-4">{shelf.title}</h2>
          <HorizontalCarousel ariaLabel={shelf.title} className="gap-4 pb-3">
            {shelf.items.map((p) => (
              <div key={p.id} className="w-44 shrink-0 snap-start">
                <img src={p.artworkUrl || ''} alt={p.title} className="w-44 h-44 rounded-lg object-cover" />
                <p className="mt-2 text-sm font-semibold line-clamp-1">{p.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.subtitle}</p>
              </div>
            ))}
          </HorizontalCarousel>
        </section>
      ))}
    </div>
  );
}
