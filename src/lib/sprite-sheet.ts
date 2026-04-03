type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const ANALYSIS_MAX_SIDE = 256;
const BG_TOLERANCE = 48;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function averageColor(samples: number[][]) {
  const total = samples.reduce(
    (acc, [r, g, b, a]) => {
      acc[0] += r;
      acc[1] += g;
      acc[2] += b;
      acc[3] += a;
      return acc;
    },
    [0, 0, 0, 0]
  );

  return total.map((value) => value / samples.length) as [number, number, number, number];
}

function getCornerBackground(data: Uint8ClampedArray, width: number, height: number) {
  const offsets = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  const samples = offsets.map(([x, y]) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  });

  return averageColor(samples);
}

function isBackgroundPixel(
  data: Uint8ClampedArray,
  idx: number,
  background: [number, number, number, number],
  tolerance: number
) {
  const alpha = data[idx + 3];
  if (alpha < 12) return true;

  const distance =
    Math.abs(data[idx] - background[0]) +
    Math.abs(data[idx + 1] - background[1]) +
    Math.abs(data[idx + 2] - background[2]);

  return distance <= tolerance;
}

function expandBounds(bounds: Bounds, sourceWidth: number, sourceHeight: number): Bounds {
  const padX = Math.max(1, Math.round(bounds.width * 0.06));
  const padY = Math.max(1, Math.round(bounds.height * 0.06));

  const left = Math.max(0, bounds.left - padX);
  const top = Math.max(0, bounds.top - padY);
  const right = Math.min(sourceWidth - 1, bounds.right + padX);
  const bottom = Math.min(sourceHeight - 1, bounds.bottom + padY);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function detectSubjectBounds(image: HTMLImageElement): Bounds {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  const scale = Math.min(1, ANALYSIS_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const analysisWidth = Math.max(1, Math.round(sourceWidth * scale));
  const analysisHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      left: 0,
      top: 0,
      right: sourceWidth - 1,
      bottom: sourceHeight - 1,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, analysisWidth, analysisHeight);

  const { data } = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
  const background = getCornerBackground(data, analysisWidth, analysisHeight);

  let left = analysisWidth;
  let right = -1;
  let top = analysisHeight;
  let bottom = -1;

  for (let y = 0; y < analysisHeight; y++) {
    for (let x = 0; x < analysisWidth; x++) {
      const idx = (y * analysisWidth + x) * 4;
      if (isBackgroundPixel(data, idx, background, BG_TOLERANCE)) continue;

      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right === -1 || bottom === -1) {
    return {
      left: 0,
      top: 0,
      right: sourceWidth - 1,
      bottom: sourceHeight - 1,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const scaledBounds: Bounds = {
    left: Math.floor(left / scale),
    top: Math.floor(top / scale),
    right: Math.ceil(right / scale),
    bottom: Math.ceil(bottom / scale),
    width: Math.ceil((right - left + 1) / scale),
    height: Math.ceil((bottom - top + 1) / scale),
  };

  return expandBounds(scaledBounds, sourceWidth, sourceHeight);
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, frameW: number, frameH: number, label: string) {
  ctx.fillStyle = 'hsl(220 15% 14%)';
  ctx.fillRect(x, 0, frameW, frameH);
  ctx.strokeStyle = 'hsl(220 12% 24%)';
  ctx.strokeRect(x + 0.5, 0.5, frameW - 1, frameH - 1);
  ctx.fillStyle = 'hsl(215 16% 66%)';
  ctx.font = `${Math.max(8, frameW / 4)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + frameW / 2, frameH / 2);
}

function mergeBounds(boundsList: Bounds[]): Bounds {
  const left = Math.min(...boundsList.map((bounds) => bounds.left));
  const top = Math.min(...boundsList.map((bounds) => bounds.top));
  const right = Math.max(...boundsList.map((bounds) => bounds.right));
  const bottom = Math.max(...boundsList.map((bounds) => bounds.bottom));

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

export async function stitchFrames(frameSrcs: string[], frameW: number, frameH: number): Promise<string> {
  const images = await Promise.all(
    frameSrcs.map(async (src) => {
      try {
        const image = await loadImage(src);
        return { image, bounds: detectSubjectBounds(image) };
      } catch {
        return null;
      }
    })
  );

  const validFrames = images.filter((frame): frame is NonNullable<typeof frame> => Boolean(frame));
  const sharedBounds = validFrames.length ? mergeBounds(validFrames.map((frame) => frame.bounds)) : null;

  const cropWidth = sharedBounds?.width ?? frameW;
  const cropHeight = sharedBounds?.height ?? frameH;
  const padX = Math.max(1, Math.round(frameW * 0.1));
  const padTop = Math.max(1, Math.round(frameH * 0.06));
  const padBottom = Math.max(1, Math.round(frameH * 0.08));
  const availableWidth = Math.max(1, frameW - padX * 2);
  const availableHeight = Math.max(1, frameH - padTop - padBottom);
  const uniformScale = Math.min(availableWidth / cropWidth, availableHeight / cropHeight);
  const drawWidth = Math.max(1, Math.round(cropWidth * uniformScale));
  const drawHeight = Math.max(1, Math.round(cropHeight * uniformScale));
  const drawY = Math.round(frameH - padBottom - drawHeight);

  const canvas = document.createElement('canvas');
  canvas.width = frameW * frameSrcs.length;
  canvas.height = frameH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create sprite sheet canvas');

  ctx.imageSmoothingEnabled = false;

  images.forEach((frame, index) => {
    const frameX = index * frameW;

    if (!frame || !sharedBounds) {
      drawPlaceholder(ctx, frameX, frameW, frameH, `${index + 1}`);
      return;
    }

    const drawX = frameX + Math.round((frameW - drawWidth) / 2);

    ctx.drawImage(
      frame.image,
      sharedBounds.left,
      sharedBounds.top,
      sharedBounds.width,
      sharedBounds.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  });

  return canvas.toDataURL('image/png');
}