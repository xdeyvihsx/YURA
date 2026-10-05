import { AppSidebar } from "@/components/app-sidebar";
import { HeroSection } from "@/components/hero-section";
import { MiniPlayer } from "@/components/mini-player";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { VideoLayer } from "@/components/video-layer";
import type { View } from "@/lib/view";
import { usePlayer } from "@/context/player";
import { MobileNav } from "@/components/mobile-nav";
import "./App.css";

function App() {
  const [currentTrack, setCurrentTrack] = useState<{ title: string; artwork: string; artist?: string; artistId?: string } | null>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showArtistView, setShowArtistView] = useState(false);
  const [currentArtist, setCurrentArtist] = useState<string | null>(null);
  const [currentArtistId, setCurrentArtistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const searchRef = useRef<HTMLInputElement>(null);
  const player = usePlayer();

  const handlePlayTrack = (title: string, artwork: string, artist?: string, artistId?: string | null) => {
    setCurrentTrack({ title, artwork, artist, artistId: artistId || undefined });
  };

  const handleTitleClick = () => {
    setShowFullPlayer(true);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!e.target.value.trim()) handleGoHome();
    else { setShowArtistView(false); setShowFullPlayer(false); setCurrentAlbumId(null); }
  };

  const handleGoHome = () => {
    setSearchQuery('');
    setShowFullPlayer(false);
    setShowArtistView(false);
    setCurrentArtist(null);
    setCurrentArtistId(null);
    setCurrentAlbumId(null);
    setView('home');
  };

  const navigate = (v: View) => {
    handleGoHome();
    setView(v);
  };

  const openSearch = (q?: string) => {
    navigate('search');
    if (q) setSearchQuery(q);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleOpenArtist = (artistId: string) => {
    setCurrentArtistId(artistId);
    setCurrentAlbumId(null);
    setShowFullPlayer(false);
    setShowArtistView(true);
  };

  return (
    <SidebarProvider defaultOpen={true} className="!h-screen !overflow-hidden">
      <AppSidebar className="hidden md:flex" view={searchQuery ? 'search' : view} onNavigate={navigate} onSearchClick={() => openSearch()} />
      <SidebarInset className="flex min-w-0 flex-col overflow-hidden">
        <div className="relative flex h-full flex-1 flex-col overflow-hidden border-border custom-shadow md:rounded-xl md:border" data-tauri-drag-region="false">
          <header className="mobile-header absolute left-0 right-0 top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/20 bg-background/75 px-3 backdrop-blur-xl sm:px-4" data-tauri-drag-region="false">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <button type="button" onClick={handleGoHome} className="shrink-0 text-lg font-bold tracking-normal md:hidden" aria-label="Ir a inicio">YURA</button>
            <div className="mx-1 flex-1 md:mx-4 md:max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  onFocus={() => { if (view !== 'search' && !searchQuery) setView('search'); }}
                  placeholder="Buscar música"
                  className="h-10 border-0 bg-muted/50 pl-9 pr-9 focus-visible:ring-2 focus-visible:ring-primary md:pl-10"
                  value={searchQuery}
                  onChange={handleSearch}
                  onKeyDown={(e) => { if (e.key === 'Escape') handleGoHome(); }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Borrar búsqueda"
                    onClick={() => openSearch()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col overflow-hidden min-h-0" style={{ backgroundColor: 'var(--hero-bg)' }} data-tauri-drag-region="false">
            <HeroSection
              onPlayTrack={handlePlayTrack}
              showFullPlayer={showFullPlayer}
              currentTrack={currentTrack}
              onCloseFullPlayer={() => setShowFullPlayer(false)}
              showArtistView={showArtistView}
              currentArtist={currentArtist}
              currentArtistId={currentArtistId}
              onCloseArtistView={() => setShowArtistView(false)}
              searchQuery={searchQuery}
              onOpenArtist={handleOpenArtist}
              currentAlbumId={currentAlbumId}
              onOpenAlbum={(id) => { setCurrentAlbumId(id); setShowFullPlayer(false); setShowArtistView(false); }}
              onCloseAlbum={() => setCurrentAlbumId(null)}
              view={view}
              onNavigate={navigate}
              onSearch={openSearch}
            />
          </div>
        </div>
        <VideoLayer />
        {player.current && !showFullPlayer && (
          <MiniPlayer
            onClose={() => player.stop()}
            onTitleClick={handleTitleClick}
            onOpenArtist={handleOpenArtist}
          />
        )}
        {!showFullPlayer && (
          <MobileNav
            view={searchQuery ? 'search' : view}
            hasPlayer={!!player.current}
            onNavigate={navigate}
            onSearch={() => openSearch()}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
