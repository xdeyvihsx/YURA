import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { YouTubeVideo, getArtist, ArtistData, YouTubeArtist } from '@/services/youtube';
import { AlbumCard } from '@/components/album-card';
import { ArtistCard } from '@/components/artist-card';
import { ArtistView } from '@/components/artist-view';
import { HomeView } from '@/components/home-view';
import { useRef } from 'react';
import { FullPlayer } from '@/components/full-player';
import { AlbumView } from '@/components/album-view';
import { usePlayer } from '@/context/player';
import { videoToTrack } from '@/services/youtube';
import { HorizontalCarousel } from '@/components/horizontal-carousel';
import { SearchResults } from '@/components/search-results';
import { DownloadsView } from '@/components/downloads-view';
import { searchAll, type SearchAll } from '@/services/youtube';
import { addSearch } from '@/services/library';
import type { View } from '@/lib/view';
import { FavoritesView, LibraryHome, PlaylistView, PlaylistsView, PodcastsView, RecentsView, SearchHome } from '@/components/library-views';

interface HeroSectionProps {
  onPlayTrack?: (title: string, artwork: string, artist?: string, artistId?: string | null) => void;
  showFullPlayer?: boolean;
  currentTrack?: { title: string; artwork: string; artist?: string; artistId?: string } | null;
  onCloseFullPlayer?: () => void;
  showArtistView?: boolean;
  currentArtist?: string | null;
  currentArtistId?: string | null;
  onCloseArtistView?: () => void;
  searchQuery?: string;
  onOpenArtist?: (artistId: string) => void;
  currentAlbumId?: string | null;
  onOpenAlbum?: (id: string) => void;
  onCloseAlbum?: () => void;
  view?: View;
  onNavigate?: (v: View) => void;
  onSearch?: (q: string) => void;
}

export function HeroSection({ onPlayTrack, showFullPlayer, onCloseFullPlayer, showArtistView, currentArtist, currentArtistId, onCloseArtistView, searchQuery, onOpenArtist, currentAlbumId, onOpenAlbum, onCloseAlbum, view = 'home', onNavigate, onSearch }: HeroSectionProps) {
  const player = usePlayer();
  const [trending, setTrending] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const [searchArtists, setSearchArtists] = useState<YouTubeArtist[]>([]);
  const [results, setResults] = useState<SearchAll | null>(null);

  const searchSeq = useRef(0);

  useEffect(() => {
    const q = (searchQuery || '').trim();
    const seq = ++searchSeq.current;
    if (!q) {
      // Back to home: forget everything from the previous search.
      setSearchArtists([]);
      setTrending([]);
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchAll(q);
        if (seq !== searchSeq.current) return;
        setResults(r);
        if (r.top || r.tracks.length) setTimeout(() => { if (seq === searchSeq.current) addSearch(q); }, 1500);
      } catch (error) {
        if (seq !== searchSeq.current) return;
        console.error('Error searching content:', error);
        setResults({ top: null, tracks: [], videos: [], albums: [], artists: [] });
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (showArtistView && currentArtistId) {
      loadArtistData(currentArtistId);
    }
  }, [showArtistView, currentArtistId]);

  const loadArtistData = async (artistId: string) => {
    setLoadingArtist(true);
    try {
      const data = await getArtist(artistId);
      setArtistData(data);
    } catch (error) {
      console.error('Error loading artist data:', error);
    } finally {
      setLoadingArtist(false);
    }
  };

  const handlePlay = (video: YouTubeVideo) => {
    const list = trending.map(videoToTrack);
    player.playTrack(videoToTrack(video), list);
    onPlayTrack?.(video.title, video.thumbnails[0]?.url, video.author.name, video.author.id);
  };

  const isSearching = !!(searchQuery || '').trim();

  if (loading && isSearching && !showFullPlayer && !showArtistView) {
    return (
      <div className="p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (showFullPlayer && player.current) {
    return <FullPlayer onClose={() => onCloseFullPlayer?.()} onOpenArtist={(id) => onOpenArtist?.(id)} />;
  }

  if (currentAlbumId) {
    return <AlbumView albumId={currentAlbumId} onBack={() => onCloseAlbum?.()} onOpenArtist={(id) => onOpenArtist?.(id)} />;
  }

  if (showArtistView && (currentArtist || currentArtistId)) {
    return (
      <ArtistView
        data={artistData}
        loading={loadingArtist}
        onBack={() => onCloseArtistView?.()}
        onPlayTrack={(t, list, opts) => { player.playTrack(t, list, opts); onPlayTrack?.(t.title, t.artworkUrl, t.artistName || undefined, t.artistId || undefined); }}
        onOpenAlbum={(id) => onOpenAlbum?.(id)}
        onOpenArtist={(id) => onOpenArtist?.(id)}
      />
    );
  }


  if (!isSearching) {
    if (view === 'downloads') return <DownloadsView />;
    if (view === 'search') return <SearchHome onSearch={(q) => onSearch?.(q)} />;
    if (view === 'library') return <LibraryHome onNavigate={(next) => onNavigate?.(next)} />;
    if (view === 'recents') return <RecentsView onOpenArtist={onOpenArtist} />;
    if (view === 'favorites') return <FavoritesView onOpenArtist={onOpenArtist} />;
    if (view === 'podcasts') return <PodcastsView onOpenArtist={onOpenArtist} />;
    if (view === 'playlists') return <PlaylistsView onOpen={(id) => onNavigate?.(`playlist:${id}`)} />;
    if (view.startsWith('playlist:')) return <PlaylistView id={view.slice(9)} onOpenArtist={onOpenArtist} />;
    return <HomeView onOpenArtist={onOpenArtist} />;
  }

  if (results) {
    return <SearchResults data={results} onOpenArtist={onOpenArtist} onOpenAlbum={onOpenAlbum} />;
  }

  return (
    <div className="mobile-page flex h-full min-h-0 flex-col space-y-8 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-20">
      {/* Artistas destacados - Solo cuando hay búsqueda */}
      {searchArtists.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Artistas destacados</h2>
          <HorizontalCarousel ariaLabel="Artistas destacados" className="gap-4 pb-4">
            {searchArtists.map((artist) => (
              <div
                key={artist.id}
                className="shrink-0 snap-start cursor-pointer group"
                onClick={() => onOpenArtist?.(artist.id)}
              >
                <div className="relative w-40 h-40 mb-3">
                  <img
                    src={artist.thumbnails[0]?.url}
                    alt={artist.name}
                    className="w-full h-full object-cover rounded-full border-2 border-transparent group-hover:border-primary transition-all"

                  />
                </div>
                <h3 className="font-semibold text-sm text-center line-clamp-1">{artist.name}</h3>
              </div>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {/* Volver a escuchar - Estilo YouTube Music */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Volver a escuchar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trending.slice(0, 2).map((video) => (
            <div
              key={video.id}
              className="group relative aspect-[16/9] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
              onClick={() => handlePlay(video)}
            >
              <img
                src={video.thumbnails[0]?.url}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-semibold text-lg line-clamp-2">{video.title}</h3>
                <p className="text-white/70 text-sm line-clamp-1">{video.author.name}</p>
              </div>
              <img
                src={video.thumbnails[0]?.url}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-semibold text-lg line-clamp-2">{video.title}</h3>
                <p className="text-white/70 text-sm">{video.author.name}</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-2xl bg-background/60 border-border/20"
                >
                  <Play className="w-10 h-10 text-white fill-current ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recaps - Estilo YouTube Music */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Resumen musical</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {trending.slice(2, 6).map((video) => (
            <AlbumCard key={video.id} video={video} onPlay={() => handlePlay(video)} />
          ))}
        </div>
      </section>

      {/* Tendencias - Estilo Spotify */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Tendencias</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {trending.slice(0, 10).map((video) => (
            <AlbumCard key={video.id} video={video} onPlay={() => handlePlay(video)} />
          ))}
        </div>
      </section>

      {/* Artistas destacados - Estilo Apple Music */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Artistas destacados</h2>
        <HorizontalCarousel ariaLabel="Artistas destacados" className="gap-4 pb-4">
          {trending.slice(0, 8).map((video) => (
            <ArtistCard key={video.id} name={video.author.name} image={video.thumbnails[0]?.url} />
          ))}
        </HorizontalCarousel>
      </section>
    </div>
  );
}
