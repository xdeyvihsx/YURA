import { useSyncExternalStore } from 'react';
import type { Track } from '@/services/youtube';

export interface Playlist { id: string; name: string; tracks: Track[]; createdAt: number }
interface LibraryState { recents: Track[]; favorites: Track[]; playlists: Playlist[]; searches: string[] }

const KEY = 'yura:library';
const empty: LibraryState = { recents: [], favorites: [], playlists: [], searches: [] };

function read(): LibraryState {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return empty; }
}
let state = read();
const listeners = new Set<() => void>();
// Never keep device-only blob URLs: they die with the session.
const clean = (t: Track): Track => { const { localUrl: _l, ...rest } = t; return rest; };

function set(next: Partial<LibraryState>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useLibrary() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state);
}

export const isFavorite = (id: string) => state.favorites.some((t) => t.sourceId === id);

export function addRecent(t: Track) {
  set({ recents: [clean(t), ...state.recents.filter((x) => x.sourceId !== t.sourceId)].slice(0, 100) });
}
export function toggleFavorite(t: Track) {
  set({ favorites: isFavorite(t.sourceId) ? state.favorites.filter((x) => x.sourceId !== t.sourceId) : [clean(t), ...state.favorites] });
}
export function addSearch(q: string) {
  const v = q.trim();
  if (v.length < 2) return;
  set({ searches: [v, ...state.searches.filter((s) => s.toLowerCase() !== v.toLowerCase())].slice(0, 12) });
}
export function removeSearch(q: string) { set({ searches: state.searches.filter((s) => s !== q) }); }

export function createPlaylist(name: string): Playlist {
  const p: Playlist = { id: Math.random().toString(36).slice(2, 10), name: name.trim() || 'Mi playlist', tracks: [], createdAt: Date.now() };
  set({ playlists: [...state.playlists, p] });
  return p;
}
export function renamePlaylist(id: string, name: string) {
  set({ playlists: state.playlists.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) });
}
export function deletePlaylist(id: string) { set({ playlists: state.playlists.filter((p) => p.id !== id) }); }
export function addToPlaylist(id: string, t: Track) {
  set({ playlists: state.playlists.map((p) => (p.id === id && !p.tracks.some((x) => x.sourceId === t.sourceId) ? { ...p, tracks: [...p.tracks, clean(t)] } : p)) });
}
export function removeFromPlaylist(id: string, sourceId: string) {
  set({ playlists: state.playlists.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((x) => x.sourceId !== sourceId) } : p)) });
}
