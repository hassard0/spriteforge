import { SpriteSheet, Collection } from '@/types/sprite';

// Generate pixel art sprite sheet as a canvas data URL
function generateMockSpriteSheet(
  frameCount: number,
  frameW: number,
  frameH: number,
  hue: number,
  pattern: 'humanoid' | 'slime' | 'bird' | 'skeleton' | 'crystal'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = frameW * frameCount;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d')!;

  for (let f = 0; f < frameCount; f++) {
    const ox = f * frameW;
    const phase = f / frameCount;

    ctx.fillStyle = `hsl(${hue}, 10%, 12%)`;
    ctx.fillRect(ox, 0, frameW, frameH);

    const px = Math.floor(frameW / 8); // pixel size

    if (pattern === 'humanoid') {
      const bounce = Math.sin(phase * Math.PI * 2) * px;
      // Body
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      for (let y = 2; y < 5; y++) {
        for (let x = 3; x < 5; x++) {
          ctx.fillRect(ox + x * px, (y * px) + bounce, px, px);
        }
      }
      // Head
      ctx.fillStyle = `hsl(${hue}, 60%, 65%)`;
      ctx.fillRect(ox + 3 * px, (1 * px) + bounce, 2 * px, px);
      // Legs - animate
      ctx.fillStyle = `hsl(${hue}, 50%, 40%)`;
      const legOffset = Math.sin(phase * Math.PI * 2) * px * 0.5;
      ctx.fillRect(ox + 3 * px, (5 * px) + legOffset, px, px);
      ctx.fillRect(ox + 4 * px, (5 * px) - legOffset, px, px);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(ox + 3 * px + 1, (1 * px) + bounce + 1, 2, 2);
      ctx.fillRect(ox + 4 * px + 1, (1 * px) + bounce + 1, 2, 2);
    } else if (pattern === 'slime') {
      const squish = Math.sin(phase * Math.PI * 2) * px * 0.3;
      ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
      for (let y = 3; y < 6; y++) {
        for (let x = 2; x < 6; x++) {
          ctx.fillRect(ox + x * px, y * px + squish, px, px);
        }
      }
      ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
      ctx.fillRect(ox + 3 * px, (2 * px) + squish, 2 * px, px);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(ox + 3 * px, (3 * px) + squish + 2, 3, 3);
      ctx.fillRect(ox + 4 * px + 2, (3 * px) + squish + 2, 3, 3);
    } else if (pattern === 'bird') {
      const fly = Math.sin(phase * Math.PI * 2) * px;
      ctx.fillStyle = `hsl(${hue}, 65%, 55%)`;
      ctx.fillRect(ox + 3 * px, (3 * px) + fly, 2 * px, px);
      // Wings
      const wingUp = Math.sin(phase * Math.PI * 2) > 0;
      ctx.fillStyle = `hsl(${hue}, 55%, 45%)`;
      ctx.fillRect(ox + 2 * px, (wingUp ? 2 : 3) * px + fly, px, px);
      ctx.fillRect(ox + 5 * px, (wingUp ? 2 : 3) * px + fly, px, px);
      // Beak
      ctx.fillStyle = `hsl(40, 90%, 60%)`;
      ctx.fillRect(ox + 5 * px, (3 * px) + fly + 1, px / 2, px / 2);
      // Eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(ox + 4 * px + 2, (3 * px) + fly, 2, 2);
    } else if (pattern === 'skeleton') {
      const sway = Math.sin(phase * Math.PI * 2) * 1;
      ctx.fillStyle = `hsl(0, 0%, 85%)`;
      // Skull
      ctx.fillRect(ox + 3 * px + sway, 1 * px, 2 * px, px);
      // Spine
      for (let y = 2; y < 5; y++) {
        ctx.fillRect(ox + 3.5 * px + sway, y * px, px, px);
      }
      // Ribs
      ctx.fillStyle = `hsl(0, 0%, 70%)`;
      ctx.fillRect(ox + 2.5 * px + sway, 2 * px, 3 * px, px / 2);
      ctx.fillRect(ox + 2.5 * px + sway, 3 * px, 3 * px, px / 2);
      // Eye sockets
      ctx.fillStyle = `hsl(0, 70%, 40%)`;
      ctx.fillRect(ox + 3 * px + sway + 1, 1 * px + 1, 2, 2);
      ctx.fillRect(ox + 4 * px + sway + 1, 1 * px + 1, 2, 2);
    } else {
      // Crystal
      const glow = 50 + Math.sin(phase * Math.PI * 2) * 15;
      ctx.fillStyle = `hsl(${hue}, 80%, ${glow}%)`;
      ctx.fillRect(ox + 3.5 * px, 1 * px, px, px);
      ctx.fillRect(ox + 3 * px, 2 * px, 2 * px, px);
      ctx.fillRect(ox + 2.5 * px, 3 * px, 3 * px, px);
      ctx.fillRect(ox + 3 * px, 4 * px, 2 * px, px);
      ctx.fillStyle = `hsl(${hue}, 90%, ${glow + 20}%)`;
      ctx.fillRect(ox + 3.5 * px, 2 * px + 1, px / 2, px / 2);
    }
  }

  return canvas.toDataURL('image/png');
}

let mockSpritesCache: SpriteSheet[] | null = null;
let mockCollectionsCache: Collection[] | null = null;

export function getMockCollections(): Collection[] {
  if (mockCollectionsCache) return mockCollectionsCache;
  mockCollectionsCache = [
    { id: 'col-1', name: 'Player Characters', description: 'Main player sprites', createdAt: '2026-03-28T10:00:00Z', color: 'hsl(152, 100%, 50%)' },
    { id: 'col-2', name: 'Enemies', description: 'Enemy NPC sprites', createdAt: '2026-03-29T10:00:00Z', color: 'hsl(0, 72%, 51%)' },
    { id: 'col-3', name: 'Environment', description: 'Environmental objects and effects', createdAt: '2026-03-30T10:00:00Z', color: 'hsl(185, 80%, 55%)' },
  ];
  return mockCollectionsCache;
}

export function getMockSprites(): SpriteSheet[] {
  if (mockSpritesCache) return mockSpritesCache;

  const specs = [
    { name: 'Knight Idle', prompt: 'medieval knight character idle animation', anim: 'idle' as const, style: 'pixel-art' as const, palette: 'nes' as const, res: '32x32' as const, frames: 6, hue: 210, pattern: 'humanoid' as const, collections: ['col-1'], tags: ['knight', 'player', 'medieval'] },
    { name: 'Green Slime Walk', prompt: 'green slime enemy walking animation', anim: 'walk' as const, style: 'pixel-art' as const, palette: 'snes' as const, res: '32x32' as const, frames: 8, hue: 120, pattern: 'slime' as const, collections: ['col-2'], tags: ['slime', 'enemy', 'green'] },
    { name: 'Fire Bird Attack', prompt: 'fire bird attack animation pixel art', anim: 'attack' as const, style: 'pixel-art' as const, palette: 'nes' as const, res: '48x48' as const, frames: 6, hue: 15, pattern: 'bird' as const, collections: ['col-2'], tags: ['bird', 'fire', 'flying'] },
    { name: 'Skeleton Run', prompt: 'skeleton enemy running animation', anim: 'run' as const, style: 'chibi' as const, palette: 'gameboy' as const, res: '32x32' as const, frames: 8, hue: 0, pattern: 'skeleton' as const, collections: ['col-2'], tags: ['skeleton', 'undead'] },
    { name: 'Magic Crystal Idle', prompt: 'glowing magic crystal pulsing animation', anim: 'idle' as const, style: 'cel-shaded' as const, palette: 'custom' as const, res: '64x64' as const, frames: 4, hue: 270, pattern: 'crystal' as const, collections: ['col-3'], tags: ['crystal', 'magic', 'environment'] },
  ];

  mockSpritesCache = specs.map((s, i) => {
    const fw = parseInt(s.res);
    return {
      id: `mock-${i + 1}`,
      name: s.name,
      prompt: s.prompt,
      gridSize: s.res as any,
      viewingAngle: 'front' as const,
      pose: s.anim as any,
      frameCount: s.frames,
      frameWidth: fw,
      frameHeight: fw,
      imageData: generateMockSpriteSheet(s.frames, fw, fw, s.hue, s.pattern),
      palette: [],
      pixelData: [],
      createdAt: new Date(2026, 2, 25 + i, 10, 0, 0).toISOString(),
      collectionIds: s.collections,
      tags: s.tags,
    };
  });

  return mockSpritesCache;
}
