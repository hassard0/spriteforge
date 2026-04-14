import { ART_STYLES, type ArtStyle } from '@/lib/art-styles';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useRef, useEffect } from 'react';

// Style preview thumbnails
import pixel8bit from '@/assets/styles/pixel-8bit.jpg';
import pixel16bit from '@/assets/styles/pixel-16bit.jpg';
import handDrawnDark from '@/assets/styles/hand-drawn-dark.jpg';
import handDrawnBright from '@/assets/styles/hand-drawn-bright.jpg';
import animeCel from '@/assets/styles/anime-cel.jpg';
import monoSilhouette from '@/assets/styles/monochrome-silhouette.jpg';
import vectorFlat from '@/assets/styles/vector-flat.jpg';
import chibiManga from '@/assets/styles/chibi-manga.jpg';
import sketchInk from '@/assets/styles/sketch-ink.jpg';
import realisticStylized from '@/assets/styles/realistic-stylized.jpg';

const STYLE_THUMBNAILS: Record<string, string> = {
  'pixel-8bit': pixel8bit,
  'pixel-16bit': pixel16bit,
  'hand-drawn-dark': handDrawnDark,
  'hand-drawn-bright': handDrawnBright,
  'anime-cel': animeCel,
  'monochrome-silhouette': monoSilhouette,
  'vector-flat': vectorFlat,
  'chibi-manga': chibiManga,
  'sketch-ink': sketchInk,
  'realistic-stylized': realisticStylized,
};

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function StyleSelector({ selectedId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, []);

  return (
    <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {ART_STYLES.map(style => (
          <StyleChip
            key={style.id}
            style={style}
            thumbnail={STYLE_THUMBNAILS[style.id]}
            selected={selectedId === style.id}
            onClick={() => onSelect(style.id)}
          />
        ))}
    </div>
  );
}

function StyleChip({ style, thumbnail, selected, onClick }: {
  style: ArtStyle;
  thumbnail?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected}
      className={cn(
        'group relative flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-150',
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary'
          : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/60'
      )}
    >
      <div className="h-7 w-7 rounded overflow-hidden flex-shrink-0 bg-secondary/30">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={style.name}
            className="h-full w-full object-cover"
            loading="lazy"
            width={28}
            height={28}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs">{style.icon}</span>
        )}
      </div>

      <span className="text-[10px] font-semibold whitespace-nowrap">{style.shortName}</span>

      {selected && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
    </button>
  );
}
