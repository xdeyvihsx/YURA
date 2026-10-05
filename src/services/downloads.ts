import { downloadUrl, type Track } from '@/services/youtube';

export type DownloadKind = 'audio' | 'video';
export interface DownloadItem {
  key: string; // `${sourceId}:${kind}`
  kind: DownloadKind;
  track: Track;
  mimeType: string;
  size: number;
  savedAt: number;
}

const DB = 'yura-downloads';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const listeners = new Set<() => void>();
export const onDownloadsChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((fn) => fn());

/** Progress of downloads in flight, keyed like DownloadItem.key (0..1, or -1 if unknown). */
export const progress = new Map<string, number>();

export async function listDownloads(): Promise<DownloadItem[]> {
  const rows = await tx<Array<DownloadItem & { blob: Blob }>>('readonly', (s) => s.getAll());
  return rows.map(({ blob: _b, ...m }) => m).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getBlob(key: string): Promise<Blob | null> {
  const row = await tx<(DownloadItem & { blob: Blob }) | undefined>('readonly', (s) => s.get(key));
  return row?.blob ?? null;
}

export async function removeDownload(key: string) {
  await tx('readwrite', (s) => s.delete(key));
  emit();
}

const fileName = (t: Track) => `${t.artistName ? `${t.artistName} - ` : ''}${t.title}`;

export async function downloadTrack(track: Track, kind: DownloadKind) {
  const key = `${track.sourceId}:${kind}`;
  if (progress.has(key)) return;
  progress.set(key, 0);
  emit();
  try {
    const res = await fetch(downloadUrl(track.sourceId, kind, fileName(track)));
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      progress.set(key, total ? got / total : -1);
      emit();
    }
    const mimeType = res.headers.get('content-type') || (kind === 'video' ? 'video/mp4' : 'audio/mp4');
    const blob = new Blob(chunks, { type: mimeType });
    const { localUrl: _l, ...clean } = track;
    await tx('readwrite', (s) => s.put({ key, kind, track: clean, mimeType, size: blob.size, savedAt: Date.now(), blob }));
  } finally {
    progress.delete(key);
    emit();
  }
}

/** Saves a stored download as a real file on the device. */
export async function saveToDevice(item: DownloadItem) {
  const blob = await getBlob(item.key);
  if (!blob) return;
  const ext = item.kind === 'video' ? 'mp4' : item.mimeType.includes('webm') ? 'webm' : 'm4a';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName(item.track)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
