import type { ArtStyle } from './art-styles';

export interface QAResult {
  passed: boolean;
  score: number; // 0-10
  issues: QAIssue[];
}

export interface QAIssue {
  check: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
}

/**
 * Run objective QA checks on a generated image (client-side canvas analysis).
 */
export function runObjectiveQA(
  imageDataUrl: string,
  style: ArtStyle,
  expectedWidth: number,
  expectedHeight: number,
): Promise<QAResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const issues: QAIssue[] = [];

      // 1. Coverage check
      const coverage = computeCoverage(imageData);
      if (coverage < style.minCoverage) {
        issues.push({
          check: 'coverage',
          severity: 'error',
          message: `Character too small (${(coverage * 100).toFixed(0)}% coverage, min ${(style.minCoverage * 100).toFixed(0)}%)`,
          suggestion: 'Regenerating with prompt urging larger subject',
        });
      }
      if (coverage > style.maxCoverage) {
        issues.push({
          check: 'coverage',
          severity: 'warning',
          message: `Character fills too much of frame (${(coverage * 100).toFixed(0)}%)`,
          suggestion: 'Regenerating with more breathing room around character',
        });
      }

      // 2. Palette check
      if (style.maxColors > 0) {
        const uniqueColors = countUniqueColors(imageData);
        if (uniqueColors > style.maxColors * 2) {
          issues.push({
            check: 'palette',
            severity: 'error',
            message: `Too many colors (${uniqueColors}) for ${style.shortName} style (max ${style.maxColors})`,
            suggestion: `Regenerating with stricter ${style.maxColors}-color palette constraint`,
          });
        } else if (uniqueColors > style.maxColors) {
          issues.push({
            check: 'palette',
            severity: 'warning',
            message: `${uniqueColors} colors detected (target ≤${style.maxColors})`,
            suggestion: 'Post-processing will clamp palette',
          });
        }
      }

      // 3. Monochrome check (for silhouette style)
      if (style.monoThreshold) {
        const colorfulness = computeColorfulness(imageData);
        if (colorfulness > 30) {
          issues.push({
            check: 'monochrome',
            severity: 'warning',
            message: 'Output contains color when monochrome was expected',
            suggestion: 'Post-processing will threshold to B/W',
          });
        }
      }

      // 4. Sharpness check for pixel art
      if (style.pixelate) {
        const blurScore = computeBlurriness(imageData);
        if (blurScore > 0.6) {
          issues.push({
            check: 'sharpness',
            severity: 'warning',
            message: 'Output appears blurry for pixel art style',
            suggestion: 'Regenerating with explicit "no anti-aliasing, sharp pixels" instruction',
          });
        }
      }

      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      const score = Math.max(0, 10 - errorCount * 3 - warningCount * 1);

      resolve({
        passed: errorCount === 0,
        score,
        issues,
      });
    };
    img.onerror = () => resolve({ passed: false, score: 0, issues: [{ check: 'load', severity: 'error', message: 'Failed to load image', suggestion: 'Retry generation' }] });
    img.src = imageDataUrl;
  });
}

/** Fraction of non-transparent pixels (background has already been removed) */
function computeCoverage(imageData: ImageData): number {
  const d = imageData.data;
  let total = 0;
  let filled = 0;
  for (let i = 0; i < d.length; i += 4) {
    total++;
    if (d[i + 3] >= 128) filled++;
  }
  return total > 0 ? filled / total : 0;
}

/** Count unique opaque colors */
function countUniqueColors(imageData: ImageData): number {
  const d = imageData.data;
  const colors = new Set<string>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] >= 128) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  }
  return colors.size;
}

/** Simple measure of color saturation/variance */
function computeColorfulness(imageData: ImageData): number {
  const d = imageData.data;
  let totalDiff = 0;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const rg = Math.abs(d[i] - d[i + 1]);
    const rb = Math.abs(d[i] - d[i + 2]);
    const gb = Math.abs(d[i + 1] - d[i + 2]);
    totalDiff += rg + rb + gb;
    count++;
  }
  return count > 0 ? totalDiff / count : 0;
}

/** Estimate blurriness by computing Laplacian variance (simplified) */
function computeBlurriness(imageData: ImageData): number {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
  }

  // Laplacian
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + (x - 1)] +
        gray[y * w + (x + 1)] -
        4 * gray[y * w + x];
      sum += lap * lap;
      count++;
    }
  }

  const variance = count > 0 ? sum / count : 0;
  // Normalize: low variance = blurry. Scale so ~0.6+ is "blurry"
  // Typical sharp images have variance > 500, blurry < 100
  const normalized = Math.max(0, 1 - variance / 200);
  return normalized;
}
