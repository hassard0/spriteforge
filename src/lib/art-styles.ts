export interface ArtStyle {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Keywords injected into the generation prompt */
  promptKeywords: string;
  /** Negative prompt constraints */
  negativePrompt: string;
  /** Max colors allowed (0 = unlimited) */
  maxColors: number;
  /** Whether to apply pixelation post-processing */
  pixelate: boolean;
  /** Whether to apply palette clamping */
  clampPalette: boolean;
  /** Whether to threshold to B/W */
  monoThreshold: boolean;
  /** Whether to posterize (reduce gradients) */
  posterize: boolean;
  /** Min silhouette coverage (0-1) */
  minCoverage: number;
  /** Max silhouette coverage (0-1) */
  maxCoverage: number;
  /** Accent color for the UI card */
  accent: string;
  /** Emoji icon */
  icon: string;
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: 'pixel-8bit',
    name: 'Pixel Art — 8-bit Retro',
    shortName: '8-bit',
    description: 'Blocky NES-style graphics with a very limited palette (≤8 colors). Sharp pixels, no anti-aliasing.',
    promptKeywords: 'pixel art, NES 8-bit style, very limited color palette, blocky pixels, retro game sprite, no anti-aliasing, no gradients, sharp pixel edges',
    negativePrompt: 'smooth, gradient, realistic, photo, blurry, anti-aliased, high-resolution',
    maxColors: 8,
    pixelate: true,
    clampPalette: true,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.15,
    maxCoverage: 0.85,
    accent: '#e74c3c',
    icon: '👾',
  },
  {
    id: 'pixel-16bit',
    name: 'Pixel Art — 16/32-bit',
    shortName: '16-bit',
    description: 'Smoother pixel sprites with richer palettes, like SNES/Genesis era. More detail but still pixelated.',
    promptKeywords: 'pixel art, 16-bit SNES style, rich color palette, detailed pixel sprite, retro RPG style, clean pixel edges',
    negativePrompt: 'photo-realistic, blurry, anti-aliased edges, 3D render',
    maxColors: 32,
    pixelate: true,
    clampPalette: true,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.15,
    maxCoverage: 0.85,
    accent: '#3498db',
    icon: '🎮',
  },
  {
    id: 'hand-drawn-dark',
    name: 'Hand-Drawn — Dark/Gothic',
    shortName: 'Gothic',
    description: 'Sketchy, moody line art with dark tones. Reminiscent of Hollow Knight or Darkest Dungeon.',
    promptKeywords: 'hand-drawn gothic art style, dark moody sketch, ink illustration, bold dark outlines, atmospheric, muted dark color palette',
    negativePrompt: 'bright colors, cheerful, pixel art, 3D, photo-realistic',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.10,
    maxCoverage: 0.90,
    accent: '#8e44ad',
    icon: '🦇',
  },
  {
    id: 'hand-drawn-bright',
    name: 'Hand-Drawn — Bright/Whimsical',
    shortName: 'Whimsical',
    description: 'Colorful cartoon style with thick outlines and flat vibrant colors. Think Cuphead or Adventure Time.',
    promptKeywords: 'hand-drawn cartoon, bright vibrant colors, thick black outlines, flat colors, whimsical playful style, cel-shaded cartoon',
    negativePrompt: 'dark, moody, realistic, pixel art, 3D render',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.15,
    maxCoverage: 0.85,
    accent: '#f39c12',
    icon: '🎨',
  },
  {
    id: 'anime-cel',
    name: 'Anime / Cel-Shaded',
    shortName: 'Anime',
    description: 'Vivid anime look with cel shading, large expressive eyes, and smooth gradients. Studio Ghibli / Genshin Impact style.',
    promptKeywords: 'anime style character, cel-shaded, vivid vibrant colors, large expressive eyes, smooth shading with hard shadow edges, Japanese animation style',
    negativePrompt: 'pixel art, sketch, photo-realistic, western cartoon',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.15,
    maxCoverage: 0.90,
    accent: '#e91e63',
    icon: '✨',
  },
  {
    id: 'monochrome-silhouette',
    name: 'Monochrome Silhouette',
    shortName: 'Silhouette',
    description: 'Minimalistic black-and-white style. The character is a dark silhouette, like in Limbo.',
    promptKeywords: 'monochrome silhouette, black and white only, dark shadow figure, minimalistic, dramatic backlight, no color',
    negativePrompt: 'colorful, detailed texture, gradient, pixel art, anime',
    maxColors: 2,
    pixelate: false,
    clampPalette: false,
    monoThreshold: true,
    posterize: false,
    minCoverage: 0.10,
    maxCoverage: 0.80,
    accent: '#95a5a6',
    icon: '🌑',
  },
  {
    id: 'vector-flat',
    name: 'Vector / Flat Art',
    shortName: 'Vector',
    description: 'Clean geometric shapes, flat solid colors, no shading. Modern minimalist game art.',
    promptKeywords: 'vector art style, simple geometric shapes, flat solid colors, no shading, clean crisp edges, modern minimalist illustration',
    negativePrompt: 'pixel art, gradients, realistic, sketch, textured',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: true,
    minCoverage: 0.15,
    maxCoverage: 0.85,
    accent: '#1abc9c',
    icon: '📐',
  },
  {
    id: 'chibi-manga',
    name: 'Chibi / Manga',
    shortName: 'Chibi',
    description: 'Cute exaggerated anime chibi style — large head, big eyes, small body, minimal realism.',
    promptKeywords: 'chibi manga style, cute exaggerated proportions, very large head, big round eyes, small body, kawaii, pastel colors',
    negativePrompt: 'realistic proportions, dark, horror, pixel art, western cartoon',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.20,
    maxCoverage: 0.85,
    accent: '#ff69b4',
    icon: '🌸',
  },
  {
    id: 'sketch-ink',
    name: 'Sketch / Ink',
    shortName: 'Sketch',
    description: 'Loose pen-and-ink sketch style with crosshatching and visible strokes. Raw and expressive.',
    promptKeywords: 'pen and ink sketch, loose hand-drawn lines, crosshatching, visible brush strokes, raw expressive illustration, black ink on white',
    negativePrompt: 'clean digital, pixel art, smooth gradients, photo-realistic, colorful',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.10,
    maxCoverage: 0.85,
    accent: '#2c3e50',
    icon: '✏️',
  },
  {
    id: 'realistic-stylized',
    name: 'Realistic Stylized',
    shortName: 'Stylized 3D',
    description: 'Smooth 3D-like characters with exaggerated cartoon proportions. Pixar/Fall Guys aesthetic.',
    promptKeywords: 'stylized 3D character, smooth soft lighting, vibrant colors, exaggerated cartoon proportions, rounded shapes, Pixar-like quality',
    negativePrompt: 'pixel art, flat, sketch, anime, photographic, uncanny valley',
    maxColors: 0,
    pixelate: false,
    clampPalette: false,
    monoThreshold: false,
    posterize: false,
    minCoverage: 0.20,
    maxCoverage: 0.85,
    accent: '#e67e22',
    icon: '🧸',
  },
];

export function getStyleById(id: string): ArtStyle | undefined {
  return ART_STYLES.find(s => s.id === id);
}
