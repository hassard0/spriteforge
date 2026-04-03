import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_GENERATED_FRAMES = 6;
const TEXT_MODEL = "google/gemini-3-flash-preview";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

// ── Pose descriptions per animation type ──

const WALK_POSES: Record<number, string[]> = {
  4: [
    "left foot forward on ground, right foot back, right arm forward, left arm back",
    "feet passing under body, weight centered, arms at sides",
    "right foot forward on ground, left foot back, left arm forward, right arm back",
    "feet passing under body, weight centered, arms at sides, opposite of frame 2",
  ],
  6: [
    "left heel strikes ground ahead, right leg pushes off behind, right arm swings forward, left arm back",
    "weight drops onto left leg, right foot lifts off ground, arms passing center",
    "right leg swings forward past left, left leg straight, arms reversed mid-swing",
    "right heel strikes ground ahead, left leg pushes off behind, left arm swings forward, right arm back",
    "weight drops onto right leg, left foot lifts off ground, arms passing center",
    "left leg swings forward past right, right leg straight, arms reversed mid-swing",
  ],
};

const RUN_POSES: Record<number, string[]> = {
  4: [
    "left foot on ground, right knee driven up high, right arm forward, left arm back, torso leaning forward",
    "both feet off ground in flight, right leg forward, left leg trailing behind, arms wide",
    "right foot on ground, left knee driven up high, left arm forward, right arm back, torso leaning forward",
    "both feet off ground in flight, left leg forward, right leg trailing behind, arms wide",
  ],
  6: [
    "left foot strikes ground, right leg fully extended behind, right arm pumped forward to face, left arm back, torso leaned forward",
    "left leg compressed absorbing impact, right knee driving upward, arms switching sides",
    "both feet airborne, right knee high in front, left leg stretched behind, classic sprint silhouette",
    "right foot strikes ground, left leg fully extended behind, left arm pumped forward to face, right arm back, torso leaned forward",
    "right leg compressed absorbing impact, left knee driving upward, arms switching sides",
    "both feet airborne, left knee high in front, right leg stretched behind, classic sprint silhouette",
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
    "wind-up: striking arm pulled far back, chest twisted away, weight on back foot",
    "mid-swing: arm coming forward, shoulders rotating, weight shifting forward",
    "full extension: arm fully forward striking, weight committed forward, body stretched",
    "recovery: arm pulling back, returning to neutral stance",
  ],
  6: [
    "ready stance, arms up in guard position",
    "wind-up: striking arm pulled far back, body coiling",
    "release: arm accelerating forward, hips rotating",
    "impact: full extension, arm forward, body stretched",
    "follow through: arm past center, momentum carrying forward",
    "recovery: returning to guard stance",
  ],
};

const JUMP_POSES: Record<number, string[]> = {
  4: [
    "crouching low, knees deeply bent, arms pulled down and back",
    "launching upward, legs extending, arms thrusting up",
    "peak of jump, body fully extended upward, arms overhead",
    "descending, knees bending to land, arms dropping for balance",
  ],
  6: [
    "anticipation: crouching low, knees bent, arms down",
    "launch: legs pushing off, body rising, arms swinging up",
    "rising: legs tucking under, arms overhead",
    "peak: fully extended in air, maximum height",
    "falling: legs extending downward, arms out for balance",
    "landing: knees bent absorbing impact, arms down",
  ],
};

const DEATH_POSES: Record<number, string[]> = {
  4: [
    "hit reaction: jerking backward from impact, arms flailing",
    "stumbling: leaning far to one side, losing balance",
    "falling: body mostly horizontal, limbs loose",
    "collapsed: lying flat on the ground, motionless",
  ],
  6: [
    "hit reaction: flinching from impact",
    "staggering: leaning backward, arms up",
    "losing balance: tilting sideways dramatically",
    "falling: body nearly horizontal",
    "hitting ground: body flat, slight bounce",
    "collapsed: lying still, limbs slack",
  ],
};

function getPosesForAnimation(animationType: string, frameCount: number): string[] {
  const poseSets: Record<string, Record<number, string[]>> = {
    walk: WALK_POSES, run: RUN_POSES, idle: IDLE_POSES,
    attack: ATTACK_POSES, jump: JUMP_POSES, death: DEATH_POSES,
  };
  const set = poseSets[animationType] || poseSets.idle;
  // Use the closest available frame count
  if (set[frameCount]) return set[frameCount];
  const available = Object.keys(set).map(Number).sort((a, b) => Math.abs(a - frameCount) - Math.abs(b - frameCount));
  return set[available[0]];
}

// ── Helpers ──

function extractTextContent(message: any): string | null {
  if (!message?.content) return null;
  if (typeof message.content === "string") return message.content.trim() || null;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
      .map((p: any) => p.text.trim())
      .filter(Boolean)
      .join(" ")
      .trim() || null;
  }
  return null;
}

function extractImageUrl(message: any): string | null {
  if (!message) return null;
  let url = message.images?.[0]?.image_url?.url;
  if (!url && typeof message.content === "string") {
    const m = message.content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
    if (m) url = m[1];
  }
  if (!url && Array.isArray(message.content)) {
    const img = message.content.find((p: any) => p.type === "image_url" || p.type === "image");
    url = img?.image_url?.url || img?.url;
  }
  return url || null;
}

async function callImageModel(apiKey: string, prompt: string, referenceImages: string[] = [], model = IMAGE_MODEL): Promise<string | null> {
  const content: any[] = [{ type: "text", text: prompt }];
  for (const ref of referenceImages.filter(Boolean)) {
    content.push({ type: "image_url", image_url: { url: ref } });
  }

  const response = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error(`AI API error ${response.status}:`, txt.slice(0, 500));
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI gateway returned ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason;

  console.log("AI response:", JSON.stringify({
    model, hasImages: !!message?.images, imagesLen: message?.images?.length,
    hasRefusal: !!message?.refusal, finishReason,
  }));

  if (finishReason === "content_filter" || finishReason === "safety") {
    console.warn("Content filtered by AI safety");
    return null;
  }

  return extractImageUrl(message);
}

async function simplifySpritePrompt(apiKey: string, prompt: string, animationType: string, facingDirection: string): Promise<string | null> {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: "You rewrite game sprite requests into safe, concise, production-ready image prompts. Keep the core subject, body type, and major visual traits. Remove nudity, sexual content, and overly complex wording. If clothing is missing, add simple practical clothing. Return exactly one short sentence." },
        { role: "user", content: `Rewrite this sprite request into a safe, concise game-character description. Animation type: ${animationType}. Facing: ${facingDirection}. Original: ${prompt}` },
      ],
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error(`Prompt rewrite error ${response.status}:`, txt.slice(0, 500));
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    return null;
  }

  const data = await response.json();
  const rewritten = extractTextContent(data.choices?.[0]?.message)?.replace(/^['"\s]+|['"\s]+$/g, "").slice(0, 220);
  console.log("Prompt rewrite:", JSON.stringify({ original: prompt.slice(0, 120), rewritten }));
  return rewritten && rewritten !== prompt ? rewritten : null;
}

// ── Main prompt builder: generates ALL frames as a single horizontal sprite sheet ──

function buildSpriteSheetPrompt(
  characterPrompt: string,
  animationType: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
  frameCount: number,
  poses: string[],
): string {
  const poseList = poses.map((pose, i) => `  Frame ${i + 1}: ${pose}`).join("\n");

  return `Create a horizontal sprite sheet image containing exactly ${frameCount} animation frames arranged left to right in a single row.

Character: ${characterPrompt}
Style: ${styleDesc}
Colors: ${paletteDesc}
Facing: ${facingDirection}
Animation: ${animationType} cycle

Each frame must show the SAME character in a DIFFERENT pose. The poses must progress through the ${animationType} animation cycle like this:
${poseList}

CRITICAL RULES:
- Draw exactly ${frameCount} frames side by side in one horizontal strip.
- Each frame must show clearly different arm and leg positions from the frame next to it.
- The character design, outfit, colors, face, and body proportions must be identical across all frames.
- Each frame should be roughly square and equally spaced.
- Keep the character the same size and on the same ground line across all frames.
- Use a plain flat solid-color background behind all frames.
- Do NOT draw borders, labels, numbers, or text on the frames.
- The motion must be exaggerated enough to read clearly at small sprite sizes.
- Arms and legs MUST change position between every adjacent frame.
- This is a ${animationType} animation — make the movement dynamic and energetic.`;
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
    const totalFrames = Math.min(Math.max(1, Math.round(Number(frameCount) || 1)), MAX_GENERATED_FRAMES);
    const styleDesc = style === "pixel-art" ? "pixel art" : style === "chibi" ? "chibi" : "cel-shaded";
    const paletteDesc = palette === "nes" ? "NES color palette" : palette === "snes" ? "SNES palette" : palette === "gameboy" ? "Game Boy 4-shade green" : "vibrant colors";
    const poses = getPosesForAnimation(animationType, totalFrames);

    let characterPrompt = prompt.trim();

    // Attempt 1: Generate full sprite sheet in a single image
    console.log(`Generating ${totalFrames}-frame ${animationType} sprite sheet...`);
    const sheetPrompt = buildSpriteSheetPrompt(characterPrompt, animationType, styleDesc, paletteDesc, facingDirection, totalFrames, poses);
    let sheetImage = await callImageModel(LOVABLE_API_KEY, sheetPrompt);

    // Attempt 2: Retry with simplified prompt
    if (!sheetImage) {
      console.log("First attempt failed, retrying with simplified prompt...");
      await new Promise((r) => setTimeout(r, 1500));
      const simplePrompt = `Create a horizontal sprite sheet with ${totalFrames} frames of a ${styleDesc} ${characterPrompt} doing a ${animationType} animation. Each frame shows a different pose. Facing ${facingDirection}. ${paletteDesc}. Plain background. No text or labels.`;
      sheetImage = await callImageModel(LOVABLE_API_KEY, simplePrompt);
    }

    // Attempt 3: Rewrite the character prompt and retry
    if (!sheetImage) {
      const rewritten = await simplifySpritePrompt(LOVABLE_API_KEY, characterPrompt, animationType, facingDirection);
      if (rewritten) {
        characterPrompt = rewritten;
        console.log("Retrying with rewritten prompt...");
        const retryPrompt = buildSpriteSheetPrompt(characterPrompt, animationType, styleDesc, paletteDesc, facingDirection, totalFrames, poses);
        sheetImage = await callImageModel(LOVABLE_API_KEY, retryPrompt);

        if (!sheetImage) {
          await new Promise((r) => setTimeout(r, 1500));
          const simpleRetry = `Create a horizontal sprite sheet with ${totalFrames} frames of a ${styleDesc} ${characterPrompt} doing a ${animationType} animation. Each frame shows a different pose. Facing ${facingDirection}. ${paletteDesc}. Plain background.`;
          sheetImage = await callImageModel(LOVABLE_API_KEY, simpleRetry);
        }
      }
    }

    if (!sheetImage) {
      throw new Error("NO_IMAGE_RETURNED");
    }

    console.log("Sprite sheet generated successfully");

    // Return the single sheet image — the client will split it into frames
    return new Response(
      JSON.stringify({
        spriteSheet: sheetImage,
        frameCount: totalFrames,
        frameWidth: fw,
        frameHeight: fw,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-sprite error:", e);

    const msg = e instanceof Error ? e.message : "Unknown error";
    let status = 500;
    if (msg === "RATE_LIMITED") status = 429;
    if (msg === "CREDITS_EXHAUSTED") status = 402;
    if (msg === "NO_IMAGE_RETURNED") status = 400;

    return new Response(
      JSON.stringify({
        error: msg === "RATE_LIMITED"
          ? "Rate limited. Please try again in a moment."
          : msg === "CREDITS_EXHAUSTED"
          ? "AI credits exhausted. Add funds in Settings > Workspace > Usage."
          : msg === "NO_IMAGE_RETURNED"
          ? "The image model could not create this sprite, even after simplifying the prompt. Try a shorter character description with 1-2 key visual traits."
          : msg,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
