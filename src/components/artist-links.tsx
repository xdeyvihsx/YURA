import type { TrackArtist } from '@/services/youtube';

interface ArtistLinksProps {
  artists?: TrackArtist[];
  fallbackName?: string | null;
  fallbackId?: string | null;
  onOpenArtist?: (id: string) => void;
  className?: string;
}

export function ArtistLinks({ artists, fallbackName, fallbackId, onOpenArtist, className = '' }: ArtistLinksProps) {
  const credits = artists?.length ? artists : fallbackName ? [{ name: fallbackName, id: fallbackId ?? null }] : [];
  return (
    <span className={className}>
      {credits.map((artist, index) => (
        <span key={`${artist.id ?? artist.name}-${index}`}>
          {index > 0 && ', '}
          {artist.id && onOpenArtist ? (
            <button
              type="button"
              className="hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                onOpenArtist(artist.id as string);
              }}
            >
              {artist.name}
            </button>
          ) : artist.name}
        </span>
      ))}
    </span>
  );
}