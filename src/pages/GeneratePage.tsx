import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getStyleById } from '@/lib/art-styles';
import { postProcessImage } from '@/lib/post-process';
import { runObjectiveQA } from '@/lib/qa-checks';
import { Sparkles, Loader2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSprites } from '@/hooks/use-sprites';
import { StyleSelector } from '@/components/generate/StyleSelector';
import { ReferenceUploader } from '@/components/generate/ReferenceUploader';
import { GenerationConfig } from '@/components/generate/GenerationConfig';
import { GenerationProgress } from '@/components/generate/GenerationProgress';
import { SpriteResultPanel } from '@/components/generate/SpriteResultPanel';
import type { GridSize, ViewingAngle, SpritePose, SpriteSheet } from '@/types/sprite';

const MAX_RETRIES = 3;

function extractPixelData(
  imageData: string,
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
): Promise<{ palette: string[]; frames: number[][] }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const actualFrameW = Math.round(img.naturalWidth / frameCount);
      const actualFrameH = img.naturalHeight;

      const colorMap = new Map<string, number>();
      colorMap.set('transparent', 0);
      const palette: string[] = ['transparent'];
      const frames: number[][] = [];

      for (let f = 0; f < frameCount; f++) {
        const framePixels: number[] = [];
        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const srcX = Math.floor((x / frameWidth) * actualFrameW) + f * actualFrameW;
            const srcY = Math.floor((y / frameHeight) * actualFrameH);
            const pixel = ctx.getImageData(srcX, srcY, 1, 1).data;

            const isMagenta = pixel[0] > 220 && pixel[1] < 40 && pixel[2] > 220;
            if (pixel[3] < 128 || isMagenta) {
              framePixels.push(0);
              continue;
            }

            const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
            let idx = colorMap.get(hex);
            if (idx === undefined) {
              idx = palette.length;
              palette.push(hex);
              colorMap.set(hex, idx);
            }
            framePixels.push(idx);
          }
        }
        frames.push(framePixels);
      }

      resolve({ palette, frames });
    };
    img.onerror = () => resolve({ palette: ['transparent'], frames: [] });
    img.src = imageData;
  });
}

interface QAStatus {
  attempt: number;
  maxAttempts: number;
  objectiveScore: number;
  perceptualScore: number;
  issues: string[];
  suggestions: string[];
  passed: boolean;
}

export default function GeneratePage() {
  const { addSprite } = useSprites();

  // Form state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('64x64');
  const [viewingAngle, setViewingAngle] = useState<ViewingAngle>('front');
  const [pose, setPose] = useState<SpritePose>('idle');
  const [frameCount, setFrameCount] = useState(1);
  const [styleId, setStyleId] = useState('pixel-16bit');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<SpriteSheet | null>(null);
  const [jsonOutput, setJsonOutput] = useState<string | null>(null);
  const [qaStatus, setQaStatus] = useState<QAStatus | null>(null);

  const selectedStyle = getStyleById(styleId);

  const handleUpload = useCallback((dataUrl: string) => {
    setReferenceImage(dataUrl);
    setReferencePreview(dataUrl);
  }, []);

  const handleClearRef = useCallback(() => {
    setReferenceImage(null);
    setReferencePreview(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!referenceImage || !selectedStyle) return;
    setGenerating(true);
    setProgress(0);
    setProgressMessage('Preparing...');
    setResult(null);
    setJsonOutput(null);
    setQaStatus(null);

    const size = parseInt(gridSize);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        setProgressMessage(attempt > 1 ? `Retry ${attempt}/${MAX_RETRIES} — Regenerating...` : 'Analyzing reference image...');
        setProgress(attempt > 1 ? 5 : 10);

        setProgressMessage(attempt > 1 ? `Retry ${attempt} — AI is generating...` : 'AI is generating your sprite...');
        const progressInterval = setInterval(() => {
          setProgress(p => Math.min(p + 0.5, 60));
        }, 500);

        const { data, error } = await supabase.functions.invoke('generate-sprite', {
          body: { referenceImage, gridSize, viewingAngle, pose, frameCount, styleId },
        });

        clearInterval(progressInterval);

        if (error) {
          const errorMsg = typeof data === 'object' && data?.error ? data.error : error.message || 'Generation failed';
          throw new Error(errorMsg);
        }

        if (data.type !== 'generated-image' || !data.imageData) {
          throw new Error('Unexpected response format');
        }

        setProgress(65);
        setProgressMessage('Post-processing...');

        let processedImage = data.imageData;
        if (selectedStyle.pixelate || selectedStyle.clampPalette || selectedStyle.monoThreshold || selectedStyle.posterize) {
          processedImage = await postProcessImage(processedImage, selectedStyle, size, size);
        }

        setProgress(75);
        setProgressMessage('Running quality checks...');

        const objectiveResult = await runObjectiveQA(processedImage, selectedStyle, size, size);

        let perceptualResult = { passed: true, score: 7, issues: [] as string[], suggestions: [] as string[] };
        try {
          const { data: qaData } = await supabase.functions.invoke('qa-check', {
            body: { imageData: processedImage, styleId, styleName: selectedStyle.name },
          });
          if (qaData) {
            perceptualResult = {
              passed: qaData.passed ?? true,
              score: qaData.score ?? 7,
              issues: qaData.issues || [],
              suggestions: qaData.suggestions || [],
            };
          }
        } catch (qaErr) {
          console.warn('Perceptual QA skipped:', qaErr);
        }

        setProgress(85);

        const allIssues = [...objectiveResult.issues.map(i => i.message), ...perceptualResult.issues];
        const allSuggestions = [...objectiveResult.issues.map(i => i.suggestion), ...perceptualResult.suggestions];
        const overallPassed = objectiveResult.passed && perceptualResult.passed;

        setQaStatus({
          attempt,
          maxAttempts: MAX_RETRIES,
          objectiveScore: objectiveResult.score,
          perceptualScore: perceptualResult.score,
          issues: allIssues,
          suggestions: allSuggestions,
          passed: overallPassed,
        });

        if (!overallPassed && attempt < MAX_RETRIES) {
          setProgressMessage(`Quality check failed (attempt ${attempt}/${MAX_RETRIES}). Retrying...`);
          toast({
            title: `QA failed (attempt ${attempt})`,
            description: allIssues[0] || 'Retrying with adjusted parameters...',
          });
          continue;
        }

        setProgress(90);
        setProgressMessage('Extracting pixel data...');
        const fw = Number(data.frameWidth);
        const fh = Number(data.frameHeight);
        const fc = Number(data.frameCount) || 1;
        const extracted = await extractPixelData(processedImage, fc, fw, fh);

        setProgress(100);
        setProgressMessage('Done!');

        const sprite: SpriteSheet = {
          id: `gen-${Date.now()}`,
          name: `${selectedStyle.shortName} ${pose} ${viewingAngle}`,
          prompt: `${selectedStyle.name} — ${pose} from ${viewingAngle}`,
          gridSize,
          viewingAngle,
          pose,
          frameCount: fc,
          frameWidth: fw,
          frameHeight: fh,
          imageData: processedImage,
          palette: extracted.palette.slice(0, 64),
          pixelData: extracted.frames,
          createdAt: new Date().toISOString(),
          collectionIds: [],
          tags: [selectedStyle.id],
          referenceImageUrl: referencePreview || undefined,
        };

        setResult(sprite);
        setJsonOutput(JSON.stringify({
          palette: extracted.palette.slice(0, 64),
          frames: extracted.frames,
          gridSize,
          viewingAngle,
          pose,
          style: selectedStyle.id,
          frameWidth: fw,
          frameHeight: fh,
          description: data.description || '',
          qa: {
            objectiveScore: objectiveResult.score,
            perceptualScore: perceptualResult.score,
            passed: overallPassed,
            issues: allIssues,
          },
        }, null, 2));

        if (!overallPassed) {
          toast({
            title: '⚠️ Generated with warnings',
            description: `QA issues detected after ${attempt} attempts. Review the results.`,
          });
        }

        break;
      } catch (err: any) {
        if (attempt >= MAX_RETRIES) {
          console.error('Generation failed after retries:', err);
          toast({
            title: 'Generation failed',
            description: err?.message || 'Something went wrong. Try again.',
          });
          setProgress(0);
          setProgressMessage('');
        }
      }
    }

    setGenerating(false);
  }, [referenceImage, gridSize, viewingAngle, pose, frameCount, styleId, selectedStyle, referencePreview]);

  const handleSave = useCallback(() => {
    if (result) {
      addSprite(result as any);
      toast({ title: '✓ Saved to library' });
    }
  }, [result, addSprite]);

  const canGenerate = !!referenceImage && !!selectedStyle && !generating;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/30">
        <h1 className="font-pixel text-xs text-primary glow-green tracking-wider">SPRITE FORGE</h1>
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          size="sm"
          className="font-pixel text-[10px] gap-2 glow-box-green h-8 px-5"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'GENERATING...' : 'GENERATE'}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Step 1: Style */}
          <section className="rounded-xl border border-border bg-card/50 p-5">
            <StyleSelector selectedId={styleId} onSelect={setStyleId} />
          </section>

          {/* Step 2: Reference + Config side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border bg-card/50 p-5">
              <ReferenceUploader
                preview={referencePreview}
                onUpload={handleUpload}
                onClear={handleClearRef}
              />
            </section>

            <section className="rounded-xl border border-border bg-card/50 p-5">
              <GenerationConfig
                gridSize={gridSize}
                viewingAngle={viewingAngle}
                pose={pose}
                frameCount={frameCount}
                onGridSizeChange={setGridSize}
                onViewingAngleChange={setViewingAngle}
                onPoseChange={setPose}
                onFrameCountChange={setFrameCount}
              />
            </section>
          </div>

          {/* Progress */}
          <GenerationProgress
            progress={progress}
            message={progressMessage}
            generating={generating}
            qaStatus={qaStatus}
          />

          {/* Result */}
          {result ? (
            <section className="rounded-xl border border-border bg-card/50 p-5">
              <SpriteResultPanel
                result={result}
                jsonOutput={jsonOutput}
                onSave={handleSave}
                onRetry={handleGenerate}
                generating={generating}
              />
            </section>
          ) : !generating ? (
            <section className="rounded-xl border border-dashed border-border bg-card/20 p-12 flex flex-col items-center justify-center text-center">
              <div className="rounded-2xl bg-secondary/50 p-4 mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Upload a reference & generate</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Pick a style, upload your character, configure settings, then hit Generate
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
