import { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Grid3X3, Maximize } from 'lucide-react';

interface Props {
  imageData: string;
  frameWidth: number;
  frameHeight: number;
  className?: string;
}

const MIN_ZOOM = 0.125;
const MAX_ZOOM = 12;

export const SpritePreviewPlayer = forwardRef<HTMLDivElement, Props>(function SpritePreviewPlayer(
  { imageData, frameWidth, frameHeight, className = '' },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);

  const getFitZoom = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return 1;

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return 1;

    const styles = window.getComputedStyle(container);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const availableW = Math.max(container.clientWidth - padX, 1);
    const availableH = Math.max(container.clientHeight - padY, 1);

    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(availableW / imgW, availableH / imgH)));
  }, []);

  const stepZoom = useCallback((current: number, direction: 1 | -1) => {
    if (current < 1) {
      const next = direction === 1 ? current * 2 : current / 2;
      return Math.max(MIN_ZOOM, Math.min(1, next));
    }

    const next = direction === 1 ? current + 1 : current - 1;
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return;

    const z = manualZoom ?? getFitZoom();
    setDisplayZoom(z);

    const scaledW = Math.max(1, Math.round(imgW * z));
    const scaledH = Math.max(1, Math.round(imgH * z));

    canvas.width = scaledW;
    canvas.height = scaledH;

    ctx.clearRect(0, 0, scaledW, scaledH);
    ctx.imageSmoothingEnabled = false;

    const checkSize = Math.max(4, Math.round(Math.max(z, 1) * 2));
    for (let y = 0; y < scaledH; y += checkSize) {
      for (let x = 0; x < scaledW; x += checkSize) {
        const isLight = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isLight ? 'hsl(220 15% 14%)' : 'hsl(220 15% 11%)';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, scaledW, scaledH);

    if (showGrid && z >= 2) {
      ctx.strokeStyle = 'hsla(152, 100%, 50%, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= scaledW; x += z) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, scaledH);
        ctx.stroke();
      }
      for (let y = 0; y <= scaledH; y += z) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(scaledW, y + 0.5);
        ctx.stroke();
      }
    }
  }, [getFitZoom, manualZoom, showGrid]);

  useEffect(() => {
    setManualZoom(null);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      if (manualZoom === null) draw();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [manualZoom, draw]);

  const handleZoomOut = () => setManualZoom(stepZoom(displayZoom, -1));
  const handleZoomIn = () => setManualZoom(stepZoom(displayZoom, 1));

  return (
    <div ref={ref} className={`flex flex-col gap-3 ${className}`}>
      <div
        ref={containerRef}
        className="flex h-[500px] items-center justify-center overflow-auto rounded-lg bg-card p-4 pixel-border-accent"
      >
        <canvas ref={canvasRef} className="block max-w-none shrink-0" style={{ imageRendering: 'pixelated' }} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{frameWidth}×{frameHeight}px</span>
        <span>{manualZoom === null ? `fit (${displayZoom.toFixed(displayZoom < 1 ? 3 : 1).replace(/\.0$/, '')}×)` : `${displayZoom.toFixed(displayZoom < 1 ? 3 : 1).replace(/\.0$/, '')}× zoom`}</span>
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant={showGrid ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
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
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="w-14 text-center text-xs text-muted-foreground">
          {displayZoom.toFixed(displayZoom < 1 ? 3 : 1).replace(/\.0$/, '')}×
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
