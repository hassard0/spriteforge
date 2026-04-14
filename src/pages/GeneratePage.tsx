import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStyleById } from '@/lib/art-styles';
import { postProcessImage } from '@/lib/post-process';
import { runObjectiveQA } from '@/lib/qa-checks';
import { toast } from '@/hooks/use-toast';
import { useSprites } from '@/hooks/use-sprites';
import { GenerateControlPanel } from '@/components/generate/GenerateControlPanel';
import { GenerateStage } from '@/components/generate/GenerateStage';
import { GenerateInspector } from '@/components/generate/GenerateInspector';
import type { GridSize, ViewingAngle, SpritePose, SpriteSheet } from '@/types/sprite';

const MAX_RETRIES = 3;

function extractPixelData(
  imageData: string, frameCount: number, frameWidth: number, frameHeight: number,
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
        const fp: number[] = [];
        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const srcX = Math.floor((x / frameWidth) * actualFrameW) + f * actualFrameW;
            const srcY = Math.floor((y / frameHeight) * actualFrameH);
            const pixel = ctx.getImageData(srcX, srcY, 1, 1).data;
            if (pixel[3] < 128 || (pixel[0] > 220 && pixel[1] < 40 && pixel[2] > 220)) { fp.push(0); continue; }
            const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
            let idx = colorMap.get(hex);
            if (idx === undefined) { idx = palette.length; palette.push(hex); colorMap.set(hex, idx); }
            fp.push(idx);
          }
        }
        frames.push(fp);
      }
      resolve({ palette, frames });
    };
    img.onerror = () => resolve({ palette: ['transparent'], frames: [] });
    img.src = imageData;
  });
}

interface QAStatus {
  attempt: number; maxAttempts: number; objectiveScore: number; perceptualScore: number;
  issues: string[]; suggestions: string[]; passed: boolean;
}

export default function GeneratePage() {
  const { addSprite } = useSprites();
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('64x64');
  const [viewingAngle, setViewingAngle] = useState<ViewingAngle>('front');
  const [pose, setPose] = useState<SpritePose>('idle');
  const [frameCount, setFrameCount] = useState(1);
  const [styleId, setStyleId] = useState('pixel-16bit');
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
    setGenerating(true); setProgress(0); setProgressMessage('Preparing...');
    setResult(null); setJsonOutput(null); setQaStatus(null);
    const size = parseInt(gridSize);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        setProgressMessage(attempt > 1 ? `Retry ${attempt}/${MAX_RETRIES}...` : 'Analyzing reference...');
        setProgress(attempt > 1 ? 5 : 10);
        setProgressMessage(attempt > 1 ? `Retry ${attempt} — Generating...` : 'AI generating sprite...');
        const pi = setInterval(() => setProgress(p => Math.min(p + 0.5, 60)), 500);
        const { data, error } = await supabase.functions.invoke('generate-sprite', {
          body: { referenceImage, gridSize, viewingAngle, pose, frameCount, styleId },
        });
        clearInterval(pi);
        if (error) throw new Error(typeof data === 'object' && data?.error ? data.error : error.message || 'Failed');
        if (data.type !== 'generated-image' || !data.imageData) throw new Error('Unexpected response');

        setProgress(65); setProgressMessage('Post-processing...');
        let processed = data.imageData;
        if (selectedStyle.pixelate || selectedStyle.clampPalette || selectedStyle.monoThreshold || selectedStyle.posterize) {
          processed = await postProcessImage(processed, selectedStyle, size, size);
        }

        setProgress(75); setProgressMessage('Quality checking...');
        const objResult = await runObjectiveQA(processed, selectedStyle, size, size);
        let percResult = { passed: true, score: 7, issues: [] as string[], suggestions: [] as string[] };
        try {
          const { data: qd } = await supabase.functions.invoke('qa-check', {
            body: { imageData: processed, styleId, styleName: selectedStyle.name },
          });
          if (qd) percResult = { passed: qd.passed ?? true, score: qd.score ?? 7, issues: qd.issues || [], suggestions: qd.suggestions || [] };
        } catch { /* skip */ }

        const allIssues = [...objResult.issues.map(i => i.message), ...percResult.issues];
        const allSugs = [...objResult.issues.map(i => i.suggestion), ...percResult.suggestions];
        const passed = objResult.passed && percResult.passed;
        setQaStatus({ attempt, maxAttempts: MAX_RETRIES, objectiveScore: objResult.score, perceptualScore: percResult.score, issues: allIssues, suggestions: allSugs, passed });

        if (!passed && attempt < MAX_RETRIES) {
          setProgressMessage(`QA failed (${attempt}/${MAX_RETRIES}). Retrying...`);
          toast({ title: `QA failed (attempt ${attempt})`, description: allIssues[0] || 'Retrying...' });
          continue;
        }

        setProgress(90); setProgressMessage('Extracting data...');
        const fw = Number(data.frameWidth), fh = Number(data.frameHeight), fc = Number(data.frameCount) || 1;
        const extracted = await extractPixelData(processed, fc, fw, fh);
        setProgress(100); setProgressMessage('Done!');

        const sprite: SpriteSheet = {
          id: `gen-${Date.now()}`, name: `${selectedStyle.shortName} ${pose} ${viewingAngle}`,
          prompt: `${selectedStyle.name} — ${pose} from ${viewingAngle}`, gridSize, viewingAngle, pose,
          frameCount: fc, frameWidth: fw, frameHeight: fh, imageData: processed,
          palette: extracted.palette.slice(0, 64), pixelData: extracted.frames,
          createdAt: new Date().toISOString(), collectionIds: [], tags: [selectedStyle.id],
          referenceImageUrl: referencePreview || undefined,
        };
        setResult(sprite);
        setJsonOutput(JSON.stringify({ palette: extracted.palette.slice(0, 64), frames: extracted.frames, gridSize, viewingAngle, pose, style: selectedStyle.id, frameWidth: fw, frameHeight: fh, description: data.description || '', qa: { objectiveScore: objResult.score, perceptualScore: percResult.score, passed, issues: allIssues } }, null, 2));
        if (!passed) toast({ title: '⚠️ Generated with warnings', description: `QA issues after ${attempt} attempts.` });
        break;
      } catch (err: any) {
        if (attempt >= MAX_RETRIES) {
          toast({ title: 'Generation failed', description: err?.message || 'Try again.' });
          setProgress(0); setProgressMessage('');
        }
      }
    }
    setGenerating(false);
  }, [referenceImage, gridSize, viewingAngle, pose, frameCount, styleId, selectedStyle, referencePreview]);

  const handleSave = () => { if (result) { addSprite(result as any); toast({ title: '✓ Saved to library' }); } };

  const canGenerate = !!referenceImage && !!selectedStyle && !generating;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
      <div className="order-2 min-h-0 border-t border-border xl:order-1 xl:border-r xl:border-t-0">
        <GenerateControlPanel
          selectedStyle={selectedStyle}
          styleId={styleId}
          onStyleChange={setStyleId}
          referencePreview={referencePreview}
          onUpload={handleUpload}
          onClearReference={handleClearRef}
          gridSize={gridSize}
          viewingAngle={viewingAngle}
          pose={pose}
          frameCount={frameCount}
          onGridSizeChange={setGridSize}
          onViewingAngleChange={setViewingAngle}
          onPoseChange={setPose}
          onFrameCountChange={setFrameCount}
          generating={generating}
          canGenerate={canGenerate}
          onGenerate={handleGenerate}
        />
      </div>

      <div className="order-1 min-h-0 xl:order-2">
        <GenerateStage
          result={result}
          referencePreview={referencePreview}
          selectedStyle={selectedStyle}
          gridSize={gridSize}
          viewingAngle={viewingAngle}
          pose={pose}
          frameCount={frameCount}
        />
      </div>

      <div className="order-3 min-h-0 border-t border-border xl:border-l xl:border-t-0">
        <GenerateInspector
          selectedStyle={selectedStyle}
          referencePreview={referencePreview}
          generating={generating}
          progress={progress}
          progressMessage={progressMessage}
          qaStatus={qaStatus}
          result={result}
          jsonOutput={jsonOutput}
          onRetry={handleGenerate}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
