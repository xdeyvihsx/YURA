import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface HorizontalCarouselProps {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}

export function HorizontalCarousel({ children, className = '', ariaLabel }: HorizontalCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canBack, setCanBack] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanBack(track.scrollLeft > 2);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    for (const child of Array.from(track.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [children, update]);

  const move = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(240, track.clientWidth * 0.82), behavior: 'smooth' });
  };

  return (
    <div className="group/carousel relative">
      <div
        ref={trackRef}
        onScroll={update}
        aria-label={ariaLabel}
        className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain ${className}`}
      >
        {children}
      </div>
      {canBack && (
        <button type="button" onClick={() => move(-1)} aria-label="Anterior" className="carousel-arrow left-2">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canNext && (
        <button type="button" onClick={() => move(1)} aria-label="Siguiente" className="carousel-arrow right-2">
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}