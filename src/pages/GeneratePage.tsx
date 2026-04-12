import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import { supabase } from '@/integrations/supabase/client';
import { renderPixelSpriteSheet } from '@/lib/sprite-sheet';
import { Sparkles, Loader2, Download, Copy, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSprites } from '@/hooks/use-sprites';
import type { GridSize, ViewingAngle, SpritePose, SpriteSheet } from '@/types/sprite';

const GRID_SIZES: { value: GridSize; label: string }[] = [
  { value: '32x32', label: '32×32' },
  { value: '64x64', label: '64×64' },
  { value: '128x128', label: '128×128' },
  { value: '256x256', label: '256×256' },
  { value: '512x512', label: '512×512' },
];

const VIEWING_ANGLES: { value: ViewingAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left-side', label: 'Left Side' },
  { value: 'right-side', label: 'Right Side' },
  { value: 'three-quarter-front-left', label: '¾ Front Left' },
  { value: 'three-quarter-front-right', label: '¾ Front Right' },
  { value: 'three-quarter-back-left', label: '¾ Back Left' },
  { value: 'three-quarter-back-right', label: '¾ Back Right' },
  { value: 'top-down', label: 'Top Down' },
  { value: 'isometric', label: 'Isometric' },
];

const POSES: { value: SpritePose; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'walking', label: 'Walking' },
  { value: 'running', label: 'Running' },
  { value: 'jumping', label: 'Jumping' },
  { value: 'falling', label: 'Falling' },
  { value: 'attacking-melee', label: 'Melee Attack' },
  { value: 'attacking-ranged', label: 'Ranged Attack' },
  { value: 'magic-casting', label: 'Magic Casting' },
  { value: 'blocking', label: 'Blocking' },
  { value: 'crouching', label: 'Crouching' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'dying', label: 'Dying' },
  { value: 'hurt', label: 'Hurt' },
  { value: 'celebrating', label: 'Celebrating' },
  { value: 'sitting', label: 'Sitting' },
  { value: 'sleeping', label: 'Sleeping' },
  { value: 'dashing', label: 'Dashing' },
  { value: 'flying', label: 'Flying' },
  { value: 'charging', label: 'Charging' },
];

/** Extract palette and pixel data from an image using canvas */
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

            // Detect background: transparent pixels OR magenta chroma key (#FF00FF)
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

export default function GeneratePage() {
  const { addSprite } = useSprites();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('64x64');
  const [viewingAngle, setViewingAngle] = useState<ViewingAngle>('front');
  const [pose, setPose] = useState<SpritePose>('idle');
  const [frameCount, setFrameCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SpriteSheet | null>(null);
  const [jsonOutput, setJsonOutput] = useState<string | null>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please upload an image file' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be under 10MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferenceImage(dataUrl);
      setReferencePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!referenceImage) return;
    setGenerating(true);
    setProgress(0);
    setResult(null);
    setJsonOutput(null);

    let progressVal = 0;
    const progressInterval = setInterval(() => {
      progressVal = Math.min(progressVal + 0.5, 90);
      setProgress(progressVal);
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('generate-sprite', {
        body: {
          referenceImage,
          gridSize,
          viewingAngle,
          pose,
          frameCount,
        },
      });

      clearInterval(progressInterval);

      if (error) {
        const errorMsg = typeof data === 'object' && data?.error ? data.error : error.message || 'Generation failed';
        throw new Error(errorMsg);
      }

      setProgress(92);

      const fw = Number(data.frameWidth);
      const fh = Number(data.frameHeight);
      const fc = Number(data.frameCount) || 1;

      let spriteImageData: string;
      let palette: string[] | undefined;
      let pixelData: number[][] | undefined;

      if (data.type === 'generated-image') {
        // New flow: AI generated an actual image
        spriteImageData = data.imageData;

        // Extract pixel data from the image client-side
        setProgress(95);
        const extracted = await extractPixelData(spriteImageData, fc, fw, fh);
        palette = extracted.palette.slice(0, 64); // Cap palette display
        pixelData = extracted.frames;
      } else if (data.type === 'pixel-data') {
        // Legacy flow: raw pixel indices
        spriteImageData = renderPixelSpriteSheet({
          palette: data.palette,
          frames: data.frames,
          frameWidth: fw,
          frameHeight: fh,
          logicalFrameWidth: Number(data.logicalFrameWidth) || fw,
          logicalFrameHeight: Number(data.logicalFrameHeight) || fh,
        });
        palette = data.palette;
        pixelData = data.frames;
      } else {
        throw new Error('Unexpected response format');
      }

      setProgress(100);

      const sprite: SpriteSheet = {
        id: `gen-${Date.now()}`,
        name: `${pose} ${viewingAngle}`,
        prompt: `${pose} from ${viewingAngle}`,
        gridSize,
        viewingAngle,
        pose,
        frameCount: fc,
        frameWidth: fw,
        frameHeight: fh,
        imageData: spriteImageData,
        palette,
        pixelData,
        createdAt: new Date().toISOString(),
        collectionIds: [],
        tags: [],
        referenceImageUrl: referencePreview || undefined,
      };

      setResult(sprite);
      setJsonOutput(JSON.stringify({
        palette,
        frames: pixelData,
        gridSize,
        viewingAngle,
        pose,
        frameWidth: fw,
        frameHeight: fh,
        description: data.description || '',
      }, null, 2));
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Generation failed:', err);
      toast({
        title: 'Generation failed',
        description: err?.message || 'Something went wrong. Try again.',
      });
      setProgress(0);
    } finally {
      setGenerating(false);
    }
  }, [referenceImage, gridSize, viewingAngle, pose, frameCount, referencePreview]);

  const handleSave = () => {
    if (result) {
      addSprite(result as any);
      toast({ title: '✓ Saved to library' });
    }
  };

  const handleDownloadPNG = () => {
    if (!result) return;
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
    a.download = `sprite_${result?.pose}_${result?.viewingAngle}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: 'JSON copied to clipboard' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <h1 className="font-pixel text-lg text-primary glow-green mb-6">SPRITE ANALYZER</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-5">
          <div className="p-4 bg-card rounded-lg pixel-border space-y-4">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Reference Sprite</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors min-h-[160px]"
            >
              {referencePreview ? (
                <img
                  src={referencePreview}
                  alt="Reference sprite"
                  className="max-h-[140px] max-w-full object-contain pixelated"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload a key sprite</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG, WEBP up to 10MB</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Grid Size</label>
                <Select value={gridSize} onValueChange={v => setGridSize(v as GridSize)}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRID_SIZES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Viewing Angle</label>
                <Select value={viewingAngle} onValueChange={v => setViewingAngle(v as ViewingAngle)}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VIEWING_ANGLES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Pose / Action</label>
              <Select value={pose} onValueChange={v => setPose(v as SpritePose)}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-2 block">
                Frames: <span className="text-primary">{frameCount}</span>
              </label>
              <Slider value={[frameCount]} onValueChange={([v]) => setFrameCount(v)} min={1} max={4} step={1} />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !referenceImage}
            className="w-full h-12 font-pixel text-xs gap-2 glow-box-green"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'GENERATING...' : 'ANALYZE & GENERATE'}
          </Button>

          {generating && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-[10px] text-muted-foreground text-center">{Math.round(progress)}% — AI is generating your sprite...</p>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="p-4 bg-card rounded-lg pixel-border">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-pixel text-[10px] text-primary">PREVIEW</h2>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleDownloadPNG}>
                    <Download className="h-3 w-3" /> PNG
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleDownloadJSON}>
                    <Download className="h-3 w-3" /> JSON
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleCopyJSON}>
                    <Copy className="h-3 w-3" /> Copy JSON
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleSave}>
                    <ImageIcon className="h-3 w-3" /> Save
                  </Button>
                </div>
              </div>

              <SpritePreviewPlayer
                imageData={result.imageData}
                frameCount={result.frameCount}
                frameWidth={result.frameWidth}
                frameHeight={result.frameHeight}
              />

              {result.palette && result.palette.length > 1 && (
                <div>
                  <h3 className="font-pixel text-[10px] text-muted-foreground mb-2">EXTRACTED PALETTE ({result.palette.length - 1} colors)</h3>
                  <div className="flex flex-wrap gap-1">
                    {result.palette.filter(c => c !== 'transparent').map((color, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {jsonOutput && (
                <div>
                  <h3 className="font-pixel text-[10px] text-muted-foreground mb-2">JSON DATA</h3>
                  <pre className="text-[10px] text-muted-foreground bg-secondary/50 p-3 rounded-lg max-h-[200px] overflow-auto font-mono">
                    {jsonOutput}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Upload a reference sprite to get started</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">AI will analyze your sprite and generate pixel art in the selected pose</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
