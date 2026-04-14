import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRESET_PALETTES, type Palette } from '@/lib/palettes';
import { Plus, X } from 'lucide-react';

interface Props {
  value: Palette;
  onChange: (p: Palette) => void;
}

export function PalettePicker({ value, onChange }: Props) {
  const [customColors, setCustomColors] = useState<string[]>(
    value.id === 'custom' ? value.colors : [],
  );

  const pick = (p: Palette) => {
    if (p.id === 'custom') {
      onChange({ ...p, colors: customColors });
    } else {
      onChange(p);
    }
  };

  const addCustom = () => {
    const next = [...customColors, '#ffffff'];
    setCustomColors(next);
    if (value.id === 'custom') onChange({ ...value, colors: next });
  };

  const updateCustom = (i: number, hex: string) => {
    const next = customColors.map((c, idx) => (idx === i ? hex : c));
    setCustomColors(next);
    if (value.id === 'custom') onChange({ ...value, colors: next });
  };

  const removeCustom = (i: number) => {
    const next = customColors.filter((_, idx) => idx !== i);
    setCustomColors(next);
    if (value.id === 'custom') onChange({ ...value, colors: next });
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-muted-foreground">Palette</label>
      <div className="grid grid-cols-1 gap-1">
        {PRESET_PALETTES.map((p) => {
          const selected = value.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className={`text-left rounded border p-1.5 transition-all ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-secondary/20 hover:border-primary/40'
              }`}
              aria-pressed={selected}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold">{p.name}</span>
                <span className="text-[9px] text-muted-foreground">
                  {p.id === 'custom' ? `${customColors.length}` : p.colors.length || '—'}
                </span>
              </div>
              {p.colors.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-[1px]">
                  {p.colors.slice(0, 24).map((c, i) => (
                    <div
                      key={i}
                      className="h-2 w-2 rounded-[1px]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
              <p className="mt-1 text-[9px] text-muted-foreground/80 leading-tight">
                {p.description}
              </p>
            </button>
          );
        })}
      </div>

      {value.id === 'custom' && (
        <div className="space-y-1 rounded border border-border p-1.5">
          {customColors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                type="color"
                value={c}
                onChange={(e) => updateCustom(i, e.target.value)}
                className="h-6 w-8 p-0 cursor-pointer border-border"
                aria-label={`Custom colour ${i + 1}`}
              />
              <span className="text-[9px] font-mono flex-1 text-muted-foreground">{c}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeCustom(i)}
                aria-label={`Remove colour ${i + 1}`}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 w-full text-[9px] gap-1"
            onClick={addCustom}
          >
            <Plus className="h-2.5 w-2.5" /> Add colour
          </Button>
        </div>
      )}
    </div>
  );
}
