import { Copy, FileJson, Image as ImageIcon, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GenerationProgress } from '@/components/generate/GenerationProgress';
import { toast } from '@/hooks/use-toast';
import type { ArtStyle } from '@/lib/art-styles';
import type { SpriteSheet } from '@/types/sprite';

interface QAStatus {
  attempt: number;
  maxAttempts: number;
  objectiveScore: number;
  perceptualScore: number;
  issues: string[];
  suggestions: string[];
  passed: boolean;
}

interface Props {
  selectedStyle: ArtStyle | undefined;
  referencePreview: string | null;
  generating: boolean;
  progress: number;
  progressMessage: string;
  qaStatus: QAStatus | null;
  result: SpriteSheet | null;
  jsonOutput: string | null;
  onRetry: () => void;
  onSave: () => void;
}

export function GenerateInspector({
  selectedStyle,
  referencePreview,
  generating,
  progress,
  progressMessage,
  qaStatus,
  result,
  jsonOutput,
  onRetry,
  onSave,
}: Props) {
  const handleDownloadPNG = () => {
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = result.imageData;
    anchor.download = `sprite_${result.pose}_${result.viewingAngle}.png`;
    anchor.click();
  };

  const handleDownloadJSON = () => {
    if (!jsonOutput || !result) return;
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sprite_${result.pose}_${result.viewingAngle}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: 'JSON copied to clipboard' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card/20">
      <div className="border-b border-border bg-card/40 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Inspector</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Review, QA, and export</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Everything after generation lives here so the canvas stays focused.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Current setup</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This rail should answer what you are making before you even generate.
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {selectedStyle?.shortName ?? 'No style'}
              </Badge>
            </div>

            {referencePreview && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background/50 p-3">
                <img
                  src={referencePreview}
                  alt="Reference preview"
                  className="h-28 w-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
              <InfoItem label="Style" value={selectedStyle?.name ?? 'Choose one'} />
              <InfoItem label="Status" value={result ? 'Generated' : generating ? 'Generating' : 'Waiting'} />
              <InfoItem label="Reference" value={referencePreview ? 'Loaded' : 'Missing'} />
              <InfoItem label="QA" value={qaStatus ? (qaStatus.passed ? 'Passed' : 'Needs review') : 'Pending'} />
            </div>
          </section>

          <GenerationProgress
            progress={progress}
            message={progressMessage}
            generating={generating}
            qaStatus={qaStatus}
          />

          {result ? (
            <>
              <section className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-sm font-medium text-foreground">Actions</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Retry fast, save good results, and export without leaving the workflow.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" className="col-span-2 h-10 justify-center gap-2" onClick={onSave}>
                    <Save className="h-4 w-4" /> Save to library
                  </Button>
                  <Button type="button" variant="outline" className="h-10 justify-center gap-2" onClick={onRetry} disabled={generating}>
                    <RotateCcw className="h-4 w-4" /> Retry
                  </Button>
                  <Button type="button" variant="outline" className="h-10 justify-center gap-2" onClick={handleDownloadPNG}>
                    <ImageIcon className="h-4 w-4" /> PNG
                  </Button>
                  <Button type="button" variant="outline" className="h-10 justify-center gap-2" onClick={handleDownloadJSON}>
                    <FileJson className="h-4 w-4" /> JSON
                  </Button>
                  <Button type="button" variant="outline" className="h-10 justify-center gap-2" onClick={handleCopyJSON}>
                    <Copy className="h-4 w-4" /> Copy JSON
                  </Button>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-sm font-medium text-foreground">Output metadata</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                  <InfoItem label="Pose" value={result.pose.replace(/-/g, ' ')} />
                  <InfoItem label="Angle" value={result.viewingAngle.replace(/-/g, ' ')} />
                  <InfoItem label="Grid" value={result.gridSize} />
                  <InfoItem label="Frames" value={String(result.frameCount)} />
                  <InfoItem label="Frame size" value={`${result.frameWidth}×${result.frameHeight}`} />
                  <InfoItem label="Tag" value={result.tags?.[0] ?? '—'} />
                </div>
              </section>

              {result.palette && result.palette.length > 1 && (
                <section className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Palette</p>
                    <span className="text-[11px] text-muted-foreground">{result.palette.length - 1} colors</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {result.palette.filter((color) => color !== 'transparent').slice(0, 24).map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-7 w-7 rounded-md border border-border transition-transform hover:scale-110"
                        style={{ backgroundColor: color }}
                        title={color}
                        onClick={() => {
                          navigator.clipboard.writeText(color);
                          toast({ title: `Copied ${color}` });
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="rounded-2xl border border-border bg-card/60 p-4">
              <p className="text-sm font-medium text-foreground">What happens next</p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                <li>• Generate a first pass and keep the preview centered on the result.</li>
                <li>• Read the QA feedback here instead of burying it under the canvas.</li>
                <li>• Save or export only when the sprite is good enough to keep.</li>
              </ul>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-foreground">{value}</p>
    </div>
  );
}