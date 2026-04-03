import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, ZoomIn, ZoomOut, Grid3X3,
} from 'lucide-react';

interface Props {
  imageData: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  className?: string;
}

export function SpritePreviewPlayer({ imageData, frameCount, frameWidth, frameHeight, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(8);
  const [loop, setLoop] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [showGrid, setShowGrid] = useState(false);

  const drawFrame = useCallback((frame: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const w = frameWidth * zoom;
    const h = frameHeight * zoom;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // Checkerboard background
    const checkSize = Math.max(4, zoom * 2);
    for (let y = 0; y < h; y += checkSize) {
      for (let x = 0; x < w; x += checkSize) {
        const isLight = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isLight ? 'hsl(220, 15%, 14%)' : 'hsl(220, 15%, 11%)';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    ctx.drawImage(
      img,
      frame * frameWidth, 0, frameWidth, frameHeight,
      0, 0, w, h
    );

    if (showGrid) {
      ctx.strokeStyle = 'hsla(152, 100%, 50%, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += zoom) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += zoom) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
    }
  }, [frameWidth, frameHeight, zoom, showGrid]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawFrame(0);
    };
    img.src = imageData;
  }, [imageData, drawFrame]);

  // Animation loop
  useEffect(() => {
    if (!playing) {
      drawFrame(currentFrame);
      return;
    }

    const interval = 1000 / fps;
    let frame = currentFrame;

    const animate = (time: number) => {
      if (time - lastTimeRef.current >= interval) {
        lastTimeRef.current = time;
        frame = (frame + 1) % frameCount;
        if (frame === 0 && !loop) {
          setPlaying(false);
          return;
        }
        setCurrentFrame(frame);
        drawFrame(frame);
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, fps, frameCount, loop, drawFrame, currentFrame]);

  // Draw when frame changes externally
  useEffect(() => {
    if (!playing) drawFrame(currentFrame);
  }, [currentFrame, playing, drawFrame]);

  const stepFrame = (dir: number) => {
    setPlaying(false);
    setCurrentFrame(f => ((f + dir) + frameCount) % frameCount);
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Canvas */}
      <div className="flex items-center justify-center p-4 bg-card rounded-lg pixel-border-accent overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Frame counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Frame <span className="text-primary font-bold">{currentFrame + 1}</span> / {frameCount}</span>
        <span>{frameWidth}×{frameHeight}px @ {fps}fps</span>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-1 justify-center">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepFrame(-1)}>
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 text-primary hover:text-primary"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepFrame(1)}>
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          variant={loop ? 'secondary' : 'ghost'}
          size="icon" className="h-8 w-8"
          onClick={() => setLoop(!loop)}
        >
          <Repeat className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={showGrid ? 'secondary' : 'ghost'}
          size="icon" className="h-8 w-8"
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(1, z - 1))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center">{zoom}×</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(12, z + 1))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Speed slider */}
      <div className="flex items-center gap-3 px-2">
        <span className="text-[10px] text-muted-foreground w-10">Speed</span>
        <Slider
          value={[fps]}
          onValueChange={([v]) => setFps(v)}
          min={1}
          max={30}
          step={1}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-12 text-right">{fps} FPS</span>
      </div>

      {/* Frame strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {Array.from({ length: frameCount }, (_, i) => (
          <button
            key={i}
            onClick={() => { setPlaying(false); setCurrentFrame(i); }}
            className={`flex-shrink-0 w-8 h-8 rounded text-[10px] font-bold transition-colors ${
              i === currentFrame
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
