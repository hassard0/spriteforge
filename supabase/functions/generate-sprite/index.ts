import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-2.5-flash";

// ── Pose descriptions per animation type ──

const WALK_POSES: Record<number, string[]> = {
  4: [
    "contact: left foot forward on ground, right foot back, right arm forward, left arm back",
    "passing: right leg lifting, weight on left leg, arms at sides crossing center",
    "contact: right foot forward on ground, left foot back, left arm forward, right arm back",
    "passing: left leg lifting, weight on right leg, arms at sides crossing center",
  ],
  6: [
    "contact: left heel strikes ground, right leg back, right arm forward, left arm back",
    "down: weight on left leg, knee bends, right foot lifting",
    "passing: right leg swings forward under body, left leg straight",
    "contact: right heel strikes ground, left leg back, left arm forward, right arm back",
    "down: weight on right leg, knee bends, left foot lifting",
    "passing: left leg swings forward under body, right leg straight",
  ],
};

const RUN_POSES: Record<number, string[]> = {
  4: [
    "contact: left foot under body, right leg trailing back, right arm forward, torso leaning",
    "flight: both feet off ground, right knee high, left leg back",
    "contact: right foot under body, left leg trailing back, left arm forward, torso leaning",
    "flight: both feet off ground, left knee high, right leg back",
  ],
  6: [
    "contact: left foot lands, right leg extended back, right arm forward",
    "compression: left knee bends, right knee rising, body lowers",
    "flight: both feet airborne, right knee high forward, left leg back",
    "contact: right foot lands, left leg extended back, left arm forward",
    "compression: right knee bends, left knee rising, body lowers",
    "flight: both feet airborne, left knee high forward, right leg back",
  ],
};

const IDLE_POSES: Record<number, string[]> = {
  4: [
    "standing relaxed, arms at sides, neutral posture",
    "slight inhale, chest lifted slightly, shoulders raised a tiny bit",
    "standing relaxed, arms at sides, neutral posture",
    "slight exhale, chest lowered, shoulders dropped slightly",
  ],
  6: [
    "standing relaxed, arms at sides",
    "slight inhale, chest rising",
    "chest at peak, tiny shoulder lift",
    "exhale beginning, chest lowering",
    "chest at lowest, shoulders dropped",
    "returning to neutral position",
  ],
};

const ATTACK_POSES: Record<number, string[]> = {
  4: [
    "wind-up: arm pulled back, chest twisted, weight on back foot",
    "mid-swing: arm coming forward, shoulders rotating, weight shifting",
    "full extension: arm fully forward, weight committed, body stretched",
    "recovery: arm pulling back, returning to stance",
  ],
  6: [
    "ready stance, arms up in guard",
    "wind-up: arm pulled back, body coiling",
    "release: arm accelerating forward, hips rotating",
    "impact: full extension, arm forward",
    "follow through: arm past center, momentum carrying",
    "recovery: returning to guard stance",
  ],
};

const JUMP_POSES: Record<number, string[]> = {
  4: [
    "crouching low, knees deeply bent, arms down",
    "launching upward, legs extending, arms up",
    "peak of jump, fully extended, arms overhead",
    "descending, knees bending, arms dropping",
  ],
  6: [
    "anticipation: crouching low, knees bent",
    "launch: legs pushing off, rising, arms up",
    "rising: legs tucking under, arms overhead",
    "peak: fully extended in air",
    "falling: legs extending down, arms out",
    "landing: knees bent absorbing impact",
  ],
};

const DEATH_POSES: Record<number, string[]> = {
  4: [
    "hit reaction: jerking backward, arms flailing",
    "stumbling: leaning far to side, losing balance",
    "falling: body mostly horizontal, limbs loose",
    "collapsed: lying flat on ground, motionless",
  ],
  6: [
    "hit reaction: flinching from impact",
    "staggering: leaning backward, arms up",
    "losing balance: tilting sideways",
    "falling: body nearly horizontal",
    "hitting ground: body flat",
    "collapsed: lying still",
  ],
};

function getPosesForAnimation(animationType: string, frameCount: number): string[] {
  const poseSets: Record<string, Record<number, string[]>> = {
    walk: WALK_POSES, run: RUN_POSES, idle: IDLE_POSES,
    attack: ATTACK_POSES, jump: JUMP_POSES, death: DEATH_POSES,
  };
  const set = poseSets[animationType] || poseSets.idle;
  return set[frameCount] || set[6] || set[4];
}

function normalizeFrameCount(frameCount: number): 4 | 6 {
  return frameCount <= 4 ? 4 : 6;
}

// ── Build the prompt that asks the AI to output pixel grids ──

function buildPixelGridPrompt(
  characterPrompt: string,
  animationType: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
  resolution: number,
  poses: string[],
): string {
  const frameDescriptions = poses.map((pose, i) =>
    `Frame ${i + 1}: ${pose}`
  ).join("\n");

  return `You are a pixel artist creating a ${resolution}x${resolution} sprite animation.

CHARACTER: ${characterPrompt}
STYLE: ${styleDesc}
PALETTE: ${paletteDesc}
FACING: ${facingDirection}
ANIMATION: ${animationType} cycle with ${poses.length} frames
RESOLUTION: ${resolution}x${resolution} pixels per frame

FRAME DESCRIPTIONS:
${frameDescriptions}

RULES:
- Each frame is a ${resolution}x${resolution} pixel grid.
- Use a shared color palette (max 16 colors). Index 0 is always transparent.
- Output each frame as a flat array of palette indices, row by row, left to right, top to bottom.
- The character must be clearly visible and centered in each frame.
- Each frame MUST show visibly different limb/body positions matching the pose description.
- Background pixels should be index 0 (transparent).
- Make the character fill roughly 60-80% of the frame height.
- Ensure smooth animation: each frame should flow naturally to the next.
- The last frame should transition smoothly back to the first frame for looping.

Return the result using the provided tool.`;
}

// ── Server ──

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const fw = parseInt(resolution);
    const totalFrames = normalizeFrameCount(Math.min(Math.max(1, Math.round(Number(frameCount) || 1)), 6));
    const styleDesc = style === "pixel-art" ? "pixel art" : style === "chibi" ? "chibi style" : "cel-shaded";
    const paletteDesc = palette === "nes" ? "NES color palette (limited, retro)" : palette === "snes" ? "SNES palette (richer, 256 colors)" : palette === "gameboy" ? "Game Boy 4-shade green palette" : "vibrant colors";
    const poses = getPosesForAnimation(animationType, totalFrames);

    const pixelPrompt = buildPixelGridPrompt(
      prompt.trim(),
      animationType,
      styleDesc,
      paletteDesc,
      facingDirection,
      fw,
      poses,
    );

    console.log(`Generating ${totalFrames}-frame ${animationType} animation at ${fw}x${fw} via text model...`);

    const toolSchema = {
      type: "function",
      function: {
        name: "output_sprite_data",
        description: "Output the sprite animation as a color palette and per-frame pixel index grids",
        parameters: {
          type: "object",
          properties: {
            palette: {
              type: "array",
              description: "Array of hex color strings. Index 0 must be transparent (use '#00000000'). Max 16 colors.",
              items: { type: "string" },
            },
            frames: {
              type: "array",
              description: `Array of ${totalFrames} frames. Each frame is a flat array of ${fw * fw} palette index integers, row by row top-to-bottom, left-to-right.`,
              items: {
                type: "array",
                items: { type: "integer" },
              },
            },
          },
          required: ["palette", "frames"],
          additionalProperties: false,
        },
      },
    };

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: "You are an expert pixel artist. You create sprite animations as structured pixel data. Always use the provided tool to output your result." },
          { role: "user", content: pixelPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "output_sprite_data" } },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error(`AI API error ${response.status}:`, txt.slice(0, 500));
      if (response.status === 429) throw new Error("RATE_LIMITED");
      if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data.choices?.[0]?.message).slice(0, 500));
      throw new Error("AI_NO_TOOL_CALL");
    }

    let spriteData: { palette: string[]; frames: number[][] };
    try {
      spriteData = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool call args:", toolCall.function.arguments.slice(0, 500));
      throw new Error("AI_PARSE_ERROR");
    }

    // Validate
    if (!Array.isArray(spriteData.palette) || spriteData.palette.length < 2) {
      throw new Error("AI_INVALID_PALETTE");
    }
    if (!Array.isArray(spriteData.frames) || spriteData.frames.length === 0) {
      throw new Error("AI_NO_FRAMES");
    }

    // Ensure palette index 0 is transparent
    if (!spriteData.palette[0]?.includes("0000") && spriteData.palette[0] !== "transparent") {
      spriteData.palette.unshift("#00000000");
      // Shift all frame indices up by 1
      spriteData.frames = spriteData.frames.map(f => f.map(idx => idx + 1));
    }

    // Pad/trim frames to expected pixel count
    const expectedPixels = fw * fw;
    spriteData.frames = spriteData.frames.map(frame => {
      if (frame.length >= expectedPixels) return frame.slice(0, expectedPixels);
      return [...frame, ...new Array(expectedPixels - frame.length).fill(0)];
    });

    // Clamp indices to palette range
    const maxIdx = spriteData.palette.length - 1;
    spriteData.frames = spriteData.frames.map(frame =>
      frame.map(idx => Math.max(0, Math.min(idx, maxIdx)))
    );

    console.log(`Generated ${spriteData.frames.length} frames with ${spriteData.palette.length}-color palette`);

    return new Response(
      JSON.stringify({
        type: "pixel-data",
        palette: spriteData.palette,
        frames: spriteData.frames,
        frameCount: spriteData.frames.length,
        frameWidth: fw,
        frameHeight: fw,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-sprite error:", e);

    const msg = e instanceof Error ? e.message : "Unknown error";
    let status = 500;
    let userMsg = msg;

    if (msg === "RATE_LIMITED") { status = 429; userMsg = "Rate limited. Please try again in a moment."; }
    else if (msg === "CREDITS_EXHAUSTED") { status = 402; userMsg = "AI credits exhausted. Add funds in Settings > Workspace > Usage."; }
    else if (msg === "AI_NO_TOOL_CALL") { status = 500; userMsg = "AI didn't return structured data. Try again."; }
    else if (msg === "AI_PARSE_ERROR") { status = 500; userMsg = "AI returned invalid data. Try again with a simpler prompt."; }
    else if (msg === "AI_INVALID_PALETTE") { status = 500; userMsg = "AI returned an invalid color palette. Try again."; }
    else if (msg === "AI_NO_FRAMES") { status = 500; userMsg = "AI didn't generate any frames. Try again."; }

    return new Response(
      JSON.stringify({ error: userMsg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
