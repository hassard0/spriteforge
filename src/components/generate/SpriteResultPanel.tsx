import { Button } from '@/components/ui/button';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import { Download, Copy, Save, RotateCcw, FileJson, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { SpriteSheet } from '@/types/sprite';

interface Props {
  result: SpriteSheet;
  jsonOutput: string | null;
  onSave: () => void;
  onRetry: () => void;
  generating: boolean;
}

export function SpriteResultPanel({ result, jsonOutput, onSave, onRetry, generating }: Props) {
  const handleDownloadPNG = () => {
    const a = document.createElement('a');
    a.href = result.imageData;
    a.download = `sprite_${result.pose}_${result.viewingAngle}.png`;
    a.click();
  };

  const handleDownloadJSON = () => {
    if (!jsonOutput) return;
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprite_${result.pose}_${result.viewingAngle}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: 'JSON copied to clipboard' });
  };

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Result
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1 text-muted-foreground"
            onClick={onRetry}
            disabled={generating}
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadPNG}>
            <ImageIcon className="h-3 w-3" /> PNG
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadJSON}>
            <FileJson className="h-3 w-3" /> JSON
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleCopyJSON}>
            <Copy className="h-3 w-3" /> Copy
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" className="h-7 text-[10px] gap-1 font-semibold" onClick={onSave}>
            <Save className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>

      {/* Preview */}
      <SpritePreviewPlayer
        imageData={result.imageData}
        frameWidth={result.frameWidth}
        frameHeight={result.frameHeight}
        frameCount={result.frameCount}
      />

      {/* Palette */}
      {result.palette && result.palette.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Palette</span>
            <span className="text-[10px] text-muted-foreground">{result.palette.length - 1} colors</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {result.palette.filter(c => c !== 'transparent').map((color, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded border border-border cursor-pointer hover:scale-125 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => {
                  navigator.clipboard.writeText(color);
                  toast({ title: `Copied ${color}` });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-3 text-[10px]">
          <MetaItem label="Style" value={result.tags?.[0] || '—'} />
          <MetaItem label="Pose" value={result.pose} />
          <MetaItem label="Angle" value={result.viewingAngle} />
          <MetaItem label="Grid" value={result.gridSize} />
          <MetaItem label="Frames" value={String(result.frameCount)} />
          <MetaItem label="Size" value={`${result.frameWidth}×${result.frameHeight}`} />
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground uppercase">{label}</span>
      <p className="font-medium text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}
