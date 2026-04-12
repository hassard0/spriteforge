# AI Sprite Generator

A dark-themed, game-dev-inspired web app for generating pixel art sprites from reference images using AI vision and image generation models.

---

## Overview

Upload a reference character image, configure your desired output (grid size, viewing angle, pose), and the app generates a pixel art sprite with transparent background — ready for use in game engines like Unity or Godot.

## How It Works

### Generation Pipeline

The sprite generation uses a **two-stage AI pipeline** powered by Lovable AI:

1. **Stage 1 — Character Analysis** (`google/gemini-2.5-flash-lite`)
   - The uploaded reference image is sent to a vision model
   - The model analyzes and describes the character's appearance: body shape, clothing, colors (hex codes), art style, and distinctive features
   - This text description is used to guide the image generation

2. **Stage 2 — Pixel Art Generation** (`google/gemini-3.1-flash-image-preview`)
   - The character description is used to prompt an image generation model
   - The model produces a pixel art sprite at the requested grid size
   - The sprite is generated on a solid magenta (#FF00FF) background for easy chroma-keying

3. **Client-Side Post-Processing**
   - The generated image is drawn to an HTML Canvas
   - Magenta background pixels are replaced with transparency
   - A color palette is extracted from the remaining pixels
   - The final sprite is encoded as a transparent PNG

### Configuration Options

| Option | Values |
|---|---|
| **Grid Size** | 32×32, 64×64, 128×128, 256×256, 512×512 |
| **Viewing Angle** | Front, Back, Left/Right Side, ¾ views, Top-Down, Isometric |
| **Pose** | Idle, Walking, Running, Jumping, Attacking, Magic Casting, Blocking, Crouching, and more |

## Pages

### Generate (`/`)
The main workspace. Upload a reference image, configure sprite parameters, and generate. The preview panel shows the result with zoom controls, pixel grid overlay, and fit-to-window scaling.

### Library (`/library`)
Browse all generated sprites in a searchable, filterable grid. Click any sprite to view details. Supports bulk selection for export or deletion.

### Collections (`/collections`)
Organize sprites into color-coded folders. Drag and drop sprites from the library into collections.

### Settings (`/settings`)
Configure API credentials, default generation parameters, UI preferences, and manage data (reset, export backup).

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui (Radix primitives)
- **Backend**: Lovable Cloud (Edge Functions)
- **AI Models**: Lovable AI Gateway
  - `google/gemini-2.5-flash-lite` — fast vision analysis
  - `google/gemini-3.1-flash-image-preview` — image generation
- **Data Storage**: localStorage (sprites, collections, settings)

## Export Formats

- **PNG** — Transparent sprite sheet image
- **JSON** — Frame metadata (dimensions, palette, pixel indices)
- **Clipboard** — Copy JSON metadata for Unity/Godot import

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Browser    │────▶│  Edge Function   │────▶│  Lovable AI Gateway │
│  (React App) │◀────│ generate-sprite  │◀────│  (Gemini Models)    │
└─────────────┘     └──────────────────┘     └─────────────────────┘
       │
       ▼
  Canvas Post-Processing
  (chroma-key, palette extraction)
```

## Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` with hot module replacement via Vite.
