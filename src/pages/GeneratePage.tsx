import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import { useSprites } from '@/hooks/use-sprites';
import { supabase } from '@/integrations/supabase/client';
import { renderPixelSpriteSheet } from '@/lib/sprite-sheet';
import { Sparkles, Loader2, Download, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AnimationType, SpriteStyle, PaletteType, Resolution, FacingDirection, SpriteSheet } from '@/types/sprite';

const ANIM_TYPES: { value: AnimationType; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'attack', label: 'Attack' },
  { value: 'jump', label: 'Jump' },
  { value: 'death', label: 'Death' },
];

const STYLES: { value: SpriteStyle; label: string }[] = [
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'chibi', label: 'Chibi' },
  { value: 'cel-shaded', label: 'Cel-Shaded' },
];

const PALETTES: { value: PaletteType; label: string }[] = [
  { value: 'nes', label: 'NES (54 colors)' },
  { value: 'snes', label: 'SNES (256 colors)' },
  { value: 'gameboy', label: 'Game Boy (4 shades)' },
  { value: 'custom', label: 'Custom' },
];

const RESOLUTIONS: { value: Resolution; label: string }[] = [
  { value: '16x16', label: '16×16' },
  { value: '32x32', label: '32×32' },
  { value: '48x48', label: '48×48' },
  { value: '64x64', label: '64×64' },
  { value: '128x128', label: '128×128' },
];

export default function GeneratePage() {
  const { addSprite } = useSprites();
  const [prompt, setPrompt] = useState('');
  const [animType, setAnimType] = useState<AnimationType>('idle');
  const [style, setStyle] = useState<SpriteStyle>('pixel-art');
  const [palette, setPalette] = useState<PaletteType>('nes');
  const [resolution, setResolution] = useState<Resolution>('32x32');
  const [frameCount, setFrameCount] = useState(6);
  const [facing, setFacing] = useState<FacingDirection>('right');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SpriteSheet | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setProgress(0);
    setResult(null);

    const fw = parseInt(resolution);

    // Progress animation - slower since we're generating multiple frames
    let progressVal = 0;
    const progressInterval = setInterval(() => {
      progressVal = Math.min(progressVal + 0.5, 90);
      setProgress(progressVal);
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('generate-sprite', {
        body: {
          prompt,
          animationType: animType,
          style,
          palette,
          resolution,
          frameCount,
          facingDirection: facing,
        },
      });

      clearInterval(progressInterval);

      if (error) {
        const errorMsg = typeof data === 'object' && data?.error ? data.error : error.message || 'Generation failed';
        throw new Error(errorMsg);
      }

      if (!Array.isArray(data?.frames) || data.frames.length === 0) {
        throw new Error('No animation frames generated. The AI model may have declined your prompt.');
      }

      setProgress(95);

      const actualFrameCount = Number(data.frameCount) || frameCount;
      const frameWidth = Number(data.frameWidth) || fw;
      const frameHeight = Number(data.frameHeight) || fw;

      const spriteSheetDataUrl = await stitchFrames(data.frames, frameWidth, frameHeight);

      setProgress(100);

      const sprite: SpriteSheet = {
        id: `gen-${Date.now()}`,
        name: prompt.slice(0, 30),
        prompt,
        animationType: animType,
        style,
        palette,
        resolution,
        frameCount: actualFrameCount,
        frameWidth,
        frameHeight,
        facingDirection: facing,
        imageData: spriteSheetDataUrl,
        createdAt: new Date().toISOString(),
        collectionIds: [],
        tags: [],
      };

      setResult(sprite);
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
  }, [prompt, animType, style, palette, resolution, frameCount, facing]);

  const handleSave = () => {
    if (result) {
      addSprite(result);
      toast({ title: '✓ Saved to library' });
      setResult(null);
      setPrompt('');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.imageData;
    a.download = `${result.name.replace(/\s+/g, '_')}_spritesheet.png`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <h1 className="font-pixel text-lg text-primary glow-green mb-6">GENERATE SPRITE</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-5">
          <div className="p-4 bg-card rounded-lg pixel-border space-y-4">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt</label>
            <Textarea
              placeholder="Describe your character... e.g. 'medieval knight with blue armor and a shield'"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="min-h-[80px] bg-secondary/50 border-border font-mono text-sm resize-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Animation</label>
                <Select value={animType} onValueChange={v => setAnimType(v as AnimationType)}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{ANIM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Style</label>
                <Select value={style} onValueChange={v => setStyle(v as SpriteStyle)}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{STYLES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Palette</label>
                <Select value={palette} onValueChange={v => setPalette(v as PaletteType)}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{PALETTES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Resolution</label>
                <Select value={resolution} onValueChange={v => setResolution(v as Resolution)}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESOLUTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-2 block">
                Frames: <span className="text-primary">{frameCount}</span>
              </label>
              <Slider value={[frameCount]} onValueChange={([v]) => setFrameCount(v)} min={4} max={24} step={1} />
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-2 block">Facing Direction</label>
              <div className="flex gap-2">
                {(['left', 'right', 'up', 'down'] as FacingDirection[]).map(d => (
                  <Button
                    key={d}
                    variant={facing === d ? 'default' : 'secondary'}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => setFacing(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full h-12 font-pixel text-xs gap-2 glow-box-green"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'GENERATING...' : 'GENERATE SPRITE'}
          </Button>

          {generating && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-[10px] text-muted-foreground text-center">{progress}% — AI is creating your sprite...</p>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="p-4 bg-card rounded-lg pixel-border">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-pixel text-[10px] text-primary">PREVIEW</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleDownload}>
                    <Download className="h-3 w-3" /> PNG
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleSave}>
                    <Copy className="h-3 w-3" /> Save to Library
                  </Button>
                </div>
              </div>
              <SpritePreviewPlayer
                imageData={result.imageData}
                frameCount={result.frameCount}
                frameWidth={result.frameWidth}
                frameHeight={result.frameHeight}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Enter a prompt and click Generate</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">AI will create your sprite sheet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
