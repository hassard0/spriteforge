import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-2.5-flash";
const MAX_PALETTE_COLORS = 16;
const MAX_GENERATED_FRAMES = 6;

const WALK_POSES: Record<number, string[]> = {
  4: [
    "contact pose, left foot forward, right foot back, right arm forward, left arm back",
    "passing pose, right knee lifting under body, arms crossing center",
    "contact pose, right foot forward, left foot back, left arm forward, right arm back",
    "passing pose, left knee lifting under body, arms crossing center",
  ],
  6: [
    "contact pose, left heel striking ground, right leg back, right arm forward",
    "down pose, weight settling on left leg, right foot lifting",
    "passing pose, right leg swinging forward under body",
    "contact pose, right heel striking ground, left leg back, left arm forward",
    "down pose, weight settling on right leg, left foot lifting",
    "passing pose, left leg swinging forward under body",
  ],
};

const RUN_POSES: Record<number, string[]> = {
  4: [
    "contact pose, left foot under body, right leg trailing, torso leaning hard forward",
    "flight pose, both feet airborne, right knee high, left leg stretched back",
    "contact pose, right foot under body, left leg trailing, torso leaning hard forward",
    "flight pose, both feet airborne, left knee high, right leg stretched back",
  ],
  6: [
    "contact pose, left foot lands, right leg extended back, right arm forward",
    "compression pose, left knee bent, body dropping, right knee rising",
    "flight pose, both feet airborne, right knee high forward, left leg back",
    "contact pose, right foot lands, left leg extended back, left arm forward",
    "compression pose, right knee bent, body dropping, left knee rising",
    "flight pose, both feet airborne, left knee high forward, right leg back",
  ],
};

const IDLE_POSES: Record<number, string[]> = {
  4: [
    "neutral relaxed stance",
    "small inhale, chest slightly higher, tiny shoulder rise",
    "neutral relaxed stance",
    "small exhale, chest slightly lower, tiny shoulder drop",
  ],
  6: [
    "neutral relaxed stance",
    "slight inhale",
    "peak inhale",
    "begin exhale",
    "lowest chest position",
    "return to neutral",
  ],
};

const ATTACK_POSES: Record<number, string[]> = {
  4: [
    "wind-up, attack arm pulled back, chest twisted, weight on back foot",
    "mid swing, arm accelerating forward, shoulders rotating",
    "impact, arm fully extended, body stretched forward",
    "recovery, arm returning, stance stabilizing",
  ],
  6: [
    "ready stance, guard up",
    "wind-up, body coiling",
    "release, arm firing forward",
    "impact, full extension",
    "follow-through, momentum carrying through",
    "recovery, returning to ready stance",
  ],
};

const JUMP_POSES: Record<number, string[]> = {
  4: [
    "anticipation crouch, knees bent low, arms down",
    "launch, legs extending, arms thrust up",
    "peak jump, body fully extended in air",
    "descent, knees bending to prepare for landing",
  ],
  6: [
    "anticipation crouch",
    "launch upward",
    "rising, legs tucked a bit",
    "peak of jump",
    "falling, legs extending down",
    "landing, knees absorbing impact",
  ],
};

const DEATH_POSES: Record<number, string[]> = {
  4: [
    "hit reaction, body jerking back",
    "stumble, balance breaking to one side",
    "falling, body nearing horizontal",
    "collapsed, lying still on the ground",
  ],
  6: [
    "hit reaction",
    "staggering backward",
    "losing balance sideways",
    "falling nearly horizontal",
    "hitting the ground",
    "collapsed motionless",
  ],
};

function normalizeFrameCount(frameCount: number): 4 | 6 {
  return frameCount <= 4 ? 4 : 6;
}

function getPosesForAnimation(animationType: string, frameCount: number): string[] {
  const poseSets: Record<string, Record<number, string[]>> = {
    walk: WALK_POSES,
    run: RUN_POSES,
    idle: IDLE_POSES,
    attack: ATTACK_POSES,
    jump: JUMP_POSES,
    death: DEATH_POSES,
  };

  const set = poseSets[animationType] || poseSets.idle;
  return set[frameCount] || set[6] || set[4];
}

function getLogicalSize(requestedSize: number): number {
  if (requestedSize <= 16) return 16;
  if (requestedSize <= 32) return 32;
  if (requestedSize <= 48) return 24;
  return 32;
}

function extractTextContent(message: any): string | null {
  if (!message?.content) return null;
  if (typeof message.content === "string") return message.content.trim() || null;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
      .map((part: any) => part.text.trim())
      .filter(Boolean)
      .join(" ")
      .trim() || null;
  }
  return null;
}

function detectTruncation(text: string): boolean {
  const trimmed = text.trim();
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;

  if (openBraces !== closeBraces || openBrackets !== closeBrackets) return true;
  return /\.\.\.$|…$|\[truncated\]/i.test(trimmed);
}

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === "[" ? "]" : "}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON object found in response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

async function callStructuredTool<T>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  tool: Record<string, unknown>,
  toolName: string,
): Promise<T> {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
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
  const choice = data.choices?.[0];
  const toolArgs = choice?.message?.tool_calls?.[0]?.function?.arguments;

  if (toolArgs) {
    return JSON.parse(toolArgs) as T;
  }

  const content = extractTextContent(choice?.message);
  if (!content) throw new Error("AI_EMPTY_RESPONSE");
  if (detectTruncation(content)) throw new Error("AI_TRUNCATED");
  return extractJsonFromResponse(content) as T;
}

function normalizeHexColor(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "transparent") return "#00000000";
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function normalizePalette(rawPalette: unknown): string[] {
  const unique = new Set<string>(["#00000000"]);

  if (Array.isArray(rawPalette)) {
    for (const color of rawPalette) {
      const normalized = normalizeHexColor(color);
      if (normalized) unique.add(normalized);
      if (unique.size >= MAX_PALETTE_COLORS) break;
    }
  }

  if (unique.size < 2) {
    unique.add("#1F2937");
    unique.add("#F9FAFB");
    unique.add("#F59E0B");
  }

  return Array.from(unique).slice(0, MAX_PALETTE_COLORS);
}

function getAllowedDigits(paletteLength: number): string {
  return "0123456789ABCDEF".slice(0, Math.min(MAX_PALETTE_COLORS, Math.max(2, paletteLength)));
}

function sanitizeRow(row: unknown, logicalSize: number, paletteLength: number): string {
  const allowed = getAllowedDigits(paletteLength);
  const cleaned = String(row ?? "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, logicalSize)
    .padEnd(logicalSize, "0");

  return cleaned
    .split("")
    .map((char) => (allowed.includes(char) ? char : "0"))
    .join("");
}

function rowsToFrameIndices(rows: unknown, logicalSize: number, paletteLength: number): number[] {
  const rawRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = Array.from({ length: logicalSize }, (_, index) =>
    sanitizeRow(rawRows[index], logicalSize, paletteLength)
  );

  return normalizedRows.flatMap((row) =>
    row.split("").map((char) => {
      const value = parseInt(char, 16);
      if (Number.isNaN(value)) return 0;
      return Math.max(0, Math.min(value, paletteLength - 1));
    })
  );
}

type SpriteBlueprint = {
  palette: string[];
  characterSummary: string;
  grounding: string;
};

type FrameRows = {
  rows: string[];
};

async function generateBlueprint(
  apiKey: string,
  prompt: string,
  animationType: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
  logicalSize: number,
): Promise<SpriteBlueprint> {
  const blueprintTool = {
    type: "function",
    function: {
      name: "output_sprite_blueprint",
      description: "Create a locked sprite blueprint with a shared palette and concise design notes",
      parameters: {
        type: "object",
        properties: {
          palette: {
            type: "array",
            items: { type: "string" },
          },
          characterSummary: { type: "string" },
          grounding: { type: "string" },
        },
        required: ["palette", "characterSummary", "grounding"],
        additionalProperties: false,
      },
    },
  };

  const blueprint = await callStructuredTool<SpriteBlueprint>(
    apiKey,
    "You are an expert retro pixel artist. Design one reusable sprite blueprint for an animated character. Keep it simple, readable, and suitable for a game sprite. Always use the provided tool.",
    `Create a sprite blueprint for this character: ${prompt}.\nAnimation: ${animationType}.\nStyle: ${styleDesc}.\nPalette direction: ${paletteDesc}.\nFacing: ${facingDirection}.\nLogical drawing grid: ${logicalSize}x${logicalSize}.\n\nRules:\n- Full body visible.\n- Readable silhouette.\n- Max ${MAX_PALETTE_COLORS} colors total including transparency.\n- Palette index 0 is transparent.\n- Keep the summary concise and stable across all frames.`,
    blueprintTool,
    "output_sprite_blueprint",
  );

  return {
    palette: normalizePalette(blueprint.palette),
    characterSummary: typeof blueprint.characterSummary === "string" && blueprint.characterSummary.trim()
      ? blueprint.characterSummary.trim().slice(0, 220)
      : prompt.trim().slice(0, 220),
    grounding: typeof blueprint.grounding === "string" && blueprint.grounding.trim()
      ? blueprint.grounding.trim().slice(0, 220)
      : "feet near a stable ground line, centered in frame, readable silhouette",
  };
}

async function generateFrame(
  apiKey: string,
  blueprint: SpriteBlueprint,
  animationType: string,
  facingDirection: string,
  logicalSize: number,
  frameIndex: number,
  totalFrames: number,
  pose: string,
): Promise<number[]> {
  const frameTool = {
    type: "function",
    function: {
      name: "output_sprite_frame",
      description: "Output a single pixel-art frame as logical rows of palette-index hex digits",
      parameters: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["rows"],
        additionalProperties: false,
      },
    },
  };

  const paletteLegend = blueprint.palette
    .map((color, index) => `${index.toString(16).toUpperCase()}=${color}`)
    .join(", ");
  const allowedDigits = getAllowedDigits(blueprint.palette.length);

  const userPrompt = `Create frame ${frameIndex + 1} of ${totalFrames} for a looping ${animationType} sprite animation.\n\nLocked character summary: ${blueprint.characterSummary}\nLocked grounding rules: ${blueprint.grounding}\nFacing: ${facingDirection}\nPose for this frame: ${pose}\nLogical frame size: ${logicalSize}x${logicalSize}\nPalette legend: ${paletteLegend}\nAllowed digits only: ${allowedDigits}\n\nHard rules:\n- Return exactly ${logicalSize} rows.\n- Each row must be exactly ${logicalSize} characters long.\n- Use only the allowed hex digits from the palette legend.\n- Index 0 means transparent background.\n- Character must be centered and fill most of the frame height.\n- Feet should stay near a consistent ground line unless airborne.\n- Arms, legs, torso, and head must visibly change according to the pose.\n- Make this frame clearly different from the adjacent frames in the cycle.\n- Do not add any explanation text. Use the tool only.`;

  const attempt = async (promptOverride?: string) => {
    const frame = await callStructuredTool<FrameRows>(
      apiKey,
      "You are an expert game sprite artist. Output one clean frame of pixel art as palette index rows. Always use the provided tool.",
      promptOverride ?? userPrompt,
      frameTool,
      "output_sprite_frame",
    );
    return rowsToFrameIndices(frame.rows, logicalSize, blueprint.palette.length);
  };

  const firstPass = await attempt();
  const opaquePixels = firstPass.reduce((count, value) => count + (value !== 0 ? 1 : 0), 0);
  if (opaquePixels > logicalSize) return firstPass;

  return attempt(`Retry the same frame because the previous output was too empty. Keep the character large and readable.\n${userPrompt}`);
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const requestedSize = parseInt(resolution);
    const outputSize = Number.isFinite(requestedSize) ? requestedSize : 32;
    const logicalSize = getLogicalSize(outputSize);
    const totalFrames = normalizeFrameCount(Math.min(Math.max(1, Math.round(Number(frameCount) || 1)), MAX_GENERATED_FRAMES));
    const styleDesc = style === "pixel-art" ? "retro pixel art" : style === "chibi" ? "cute chibi pixel art" : "clean cel-shaded pixel art";
    const paletteDesc = palette === "nes"
      ? "limited retro console colors"
      : palette === "snes"
      ? "richer 16-bit console colors"
      : palette === "gameboy"
      ? "4-shade handheld green palette"
      : "cohesive vibrant game palette";
    const poses = getPosesForAnimation(animationType, totalFrames);

    console.log(`Generating ${totalFrames}-frame ${animationType} animation at ${outputSize}x${outputSize} using logical ${logicalSize}x${logicalSize} frames...`);

    const blueprint = await generateBlueprint(
      LOVABLE_API_KEY,
      prompt.trim(),
      animationType,
      styleDesc,
      paletteDesc,
      facingDirection,
      logicalSize,
    );

    const frames: number[][] = [];
    for (let index = 0; index < poses.length; index++) {
      const frame = await generateFrame(
        LOVABLE_API_KEY,
        blueprint,
        animationType,
        facingDirection,
        logicalSize,
        index,
        poses.length,
        poses[index],
      );
      frames.push(frame);
    }

    console.log(`Generated ${frames.length} frames with ${blueprint.palette.length}-color palette`);

    return new Response(
      JSON.stringify({
        type: "pixel-data",
        palette: blueprint.palette,
        frames,
        frameCount: frames.length,
        frameWidth: outputSize,
        frameHeight: outputSize,
        logicalFrameWidth: logicalSize,
        logicalFrameHeight: logicalSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-sprite error:", e);

    const msg = e instanceof Error ? e.message : "Unknown error";
    let status = 500;
    let userMsg = msg;

    if (msg === "RATE_LIMITED") {
      status = 429;
      userMsg = "Rate limited. Please try again in a moment.";
    } else if (msg === "CREDITS_EXHAUSTED") {
      status = 402;
      userMsg = "AI credits exhausted. Add funds in Settings > Workspace > Usage.";
    } else if (msg === "AI_TRUNCATED") {
      userMsg = "The AI response was truncated. Try again with a smaller sprite size or simpler prompt.";
    } else if (msg === "AI_EMPTY_RESPONSE") {
      userMsg = "The AI returned an empty response. Please try again.";
    }

    return new Response(JSON.stringify({ error: userMsg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
