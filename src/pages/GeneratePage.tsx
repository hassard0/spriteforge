import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getStyleById, type ArtStyle } from '@/lib/art-styles';
import { postProcessImage } from '@/lib/post-process';

import {
  Sparkles, Loader2, Upload, Copy, Save, RotateCcw, FileJson, Image as ImageIcon,
  X as XIcon, RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSprites } from '@/hooks/use-sprites';
import { StyleSelector } from '@/components/generate/StyleSelector';
import { ReferenceUploader } from '@/components/generate/ReferenceUploader';
import { GenerationConfig } from '@/components/generate/GenerationConfig';
import { GenerationProgress } from '@/components/generate/GenerationProgress';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import type { GridSize, ViewingAngle, SpritePose, SpriteSheet } from '@/types/sprite';
import { PRESET_PALETTES, type Palette } from '@/lib/palettes';
import {
  describeReferenceImage,
  detectVisionBackend,
  type VisionProgress,
} from '@/lib/local-vision';

const MAX_RETRIES = 1;
const LOCAL_VISION_KEY = 'voxpi_use_local_vision';
const RECENT_KEY = 'voxpi_recent_gens';
const RECENT_MAX = 10;
let hasShownBgModelToast = false;

interface RecentGen {
  id: string;
  sprite: SpriteSheet;
  jsonOutput: string;
  createdAt: string;
}

function loadRecents(): RecentGen[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveRecent(gen: RecentGen) {
  try {
    const existing = loadRecents();
    const next = [gen, ...existing].slice(0, RECENT_MAX);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function extractPixelData(
  imageData: string, frameCount: number, frameWidth: number, frameHeight: number,
): Promise<{ palette: string[]; frames: number[][] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const expectedW = frameWidth * frameCount;
      if (img.naturalWidth !== expectedW) {
        console.warn(
          `extractPixelData: image width ${img.naturalWidth} != expected ${expectedW}`,
        );
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

interface PostProcessSettings {
  style: ArtStyle;
  size: number;
  paletteColors: string[] | undefined;
}

async function applyPostProcess(rawImage: string, settings: PostProcessSettings): Promise<string> {
  return postProcessImage(
    rawImage,
    settings.style,
    settings.size,
    settings.size,
    settings.paletteColors,
  );
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
  const [palette, setPalette] = useState<Palette>(PRESET_PALETTES[0]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState<SpriteSheet | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [jsonOutput, setJsonOutput] = useState<string | null>(null);
  const [qaStatus, setQaStatus] = useState<QAStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentGen[]>(() => loadRecents());
  const [useLocalVision, setUseLocalVision] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_VISION_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [visionDownload, setVisionDownload] = useState<VisionProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Re-read preference if it changes via the settings page tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_VISION_KEY) setUseLocalVision(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const selectedStyle = getStyleById(styleId);

  const handleUpload = useCallback((dataUrl: string) => {
    setReferenceImage(dataUrl);
    setReferencePreview(dataUrl);
  }, []);
  const handleClearRef = useCallback(() => {
    setReferenceImage(null);
    setReferencePreview(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setGenerating(false);
    setProgress(0);
    setProgressMessage('');
    setPhase('');
    toast({ title: 'Generation cancelled' });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!referenceImage || !selectedStyle) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true); setProgress(0);
    setResult(null); setJsonOutput(null); setQaStatus(null); setError(null); setRawImage(null);
    setVisionDownload(null);
    const size = parseInt(gridSize);

    // Stage 1: vision analysis. If the user opted in to local vision AND WebGPU
    // is available, run SmolVLM in-browser and forward the resulting text as a
    // precomputed description. Any failure falls back to server-side Gemini.
    let precomputedDescription: string | undefined;
    if (useLocalVision) {
      const backend = await detectVisionBackend();
      if (backend === 'webgpu') {
        try {
          setPhase('Analyzing reference locally');
          setProgress(5);
          setProgressMessage('Loading local vision model…');
          const desc = await describeReferenceImage(referenceImage, {
            signal: controller.signal,
            onProgress: (p) => {
              setVisionDownload(p);
              if (p.status === 'downloading' && typeof p.progress === 'number') {
                const pct = 5 + p.progress * 15; // 5% -> 20%
                setProgress(pct);
                if (p.loaded && p.total) {
                  const mb = (n: number) => (n / (1024 * 1024)).toFixed(0);
                  setProgressMessage(
                    `Downloading model ${mb(p.loaded)}/${mb(p.total)} MB…`,
                  );
                } else {
                  setProgressMessage(p.message || 'Downloading model…');
                }
              } else if (p.status === 'loading') {
                setProgressMessage(p.message || 'Loading model…');
              } else if (p.status === 'inferring') {
                setProgress(20);
                setProgressMessage('Analyzing reference locally…');
              }
            },
          });
          if (desc && desc.trim().length > 20) {
            precomputedDescription = desc.trim();
            console.log('[local-vision] description:', precomputedDescription);
          } else {
            console.warn('[local-vision] returned empty/short description, falling back to server');
          }
        } catch (err: any) {
          if (!controller.signal.aborted) {
            console.error('[local-vision] failed:', err);
            toast({
              title: 'Local vision failed',
              description: 'Falling back to server vision.',
            });
          }
          precomputedDescription = undefined;
        } finally {
          setVisionDownload(null);
        }
      } else {
        console.log('[local-vision] WebGPU unavailable, using server vision');
      }
    }

    if (controller.signal.aborted) {
      setGenerating(false);
      abortRef.current = null;
      return;
    }

    setPhase(precomputedDescription ? 'Generating sprite' : 'Analyzing reference');
    setProgress(precomputedDescription ? 25 : 10);
    setProgressMessage(
      precomputedDescription ? 'AI generating sprite...' : 'Analyzing reference...',
    );

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (controller.signal.aborted) break;
      try {
        setPhase('Generating sprite'); setProgress(25);
        setProgressMessage(attempt > 1 ? `Retry ${attempt}/${MAX_RETRIES} — Generating...` : 'AI generating sprite...');
        const pi = setInterval(() => setProgress(p => Math.min(p + 0.5, 55)), 500);
        const { data, error: err } = await supabase.functions.invoke('generate-sprite', {
          body: {
            referenceImage, gridSize, viewingAngle, pose, frameCount, styleId,
            styleKeywords: selectedStyle.promptKeywords || selectedStyle.name,
            styleNegative: selectedStyle.negativePrompt || '',
            palette: { id: palette.id, colors: palette.colors },
            ...(precomputedDescription ? { precomputedDescription } : {}),
          },
        });
        clearInterval(pi);
        if (controller.signal.aborted) break;
        if (err) throw new Error(typeof data === 'object' && data?.error ? data.error : err.message || 'Failed');
        if (data.type !== 'generated-image' || !data.imageData) throw new Error('Unexpected response');

        const rawImg = data.imageData as string;
        setRawImage(rawImg);

        setPhase('Removing background'); setProgress(60); setProgressMessage('Removing background...');
        if (!hasShownBgModelToast) {
          hasShownBgModelToast = true;
          toast({ title: 'Loading background-removal model', description: 'First-run ~4 MB download, then cached.' });
        }
        let processed = rawImg;
        setPhase('Quantizing palette'); setProgress(80); setProgressMessage('Post-processing...');
        processed = await applyPostProcess(rawImg, {
          style: selectedStyle,
          size,
          paletteColors: palette.colors.length > 0 ? palette.colors : undefined,
        });
        if (controller.signal.aborted) break;

        setProgress(85); setProgressMessage('Finalizing...');

        setPhase('Done'); setProgress(95); setProgressMessage('Extracting data...');
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
        const jsonOut = JSON.stringify({
          palette: extracted.palette.slice(0, 64), frames: extracted.frames,
          gridSize, viewingAngle, pose, style: selectedStyle.id,
          frameWidth: fw, frameHeight: fh, description: data.description || '',
        }, null, 2);

        setResult(sprite);
        setJsonOutput(jsonOut);

        const recent: RecentGen = { id: sprite.id, sprite, jsonOutput: jsonOut, createdAt: sprite.createdAt };
        saveRecent(recent);
        setRecents(loadRecents());

        toast({ title: 'Sprite generated!' });
        break;
      } catch (err: any) {
        if (controller.signal.aborted) break;
        if (attempt >= MAX_RETRIES) {
          setError(err?.message || 'Generation failed');
          toast({ title: 'Generation failed', description: err?.message || 'Try again.' });
          setProgress(0); setProgressMessage(''); setPhase('');
        }
      }
    }
    setGenerating(false);
    abortRef.current = null;
  }, [referenceImage, gridSize, viewingAngle, pose, frameCount, styleId, selectedStyle, referencePreview, palette, useLocalVision]);

  const handleReprocess = useCallback(async () => {
    if (!rawImage || !selectedStyle || !result) return;
    try {
      const size = parseInt(gridSize);
      toast({ title: 'Re-processing…' });
      const processed = await applyPostProcess(rawImage, {
        style: selectedStyle,
        size,
        paletteColors: palette.colors.length > 0 ? palette.colors : undefined,
      });
      const extracted = await extractPixelData(processed, result.frameCount, result.frameWidth, result.frameHeight);
      const updated: SpriteSheet = {
        ...result,
        imageData: processed,
        palette: extracted.palette.slice(0, 64),
        pixelData: extracted.frames,
      };
      setResult(updated);
      toast({ title: 'Re-processed' });
    } catch (err: any) {
      toast({ title: 'Re-process failed', description: err?.message || 'Unknown error' });
    }
  }, [rawImage, selectedStyle, result, gridSize, palette]);

  const handleSave = () => { if (result) { addSprite(result); toast({ title: 'Saved to library' }); } };
  const handleDownloadPNG = () => { if (!result) return; const a = document.createElement('a'); a.href = result.imageData; a.download = `sprite_${result.pose}_${result.viewingAngle}.png`; a.click(); };
  const handleDownloadJSON = () => { if (!jsonOutput) return; const b = new Blob([jsonOutput], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `sprite_${result?.pose}_${result?.viewingAngle}.json`; a.click(); URL.revokeObjectURL(u); };
  const handleCopyJSON = () => { if (!jsonOutput) return; navigator.clipboard.writeText(jsonOutput); toast({ title: 'Copied to clipboard' }); };

  const canGenerate = !!referenceImage && !!selectedStyle && !generating;

  // Global Ctrl+Enter -> Generate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (canGenerate) { e.preventDefault(); handleGenerate(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canGenerate, handleGenerate]);

  const loadRecent = (gen: RecentGen) => {
    setResult(gen.sprite);
    setJsonOutput(gen.jsonOutput);
    setError(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Style strip */}
      <div className="flex-shrink-0 border-b border-border bg-card/30 px-4 py-2">
        <StyleSelector selectedId={styleId} onSelect={setStyleId} />
      </div>

      {/* Responsive layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* LEFT / TOP: Config */}
        <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/20 flex flex-col md:overflow-y-auto max-h-[40vh] md:max-h-none overflow-y-auto">
          <div className="p-4 space-y-5 flex-1">
            <ReferenceUploader preview={referencePreview} onUpload={handleUpload} onClear={handleClearRef} />
            <GenerationConfig
              gridSize={gridSize} viewingAngle={viewingAngle} pose={pose} frameCount={frameCount} palette={palette}
              onGridSizeChange={setGridSize} onViewingAngleChange={setViewingAngle}
              onPoseChange={setPose} onFrameCountChange={setFrameCount}
              onPaletteChange={setPalette}
            />
          </div>
          <div className="p-3 border-t border-border bg-card/30">
            {generating ? (
              <Button onClick={handleCancel} variant="destructive" className="w-full h-9 font-pixel text-[10px] gap-2" aria-label="Cancel generation">
                <XIcon className="h-3.5 w-3.5" />
                CANCEL
              </Button>
            ) : (
              <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full h-9 font-pixel text-[10px] gap-2 glow-box-green" aria-label="Generate sprite (Ctrl+Enter)">
                <Sparkles className="h-3.5 w-3.5" />
                GENERATE
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT / BOTTOM: Canvas */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {generating && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-card/20">
              <GenerationProgress
                progress={progress}
                message={progressMessage}
                generating={generating}
                qaStatus={null}
                visionDownload={visionDownload}
              />
              {phase && <p className="text-[10px] text-muted-foreground mt-1">{phase}</p>}
            </div>
          )}

          {/* Recent rail */}
          {recents.length > 0 && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-card/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-muted-foreground uppercase">Recent</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {recents.map(r => (
                  <button
                    key={r.id}
                    onClick={() => loadRecent(r)}
                    className="flex-shrink-0 h-10 w-10 rounded border border-border hover:border-primary/60 overflow-hidden bg-secondary/30"
                    aria-label={`Load recent generation ${r.sprite.name}`}
                    title={r.sprite.name}
                  >
                    <img src={r.sprite.imageData} alt="" className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            {generating && !result && (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse rounded-xl border border-border bg-card/30 p-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground">{phase || 'Working...'}</p>
                </div>
              </div>
            )}
            {!generating && !result && error && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <p className="text-sm text-destructive mb-2">Generation failed</p>
                <p className="text-[10px] text-muted-foreground mb-4 max-w-[300px]">{error}</p>
                <Button size="sm" onClick={handleGenerate} className="gap-1.5">
                  <RotateCcw className="h-3 w-3" /> Retry
                </Button>
              </div>
            )}
            {result ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 flex-shrink-0 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{result.name}</span>
                    <span className="text-[9px] text-muted-foreground">{result.frameWidth}×{result.frameHeight} · {result.frameCount}f</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleGenerate} disabled={generating} aria-label="Regenerate">
                      <RotateCcw className="h-3 w-3" /> Retry
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleReprocess} disabled={!rawImage || generating} aria-label="Re-process">
                      <RefreshCw className="h-3 w-3" /> Re-process
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadPNG} aria-label="Download PNG">
                      <ImageIcon className="h-3 w-3" /> PNG
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadJSON} aria-label="Download JSON">
                      <FileJson className="h-3 w-3" /> JSON
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleCopyJSON} aria-label="Copy JSON">
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <Button size="sm" className="h-7 text-[10px] gap-1 font-semibold" onClick={handleSave} aria-label="Save to library">
                      <Save className="h-3 w-3" /> Save
                    </Button>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <SpritePreviewPlayer imageData={result.imageData} frameWidth={result.frameWidth} frameHeight={result.frameHeight} frameCount={result.frameCount} className="h-full" />
                </div>

                <div className="flex-shrink-0 mt-3 flex gap-3 flex-wrap">
                  {qaStatus && (
                    <div className={`flex-1 min-w-[200px] rounded-lg border p-3 text-[10px] ${qaStatus.passed ? 'border-primary/30 bg-primary/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">QA {qaStatus.passed ? 'Passed' : 'Warnings'}</span>
                        <span className="text-muted-foreground ml-auto">
                          Obj {qaStatus.objectiveScore}/10 · AI {qaStatus.perceptualScore}/10
                          {qaStatus.attempt > 1 && ` · ${qaStatus.attempt} attempts`}
                        </span>
                      </div>
                      {qaStatus.issues.length > 0 && (
                        <ul className="space-y-0.5 text-muted-foreground mt-1">
                          {qaStatus.issues.slice(0, 3).map((iss, i) => <li key={i}>- {iss}</li>)}
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
            ) : !generating && !error && (
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
