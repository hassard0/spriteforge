import { ART_STYLES, type ArtStyle } from '@/lib/art-styles';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

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
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Art Style
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {ART_STYLES.length} styles
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {ART_STYLES.map(style => (
          <StyleCard
            key={style.id}
            style={style}
            thumbnail={STYLE_THUMBNAILS[style.id]}
            selected={selectedId === style.id}
            onClick={() => onSelect(style.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StyleCard({ style, thumbnail, selected, onClick }: {
  style: ArtStyle;
  thumbnail?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border transition-all duration-200',
        selected
          ? 'border-primary ring-1 ring-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
          : 'border-border bg-card hover:border-primary/40'
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 z-10 rounded-full bg-primary p-0.5">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative aspect-square bg-secondary/30 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={style.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            width={512}
            height={512}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {style.icon}
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Label */}
      <div className="p-2 text-center bg-card">
        <span className="text-[10px] font-semibold leading-tight">{style.shortName}</span>
      </div>
    </button>
  );
}
