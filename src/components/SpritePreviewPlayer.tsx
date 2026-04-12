import { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Grid3X3 } from 'lucide-react';

interface Props {
  imageData: string;
  frameWidth: number;
  frameHeight: number;
  className?: string;
}

export const SpritePreviewPlayer = forwardRef<HTMLDivElement, Props>(function SpritePreviewPlayer(
  { imageData, frameWidth, frameHeight, className = '' },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(2);
  const [showGrid, setShowGrid] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;

    const w = imgW * zoom;
    const h = imgH * zoom;
    canvas.width = w;
    canvas.height = h;

    // Checkerboard background
    const checkSize = Math.max(4, zoom * 2);
    for (let y = 0; y < h; y += checkSize) {
      for (let x = 0; x < w; x += checkSize) {
        const isLight = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isLight ? 'hsl(220 15% 14%)' : 'hsl(220 15% 11%)';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw the full image scaled up
    ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, w, h);

    // Grid overlay
    if (showGrid && zoom >= 2) {
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
  }, [zoom, showGrid]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageData;
  }, [imageData, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div ref={ref} className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-center p-4 bg-card rounded-lg pixel-border-accent overflow-auto max-h-[500px]">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{frameWidth}×{frameHeight}px</span>
        <span>{zoom}× zoom</span>
      </div>

      <div className="flex items-center gap-1 justify-center">
        <Button
          type="button"
          variant={showGrid ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(1, z - 1))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center">{zoom}×</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(12, z + 1))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
