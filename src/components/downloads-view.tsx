import { useEffect, useState } from 'react';
import { HardDriveDownload, Music2, Play, Save, Trash2, Video, X } from 'lucide-react';
import { getBlob, listDownloads, onDownloadsChange, removeDownload, saveToDevice, type DownloadItem } from '@/services/downloads';
import { usePlayer } from '@/context/player';
import type { Track } from '@/services/youtube';

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const urls = new Map<string, string>();

async function localUrl(key: string) {
  if (urls.has(key)) return urls.get(key)!;
  const blob = await getBlob(key);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(key, u);
  return u;
}

export function DownloadsView() {
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null);
  const { playTrack, current } = usePlayer();

  useEffect(() => {
    const load = () => listDownloads().then(setItems).catch(() => setItems([]));
    load();
    return onDownloadsChange(load);
  }, []);

  const songs = (items ?? []).filter((i) => i.kind === 'audio');
  const videos = (items ?? []).filter((i) => i.kind === 'video');

  const playSong = async (item: DownloadItem) => {
    const list: Track[] = [];
    for (const s of songs) {
      const u = await localUrl(s.key);
      if (u) list.push({ ...s.track, localUrl: u });
    }
    const t = list.find((x) => x.sourceId === item.track.sourceId);
    if (t) playTrack(t, list);
  };

  const openVideo = async (item: DownloadItem) => {
    const u = await localUrl(item.key);
    if (u) setVideo({ url: u, title: item.track.title });
  };

  const Row = ({ item, onPlay }: { item: DownloadItem; onPlay: () => void }) => (
    <div className={`group flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 ${current?.sourceId === item.track.sourceId && item.kind === 'audio' ? 'text-primary' : ''}`}>
      <button onClick={onPlay} className="relative h-12 w-12 shrink-0 overflow-hidden rounded" aria-label="Reproducir">
        <img src={item.track.artworkUrl} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 hidden items-center justify-center bg-background/50 group-hover:flex"><Play className="h-4 w-4 fill-current" /></span>
      </button>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium">{item.track.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.track.artistName} · {mb(item.size)}</p>
      </button>
      <button onClick={() => saveToDevice(item)} title="Guardar archivo en el equipo" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><Save className="h-4 w-4" /></button>
      <button onClick={() => removeDownload(item.key)} title="Eliminar descarga" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="mobile-page h-full overflow-y-auto px-4 pb-32 pt-20 sm:px-6">
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-bold"><HardDriveDownload className="h-7 w-7" /> Descargas</h1>
      {items && !items.length && <p className="text-muted-foreground">Aún no has descargado nada. Usa el botón de descarga en cualquier canción.</p>}

      {video && (
        <div className="mb-8 max-w-3xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">{video.title}</p>
            <button onClick={() => setVideo(null)} aria-label="Cerrar video" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <video src={video.url} controls autoPlay className="aspect-video w-full rounded-2xl bg-muted" />
        </div>
      )}

      {songs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><Music2 className="h-5 w-5" /> Canciones</h2>
          {songs.map((i) => <Row key={i.key} item={i} onPlay={() => playSong(i)} />)}
        </section>
      )}
      {videos.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><Video className="h-5 w-5" /> Videos</h2>
          {videos.map((i) => <Row key={i.key} item={i} onPlay={() => openVideo(i)} />)}
        </section>
      )}
    </div>
  );
}
