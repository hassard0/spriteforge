export type GridSize = '32x32' | '64x64' | '128x128' | '256x256' | '512x512';

export type ViewingAngle =
  | 'front'
  | 'back'
  | 'left-side'
  | 'right-side'
  | 'three-quarter-front-left'
  | 'three-quarter-front-right'
  | 'three-quarter-back-left'
  | 'three-quarter-back-right'
  | 'top-down'
  | 'isometric';

export type SpritePose =
  | 'idle'
  | 'walking'
  | 'running'
  | 'jumping'
  | 'falling'
  | 'attacking-melee'
  | 'attacking-ranged'
  | 'magic-casting'
  | 'blocking'
  | 'crouching'
  | 'climbing'
  | 'swimming'
  | 'dying'
  | 'hurt'
  | 'celebrating'
  | 'sitting'
  | 'sleeping'
  | 'dashing'
  | 'flying'
  | 'charging';

export interface SpriteSheet {
  id: string;
  name: string;
  prompt: string;
  gridSize: GridSize;
  viewingAngle: ViewingAngle;
  pose: SpritePose;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  imageData: string; // data URL of the sprite sheet
  palette: string[];
  pixelData: number[][]; // frame pixel indices
  createdAt: string;
  collectionIds: string[];
  tags: string[];
  referenceImageUrl?: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  color: string;
}

export interface GenerationConfig {
  referenceImage: string; // base64 data URL
  gridSize: GridSize;
  viewingAngle: ViewingAngle;
  pose: SpritePose;
  frameCount: number;
}

export interface ExportConfig {
  format: 'png' | 'json' | 'unity' | 'godot';
  includeMetadata: boolean;
}

// Legacy compat
export type AnimationType = SpritePose;
export type SpriteStyle = 'pixel-art';
export type PaletteType = 'custom';
export type Resolution = GridSize;
export type FacingDirection = ViewingAngle;
