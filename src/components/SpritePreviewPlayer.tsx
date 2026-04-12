import { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Grid3X3, Maximize } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [manualZoom, setManualZoom] = useState<number | null>(null); // null = fit
  const [displayZoom, setDisplayZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !img.complete || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return;

    let z: number;
    if (manualZoom !== null) {
      z = manualZoom;
    } else {
      // Fit to container
      const padding = 32;
      const maxW = container.clientWidth - padding;
      const maxH = 468;
      z = Math.max(1, Math.floor(Math.min(maxW / imgW, maxH / imgH)));
      z = Math.min(z, 12);
    }

    setDisplayZoom(z);

    const w = imgW * z;
    const h = imgH * z;
    canvas.width = w;
    canvas.height = h;

    const checkSize = Math.max(4, z * 2);
    for (let y = 0; y < h; y += checkSize) {
      for (let x = 0; x < w; x += checkSize) {
        const isLight = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isLight ? 'hsl(220 15% 14%)' : 'hsl(220 15% 11%)';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, w, h);

    if (showGrid && z >= 2) {
      ctx.strokeStyle = 'hsla(152, 100%, 50%, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += z) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += z) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
    }
  }, [manualZoom, showGrid]);

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

  // Redraw on container resize for fit mode
  useEffect(() => {
    if (manualZoom !== null) return;
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [manualZoom, draw]);

  return (
    <div ref={ref} className={`flex flex-col gap-3 ${className}`}>
      <div ref={containerRef} className="flex items-center justify-center p-4 bg-card rounded-lg pixel-border-accent overflow-auto max-h-[500px]">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{frameWidth}×{frameHeight}px</span>
        <span>{manualZoom === null ? 'fit' : `${displayZoom}×`} zoom</span>
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
        <Button
          type="button"
          variant={manualZoom === null ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setManualZoom(null)}
          title="Fit to size"
        >
          <Maximize className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setManualZoom(Math.max(1, displayZoom - 1))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center">{displayZoom}×</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setManualZoom(Math.min(12, displayZoom + 1))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
