export interface Palette {
  id: string;
  name: string;
  colors: string[];
  description: string;
}

// Canonical NES palette (54 visible colours, commonly ordered after the
// FCEUX/Nesticle default tables). Duplicates and blacks beyond the first
// have been collapsed into the canonical 54.
const NES_COLORS = [
  '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400',
  '#503000', '#007800', '#006800', '#005800', '#004058', '#000000', '#BCBCBC', '#0078F8',
  '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10', '#AC7C00', '#00B800',
  '#00A800', '#00A844', '#008888', '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8',
  '#F85898', '#F87858', '#FCA044', '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8',
  '#787878', '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0',
  '#FCE0A8', '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#F8D8F8',
];

// Representative 32-colour SNES subset (inspired by Yoshi's Island / SMW)
const SNES_COLORS = [
  '#000000', '#1A1A1A', '#3B3B3B', '#5C5C5C', '#8A8A8A', '#BDBDBD', '#E0E0E0', '#FFFFFF',
  '#7A1F1F', '#C62828', '#F44336', '#FF7043', '#FFB74D', '#FFD54F', '#FFE082', '#FFF59D',
  '#1B5E20', '#2E7D32', '#66BB6A', '#A5D6A7', '#004D40', '#00897B', '#26C6DA', '#80DEEA',
  '#0D47A1', '#1976D2', '#42A5F5', '#90CAF9', '#4A148C', '#7B1FA2', '#BA68C8', '#F8BBD0',
];

// Game Boy DMG 4 colours
const GB_COLORS = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];

// Official PICO-8 16 palette
const PICO8_COLORS = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
];

// Representative Master System 32-colour subset (of the 64-colour palette)
const SMS_COLORS = [
  '#000000', '#555555', '#AAAAAA', '#FFFFFF',
  '#550000', '#AA0000', '#FF0000', '#FF5555',
  '#005500', '#00AA00', '#00FF00', '#55FF55',
  '#000055', '#0000AA', '#0000FF', '#5555FF',
  '#555500', '#AAAA00', '#FFFF00', '#FFFF55',
  '#550055', '#AA00AA', '#FF00FF', '#FF55FF',
  '#005555', '#00AAAA', '#00FFFF', '#55FFFF',
  '#AA5500', '#FFAA00', '#AA5555', '#FFAA55',
];

export const PRESET_PALETTES: Palette[] = [
  {
    id: 'none',
    name: 'Auto',
    colors: [],
    description: 'Let the model pick colours (no palette constraint).',
  },
  {
    id: 'nes',
    name: 'NES',
    colors: NES_COLORS,
    description: 'Canonical 54-colour NES palette.',
  },
  {
    id: 'snes',
    name: 'SNES',
    colors: SNES_COLORS,
    description: 'Curated 32-colour SNES subset.',
  },
  {
    id: 'gameboy',
    name: 'Game Boy',
    colors: GB_COLORS,
    description: 'The 4 canonical DMG greens.',
  },
  {
    id: 'pico8',
    name: 'PICO-8',
    colors: PICO8_COLORS,
    description: 'Official PICO-8 16-colour palette.',
  },
  {
    id: 'sms',
    name: 'Master System',
    colors: SMS_COLORS,
    description: 'Representative 32-colour Master System subset.',
  },
  {
    id: 'custom',
    name: 'Custom',
    colors: [],
    description: 'Build your own colour list below.',
  },
];

export function getPaletteById(id: string): Palette | undefined {
  return PRESET_PALETTES.find((p) => p.id === id);
}
