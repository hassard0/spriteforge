export type AnimationType = 'idle' | 'walk' | 'run' | 'attack' | 'jump' | 'death';
export type SpriteStyle = 'pixel-art' | 'chibi' | 'cel-shaded';
export type PaletteType = 'nes' | 'snes' | 'gameboy' | 'custom';
export type Resolution = '16x16' | '32x32' | '48x48' | '64x64' | '128x128';
export type FacingDirection = 'left' | 'right' | 'up' | 'down';

export interface SpriteSheet {
  id: string;
  name: string;
  prompt: string;
  animationType: AnimationType;
  style: SpriteStyle;
  palette: PaletteType;
  resolution: Resolution;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  facingDirection: FacingDirection;
  imageData: string; // base64 or data URL of the sprite sheet
  createdAt: string;
  collectionIds: string[];
  tags: string[];
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  color: string;
}

export interface GenerationConfig {
  prompt: string;
  animationType: AnimationType;
  style: SpriteStyle;
  palette: PaletteType;
  resolution: Resolution;
  frameCount: number;
  facingDirection: FacingDirection;
}

export interface ExportConfig {
  format: 'png' | 'json' | 'unity' | 'godot';
  includeMetadata: boolean;
}
