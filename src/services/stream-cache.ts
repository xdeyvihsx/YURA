import { streamUrl, type Track } from '@/services/youtube';

/** Spotify-style buffer: keeps the current and upcoming songs on the device. */
const CACHE = 'yura-stream';
const INDEX = 'yura:stream-index';
const MAX_BYTES = 300 * 1024 * 1024;
const supported = () => typeof caches !== 'undefined';
const keyFor = (id: string) => `/yura-stream/${id}`;
const inflight = new Map<string, Promise<void>>();

type Entry = { id: string; size: number; at: number };
const readIndex = (): Entry[] => { try { return JSON.parse(localStorage.getItem(INDEX) || '[]'); } catch { return []; } };
const writeIndex = (e: Entry[]) => { try { localStorage.setItem(INDEX, JSON.stringify(e)); } catch { /* ignore */ } };

export async function cachedStream(id: string): Promise<string | null> {
  if (!supported()) return null;
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(keyFor(id));
    if (!r) return null;
    const blob = await r.blob();
    if (!blob.size) return null;
    writeIndex(readIndex().map((e) => (e.id === id ? { ...e, at: Date.now() } : e)));
    return URL.createObjectURL(blob);
  } catch { return null; }
}

async function evict(c: Cache) {
  const idx = readIndex().sort((a, b) => b.at - a.at);
  let total = 0;
  const keep: Entry[] = [];
  for (const e of idx) {
    total += e.size;
    if (total > MAX_BYTES) await c.delete(keyFor(e.id));
    else keep.push(e);
  }
  writeIndex(keep);
}

export function prefetchStream(t: Track): Promise<void> {
  const id = t.sourceId;
  if (!supported() || t.localUrl || inflight.has(id) || (typeof navigator !== 'undefined' && !navigator.onLine)) return inflight.get(id) ?? Promise.resolve();
  const job = (async () => {
    try {
      const c = await caches.open(CACHE);
      if (await c.match(keyFor(id))) return;
      const res = await fetch(streamUrl(id));
      if (!res.ok) return;
      const blob = await res.blob();
      if (blob.size < 50_000) return;
      await c.put(keyFor(id), new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/webm' } }));
      writeIndex([{ id, size: blob.size, at: Date.now() }, ...readIndex().filter((e) => e.id !== id)]);
      await evict(c);
    } catch { /* offline or blocked: just stream later */ }
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}
