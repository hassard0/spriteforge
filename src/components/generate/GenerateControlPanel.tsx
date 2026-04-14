import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StyleSelector } from '@/components/generate/StyleSelector';
import { ReferenceUploader } from '@/components/generate/ReferenceUploader';
import { GenerationConfig } from '@/components/generate/GenerationConfig';
import type { ArtStyle } from '@/lib/art-styles';
import type { GridSize, ViewingAngle, SpritePose } from '@/types/sprite';

interface Props {
  selectedStyle: ArtStyle | undefined;
  styleId: string;
  onStyleChange: (id: string) => void;
  referencePreview: string | null;
  onUpload: (dataUrl: string) => void;
  onClearReference: () => void;
  gridSize: GridSize;
  viewingAngle: ViewingAngle;
  pose: SpritePose;
  frameCount: number;
  onGridSizeChange: (value: GridSize) => void;
  onViewingAngleChange: (value: ViewingAngle) => void;
  onPoseChange: (value: SpritePose) => void;
  onFrameCountChange: (value: number) => void;
  generating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}

export function GenerateControlPanel({
  selectedStyle,
  styleId,
  onStyleChange,
  referencePreview,
  onUpload,
  onClearReference,
  gridSize,
  viewingAngle,
  pose,
  frameCount,
  onGridSizeChange,
  onViewingAngleChange,
  onPoseChange,
  onFrameCountChange,
  generating,
  canGenerate,
  onGenerate,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card/20">
      <div className="border-b border-border bg-card/40 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Sprite workflow
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          Generate with a clearer flow
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Pick the visual language first, lock in the reference, then tune the motion settings.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <SectionHeader step="01" title="Choose a style" description="Start with the visual target so every later choice makes sense." />
            <div className="mt-4">
              <StyleSelector selectedId={styleId} onSelect={onStyleChange} />
            </div>

            {selectedStyle && (
              <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedStyle.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedStyle.description}</p>
                  </div>
                  <span className="text-lg" aria-hidden="true">{selectedStyle.icon}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedStyle.maxColors > 0 && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      ≤ {selectedStyle.maxColors} colors
                    </Badge>
                  )}
                  {selectedStyle.pixelate && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      Pixel cleanup
                    </Badge>
                  )}
                  {selectedStyle.clampPalette && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      Palette clamp
                    </Badge>
                  )}
                  {selectedStyle.posterize && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      Posterized
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <SectionHeader step="02" title="Add a reference" description="Keep the source visible and easy to replace while you iterate." />
            <div className="mt-4">
              <ReferenceUploader preview={referencePreview} onUpload={onUpload} onClear={onClearReference} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <SectionHeader step="03" title="Tune the output" description="Use direct controls for canvas size, viewing angle, pose, and loop length." />
            <div className="mt-4">
              <GenerationConfig
                gridSize={gridSize}
                viewingAngle={viewingAngle}
                pose={pose}
                frameCount={frameCount}
                onGridSizeChange={onGridSizeChange}
                onViewingAngleChange={onViewingAngleChange}
                onPoseChange={onPoseChange}
                onFrameCountChange={onFrameCountChange}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-card/40 p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{gridSize}</Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{pose.replace(/-/g, ' ')}</Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{frameCount} frame{frameCount !== 1 ? 's' : ''}</Badge>
        </div>

        <Button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="h-11 w-full gap-2 text-sm font-semibold"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? 'Generating sprite…' : 'Generate sprite'}
        </Button>

        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          {referencePreview
            ? 'Your reference is loaded. Generate a first pass, then compare retries from the inspector.'
            : 'Upload a character image to unlock generation and keep the preview focused on the result.'}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}