import { Heart, ListPlus, MoreHorizontal, Plus, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { addToPlaylist, createPlaylist, toggleFavorite, useLibrary } from '@/services/library';
import type { Track } from '@/services/youtube';

export function HeartButton({ track, className = '' }: { track: Track; className?: string }) {
  const { favorites } = useLibrary();
  const on = favorites.some((t) => t.sourceId === track.sourceId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleFavorite(track); }}
      aria-label={on ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      aria-pressed={on}
      className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted ${on ? 'text-primary' : ''} ${className}`}
    >
      <Heart className={`h-4 w-4 ${on ? 'fill-current' : ''}`} />
    </button>
  );
}

export function AddToPlaylistMenu({ track, className = '' }: { track: Track; className?: string }) {
  const { playlists } = useLibrary();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} aria-label="Más opciones" className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted ${className}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => toggleFavorite(track)}><Heart className="h-4 w-4" /> Favoritos</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground"><ListPlus className="h-3.5 w-3.5" /> Añadir a playlist</DropdownMenuLabel>
        {playlists.map((p) => {
          const has = p.tracks.some((t) => t.sourceId === track.sourceId);
          return (
            <DropdownMenuItem key={p.id} disabled={has} onSelect={() => addToPlaylist(p.id, track)}>
              {has ? <Check className="h-4 w-4" /> : <span className="w-4" />} <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem onSelect={() => { const p = createPlaylist(`Mi playlist ${playlists.length + 1}`); addToPlaylist(p.id, track); }}>
          <Plus className="h-4 w-4" /> Nueva playlist
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TrackActions({ track, className = '' }: { track: Track; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <HeartButton track={track} />
      <AddToPlaylistMenu track={track} />
    </span>
  );
}
