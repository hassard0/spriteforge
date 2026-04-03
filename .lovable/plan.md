

## AI Sprite Generator — Dashboard & Asset Manager

A dark-themed, game-dev-inspired dashboard for generating, previewing, and managing animated sprite sheets.

### Pages & Layout

**Sidebar navigation** (dark, icon-collapsible) with sections:
- **Generate** — main sprite creation page
- **Library** — browse/search all generated sprites
- **Collections** — organize sprites into folders/projects
- **Settings** — preferences (default resolution, palette, API config)

### Generate Page
- **Input panel** (left): Text prompt field OR image upload for reference character
- **Options panel**: Animation type dropdown (idle, walk, run, attack, jump, death), frame count slider (4–24), resolution selector (16×16 to 128×128), palette picker (NES, SNES, custom), style selector (pixel art, chibi, cel-shaded), facing direction toggle
- **Generate button** with progress indicator (simulated for now, ready to wire to a real API)
- **Preview panel** (right): Shows the generated sprite sheet + animated preview player

### Sprite Preview Player
- Canvas-based animation player that cycles through sprite sheet frames
- Controls: play/pause, speed slider, frame-by-frame step (prev/next), loop toggle
- Zoom controls and pixel-grid overlay toggle
- Frame counter display (e.g. "Frame 3/8")
- Click a frame in the sheet grid below to jump to it

### Library Page
- Grid of generated sprite cards showing: thumbnail (animated), name, animation type, resolution, date
- Search bar + filters (by animation type, style, resolution, date range)
- Click a card to open detail view with full preview player and metadata
- Bulk select for delete or export

### Collections Page
- Create/rename/delete collections (folders)
- Drag sprites from library into collections
- Each collection shows sprite count and thumbnail previews

### Export & Download
- Download sprite sheet as PNG
- Download metadata as JSON (frame dimensions, timing, pivot points)
- Copy sprite sheet data for Unity/Godot import format

### Design
- **Dark theme** with pixel-art inspired accents — subtle grid/scanline textures, monospace fonts for data, pixel-art favicon
- Accent color: vibrant green (#00FF88) on dark charcoal backgrounds
- Card borders with subtle pixel-stepped corners
- Retro-styled buttons and form controls

### Data
- All data stored in local state/localStorage initially (no backend required)
- Pre-loaded with 4–5 sample sprite sheets for demo purposes
- Generation form is fully functional UI — outputs mock results, ready to connect to a real ML API endpoint later

