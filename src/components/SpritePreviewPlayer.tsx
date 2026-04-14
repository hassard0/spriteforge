import { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Grid3X3, Repeat, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  imageData: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  className?: string;
  initialFps?: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const MIN_FPS = 1;
const MAX_FPS = 30;

export const SpritePreviewPlayer = forwardRef<HTMLDivElement, Props>(function SpritePreviewPlayer(
  { imageData, frameWidth, frameHeight, frameCount, className = '', initialFps = 8 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumRef = useRef<number>(0);
  const playingRef = useRef<boolean>(true);
  const fpsRef = useRef<number>(initialFps);
  const loopRef = useRef<boolean>(true);
  const frameRef = useRef<number>(0);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(initialFps);
  const [loop, setLoop] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [showGrid, setShowGrid] = useState(false);
  const [imgReady, setImgReady] = useState(false);

  // Sync refs with state (so the rAF loop sees latest values without restart)
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { fpsRef.current = fps; }, [fps]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { frameRef.current = currentFrame; }, [currentFrame]);

  // Load image once
  useEffect(() => {
    setImgReady(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
    };
    img.src = imageData;
  }, [imageData]);

  // Reset frame when frameCount changes
  useEffect(() => {
    setCurrentFrame((f) => Math.min(f, Math.max(0, frameCount - 1)));
  }, [frameCount]);

  const drawFrame = useCallback(
    (frameIdx: number) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img || !img.complete) return;

      const displayW = frameWidth * zoom;
      const displayH = frameHeight * zoom;
      canvas.width = displayW;
      canvas.height = displayH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, displayW, displayH);

      // Checker background
      const check = Math.max(4, zoom * 2);
      const rootStyles = window.getComputedStyle(document.documentElement);
      const light = `hsl(${rootStyles.getPropertyValue('--secondary').trim()} / 0.9)`;
      const dark = `hsl(${rootStyles.getPropertyValue('--muted').trim()} / 0.7)`;
      for (let y = 0; y < displayH; y += check) {
        for (let x = 0; x < displayW; x += check) {
          const isLight = ((x / check) + (y / check)) % 2 === 0;
          ctx.fillStyle = isLight ? light : dark;
          ctx.fillRect(x, y, check, check);
        }
      }

      ctx.drawImage(
        img,
        frameIdx * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        displayW,
        displayH,
      );

      if (showGrid && zoom >= 2) {
        ctx.strokeStyle = `hsl(${rootStyles.getPropertyValue('--border').trim()} / 0.9)`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= displayW; x += zoom) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, displayH);
          ctx.stroke();
        }
        for (let y = 0; y <= displayH; y += zoom) {
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(displayW, y + 0.5);
          ctx.stroke();
        }
      }
    },
    [frameWidth, frameHeight, zoom, showGrid],
  );

  // Redraw when any visual parameter changes
  useEffect(() => {
    if (imgReady) drawFrame(currentFrame);
  }, [imgReady, currentFrame, drawFrame]);

  // rAF loop (single instance, never restarted on state changes)
  useEffect(() => {
    if (!imgReady) return;
    const tick = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (playingRef.current && frameCount > 1) {
        accumRef.current += dt;
        const msPerFrame = 1000 / fpsRef.current;
        while (accumRef.current >= msPerFrame) {
          accumRef.current -= msPerFrame;
          let next = frameRef.current + 1;
          if (next >= frameCount) {
            if (loopRef.current) {
              next = 0;
            } else {
              next = frameCount - 1;
              playingRef.current = false;
              setPlaying(false);
            }
          }
          frameRef.current = next;
          setCurrentFrame(next);
        }
      } else {
        accumRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
      accumRef.current = 0;
    };
  }, [imgReady, frameCount]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const stepPrev = useCallback(() => {
    setPlaying(false);
    setCurrentFrame((f) => {
      if (f <= 0) return loopRef.current ? frameCount - 1 : 0;
      return f - 1;
    });
  }, [frameCount]);
  const stepNext = useCallback(() => {
    setPlaying(false);
    setCurrentFrame((f) => {
      if (f >= frameCount - 1) return loopRef.current ? 0 : frameCount - 1;
      return f + 1;
    });
  }, [frameCount]);

  const onCanvasKey = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepNext(); }
      else if (e.key === 'l' || e.key === 'L') { setLoop((l) => !l); }
    },
    [togglePlay, stepPrev, stepNext],
  );

  // Thumbnail strip refs
  const thumbCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    if (!imgReady) return;
    const img = imgRef.current;
    if (!img) return;
    const THUMB_H = 48;
    const scale = THUMB_H / frameHeight;
    const thumbW = Math.round(frameWidth * scale);
    for (let i = 0; i < frameCount; i++) {
      const c = thumbCanvasRefs.current[i];
      if (!c) continue;
      c.width = thumbW;
      c.height = THUMB_H;
      const tctx = c.getContext('2d');
      if (!tctx) continue;
      tctx.imageSmoothingEnabled = false;
      tctx.clearRect(0, 0, thumbW, THUMB_H);
      tctx.drawImage(img, i * frameWidth, 0, frameWidth, frameHeight, 0, 0, thumbW, THUMB_H);
    }
  }, [imgReady, frameCount, frameWidth, frameHeight]);

  const selectFrame = (idx: number) => {
    setPlaying(false);
    setCurrentFrame(idx);
  };

  return (
    <div ref={ref} className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-1 items-center justify-center overflow-auto rounded-lg bg-card p-4 pixel-border-accent">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onKeyDown={onCanvasKey}
          aria-label={`Sprite preview, frame ${currentFrame + 1} of ${frameCount}`}
          className="block max-w-none shrink-0 outline-none focus:ring-2 focus:ring-primary/50 rounded"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={stepPrev}
          aria-label="Previous frame"
          disabled={frameCount <= 1}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={frameCount <= 1}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={stepNext}
          aria-label="Next frame"
          disabled={frameCount <= 1}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={loop ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setLoop((l) => !l)}
          aria-label="Toggle loop"
          title="Toggle loop (L)"
        >
          <Repeat className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={showGrid ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowGrid((g) => !g)}
          aria-label="Toggle pixel grid"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1.5 flex-1 min-w-[100px]">
          <span className="text-[9px] text-muted-foreground w-6">FPS</span>
          <Slider
            value={[fps]}
            onValueChange={([v]) => setFps(v)}
            min={MIN_FPS}
            max={MAX_FPS}
            step={1}
            aria-label="Frames per second"
          />
          <span className="text-[10px] tabular-nums w-6 text-right">{fps}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] tabular-nums w-6 text-center">{zoom}x</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground text-center" aria-live="polite">
        Frame {currentFrame + 1} / {frameCount}
      </div>

      {/* Thumbnail strip */}
      {frameCount > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: frameCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectFrame(i)}
              aria-label={`Jump to frame ${i + 1}`}
              className={`flex-shrink-0 rounded border-2 p-0.5 transition-all ${
                i === currentFrame ? 'border-primary' : 'border-border hover:border-primary/50'
              }`}
            >
              <canvas
                ref={(el) => { thumbCanvasRefs.current[i] = el; }}
                style={{ imageRendering: 'pixelated', display: 'block' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
