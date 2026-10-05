import { Play, MoreHorizontal } from 'lucide-react';
import { YouTubeVideo } from '@/services/youtube';
import { useState } from 'react';

interface AlbumCardProps {
  video: YouTubeVideo;
  onPlay?: (title: string, artwork: string, artist?: string, artistId?: string) => void;
}

export function AlbumCard({ video, onPlay }: AlbumCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handlePlay = () => {
    if (onPlay) {
      onPlay(video.title, video.thumbnails[0]?.url, video.author.name, video.author.id);
    }
  };

  return (
    <div className="group cursor-pointer transition-all hover:scale-[1.02]" onClick={handlePlay}>
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-muted">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 rounded-full border-t-transparent animate-spin" />
          </div>
        )}
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <svg className="w-12 h-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l4.586-4.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <img
            src={video.thumbnails[0]?.url}
            alt={video.title}
            className="w-full h-full object-cover"

            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-2xl bg-background/60 border-border/20"
          >
            <Play className="w-10 h-10 text-white fill-current ml-1" />
          </div>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="w-8 h-8 bg-background/60 rounded-full flex items-center justify-center hover:bg-background/80 border border-border/20">
            <MoreHorizontal className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>
      <h3 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h3>
      <p className="text-sm text-muted-foreground line-clamp-1">{video.author.name}</p>
    </div>
  );
}
