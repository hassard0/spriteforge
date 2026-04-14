/**
 * Renders pixel-data frames (palette + index arrays) into a horizontal sprite sheet PNG data URL.
 */

export interface PixelSpriteData {
  palette: string[];
  frames: number[][];
  frameWidth: number;
  frameHeight: number;
  logicalFrameWidth?: number;
  logicalFrameHeight?: number;
}

function parseHex(hex: string): [number, number, number, number] {
  if (hex === 'transparent' || hex === '#00000000') return [0, 0, 0, 0];
  const clean = hex.replace('#', '');
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      255,
    ];
  }
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
      255,
    ];
  }
  return [0, 0, 0, 0];
}

function renderFrame(
  palette: [number, number, number, number][],
  indices: number[],
  width: number,
  height: number,
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  const expectedPixels = width * height;

  for (let i = 0; i < expectedPixels; i++) {
    const idx = i < indices.length ? indices[i] : 0;
    const color = idx < palette.length ? palette[idx] : [0, 0, 0, 0];
    const offset = i * 4;
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3];
  }

  return imageData;
}

export function renderPixelSpriteSheet(spriteData: PixelSpriteData): string {
  const {
    palette: hexPalette,
    frames,
    frameWidth,
    frameHeight,
    logicalFrameWidth = frameWidth,
    logicalFrameHeight = frameHeight,
  } = spriteData;

  const palette = hexPalette.map(parseHex);
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frames.length;
  canvas.height = frameHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.imageSmoothingEnabled = false;

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = logicalFrameWidth;
  frameCanvas.height = logicalFrameHeight;
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('Could not create frame canvas context');
  frameCtx.imageSmoothingEnabled = false;

  frames.forEach((indices, frameIndex) => {
    const frameImageData = renderFrame(palette, indices, logicalFrameWidth, logicalFrameHeight);
    frameCtx.clearRect(0, 0, logicalFrameWidth, logicalFrameHeight);
    frameCtx.putImageData(frameImageData, 0, 0);

    ctx.drawImage(
      frameCanvas,
      0,
      0,
      logicalFrameWidth,
      logicalFrameHeight,
      frameIndex * frameWidth,
      0,
      frameWidth,
      frameHeight,
    );
  });

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function stitchFrames(
  frameSrcs: string[],
  frameW: number,
  frameH: number,
): Promise<{ canvas: HTMLCanvasElement; failed: number[] }> {
  const images = await Promise.all(
    frameSrcs.map(async (src) => {
      try {
        return await loadImage(src);
      } catch {
        return null;
      }
    }),
  );

  const canvas = document.createElement('canvas');
  canvas.width = frameW * frameSrcs.length;
  canvas.height = frameH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create sprite sheet canvas');
  ctx.imageSmoothingEnabled = false;

  const failed: number[] = [];
  images.forEach((img, index) => {
    const frameX = index * frameW;
    if (!img) {
      failed.push(index);
      ctx.fillStyle = 'hsl(220 15% 14%)';
      ctx.fillRect(frameX, 0, frameW, frameH);
      return;
    }
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, frameX, 0, frameW, frameH);
  });

  return { canvas, failed };
}
