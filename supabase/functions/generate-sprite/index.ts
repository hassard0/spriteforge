import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_GENERATED_FRAMES = 6;
const MAX_PALETTE_COLORS = 8;

type Archetype = "humanoid" | "canine" | "slime" | "bird" | "robot" | "skeleton";
type Accessory = "none" | "sword" | "shield" | "staff";
type Expression = "neutral" | "cute" | "happy" | "angry";
type Feature = "ears" | "tail" | "cape" | "helmet" | "hat" | "horns" | "spots" | "wings" | "antenna";
type FacingDirection = "left" | "right" | "up" | "down";
type AnimationType = "idle" | "walk" | "run" | "attack" | "jump" | "death";
type PaletteType = "nes" | "snes" | "gameboy" | "custom";
type SpriteStyle = "pixel-art" | "chibi" | "cel-shaded";
type BodyType = "slim" | "average" | "stocky";
type GenderPresentation = "neutral" | "feminine" | "masculine";
type HairStyle = "none" | "short" | "long" | "spiky";
type OutfitStyle = "tunic" | "robe" | "armor" | "dress";

type SpriteRecipe = {
  archetype: Archetype;
  palette: string[];
  features: Feature[];
  accessory: Accessory;
  expression: Expression;
  bodyType: BodyType;
  genderPresentation: GenderPresentation;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
  summary: string;
};

type MotionState = {
  bob: number;
  airborneLift: number;
  torsoTilt: number;
  armSwingA: number;
  armSwingB: number;
  legSwingA: number;
  legSwingB: number;
  headOffset: number;
  tailSwing: number;
  wingSwing: number;
  squash: number;
  stretch: number;
  collapse: number;
};

function normalizeFrameCount(frameCount: number): 4 | 6 {
  return frameCount <= 4 ? 4 : 6;
}

function getLogicalSize(requestedSize: number): number {
  if (requestedSize <= 16) return 16;
  if (requestedSize <= 32) return 32;
  if (requestedSize <= 48) return 48;
  if (requestedSize <= 64) return 64;
  return Math.min(requestedSize, 128);
}

function dedupePalette(colors: string[]) {
  return Array.from(new Set(colors)).slice(0, MAX_PALETTE_COLORS);
}

function defaultPaletteSeed(palette: PaletteType): string[] {
  if (palette === "gameboy") {
    return ["#00000000", "#0F380F", "#306230", "#8BAC0F", "#9BBC0F", "#E0F8CF", "#1A1A1A", "#FFFFFF"];
  }
  if (palette === "nes") {
    return ["#00000000", "#0F0F1B", "#3F3F74", "#6B6B6B", "#A7A7A7", "#D9A066", "#7D3B3B", "#F4F4F4"];
  }
  if (palette === "snes") {
    return ["#00000000", "#1B1C2E", "#4D2B32", "#A85D5D", "#E09F6B", "#7DB37D", "#5B6EE1", "#F7F4EA"];
  }
  return ["#00000000", "#1F2430", "#5C6773", "#C47C4D", "#E7B97A", "#6BA368", "#D95763", "#F5F7FA"];
}

function detectArchetype(prompt: string): Archetype {
  const input = prompt.toLowerCase();
  if (/(dog|wolf|fox|corgi|cat|lion|tiger|bear|canine|feline)/.test(input)) return "canine";
  if (/(bird|crow|eagle|owl|chicken|duck|penguin)/.test(input)) return "bird";
  if (/(slime|blob|goo|gel|jelly)/.test(input)) return "slime";
  if (/(robot|mech|android|cyborg|machine)/.test(input)) return "robot";
  if (/(skeleton|undead|bones)/.test(input)) return "skeleton";
  return "humanoid";
}

function detectFeatures(prompt: string, archetype: Archetype): Feature[] {
  const input = prompt.toLowerCase();
  const features = new Set<Feature>();

  if (/(tail|corgi|fox|wolf|cat|lion|tiger|bird)/.test(input) || archetype === "canine") features.add("tail");
  if (/(ear|corgi|cat|fox|wolf|rabbit|bunny)/.test(input) || archetype === "canine") features.add("ears");
  if (/(cape|cloak)/.test(input)) features.add("cape");
  if (/(helmet|armor|armour)/.test(input)) features.add("helmet");
  if (/(hat|wizard|witch)/.test(input)) features.add("hat");
  if (/(horn|demon|devil)/.test(input)) features.add("horns");
  if (/(spot|spotted|patch)/.test(input)) features.add("spots");
  if (/(wing|angel|bat)/.test(input) || archetype === "bird") features.add("wings");
  if (/(antenna|alien)/.test(input) || archetype === "robot") features.add("antenna");

  return Array.from(features);
}

function detectAccessory(prompt: string): Accessory {
  const input = prompt.toLowerCase();
  if (/(sword|blade|katana)/.test(input)) return "sword";
  if (/(shield|buckler)/.test(input)) return "shield";
  if (/(staff|wand|spear)/.test(input)) return "staff";
  return "none";
}

function detectExpression(prompt: string): Expression {
  const input = prompt.toLowerCase();
  if (/(cute|adorable|smile|happy|joy)/.test(input)) return "happy";
  if (/(angry|rage|mad|fierce)/.test(input)) return "angry";
  if (/(chibi|baby)/.test(input)) return "cute";
  return "neutral";
}

function detectBodyType(prompt: string): BodyType {
  const input = prompt.toLowerCase();
  if (/(fat|heavy|plus size|plus-size|stocky|chubby|wide|broad)/.test(input)) return "stocky";
  if (/(slim|thin|lean|skinny|lanky)/.test(input)) return "slim";
  return "average";
}

function detectGenderPresentation(prompt: string): GenderPresentation {
  const input = prompt.toLowerCase();
  if (/(woman|girl|female|lady|queen|princess|witch|sorceress)/.test(input)) return "feminine";
  if (/(man|boy|male|king|prince|wizard|barbarian|gentleman|bearded)/.test(input)) return "masculine";
  return "neutral";
}

function detectHairStyle(prompt: string, genderPresentation: GenderPresentation): HairStyle {
  const input = prompt.toLowerCase();
  if (/(bald|shaved head)/.test(input)) return "none";
  if (/(mohawk|spiky hair|spiked hair)/.test(input)) return "spiky";
  if (/(long hair|braid|ponytail|pigtail|flowing hair)/.test(input)) return "long";
  if (genderPresentation === "feminine") return "long";
  return "short";
}

function detectOutfitStyle(prompt: string): OutfitStyle {
  const input = prompt.toLowerCase();
  if (/(armor|armour|knight|paladin|soldier)/.test(input)) return "armor";
  if (/(robe|wizard|witch|mage|priest)/.test(input)) return "robe";
  if (/(dress|gown|skirt|princess|queen)/.test(input)) return "dress";
  return "tunic";
}

function detectOutfitColors(prompt: string): { primary: string; shadow: string } | null {
  const input = prompt.toLowerCase();
  if (/(blue|azure|navy|ice|water|frost)/.test(input)) return { primary: "#4F7DFF", shadow: "#2F4FA8" };
  if (/(green|nature|forest|poison)/.test(input)) return { primary: "#3FAE5A", shadow: "#2F7A43" };
  if (/(red|fire|lava|flame)/.test(input)) return { primary: "#D95763", shadow: "#8C3740" };
  if (/(gold|yellow|sun)/.test(input)) return { primary: "#D6A63C", shadow: "#8C6A23" };
  if (/(purple|magic|arcane)/.test(input)) return { primary: "#8A63D2", shadow: "#5A3D90" };
  if (/(pink|rose)/.test(input)) return { primary: "#D97AA8", shadow: "#8C4D6C" };
  if (/(black|dark)/.test(input)) return { primary: "#4B5563", shadow: "#1F2937" };
  if (/(white|ivory)/.test(input)) return { primary: "#D6DBE4", shadow: "#9AA3B2" };
  if (/(brown|leather|wood)/.test(input)) return { primary: "#8B5E3C", shadow: "#5D3C24" };
  if (/(silver|steel|metal)/.test(input)) return { primary: "#AEB7C4", shadow: "#707A8A" };
  if (/(orange|amber)/.test(input)) return { primary: "#D97A34", shadow: "#8C4C1E" };
  return null;
}

function detectSkinTone(prompt: string): string {
  const input = prompt.toLowerCase();
  if (/(dark skin|brown skin|black skin|deep skin)/.test(input)) return "#8D5A3A";
  if (/(olive skin|tan skin|tan)/.test(input)) return "#C68642";
  if (/(pale skin|fair skin|pale|fair)/.test(input)) return "#F1C27D";
  return "#D9A066";
}

function detectHairColor(prompt: string): string {
  const input = prompt.toLowerCase();
  if (/(blonde|blond|golden hair|yellow hair)/.test(input)) return "#D7B25C";
  if (/(black hair|dark hair|brunette)/.test(input)) return "#3A2C25";
  if (/(brown hair|auburn)/.test(input)) return "#7A4B2E";
  if (/(red hair|ginger)/.test(input)) return "#B85438";
  if (/(white hair|gray hair|grey hair|silver hair)/.test(input)) return "#D7DAE0";
  if (/(pink hair)/.test(input)) return "#D97AA8";
  if (/(blue hair)/.test(input)) return "#6F8BFF";
  return "#6B4B3A";
}

function promptTint(prompt: string): string[] {
  const colors = detectOutfitColors(prompt);
  return colors ? [colors.primary, colors.shadow] : [];
}

function buildHumanoidPalette(prompt: string, paletteType: PaletteType): string[] {
  if (paletteType === "gameboy") return defaultPaletteSeed(paletteType);

  const base = defaultPaletteSeed(paletteType);
  const outfitColors = detectOutfitColors(prompt);
  const bodyColor = outfitColors?.primary ?? base[2];
  const bodyShadow = outfitColors?.shadow ?? base[3];
  const skinTone = detectSkinTone(prompt);
  const hairColor = detectHairColor(prompt);

  return dedupePalette(["#00000000", base[1], bodyColor, bodyShadow, skinTone, hairColor, base[6], base[7]]);
}

function buildRecipe(prompt: string, paletteType: PaletteType): SpriteRecipe {
  const archetype = detectArchetype(prompt);
  const genderPresentation = detectGenderPresentation(prompt);
  const palette = archetype === "humanoid"
    ? buildHumanoidPalette(prompt, paletteType)
    : dedupePalette(["#00000000", ...promptTint(prompt), ...defaultPaletteSeed(paletteType)]);

  return {
    archetype,
    palette,
    features: detectFeatures(prompt, archetype),
    accessory: detectAccessory(prompt),
    expression: detectExpression(prompt),
    bodyType: detectBodyType(prompt),
    genderPresentation,
    hairStyle: detectHairStyle(prompt, genderPresentation),
    outfitStyle: detectOutfitStyle(prompt),
    summary: prompt.trim().slice(0, 200),
  };
}

function createFrame(size: number): number[] {
  return Array(size * size).fill(0);
}

function setPixel(frame: number[], size: number, x: number, y: number, color: number) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  frame[y * size + x] = color;
}

function fillRect(frame: number[], size: number, x: number, y: number, w: number, h: number, color: number) {
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) setPixel(frame, size, x + ix, y + iy, color);
  }
}

function fillEllipse(frame: number[], size: number, cx: number, cy: number, rx: number, ry: number, color: number) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const nx = x / Math.max(1, rx);
      const ny = y / Math.max(1, ry);
      if ((nx * nx) + (ny * ny) <= 1.05) setPixel(frame, size, cx + x, cy + y, color);
    }
  }
}

function drawLine(frame: number[], size: number, x0: number, y0: number, x1: number, y1: number, color: number, thickness = 1) {
  let startX = Math.round(x0);
  let startY = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - startX);
  const sx = startX < endX ? 1 : -1;
  const dy = -Math.abs(endY - startY);
  const sy = startY < endY ? 1 : -1;
  let err = dx + dy;

  while (true) {
    for (let tx = -Math.floor(thickness / 2); tx <= Math.floor(thickness / 2); tx++) {
      for (let ty = -Math.floor(thickness / 2); ty <= Math.floor(thickness / 2); ty++) {
        setPixel(frame, size, startX + tx, startY + ty, color);
      }
    }
    if (startX === endX && startY === endY) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      startX += sx;
    }
    if (e2 <= dx) {
      err += dx;
      startY += sy;
    }
  }
}

function fillTriangle(frame: number[], size: number, a: [number, number], b: [number, number], c: [number, number], color: number) {
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const area = (p1: [number, number], p2: [number, number], p3: [number, number]) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p: [number, number] = [x, y];
      const w1 = area(p, b, c);
      const w2 = area(a, p, c);
      const w3 = area(a, b, p);
      const hasNeg = w1 < 0 || w2 < 0 || w3 < 0;
      const hasPos = w1 > 0 || w2 > 0 || w3 > 0;
      if (!(hasNeg && hasPos)) setPixel(frame, size, x, y, color);
    }
  }
}

function mirrorX(x: number, center: number, facing: FacingDirection) {
  return facing === "left" ? center - (x - center) : x;
}

function paletteRoles(palette: string[]) {
  return {
    outline: Math.min(1, palette.length - 1),
    primary: Math.min(2, palette.length - 1),
    shadow: Math.min(3, palette.length - 1),
    secondary: Math.min(4, palette.length - 1),
    accent: Math.min(5, palette.length - 1),
    eye: Math.min(6, palette.length - 1),
    highlight: Math.min(7, palette.length - 1),
  };
}

function getMotionState(animationType: AnimationType, frameIndex: number, frameCount: number, s: number): MotionState {
  const phase = (frameIndex / frameCount) * Math.PI * 2;
  const wave = Math.sin(phase);
  const wave2 = Math.sin(phase + Math.PI);

  if (animationType === "idle") {
    return { bob: Math.round(wave * 0.5 * s), airborneLift: 0, torsoTilt: 0, armSwingA: 0, armSwingB: 0, legSwingA: 0, legSwingB: 0, headOffset: Math.round(wave * 0.5 * s), tailSwing: Math.round(wave * 1.5 * s), wingSwing: Math.round(wave * 1.5 * s), squash: 0, stretch: 0, collapse: 0 };
  }
  if (animationType === "walk") {
    return { bob: Math.round(Math.abs(wave) * 1 * s), airborneLift: 0, torsoTilt: 0, armSwingA: Math.round(wave * 2 * s), armSwingB: Math.round(wave2 * 2 * s), legSwingA: Math.round(wave * 2 * s), legSwingB: Math.round(wave2 * 2 * s), headOffset: 0, tailSwing: Math.round(wave * 2 * s), wingSwing: Math.round(wave * 2 * s), squash: 0, stretch: 0, collapse: 0 };
  }
  if (animationType === "run") {
    return { bob: Math.round(Math.abs(wave) * 2 * s), airborneLift: wave > 0.2 ? Math.round(2 * s) : 0, torsoTilt: Math.round(1 * s), armSwingA: Math.round(wave * 3 * s), armSwingB: Math.round(wave2 * 3 * s), legSwingA: Math.round(wave * 3 * s), legSwingB: Math.round(wave2 * 3 * s), headOffset: 0, tailSwing: Math.round(wave * 3 * s), wingSwing: Math.round(wave * 3 * s), squash: 0, stretch: Math.round(1 * s), collapse: 0 };
  }
  if (animationType === "jump") {
    const presets = frameCount === 4
      ? [
          { bob: 0, airborneLift: 0, squash: 2, stretch: 0 },
          { bob: -1, airborneLift: 2, squash: 0, stretch: 2 },
          { bob: -2, airborneLift: 4, squash: 0, stretch: 2 },
          { bob: 0, airborneLift: 1, squash: 1, stretch: 0 },
        ]
      : [
          { bob: 0, airborneLift: 0, squash: 2, stretch: 0 },
          { bob: -1, airborneLift: 1, squash: 1, stretch: 1 },
          { bob: -2, airborneLift: 3, squash: 0, stretch: 2 },
          { bob: -2, airborneLift: 4, squash: 0, stretch: 2 },
          { bob: -1, airborneLift: 2, squash: 0, stretch: 1 },
          { bob: 0, airborneLift: 0, squash: 2, stretch: 0 },
        ];
    const preset = presets[frameIndex] ?? presets[0];
    return { bob: Math.round(preset.bob * s), airborneLift: Math.round(preset.airborneLift * s), torsoTilt: 0, armSwingA: Math.round(1 * s), armSwingB: Math.round(-1 * s), legSwingA: Math.round(-1 * s), legSwingB: Math.round(1 * s), headOffset: 0, tailSwing: Math.round(1 * s), wingSwing: Math.round(3 * s), squash: Math.round(preset.squash * s), stretch: Math.round(preset.stretch * s), collapse: 0 };
  }
  if (animationType === "attack") {
    const presets = frameCount === 4
      ? [
          { torsoTilt: -1, armSwingA: -3, armSwingB: 1 },
          { torsoTilt: 0, armSwingA: -1, armSwingB: 1 },
          { torsoTilt: 2, armSwingA: 4, armSwingB: -1 },
          { torsoTilt: 0, armSwingA: 1, armSwingB: 0 },
        ]
      : [
          { torsoTilt: -1, armSwingA: -2, armSwingB: 1 },
          { torsoTilt: -1, armSwingA: -4, armSwingB: 2 },
          { torsoTilt: 0, armSwingA: -1, armSwingB: 1 },
          { torsoTilt: 2, armSwingA: 5, armSwingB: -2 },
          { torsoTilt: 1, armSwingA: 3, armSwingB: -1 },
          { torsoTilt: 0, armSwingA: 0, armSwingB: 0 },
        ];
    const preset = presets[frameIndex] ?? presets[0];
    return { bob: 0, airborneLift: 0, torsoTilt: Math.round(preset.torsoTilt * s), armSwingA: Math.round(preset.armSwingA * s), armSwingB: Math.round(preset.armSwingB * s), legSwingA: 0, legSwingB: 0, headOffset: 0, tailSwing: Math.round(1 * s), wingSwing: Math.round(1 * s), squash: 0, stretch: 0, collapse: 0 };
  }
  const collapse = Math.round((frameIndex / Math.max(1, frameCount - 1)) * 8 * s);
  return { bob: 0, airborneLift: 0, torsoTilt: Math.round(1 * s), armSwingA: Math.round(-1 * s), armSwingB: Math.round(1 * s), legSwingA: Math.round(-1 * s), legSwingB: Math.round(1 * s), headOffset: 0, tailSwing: 0, wingSwing: 0, squash: 0, stretch: 0, collapse };
}

function drawEyes(frame: number[], size: number, recipe: SpriteRecipe, cx: number, y: number, facing: FacingDirection, color: number, s: number) {
  const gap = Math.max(1, Math.round(1 * s));
  if (recipe.expression === "cute") {
    fillRect(frame, size, mirrorX(cx - gap, cx, facing), y, Math.max(1, Math.round(s * 0.6)), Math.max(1, Math.round(s * 0.6)), color);
    fillRect(frame, size, mirrorX(cx + gap, cx, facing), y, Math.max(1, Math.round(s * 0.6)), Math.max(1, Math.round(s * 0.6)), color);
    return;
  }
  if (recipe.expression === "angry") {
    const bw = Math.max(1, Math.round(s * 0.8));
    drawLine(frame, size, mirrorX(cx - gap * 2, cx, facing), y, mirrorX(cx - gap, cx, facing), y - Math.round(s), color, bw);
    drawLine(frame, size, mirrorX(cx + gap * 2, cx, facing), y - Math.round(s), mirrorX(cx + gap, cx, facing), y, color, bw);
    return;
  }
  fillRect(frame, size, mirrorX(cx - gap, cx, facing), y, Math.max(1, Math.round(s * 0.6)), Math.max(1, Math.round(s * 0.6)), color);
  fillRect(frame, size, mirrorX(cx + gap, cx, facing), y, Math.max(1, Math.round(s * 0.6)), Math.max(1, Math.round(s * 0.6)), color);
}

function drawAccessory(frame: number[], size: number, recipe: SpriteRecipe, handX: number, handY: number, facing: FacingDirection, roles: ReturnType<typeof paletteRoles>, s: number) {
  if (recipe.accessory === "none") return;
  const dir = facing === "left" ? -1 : 1;
  const th = Math.max(1, Math.round(s));
  if (recipe.accessory === "sword") {
    drawLine(frame, size, handX, handY, handX + Math.round(4 * s * dir), handY - Math.round(4 * s), roles.outline, th);
    drawLine(frame, size, handX, handY, handX + Math.round(3 * s * dir), handY - Math.round(3 * s), roles.highlight, Math.max(1, th - 1));
    fillRect(frame, size, handX + Math.round(dir * s * 0.5), handY, Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), roles.accent);
    return;
  }
  if (recipe.accessory === "staff") {
    drawLine(frame, size, handX, handY + Math.round(s), handX + Math.round(1 * s * dir), handY - Math.round(5 * s), roles.outline, th);
    fillEllipse(frame, size, handX + Math.round(1 * s * dir), handY - Math.round(5 * s), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), roles.accent);
    return;
  }
  if (recipe.accessory === "shield") {
    const sw = Math.round(3 * s);
    const sh = Math.round(4 * s);
    fillRect(frame, size, handX - Math.round(s) - (dir === -1 ? sw : 0), handY - Math.round(2 * s), sw, sh, roles.secondary);
    drawLine(frame, size, handX - Math.round(s) - (dir === -1 ? sw : 0), handY - Math.round(2 * s), handX + Math.round(s) - (dir === -1 ? sw : 0), handY - Math.round(2 * s), roles.outline, th);
  }
}

function drawHumanoid(frame: number[], size: number, recipe: SpriteRecipe, facing: FacingDirection, style: SpriteStyle, motion: MotionState) {
  const roles = paletteRoles(recipe.palette);
  const cx = Math.round(size / 2) + (facing === "left" ? -motion.torsoTilt : facing === "right" ? motion.torsoTilt : 0);
  const ground = size - 4 - motion.airborneLift;
  const headSize = style === "chibi" ? 4 : 3;
  const bodyWidthOffset = recipe.bodyType === "stocky" ? 2 : recipe.bodyType === "slim" ? -1 : 0;
  const torsoW = Math.max(4, (style === "chibi" ? 6 : 5) + bodyWidthOffset + (recipe.outfitStyle === "armor" ? 1 : 0));
  const torsoH = style === "chibi" ? 6 : 7;
  const torsoY = ground - 11 + motion.bob + motion.collapse;
  const headY = torsoY - headSize - 2 + motion.headOffset + motion.collapse;
  const leftHipX = cx - 1 - Math.max(0, Math.floor(bodyWidthOffset / 2));
  const rightHipX = cx + 1 + Math.max(0, Math.floor(bodyWidthOffset / 2));
  const shoulderY = torsoY + 1;
  const leftShoulderX = cx - Math.max(2, Math.floor(torsoW / 2));
  const rightShoulderX = cx + Math.max(2, Math.floor(torsoW / 2));

  if (recipe.features.includes("cape")) {
    fillTriangle(frame, size, [cx, torsoY + 1], [cx - 4, torsoY + 8], [cx + 4, torsoY + 8], roles.secondary);
  }

  if (recipe.outfitStyle === "dress") {
    fillTriangle(frame, size, [cx, torsoY + 2], [cx - Math.max(4, Math.floor(torsoW / 2) + 1), ground], [cx + Math.max(4, Math.floor(torsoW / 2) + 1), ground], roles.outline);
    fillTriangle(frame, size, [cx, torsoY + 3], [cx - Math.max(3, Math.floor(torsoW / 2)), ground - 1], [cx + Math.max(3, Math.floor(torsoW / 2)), ground - 1], roles.primary);
  } else if (recipe.outfitStyle === "robe") {
    fillRect(frame, size, cx - Math.floor(torsoW / 2), torsoY, torsoW, torsoH + 1 - motion.squash + motion.stretch, roles.outline);
    fillRect(frame, size, cx - Math.floor(torsoW / 2) + 1, torsoY + 1, torsoW - 2, Math.max(1, torsoH - 1 - motion.squash + motion.stretch), roles.primary);
    fillRect(frame, size, cx - Math.floor(torsoW / 2) + 1, torsoY + torsoH - 1, torsoW - 2, 1, roles.shadow);
  } else {
    fillRect(frame, size, cx - Math.floor(torsoW / 2), torsoY, torsoW, torsoH - motion.squash + motion.stretch, roles.outline);
    fillRect(frame, size, cx - Math.floor(torsoW / 2) + 1, torsoY + 1, torsoW - 2, Math.max(1, torsoH - 2 - motion.squash + motion.stretch), roles.primary);
    fillRect(frame, size, cx - Math.floor(torsoW / 2) + 1, torsoY + Math.max(1, torsoH - 3), torsoW - 2, 1, roles.shadow);
  }

  fillRect(frame, size, cx - headSize, headY, headSize * 2 + 1, headSize * 2 + 1, roles.outline);
  fillRect(frame, size, cx - headSize + 1, headY + 1, Math.max(1, headSize * 2 - 1), Math.max(1, headSize * 2 - 1), roles.secondary);

  if (recipe.hairStyle === "short") {
    fillRect(frame, size, cx - headSize + 1, headY + 1, headSize * 2 - 1, 2, roles.accent);
  }
  if (recipe.hairStyle === "long") {
    fillRect(frame, size, cx - headSize + 1, headY + 1, headSize * 2 - 1, 2, roles.accent);
    fillRect(frame, size, cx - headSize, headY + 3, 2, headSize + 1, roles.accent);
    fillRect(frame, size, cx + headSize - 1, headY + 3, 2, headSize + 1, roles.accent);
  }
  if (recipe.hairStyle === "spiky") {
    fillTriangle(frame, size, [cx - 2, headY + 1], [cx - 1, headY - 2], [cx, headY + 1], roles.accent);
    fillTriangle(frame, size, [cx, headY + 1], [cx + 1, headY - 2], [cx + 2, headY + 1], roles.accent);
  }

  drawEyes(frame, size, recipe, cx, headY + headSize, facing, roles.eye);

  if (recipe.genderPresentation === "feminine") {
    setPixel(frame, size, cx, headY + headSize + 2, roles.highlight);
  }

  if (recipe.features.includes("helmet")) {
    fillRect(frame, size, cx - headSize, headY, headSize * 2 + 1, 2, roles.accent);
  }
  if (recipe.features.includes("hat")) {
    fillRect(frame, size, cx - headSize - 1, headY - 1, headSize * 2 + 3, 1, roles.accent);
    fillRect(frame, size, cx - 1, headY - 3, 3, 2, roles.accent);
  }
  if (recipe.features.includes("horns")) {
    fillTriangle(frame, size, [cx - 2, headY], [cx - 3, headY - 2], [cx - 1, headY], roles.accent);
    fillTriangle(frame, size, [cx + 2, headY], [cx + 3, headY - 2], [cx + 1, headY], roles.accent);
  }
  if (recipe.features.includes("wings")) {
    fillTriangle(frame, size, [cx - 2, torsoY + 2], [cx - 6 - motion.wingSwing, torsoY + 4], [cx - 3, torsoY + 7], roles.secondary);
    fillTriangle(frame, size, [cx + 2, torsoY + 2], [cx + 6 + motion.wingSwing, torsoY + 4], [cx + 3, torsoY + 7], roles.secondary);
  }

  if (recipe.outfitStyle !== "dress") {
    drawLine(frame, size, leftHipX, torsoY + torsoH - 1, leftHipX + motion.legSwingA, ground, roles.outline, 2);
    drawLine(frame, size, rightHipX, torsoY + torsoH - 1, rightHipX + motion.legSwingB, ground, roles.outline, 2);
    drawLine(frame, size, leftHipX, torsoY + torsoH - 1, leftHipX + motion.legSwingA, ground - 1, roles.primary);
    drawLine(frame, size, rightHipX, torsoY + torsoH - 1, rightHipX + motion.legSwingB, ground - 1, roles.primary);
  }

  const leadHandX = mirrorX(rightShoulderX + motion.armSwingA, cx, facing);
  const leadHandY = shoulderY + 4 + Math.abs(motion.armSwingA) / 2;
  const rearHandX = mirrorX(leftShoulderX + motion.armSwingB, cx, facing);
  const rearHandY = shoulderY + 4 + Math.abs(motion.armSwingB) / 2;

  drawLine(frame, size, leftShoulderX, shoulderY, rearHandX, rearHandY, roles.outline, 2);
  drawLine(frame, size, rightShoulderX, shoulderY, leadHandX, leadHandY, roles.outline, 2);
  drawLine(frame, size, leftShoulderX, shoulderY, rearHandX, rearHandY, roles.primary);
  drawLine(frame, size, rightShoulderX, shoulderY, leadHandX, leadHandY, roles.primary);
  drawAccessory(frame, size, recipe, leadHandX, leadHandY, facing, roles);
}

function drawCanine(frame: number[], size: number, recipe: SpriteRecipe, facing: FacingDirection, style: SpriteStyle, motion: MotionState) {
  const roles = paletteRoles(recipe.palette);
  const cx = Math.round(size / 2);
  const ground = size - 4 - motion.airborneLift;
  const dir = facing === "left" ? -1 : 1;
  const bodyY = ground - 7 + motion.bob + motion.collapse;
  const bodyLength = style === "chibi" ? 9 : 11;
  const headX = cx + (dir * 5);
  const bodyX = cx - Math.floor(bodyLength / 2);

  fillEllipse(frame, size, cx, bodyY, Math.floor(bodyLength / 2), 3 - motion.squash + motion.stretch, roles.outline);
  fillEllipse(frame, size, cx, bodyY, Math.max(2, Math.floor(bodyLength / 2) - 1), 2 - Math.min(1, motion.squash) + motion.stretch, roles.primary);
  fillEllipse(frame, size, headX, bodyY - 2 + motion.headOffset, 3, 3, roles.outline);
  fillEllipse(frame, size, headX, bodyY - 2 + motion.headOffset, 2, 2, roles.secondary);

  if (recipe.features.includes("ears")) {
    fillTriangle(frame, size, [headX - (dir * 1), bodyY - 4], [headX - (dir * 2), bodyY - 7], [headX, bodyY - 4], roles.outline);
    fillTriangle(frame, size, [headX + (dir * 1), bodyY - 4], [headX + (dir * 2), bodyY - 7], [headX, bodyY - 4], roles.outline);
    fillTriangle(frame, size, [headX - (dir * 1), bodyY - 5], [headX - (dir * 2), bodyY - 6], [headX, bodyY - 4], roles.accent);
    fillTriangle(frame, size, [headX + (dir * 1), bodyY - 5], [headX + (dir * 2), bodyY - 6], [headX, bodyY - 4], roles.accent);
  }

  if (recipe.features.includes("tail")) {
    drawLine(frame, size, bodyX - dir, bodyY - 1, bodyX - (dir * (3 + motion.tailSwing)), bodyY - 3 + motion.tailSwing, roles.outline, 2);
    drawLine(frame, size, bodyX - dir, bodyY - 1, bodyX - (dir * (2 + motion.tailSwing)), bodyY - 3 + motion.tailSwing, roles.secondary);
  }

  if (recipe.features.includes("spots")) {
    fillEllipse(frame, size, cx - dir, bodyY - 1, 1, 1, roles.accent);
    fillEllipse(frame, size, cx + dir, bodyY + 1, 1, 1, roles.accent);
  }

  const legXs = [cx - 3, cx - 1, cx + 1, cx + 3];
  const legSwings = [motion.legSwingA, motion.legSwingB, motion.legSwingB, motion.legSwingA];
  legXs.forEach((legX, index) => {
    drawLine(frame, size, legX, bodyY + 2, legX + legSwings[index], ground, roles.outline, 2);
    drawLine(frame, size, legX, bodyY + 2, legX + legSwings[index], ground - 1, roles.primary);
  });

  drawEyes(frame, size, recipe, headX, bodyY - 2, facing, roles.eye);
  setPixel(frame, size, headX + (dir * 2), bodyY - 1, roles.accent);
}

function drawSlime(frame: number[], size: number, recipe: SpriteRecipe, _facing: FacingDirection, _style: SpriteStyle, motion: MotionState) {
  const roles = paletteRoles(recipe.palette);
  const cx = Math.round(size / 2);
  const ground = size - 4;
  const rx = 5 + motion.squash - motion.stretch;
  const ry = 4 - motion.squash + motion.stretch;
  const cy = ground - 4 - motion.airborneLift;

  fillEllipse(frame, size, cx, cy, rx + 1, ry + 1, roles.outline);
  fillEllipse(frame, size, cx, cy, rx, ry, roles.primary);
  fillEllipse(frame, size, cx - 1, cy - 1, 1, 1, roles.highlight);
  fillEllipse(frame, size, cx + 3, cy - 2, 1, 1, roles.highlight);
  drawEyes(frame, size, recipe, cx, cy, "right", roles.eye);
}

function drawBird(frame: number[], size: number, recipe: SpriteRecipe, facing: FacingDirection, _style: SpriteStyle, motion: MotionState) {
  const roles = paletteRoles(recipe.palette);
  const cx = Math.round(size / 2);
  const ground = size - 4 - motion.airborneLift;
  const dir = facing === "left" ? -1 : 1;
  const bodyY = ground - 8 + motion.bob;
  const headX = cx + (dir * 2);

  fillEllipse(frame, size, cx, bodyY, 4, 5 - motion.squash + motion.stretch, roles.outline);
  fillEllipse(frame, size, cx, bodyY, 3, 4 - motion.squash + motion.stretch, roles.primary);
  fillEllipse(frame, size, headX, bodyY - 5, 3, 3, roles.outline);
  fillEllipse(frame, size, headX, bodyY - 5, 2, 2, roles.secondary);
  fillTriangle(frame, size, [headX + (dir * 3), bodyY - 5], [headX + (dir * 5), bodyY - 4], [headX + (dir * 3), bodyY - 3], roles.accent);
  fillTriangle(frame, size, [cx, bodyY - 1], [cx - 5 - motion.wingSwing, bodyY + 1], [cx - 1, bodyY + 4], roles.secondary);
  fillTriangle(frame, size, [cx, bodyY - 1], [cx + 5 + motion.wingSwing, bodyY + 1], [cx + 1, bodyY + 4], roles.secondary);
  drawLine(frame, size, cx - 1, bodyY + 4, cx - 1 + motion.legSwingA, ground, roles.outline);
  drawLine(frame, size, cx + 1, bodyY + 4, cx + 1 + motion.legSwingB, ground, roles.outline);
  drawEyes(frame, size, recipe, headX, bodyY - 5, facing, roles.eye);
}

function drawRobot(frame: number[], size: number, recipe: SpriteRecipe, facing: FacingDirection, _style: SpriteStyle, motion: MotionState) {
  const roles = paletteRoles(recipe.palette);
  const cx = Math.round(size / 2);
  const ground = size - 4 - motion.airborneLift;
  const bodyY = ground - 11 + motion.bob + motion.collapse;
  const headY = bodyY - 5;

  fillRect(frame, size, cx - 4, bodyY, 9, 7, roles.outline);
  fillRect(frame, size, cx - 3, bodyY + 1, 7, 5, roles.primary);
  fillRect(frame, size, cx - 3, bodyY + 4, 7, 1, roles.shadow);
  fillRect(frame, size, cx - 3, headY, 7, 5, roles.outline);
  fillRect(frame, size, cx - 2, headY + 1, 5, 3, roles.secondary);
  fillRect(frame, size, cx - 2, headY + 2, 1, 1, roles.eye);
  fillRect(frame, size, cx + 1, headY + 2, 1, 1, roles.eye);

  if (recipe.features.includes("antenna")) {
    drawLine(frame, size, cx, headY, cx, headY - 3, roles.outline);
    setPixel(frame, size, cx, headY - 3, roles.accent);
  }

  drawLine(frame, size, cx - 2, bodyY + 1, cx - 4 + motion.armSwingB, bodyY + 5, roles.outline, 2);
  drawLine(frame, size, cx + 2, bodyY + 1, cx + 4 + motion.armSwingA, bodyY + 5, roles.outline, 2);
  drawLine(frame, size, cx - 2, bodyY + 6, cx - 2 + motion.legSwingA, ground, roles.outline, 2);
  drawLine(frame, size, cx + 2, bodyY + 6, cx + 2 + motion.legSwingB, ground, roles.outline, 2);
  drawAccessory(frame, size, recipe, mirrorX(cx + 4 + motion.armSwingA, cx, facing), bodyY + 5, facing, roles);
}

function drawSkeleton(frame: number[], size: number, recipe: SpriteRecipe, facing: FacingDirection, _style: SpriteStyle, motion: MotionState) {
  const roles = paletteRoles(recipe.palette);
  const cx = Math.round(size / 2);
  const ground = size - 4 - motion.airborneLift;
  const spineY = ground - 10 + motion.bob + motion.collapse;
  fillEllipse(frame, size, cx, spineY - 4, 3, 3, roles.outline);
  fillEllipse(frame, size, cx, spineY - 4, 2, 2, roles.highlight);
  drawEyes(frame, size, recipe, cx, spineY - 4, facing, roles.eye);
  drawLine(frame, size, cx, spineY - 1, cx, spineY + 5, roles.outline);
  drawLine(frame, size, cx - 3, spineY + 1, cx + 3, spineY + 1, roles.outline);
  drawLine(frame, size, cx - 1, spineY + 5, cx - 2 + motion.legSwingA, ground, roles.outline);
  drawLine(frame, size, cx + 1, spineY + 5, cx + 2 + motion.legSwingB, ground, roles.outline);
  drawLine(frame, size, cx - 3, spineY + 1, cx - 4 + motion.armSwingB, spineY + 5, roles.outline);
  drawLine(frame, size, cx + 3, spineY + 1, cx + 4 + motion.armSwingA, spineY + 5, roles.outline);
}

function renderFrame(recipe: SpriteRecipe, size: number, animationType: AnimationType, frameIndex: number, frameCount: number, facing: FacingDirection, style: SpriteStyle) {
  const frame = createFrame(size);
  const motion = getMotionState(animationType, frameIndex, frameCount);

  if (recipe.archetype === "humanoid") drawHumanoid(frame, size, recipe, facing, style, motion);
  else if (recipe.archetype === "canine") drawCanine(frame, size, recipe, facing, style, motion);
  else if (recipe.archetype === "slime") drawSlime(frame, size, recipe, facing, style, motion);
  else if (recipe.archetype === "bird") drawBird(frame, size, recipe, facing, style, motion);
  else if (recipe.archetype === "robot") drawRobot(frame, size, recipe, facing, style, motion);
  else drawSkeleton(frame, size, recipe, facing, style, motion);

  return frame;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, animationType, style, palette, resolution, frameCount, facingDirection } = await req.json();

    if (!prompt || !animationType || !resolution || !frameCount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outputSize = parseInt(resolution);
    const logicalSize = getLogicalSize(outputSize);
    const totalFrames = normalizeFrameCount(Math.min(Math.max(1, Math.round(Number(frameCount) || 1)), MAX_GENERATED_FRAMES));
    const recipe = buildRecipe(String(prompt), palette as PaletteType);

    const frames = Array.from({ length: totalFrames }, (_, index) =>
      renderFrame(recipe, logicalSize, animationType as AnimationType, index, totalFrames, facingDirection as FacingDirection, style as SpriteStyle)
    );

    console.log(`Generated ${frames.length} deterministic ${recipe.archetype} frames for: ${recipe.summary}`);

    return new Response(
      JSON.stringify({
        type: "pixel-data",
        palette: recipe.palette,
        frames,
        frameCount: totalFrames,
        frameWidth: outputSize,
        frameHeight: outputSize,
        logicalFrameWidth: logicalSize,
        logicalFrameHeight: logicalSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-sprite error:", e);
    return new Response(
      JSON.stringify({ error: "Sprite generation failed. Please try a different prompt." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});