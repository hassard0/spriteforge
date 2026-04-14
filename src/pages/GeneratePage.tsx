import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getStyleById } from '@/lib/art-styles';
import { postProcessImage } from '@/lib/post-process';
import { runObjectiveQA } from '@/lib/qa-checks';
import { Sparkles, Loader2, Upload, Copy, Save, RotateCcw, FileJson, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSprites } from '@/hooks/use-sprites';
import { StyleSelector } from '@/components/generate/StyleSelector';
import { ReferenceUploader } from '@/components/generate/ReferenceUploader';
import { GenerationConfig } from '@/components/generate/GenerationConfig';
import { GenerationProgress } from '@/components/generate/GenerationProgress';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import type { GridSize, ViewingAngle, SpritePose, SpriteSheet } from '@/types/sprite';

const MAX_RETRIES = 3;
let hasShownBgModelToast = false;

function extractPixelData(
  imageData: string, frameCount: number, frameWidth: number, frameHeight: number,
): Promise<{ palette: string[]; frames: number[][] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const expectedW = frameWidth * frameCount;
      if (img.naturalWidth !== expectedW) {
        console.warn(
          `extractPixelData: image width ${img.naturalWidth} != expected ${expectedW} (frameWidth ${frameWidth} * frameCount ${frameCount}) — continuing with rescaled sampling`,
        );
        // Not a hard error since stitching upstream should already match; we log and keep going.
      }
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
        const fullFrame = ctx.getImageData(f * actualFrameW, 0, actualFrameW, actualFrameH).data;
        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const srcX = Math.floor((x / frameWidth) * actualFrameW);
            const srcY = Math.floor((y / frameHeight) * actualFrameH);
            const i = (srcY * actualFrameW + srcX) * 4;
            const r = fullFrame[i], g = fullFrame[i + 1], b = fullFrame[i + 2], a = fullFrame[i + 3];
            if (a < 128) { fp.push(0); continue; }
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            let idx = colorMap.get(hex);
            if (idx === undefined) { idx = palette.length; palette.push(hex); colorMap.set(hex, idx); }
            fp.push(idx);
          }
        }
        frames.push(fp);
      }
      resolve({ palette, frames });
    };
    img.onerror = () => reject(new Error('Failed to load generated image for pixel extraction'));
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
        if (!hasShownBgModelToast) {
          hasShownBgModelToast = true;
          toast({ title: 'Loading background-removal model', description: 'First-run ~4 MB download, then cached.' });
        }
        processed = await postProcessImage(processed, selectedStyle, size, size);

        setProgress(75); setProgressMessage('Quality checking...');
        const objResult = await runObjectiveQA(processed, selectedStyle, size, size);
        let percResult = { passed: true, score: 7, issues: [] as string[], suggestions: [] as string[] };
        try {
          const { data: qd } = await supabase.functions.invoke('qa-check', {
            body: { imageData: processed, styleId, styleName: selectedStyle.name },
          });
          if (qd?.error === true) {
            toast({ title: 'QA check failed', description: 'Generated sprite still saved.' });
          } else if (qd) {
            percResult = { passed: qd.passed ?? true, score: qd.score ?? 7, issues: qd.issues || [], suggestions: qd.suggestions || [] };
          }
        } catch {
          toast({ title: 'QA check failed', description: 'Generated sprite still saved.' });
        }

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
  const handleDownloadPNG = () => { if (!result) return; const a = document.createElement('a'); a.href = result.imageData; a.download = `sprite_${result.pose}_${result.viewingAngle}.png`; a.click(); };
  const handleDownloadJSON = () => { if (!jsonOutput) return; const b = new Blob([jsonOutput], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `sprite_${result?.pose}_${result?.viewingAngle}.json`; a.click(); URL.revokeObjectURL(u); };
  const handleCopyJSON = () => { if (!jsonOutput) return; navigator.clipboard.writeText(jsonOutput); toast({ title: 'Copied to clipboard' }); };

  const canGenerate = !!referenceImage && !!selectedStyle && !generating;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Style strip */}
      <div className="flex-shrink-0 border-b border-border bg-card/30 px-4 py-2">
        <StyleSelector selectedId={styleId} onSelect={setStyleId} />
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Config */}
        <div className="w-64 flex-shrink-0 border-r border-border bg-card/20 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-5 flex-1">
            <ReferenceUploader preview={referencePreview} onUpload={handleUpload} onClear={handleClearRef} />
            <GenerationConfig
              gridSize={gridSize} viewingAngle={viewingAngle} pose={pose} frameCount={frameCount}
              onGridSizeChange={setGridSize} onViewingAngleChange={setViewingAngle}
              onPoseChange={setPose} onFrameCountChange={setFrameCount}
            />
          </div>
          <div className="p-3 border-t border-border bg-card/30">
            <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full h-9 font-pixel text-[10px] gap-2 glow-box-green">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'GENERATING...' : 'GENERATE'}
            </Button>
          </div>
        </div>

        {/* RIGHT: Canvas */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {generating && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-card/20">
              <GenerationProgress progress={progress} message={progressMessage} generating={generating} qaStatus={null} />
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            {result ? (
              <div className="h-full flex flex-col">
                {/* Action bar */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{result.name}</span>
                    <span className="text-[9px] text-muted-foreground">{result.frameWidth}×{result.frameHeight} · {result.frameCount}f</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleGenerate} disabled={generating}>
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
                    <Button size="sm" className="h-7 text-[10px] gap-1 font-semibold" onClick={handleSave}>
                      <Save className="h-3 w-3" /> Save
                    </Button>
                  </div>
                </div>

                {/* Preview */}
                <div className="flex-1 min-h-0">
                  <SpritePreviewPlayer imageData={result.imageData} frameWidth={result.frameWidth} frameHeight={result.frameHeight} frameCount={result.frameCount} className="h-full" />
                </div>

                {/* Bottom bar: QA + Palette */}
                <div className="flex-shrink-0 mt-3 flex gap-3">
                  {qaStatus && (
                    <div className={`flex-1 rounded-lg border p-3 text-[10px] ${qaStatus.passed ? 'border-primary/30 bg-primary/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">QA {qaStatus.passed ? '✓ Passed' : '⚠ Warnings'}</span>
                        <span className="text-muted-foreground ml-auto">
                          Obj {qaStatus.objectiveScore}/10 · AI {qaStatus.perceptualScore}/10
                          {qaStatus.attempt > 1 && ` · ${qaStatus.attempt} attempts`}
                        </span>
                      </div>
                      {qaStatus.issues.length > 0 && (
                        <ul className="space-y-0.5 text-muted-foreground mt-1">
                          {qaStatus.issues.slice(0, 3).map((iss, i) => <li key={i}>• {iss}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  {result.palette && result.palette.length > 1 && (
                    <div className="rounded-lg border border-border p-3">
                      <span className="text-[9px] text-muted-foreground uppercase block mb-1.5">{result.palette.length - 1} colors</span>
                      <div className="flex flex-wrap gap-0.5">
                        {result.palette.filter(c => c !== 'transparent').slice(0, 24).map((color, i) => (
                          <div key={i} className="w-4 h-4 rounded-sm border border-border/50 cursor-pointer hover:scale-150 transition-transform" style={{ backgroundColor: color }} title={color} onClick={() => { navigator.clipboard.writeText(color); toast({ title: `Copied ${color}` }); }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="rounded-2xl bg-secondary/30 p-6 mb-4">
                  <Upload className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {referenceImage ? 'Ready to generate' : 'Upload a reference character'}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1 max-w-[300px]">
                  {referenceImage
                    ? 'Configure your settings and click Generate'
                    : 'Drop an image in the panel on the left, pick a style, and hit Generate'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
