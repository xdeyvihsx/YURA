import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type React from 'react';
import { getUpNext, streamUrl, type Track } from '@/services/youtube';
import { cachedStream, prefetchStream } from '@/services/stream-cache';
import { addRecent } from '@/services/library';

type Mode = 'audio' | 'video';
export type Repeat = 'off' | 'all' | 'one';

const shuffled = <T,>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const readPref = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  mode: Mode;
  repeat: Repeat;
  shuffle: boolean;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  playTrack: (track: Track, list?: Track[], opts?: { video?: boolean }) => void;
  playAt: (i: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setMode: (m: Mode) => void;
  /** Used by the video player to report its own clock while audio is paused. */
  reportVideoTime: (t: number, d?: number) => void;
  stop: () => void;
}

// Keep one context object across hot reloads so the provider and consumers always match.
const g = globalThis as { __yuraPlayerCtx?: React.Context<PlayerState | null> };
const Ctx = (g.__yuraPlayerCtx ??= createContext<PlayerState | null>(null));

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer outside PlayerProvider');
  return c;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [mode, setModeState] = useState<Mode>('audio');
  const modeRef = useRef<Mode>('audio');
  const [repeat, setRepeat] = useState<Repeat>(() => (readPref('yura:repeat') as Repeat) || 'off');
  const [shuffle, setShuffle] = useState(() => readPref('yura:shuffle') === '1');
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const originalRef = useRef<Track[] | null>(null);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const extendingRef = useRef(false);
  queueRef.current = queue;
  indexRef.current = index;

  const current = index >= 0 ? queue[index] ?? null : null;

  const blobRef = useRef<string | null>(null);
  const loadSeq = useRef(0);
  const load = useCallback(async (t: Track, autoplay = true, startAt = 0) => {
    const a = audioRef.current;
    if (!a) return;
    const seq = ++loadSeq.current;
    setError(null);
    setLoading(true);
    setCurrentTime(startAt);
    setDuration(t.durationSeconds || 0);
    addRecent(t);
    // Songs already buffered on the device start instantly and survive a dropped connection.
    const cached = t.localUrl ? null : await cachedStream(t.sourceId);
    if (seq !== loadSeq.current) { if (cached) URL.revokeObjectURL(cached); return; }
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = cached;
    a.src = t.localUrl ?? cached ?? streamUrl(t.sourceId);
    if (startAt) a.currentTime = startAt;
    if (autoplay && modeRef.current === 'audio') a.play().catch(() => setIsPlaying(false));
  }, []);

  // Buffer the current song and the next three in the background.
  useEffect(() => {
    if (index < 0) return;
    const upcoming = queue.slice(index + 1, index + 4);
    const cur = queue[index];
    const timer = setTimeout(async () => {
      for (const t of upcoming) await prefetchStream(t);
      if (cur) await prefetchStream(cur);
    }, 1500);
    return () => clearTimeout(timer);
  }, [index, queue]);

  // Grow the queue with YouTube Music's radio when we are near the end.
  const extendQueue = useCallback(async () => {
    const q = queueRef.current;
    const last = q[q.length - 1];
    if (!last || extendingRef.current) return;
    extendingRef.current = true;
    try {
      const more = await getUpNext(last.sourceId);
      const seen = new Set(queueRef.current.map((t) => t.sourceId));
      const fresh = more.filter((t) => !seen.has(t.sourceId));
      if (fresh.length) setQueue((prev) => [...prev, ...fresh]);
    } finally {
      extendingRef.current = false;
    }
  }, []);

  const playAt = useCallback(
    (i: number) => {
      const t = queueRef.current[i];
      if (!t) return;
      setIndex(i);
      load(t);
      if (i >= queueRef.current.length - 2) extendQueue();
    },
    [load, extendQueue],
  );

  const next = useCallback(() => {
    const i = indexRef.current + 1;
    if (i < queueRef.current.length) playAt(i);
    else if (repeatRef.current === 'all' && queueRef.current.length) playAt(0);
    else extendQueue().then(() => setTimeout(() => playAt(indexRef.current + 1), 0));
  }, [playAt, extendQueue]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    if (indexRef.current > 0) playAt(indexRef.current - 1);
  }, [playAt]);

  const playTrack = useCallback(
    (track: Track, list?: Track[], opts?: { video?: boolean }) => {
      let base = list && list.some((t) => t.sourceId === track.sourceId) ? list : [track];
      originalRef.current = base;
      if (shuffleRef.current) base = [track, ...shuffled(base.filter((t) => t.sourceId !== track.sourceId))];
      const i = base.findIndex((t) => t.sourceId === track.sourceId);
      queueRef.current = base;
      setQueue(base);
      const m: Mode = opts?.video ? 'video' : 'audio';
      modeRef.current = m;
      setModeState(m);
      setIndex(i);
      indexRef.current = i;
      load(track, true);
      if (base.length - i <= 2) extendQueue();
    },
    [load, extendQueue],
  );

  // Audio element events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => modeRef.current === 'audio' && setCurrentTime(a.currentTime);
    const onDur = () => isFinite(a.duration) && a.duration > 0 && setDuration(a.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => modeRef.current === 'audio' && setIsPlaying(false);
    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onEnded = () => {
      if (repeatRef.current === 'one') { a.currentTime = 0; a.play().catch(() => {}); return; }
      next();
    };
    let skipTimer: ReturnType<typeof setTimeout> | undefined;
    const onError = () => {
      if (!a.src) return;
      setLoading(false);
      setIsPlaying(false);
      setError('No disponible');
      skipTimer = setTimeout(() => {
        if (modeRef.current === 'audio') next();
      }, 2500);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('canplay', onPlaying);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      clearTimeout(skipTimer);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('loadedmetadata', onDur);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('canplay', onPlaying);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, [next]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    if (modeRef.current === 'video') {
      window.dispatchEvent(new CustomEvent('yura:video-toggle'));
      return;
    }
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, []);

  const seek = useCallback((t: number) => {
    if (modeRef.current === 'video') {
      window.dispatchEvent(new CustomEvent('yura:video-seek', { detail: t }));
      setCurrentTime(t);
      return;
    }
    const a = audioRef.current;
    if (a) a.currentTime = t;
    setCurrentTime(t);
  }, []);

  const setVolume = useCallback((v: number) => {
    const val = Math.max(0, Math.min(1, v));
    if (audioRef.current) audioRef.current.volume = val;
    setVolumeState(val);
    setMutedState(val === 0);
    if (audioRef.current) audioRef.current.muted = val === 0;
  }, []);

  const setMuted = useCallback((m: boolean) => {
    if (audioRef.current) audioRef.current.muted = m;
    setMutedState(m);
  }, []);

  const setMode = useCallback((m: Mode) => {
    const a = audioRef.current;
    if (m === modeRef.current) return;
    modeRef.current = m;
    setModeState(m);
    if (!a) return;
    if (m === 'video') {
      a.pause();
    } else {
      // Resume the song where the video left off.
      a.currentTime = currentTimeRef.current;
      a.play().catch(() => {});
    }
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const n: Repeat = r === 'off' ? 'all' : r === 'all' ? 'one' : 'off';
      try { localStorage.setItem('yura:repeat', n); } catch { /* ignore */ }
      return n;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    const on = !shuffleRef.current;
    shuffleRef.current = on;
    setShuffle(on);
    try { localStorage.setItem('yura:shuffle', on ? '1' : '0'); } catch { /* ignore */ }
    const q = queueRef.current;
    const i = indexRef.current;
    const cur = q[i];
    if (!cur) return;
    let nq: Track[];
    if (on) {
      originalRef.current = q;
      nq = [...q.slice(0, i + 1), ...shuffled(q.slice(i + 1))];
    } else {
      const orig = originalRef.current ?? q;
      const known = new Set(orig.map((t) => t.sourceId));
      nq = [...orig, ...q.filter((t) => !known.has(t.sourceId))];
    }
    const ni = nq.findIndex((t) => t.sourceId === cur.sourceId);
    queueRef.current = nq;
    indexRef.current = ni;
    setQueue(nq);
    setIndex(ni);
  }, []);

  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const reportVideoTime = useCallback((t: number, d?: number) => {
    setCurrentTime(t);
    if (d && d > 0) setDuration(d);
    setLoading(false);
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    setQueue([]);
    setIndex(-1);
    setIsPlaying(false);
    modeRef.current = 'audio';
    setModeState('audio');
  }, []);

  // Keyboard space = play/pause (when not typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Video player reports play state too
  useEffect(() => {
    const onState = (e: Event) => setIsPlaying(!!(e as CustomEvent).detail);
    window.addEventListener('yura:video-state', onState);
    return () => window.removeEventListener('yura:video-state', onState);
  }, []);

  return (
    <Ctx.Provider
      value={{
        queue, index, current, isPlaying, loading, error, currentTime, duration, volume, muted, mode, repeat, shuffle, cycleRepeat, toggleShuffle,
        playTrack, playAt, toggle, next, prev, seek, setVolume, setMuted, setMode, reportVideoTime, stop,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
