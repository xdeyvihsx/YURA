import { useState } from 'react';
import { Download, Heart, Home, Library, ListMusic, Mic, MoreHorizontal, Plus, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createPlaylist } from '@/services/library';
import type { View } from '@/lib/view';

interface MobileNavProps {
  view: View;
  hasPlayer: boolean;
  onNavigate: (view: View) => void;
  onSearch: () => void;
}

const primary = [
  { label: 'Inicio', icon: Home, view: 'home' as const },
  { label: 'Buscar', icon: Search, view: 'search' as const },
  { label: 'Biblioteca', icon: Library, view: 'library' as const },
  { label: 'Descargas', icon: Download, view: 'downloads' as const },
];

export function MobileNav({ view, hasPlayer, onNavigate, onSearch }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const moreActive = view === 'podcasts' || view === 'playlists' || view.startsWith('playlist:');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const playlist = createPlaylist(name.trim());
    setName('');
    setCreating(false);
    setMoreOpen(false);
    onNavigate(`playlist:${playlist.id}`);
  };

  return (
    <nav className={`mobile-bottom-nav md:hidden ${hasPlayer ? 'has-player' : ''}`} aria-label="Navegación principal">
      <div className="grid h-full grid-cols-5">
        {primary.map((item) => {
          const active = item.view === 'library'
            ? view === 'library' || view === 'recents' || view === 'favorites'
            : view === item.view;
          const Icon = item.icon;
          return (
            <Button
              key={item.view}
              type="button"
              variant="ghost"
              onClick={() => item.view === 'search' ? onSearch() : onNavigate(item.view)}
              className={`mobile-nav-item ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon />
              <span>{item.label}</span>
            </Button>
          );
        })}

        <Popover open={moreOpen} onOpenChange={(open) => { setMoreOpen(open); if (!open) setCreating(false); }}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" className={`mobile-nav-item ${moreActive ? 'is-active' : ''}`}>
              <MoreHorizontal />
              <span>Más</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={12} className="mb-safe w-64 p-2">
            {creating ? (
              <form className="space-y-3 p-2" onSubmit={submit}>
                <p className="font-semibold">Nueva playlist</p>
                <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la playlist" maxLength={60} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={!name.trim()}>Crear</Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-1">
                <Button variant="ghost" className="justify-start" onClick={() => { onNavigate('podcasts'); setMoreOpen(false); }}><Mic /> Podcasts</Button>
                <Button variant="ghost" className="justify-start" onClick={() => { onNavigate('playlists'); setMoreOpen(false); }}><ListMusic /> Tus playlists</Button>
                <Button variant="ghost" className="justify-start" onClick={() => { onNavigate('recents'); setMoreOpen(false); }}><Clock /> Recientes</Button>
                <Button variant="ghost" className="justify-start" onClick={() => { onNavigate('favorites'); setMoreOpen(false); }}><Heart /> Favoritos</Button>
                <Button variant="ghost" className="justify-start" onClick={() => setCreating(true)}><Plus /> Crear playlist</Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}