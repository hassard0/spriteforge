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
    <div className="grid grid-cols-2 gap-2">
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
        'group relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-2xl border text-left transition-all duration-150',
        selected
          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
          : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/30'
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-secondary/30">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={style.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            loading="lazy"
            width={240}
            height={180}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl">{style.icon}</span>
        )}

        <div className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-1 text-xs backdrop-blur-sm">
          {style.icon}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">{style.shortName}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{style.name}</p>
          </div>
          {selected && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />}
        </div>

        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{style.description}</p>
      </div>
    </button>
  );
}
