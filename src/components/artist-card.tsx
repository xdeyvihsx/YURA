interface ArtistCardProps {
  name: string;
  image: string;
}

export function ArtistCard({ name, image }: ArtistCardProps) {
  return (
    <div className="flex-shrink-0 cursor-pointer group">
      <div className="relative w-40 h-40 mb-3">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover rounded-full border-2 border-transparent group-hover:border-primary transition-all"

        />
      </div>
      <h3 className="font-semibold text-sm text-center line-clamp-1">{name}</h3>
    </div>
  );
}
