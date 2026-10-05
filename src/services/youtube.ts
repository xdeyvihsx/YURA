// Tauri talks to the local sidecar; in a browser the music server lives on the same address.
export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const BACKEND_URL = IS_TAURI ? 'http://localhost:3000' : '';

const IMG_HOST = /^https:\/\/([\w-]+\.)*(googleusercontent\.com|ggpht\.com|ytimg\.com)\//;
/** The desktop webview blocks Google image hosts (tracking prevention), so images go through the local server there. */
export function img(url: string | null | undefined): string {
  if (!url) return '';
  return IS_TAURI && IMG_HOST.test(url) ? `${BACKEND_URL}/api/img?u=${encodeURIComponent(url)}` : url;
}
function proxyImages<T>(v: T): T {
  if (!IS_TAURI) return v;
  if (typeof v === 'string') return img(v) as unknown as T;
  if (Array.isArray(v)) return v.map(proxyImages) as unknown as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = proxyImages(x);
    return o as T;
  }
  return v;
}

/** Ask YouTube/YT Music CDNs for a large image instead of the 60px default. */
export function hiResArtwork(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('/api/img?u=')) return url;
  let out = url;
  if (/googleusercontent\.com|ggpht\.com/.test(out)) {
    out = out.replace(/=w\d+-h\d+[^&?#]*/, '=w544-h544-l90-rj').replace(/=s\d+[^&?#]*/, '=s544');
  }
  return out.replace(/\/(default|mqdefault|sddefault)\.jpg/, '/hqdefault.jpg');
}

export interface Track {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  artistName: string | null;
  artistId: string | null;
  artists?: TrackArtist[];
  albumName: string | null;
  albumId: string | null;
  durationSeconds: number | null;
  artworkUrl: string;
  isExplicit: boolean;
  /** Set for downloaded songs: plays from the device instead of the server. */
  localUrl?: string;
}

export interface TrackArtist {
  name: string;
  id: string | null;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  author: {
    name: string;
    id: string;
  };
  artists?: TrackArtist[];
  thumbnails: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  duration: string;
}

export interface YouTubeArtist {
  id: string;
  name: string;
  thumbnails: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

export interface YouTubeAlbum {
  id: string;
  title: string;
  author: string;
  thumbnails: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

export interface ArtistData {
  id: string;
  name: string;
  artworkUrl: string;
  description: string | null;
  subscribers: string | null;
  topSongs: Track[];
  sections: Array<{
    order: number;
    title: string;
    kind: string;
    items: Array<{
      id: string;
      title: string;
      subtitle: string | null;
      year: string | null;
      type: string;
      artworkUrl: string;
    }>;
  }>;
  partial: boolean;
  latestRelease?: ArtistCardItem | null;
}

export interface ArtistCardItem {
  id: string;
  title: string;
  subtitle: string | null;
  year: string | null;
  type: string;
  artworkUrl: string;
}

interface SearchResponse {
  tracks: Track[];
  artists?: Array<{
    id: string;
    name: string;
    artworkUrl: string;
  }>;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return proxyImages(await response.json());
}

export async function getTrendingMusic(): Promise<YouTubeVideo[]> {
  try {
    const response = await fetchJson<SearchResponse>('/api/search?q=música&limit=20');
    return response.tracks.map((track): YouTubeVideo => ({
      id: track.sourceId,
      title: track.title,
      author: {
        name: track.artistName || 'Desconocido',
        id: track.artistId || '',
      },
      artists: track.artists,
      thumbnails: [
        {
          url: hiResArtwork(track.artworkUrl) || track.artworkUrl,
          width: 300,
          height: 300,
        },
      ],
      duration: track.durationSeconds ? formatDuration(track.durationSeconds) : '0:00',
    }));
  } catch (error) {
    console.error('Error fetching trending music:', error);
    return [];
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function searchMusic(query: string): Promise<{ videos: YouTubeVideo[]; artists: YouTubeArtist[] }> {
  try {
    const response = await fetchJson<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
    const videos = response.tracks.map((track): YouTubeVideo => ({
      id: track.sourceId,
      title: track.title,
      author: {
        name: track.artistName || 'Desconocido',
        id: track.artistId || '',
      },
      artists: track.artists,
      thumbnails: [
        {
          url: hiResArtwork(track.artworkUrl) || track.artworkUrl,
          width: 300,
          height: 300,
        },
      ],
      duration: track.durationSeconds ? formatDuration(track.durationSeconds) : '0:00',
    }));
    const artists = (response.artists || []).map((artist): YouTubeArtist => ({
      id: artist.id,
      name: artist.name,
      thumbnails: [
        {
          url: hiResArtwork(artist.artworkUrl) || artist.artworkUrl,
          width: 300,
          height: 300,
        },
      ],
    }));
    return { videos, artists };
  } catch (error) {
    console.error('Error searching music:', error);
    return { videos: [], artists: [] };
  }
}

export async function getArtist(artistId: string): Promise<ArtistData> {
  try {
    const data = await fetchJson<ArtistData>(`/api/artist/${artistId}/full`);
    return data;
  } catch (error) {
    console.error('Error fetching artist:', error);
    throw error;
  }
}

export async function getHomeFeed() {
  return await getTrendingMusic();
}

export interface HomeData {
  country: string;
  trendingTitle: string;
  topTitle: string;
  trending: Track[];
  topSongs: Track[];
  topArtists: { id: string; name: string; artworkUrl: string | null }[];
  playlists: { title: string; items: { id: string; title: string; subtitle: string | null; artworkUrl: string | null }[] }[];
}

/** Country of the device: IP lookup first, then the browser's language region. */
export async function detectCountry(): Promise<string> {
  const cachedCountry = typeof localStorage !== 'undefined' ? localStorage.getItem('yura:country') : null;
  if (cachedCountry) return cachedCountry;
  let gl: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('https://ipapi.co/country/', { signal: ctrl.signal });
    clearTimeout(timer);
    const txt = (await r.text()).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(txt)) gl = txt;
  } catch { /* ignore */ }
  if (!gl) {
    const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    for (const l of langs) {
      const m = /[-_]([A-Za-z]{2})\b/.exec(l || '');
      if (m) { gl = m[1].toUpperCase(); break; }
    }
  }
  gl = gl || 'US';
  try { localStorage.setItem('yura:country', gl); } catch { /* ignore */ }
  return gl;
}

export async function getHomeData(gl: string): Promise<HomeData> {
  return await fetchJson<HomeData>(`/api/home?gl=${encodeURIComponent(gl)}`);
}

// ---------- Playback helpers ----------
export interface AlbumData {
  id: string;
  title: string | null;
  subtitle: string | null;
  artistName: string | null;
  artistId: string | null;
  artworkUrl: string | null;
  tracks: Track[];
}

export interface LyricLine { time: number; text: string }
export interface Lyrics { synced: LyricLine[] | null; plain: string | null }

const isAppleWebKit = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);

export function streamUrl(videoId: string): string {
  return `${BACKEND_URL}/api/stream/${videoId}/audio?format=${isAppleWebKit() ? 'mp4' : 'webm'}`;
}

export async function getAlbum(id: string): Promise<AlbumData> {
  return await fetchJson<AlbumData>(`/api/album/${encodeURIComponent(id)}`);
}

export async function getUpNext(videoId: string): Promise<Track[]> {
  try {
    const r = await fetchJson<{ tracks: Track[] }>(`/api/up-next/${videoId}`);
    return r.tracks || [];
  } catch {
    return [];
  }
}

const counterparts = new Map<string, Promise<{ songId: string | null; videoId: string | null }>>();
/** Memoized so the player, the video layer and prefetching share one request per song. */
export function getCounterpart(t: Track): Promise<{ songId: string | null; videoId: string | null }> {
  const hit = counterparts.get(t.sourceId);
  if (hit) return hit;
  const q = new URLSearchParams({ title: t.title, artist: t.artistName || '', artistId: t.artistId || '' });
  const p = fetchJson<{ songId: string | null; videoId: string | null }>(`/api/counterpart/${t.sourceId}?${q}`).catch(() => {
    counterparts.delete(t.sourceId);
    return { songId: t.sourceId, videoId: null };
  });
  counterparts.set(t.sourceId, p);
  return p;
}

export async function getPodcasts(q: string): Promise<Track[]> {
  const r = await fetchJson<{ tracks: Track[] }>(`/api/podcasts?q=${encodeURIComponent(q)}`);
  return (r.tracks || []).map((t) => ({ ...t, artworkUrl: hiResArtwork(t.artworkUrl) || t.artworkUrl }));
}

const cleanTitle = (s: string) => s.replace(/\(.*?\)|\[.*?\]/g, '').replace(/official|video|oficial|lyrics?/gi, '').replace(/\s+-\s+.*$/, '').trim();

export async function getLyrics(t: Track): Promise<Lyrics> {
  const artist = (t.artistName || '').split(',')[0].trim();
  let title = cleanTitle(t.title);
  // "Artist - Song" style video titles
  const dash = t.title.split(' - ');
  if (dash.length > 1 && artist && dash[0].toLowerCase().includes(artist.toLowerCase())) title = cleanTitle(dash.slice(1).join(' - '));
  try {
    const rows = await fetchJson<Array<{ syncedLyrics?: string | null; plainLyrics?: string | null; duration?: number }>>(
      `/api/lyrics?${new URLSearchParams({ title, artist })}`,
    );
    const pick = rows.find((r) => r.syncedLyrics) || rows.find((r) => r.plainLyrics);
    if (!pick) return { synced: null, plain: null };
    let synced: LyricLine[] | null = null;
    if (pick.syncedLyrics) {
      synced = pick.syncedLyrics
        .split('\n')
        .map((l) => {
          const m = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/.exec(l.trim());
          return m ? { time: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() } : null;
        })
        .filter((x): x is LyricLine => !!x);
    }
    return { synced, plain: pick.plainLyrics || null };
  } catch {
    return { synced: null, plain: null };
  }
}

/** Builds a Track from the lighter card/video objects used across the UI. */
export function videoToTrack(v: YouTubeVideo): Track {
  return {
    id: `youtube:${v.id}`, source: 'youtube', sourceId: v.id, title: v.title,
    artistName: v.author.name, artistId: v.author.id || null, artists: v.artists?.length ? v.artists : [{ name: v.author.name, id: v.author.id || null }], albumName: null, albumId: null,
    durationSeconds: null, artworkUrl: v.thumbnails[0]?.url || img(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`), isExplicit: false,
  };
}

// ---------- Full search ----------
export interface SearchAlbum {
  id: string;
  title: string;
  subtitle: string | null;
  year: string | null;
  type: string;
  artworkUrl: string | null;
  artistName: string | null;
  artistId: string | null;
}
export interface SearchArtist { id: string; name: string; artworkUrl: string | null }
export type SearchTop =
  | { kind: 'track'; track: Track }
  | { kind: 'album'; album: SearchAlbum }
  | { kind: 'artist'; artist: SearchArtist };
export interface SearchAll {
  top: SearchTop | null;
  tracks: Track[];
  videos: Track[];
  albums: SearchAlbum[];
  artists: SearchArtist[];
}

export async function searchAll(query: string): Promise<SearchAll> {
  const r = await fetchJson<Partial<SearchAll>>(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
  const art = (t: Track): Track => ({ ...t, artworkUrl: hiResArtwork(t.artworkUrl) || t.artworkUrl });
  return {
    top: r.top ?? null,
    tracks: (r.tracks ?? []).map(art),
    videos: (r.videos ?? []).map(art),
    albums: (r.albums ?? []).map((a) => ({ ...a, artworkUrl: hiResArtwork(a.artworkUrl) })),
    artists: (r.artists ?? []).map((a) => ({ ...a, artworkUrl: hiResArtwork(a.artworkUrl) })),
  };
}

export function downloadUrl(videoId: string, kind: 'audio' | 'video', name: string): string {
  const q = new URLSearchParams({ kind, name, format: isAppleWebKit() ? 'mp4' : 'webm' });
  return `${BACKEND_URL}/api/download/${videoId}?${q}`;
}
