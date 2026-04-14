import type { ArtStyle } from './art-styles';
import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

/**
 * Apply procedural post-processing to a generated image based on art style.
 * Returns a new data URL.
 */
export async function postProcessImage(
  imageDataUrl: string,
  style: ArtStyle,
  targetWidth: number,
  targetHeight: number,
  targetPalette?: string[],
): Promise<string> {
  const img = await loadImage(imageDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Step 1: Background removal (ML model or patched chroma-key fallback)
  try {
    imageData = await removeBackground(imageData);
  } catch (err) {
    console.warn('ML background removal failed, falling back to chroma-key flood-fill', err);
    imageData = chromaKeyFloodFill(imageData);
  }

  if (style.monoThreshold) {
    imageData = applyMonoThreshold(imageData);
  }
  if (style.posterize) {
    imageData = applyPosterize(imageData, 6);
  }
  if (style.clampPalette && style.maxColors > 0) {
    imageData = clampPalette(imageData, style.maxColors, targetPalette);
  } else if (targetPalette && targetPalette.length > 0) {
    imageData = clampPalette(imageData, targetPalette.length, targetPalette);
  }

  ctx.putImageData(imageData, 0, 0);

  if (style.pixelate) {
    const result = pixelateCanvas(canvas, targetWidth, targetHeight);
    return result.toDataURL('image/png');
  }
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for post-processing'));
    img.src = src;
  });
}

/**
 * ML-based background removal using @imgly/background-removal. Converts the
 * ImageData to a Blob, passes it through the model, and converts the result
 * back to ImageData via a canvas. The first call lazy-downloads a ~4 MB ONNX
 * model.
 */
export async function removeBackground(imageData: ImageData): Promise<ImageData> {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imageData.width;
  srcCanvas.height = imageData.height;
  const sctx = srcCanvas.getContext('2d')!;
  sctx.putImageData(imageData, 0, 0);

  const srcBlob: Blob = await new Promise((resolve, reject) => {
    srcCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode source blob'))),
      'image/png',
    );
  });

  const resultBlob = await imglyRemoveBackground(srcBlob);

  const bmp = await createImageBitmap(resultBlob);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = bmp.width;
  outCanvas.height = bmp.height;
  const octx = outCanvas.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(bmp, 0, 0);
  return octx.getImageData(0, 0, outCanvas.width, outCanvas.height);
}

/**
 * @deprecated Use `removeBackground` for ML-based segmentation. This wrapper
 * remains for backwards compatibility with existing call sites and now
 * forwards to the ML model (falling back to the flood-fill chroma-key on
 * error).
 */
export async function chromaKeyMagenta(imageData: ImageData): Promise<ImageData> {
  try {
    return await removeBackground(imageData);
  } catch {
    return chromaKeyFloodFill(imageData);
  }
}

/**
 * Tightened chroma-key fallback. Floods from all four image edges keying any
 * near-magenta OR near-white pixel reachable from the background, so that
 * interior magenta/white pixels (part of the sprite) are preserved.
 */
export function chromaKeyFloodFill(imageData: ImageData): ImageData {
  const { width: w, height: h, data: d } = imageData;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const isBg = (idx: number) => {
    const o = idx * 4;
    const r = d[o], g = d[o + 1], b = d[o + 2];
    // Near-magenta (tightened threshold) or near-white
    if (r > 240 && g < 20 && b > 240) return true;
    if (r > 240 && g > 240 && b > 240) return true;
    return false;
  };

  // Seed from all four edges
  for (let x = 0; x < w; x++) {
    stack.push(x);
    stack.push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w);
    stack.push(y * w + (w - 1));
  }

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (!isBg(idx)) continue;
    // Alpha to 0
    d[idx * 4 + 3] = 0;
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) stack.push(idx - 1);
    if (x < w - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - w);
    if (y < h - 1) stack.push(idx + w);
  }
  return imageData;
}

/** Threshold all pixels to black or white (preserving alpha) */
function applyMonoThreshold(imageData: ImageData): ImageData {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = luma > 128 ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  return imageData;
}

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

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Reduce colours. If `targetPalette` is provided, every opaque pixel is snapped
 * to the nearest colour in that palette (Euclidean RGB). Otherwise falls back
 * to the original "keep most-frequent K colours" auto-extraction behaviour.
 */
export function clampPalette(
  imageData: ImageData,
  maxColors: number,
  targetPalette?: string[],
): ImageData {
  const d = imageData.data;

  if (targetPalette && targetPalette.length > 0) {
    const rgbPalette: [number, number, number][] = [];
    for (const hex of targetPalette) {
      const rgb = hexToRgb(hex);
      if (rgb) rgbPalette.push(rgb);
    }
    if (rgbPalette.length === 0) return imageData;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      let bestDist = Infinity;
      let bestR = rgbPalette[0][0], bestG = rgbPalette[0][1], bestB = rgbPalette[0][2];
      for (const [r, g, b] of rgbPalette) {
        const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestR = r; bestG = g; bestB = b;
        }
      }
      d[i] = bestR; d[i + 1] = bestG; d[i + 2] = bestB;
    }
    return imageData;
  }

  // Auto-extracted top-K colours
  const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    const existing = colorCounts.get(key);
    if (existing) existing.count++;
    else colorCounts.set(key, { r: d[i], g: d[i + 1], b: d[i + 2], count: 1 });
  }
  if (colorCounts.size <= maxColors) return imageData;
  const sorted = [...colorCounts.values()].sort((a, b) => b.count - a.count);
  const palette = sorted.slice(0, maxColors);

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    let bestDist = Infinity;
    let bestColor = palette[0];
    for (const c of palette) {
      const dr = d[i] - c.r, dg = d[i + 1] - c.g, db = d[i + 2] - c.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) { bestDist = dist; bestColor = c; }
    }
    d[i] = bestColor.r; d[i + 1] = bestColor.g; d[i + 2] = bestColor.b;
  }
  return imageData;
}

function pixelateCanvas(source: HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = targetW;
  small.height = targetH;
  const sCtx = small.getContext('2d')!;
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(source, 0, 0, targetW, targetH);

  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const oCtx = output.getContext('2d')!;
  oCtx.imageSmoothingEnabled = false;
  oCtx.drawImage(small, 0, 0, output.width, output.height);
  return output;
}
