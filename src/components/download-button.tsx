import { useEffect, useState } from 'react';
import { Check, Download, Loader2, Music2, Video } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { downloadTrack, listDownloads, onDownloadsChange, progress } from '@/services/downloads';
import type { Track } from '@/services/youtube';

export function DownloadButton({ track, className = '' }: { track: Track; className?: string }) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [, force] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const refresh = () => {
      force((n) => n + 1);
      listDownloads().then((l) => setSaved(new Set(l.filter((d) => d.track.sourceId === track.sourceId).map((d) => d.kind)))).catch(() => {});
    };
    refresh();
    return onDownloadsChange(refresh);
  }, [track.sourceId]);

  const busy = ['audio', 'video'].map((k) => progress.get(`${track.sourceId}:${k}`)).find((p) => p !== undefined);
  const start = (kind: 'audio' | 'video') => {
    setFailed(false);
    downloadTrack(track, kind).catch(() => setFailed(true));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label="Descargar"
          title={failed ? 'La descarga falló, inténtalo de nuevo' : 'Descargar'}
          onClick={(e) => e.stopPropagation()}
          className={`relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-muted ${failed ? 'text-destructive' : ''} ${className}`}
        >
          {busy !== undefined ? (
            busy > 0 ? <span className="text-[10px] font-semibold tabular-nums">{Math.round(busy * 100)}%</span> : <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved.size ? <Check className="h-4 w-4 text-primary" /> : <Download className="h-4 w-4" />}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem disabled={busy !== undefined} onSelect={() => start('audio')}>
          <Music2 className="mr-2 h-4 w-4" /> {saved.has('audio') ? 'Canción descargada' : 'Descargar canción'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy !== undefined} onSelect={() => start('video')}>
          <Video className="mr-2 h-4 w-4" /> {saved.has('video') ? 'Video descargado' : 'Descargar video'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
