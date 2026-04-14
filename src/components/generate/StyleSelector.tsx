import { ART_STYLES, type ArtStyle } from '@/lib/art-styles';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

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
            selected={selectedId === style.id}
            onClick={() => onSelect(style.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StyleCard({ style, selected, onClick }: { style: ArtStyle; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all duration-200 text-center',
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
          : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/60'
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute -top-1.5 -right-1.5 rounded-full bg-primary p-0.5">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}

      {/* Style icon */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${style.accent}20` }}
      >
        {style.icon}
      </div>

      {/* Name */}
      <span className="text-[11px] font-semibold leading-tight">{style.shortName}</span>

      {/* Description */}
      <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2">
        {style.description}
      </p>

      {/* Accent dot */}
      <div
        className="absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full opacity-60"
        style={{ backgroundColor: style.accent }}
      />
    </button>
  );
}
