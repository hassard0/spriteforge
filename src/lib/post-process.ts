import type { ArtStyle } from './art-styles';

/**
 * Apply procedural post-processing to a generated image based on art style.
 * Returns a new data URL.
 */
export function postProcessImage(
  imageDataUrl: string,
  style: ArtStyle,
  targetWidth: number,
  targetHeight: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Step 1: Remove magenta background → transparent
        imageData = chromaKeyMagenta(imageData);

        // Step 2: Monochrome threshold (for silhouette style)
        if (style.monoThreshold) {
          imageData = applyMonoThreshold(imageData);
        }

        // Step 3: Posterize (for vector/flat style)
        if (style.posterize) {
          imageData = applyPosterize(imageData, 6);
        }

        // Step 4: Palette clamping (for pixel art styles)
        if (style.clampPalette && style.maxColors > 0) {
          imageData = clampPalette(imageData, style.maxColors);
        }

        ctx.putImageData(imageData, 0, 0);

        // Step 5: Pixelation (downscale + upscale with nearest neighbor)
        if (style.pixelate) {
          const result = pixelateCanvas(canvas, targetWidth, targetHeight);
          resolve(result.toDataURL('image/png'));
        } else {
          resolve(canvas.toDataURL('image/png'));
        }
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for post-processing'));
    img.src = imageDataUrl;
  });
}

/** Replace magenta (#FF00FF ± tolerance) with transparent */
function chromaKeyMagenta(imageData: ImageData): ImageData {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200) {
      d[i + 3] = 0; // set alpha to 0
    }
  }
  return imageData;
}

/** Threshold all pixels to black or white (preserving alpha) */
function applyMonoThreshold(imageData: ImageData): ImageData {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue; // skip transparent
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = luma > 128 ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  return imageData;
}

/** Reduce color levels per channel (posterize effect) */
function applyPosterize(imageData: ImageData, levels: number): ImageData {
  const d = imageData.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    d[i] = Math.round(Math.round(d[i] / step) * step);
    d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
    d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
  }
  return imageData;
}

/** Reduce the number of unique colors using median-cut-like approach */
function clampPalette(imageData: ImageData, maxColors: number): ImageData {
  const d = imageData.data;
  // Collect unique opaque colors
  const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { r: d[i], g: d[i + 1], b: d[i + 2], count: 1 });
    }
  }

  if (colorCounts.size <= maxColors) return imageData;

  // Keep the most frequent colors
  const sorted = [...colorCounts.values()].sort((a, b) => b.count - a.count);
  const palette = sorted.slice(0, maxColors);

  // Map every pixel to nearest palette color
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    let bestDist = Infinity;
    let bestColor = palette[0];
    for (const c of palette) {
      const dr = d[i] - c.r;
      const dg = d[i + 1] - c.g;
      const db = d[i + 2] - c.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestColor = c;
      }
    }
    d[i] = bestColor.r;
    d[i + 1] = bestColor.g;
    d[i + 2] = bestColor.b;
  }

  return imageData;
}

/** Downscale to target size then upscale back — pixel art effect */
function pixelateCanvas(source: HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement {
  // Downscale
  const small = document.createElement('canvas');
  small.width = targetW;
  small.height = targetH;
  const sCtx = small.getContext('2d')!;
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(source, 0, 0, targetW, targetH);

  // Upscale back to original size
  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const oCtx = output.getContext('2d')!;
  oCtx.imageSmoothingEnabled = false;
  oCtx.drawImage(small, 0, 0, output.width, output.height);

  return output;
}
