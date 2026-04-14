import { Badge } from '@/components/ui/badge';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import type { ArtStyle } from '@/lib/art-styles';
import type { SpriteSheet, GridSize, ViewingAngle, SpritePose } from '@/types/sprite';
import { ImagePlus, Sparkles, Wand2 } from 'lucide-react';

interface Props {
  result: SpriteSheet | null;
  referencePreview: string | null;
  selectedStyle: ArtStyle | undefined;
  gridSize: GridSize;
  viewingAngle: ViewingAngle;
  pose: SpritePose;
  frameCount: number;
}

export function GenerateStage({ result, referencePreview, selectedStyle, gridSize, viewingAngle, pose, frameCount }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-card/20 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Stage</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Canvas-first sprite preview</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              The sprite stays central while setup and export controls move to the rails, like a real creative tool.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{selectedStyle?.shortName ?? 'Style'}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{gridSize}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{viewingAngle.replace(/-/g, ' ')}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{pose.replace(/-/g, ' ')}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{frameCount} frame{frameCount !== 1 ? 's' : ''}</Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="flex h-full min-h-[36rem] flex-col rounded-[1.5rem] border border-border bg-card/30 shadow-sm">
          {result ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/40 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Latest output</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{result.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {result.frameWidth}×{result.frameHeight} px · {result.frameCount} frame{result.frameCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex-1 min-h-0 p-4">
                <SpritePreviewPlayer
                  imageData={result.imageData}
                  frameWidth={result.frameWidth}
                  frameHeight={result.frameHeight}
                  className="h-full"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between p-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>

                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    {referencePreview ? 'Ready to generate your first pass' : 'A less cluttered sprite workflow'}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {referencePreview
                      ? 'Your reference is already loaded. Generate now and use the inspector to judge QA, compare retries, and export without losing focus on the canvas.'
                      : 'This workspace is organized like a creative app: decisions on the left, a dominant canvas in the middle, and review plus export on the right.'}
                  </p>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <StageStep icon={Wand2} title="1. Pick style" description="Choose the target look before changing motion or size." />
                    <StageStep icon={ImagePlus} title="2. Drop reference" description="Keep the character source visible and easy to replace." />
                    <StageStep icon={Sparkles} title="3. Generate + review" description="Inspect QA and exports in a dedicated rail, not on the canvas." />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  {referencePreview ? (
                    <div className="flex h-full flex-col gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Reference</p>
                        <p className="mt-1 text-sm font-medium text-foreground">Source image ready</p>
                      </div>
                      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card/40 p-4">
                        <img
                          src={referencePreview}
                          alt="Uploaded reference character"
                          className="max-h-[18rem] w-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-border bg-card/30 p-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Selected style</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{selectedStyle?.name ?? 'Choose a style first'}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {selectedStyle?.description ?? 'The style panel on the left now carries more of the decision-making load, so the center can stay clean.'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Why this layout works better</p>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                          <li>• The primary action stays close to the setup inputs.</li>
                          <li>• The canvas has a single job: show the sprite clearly.</li>
                          <li>• QA, metadata, and exports move out of the way until needed.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Creative target</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{selectedStyle?.name ?? 'Choose a style to define the look'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{selectedStyle?.shortName ?? 'No style selected'}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{gridSize}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{frameCount} frame{frameCount !== 1 ? 's' : ''}</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StageStep({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}