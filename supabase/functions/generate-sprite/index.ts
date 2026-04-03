import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3-flash-preview";
const BASE_IMAGE_MODEL = "google/gemini-2.5-flash-image";
const FRAME_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const MAX_GENERATED_FRAMES = 6;

// ── Pose descriptions per animation type ──

const WALK_POSES: Record<number, string[]> = {
  4: [
    "contact pose — left heel planted forward, right toe pushing off behind, right arm swung forward, left arm swung back, hips rotated",
    "passing pose — right knee lifted under the body, left leg supporting the weight, arms crossing the torso centerline, shoulders counter-rotated",
    "contact pose — right heel planted forward, left toe pushing off behind, left arm swung forward, right arm swung back, hips rotated opposite",
    "passing pose — left knee lifted under the body, right leg supporting the weight, arms crossing the torso centerline, shoulders counter-rotated opposite",
  ],
  6: [
    "contact pose — left heel strikes ground forward, right leg extended back on toe, right arm forward, left arm back, torso leaning slightly into motion",
    "down pose — weight settles onto the left leg, left knee bends, right foot peeling off the ground, arms passing through center",
    "passing pose — right thigh swings forward under the torso, left leg straight beneath body, elbows bent, shoulders twisted opposite the hips",
    "contact pose — right heel strikes ground forward, left leg extended back on toe, left arm forward, right arm back, torso leaning slightly into motion",
    "down pose — weight settles onto the right leg, right knee bends, left foot peeling off the ground, arms passing through center",
    "passing pose — left thigh swings forward under the torso, right leg straight beneath body, elbows bent, shoulders twisted opposite the hips",
  ],
};

const RUN_POSES: Record<number, string[]> = {
  4: [
    "contact pose — left foot striking under the body, right leg trailing long behind, right arm punching forward, left arm driving back, torso pitched forward aggressively",
    "flight pose — both feet fully airborne, right knee high in front, left leg stretched behind, elbows bent sharply, body lifted off the ground",
    "contact pose — right foot striking under the body, left leg trailing long behind, left arm punching forward, right arm driving back, torso pitched forward aggressively",
    "flight pose — both feet fully airborne, left knee high in front, right leg stretched behind, elbows bent sharply, body lifted off the ground",
  ],
  6: [
    "contact pose — left foot hits the ground beneath the hips, right leg fully extended behind, right arm driven forward near the face, left arm thrown back, torso steeply leaned forward",
    "compression pose — left knee bends under body weight, right knee surges upward, pelvis drops slightly, elbows reversing with force, cheeks and torso showing heavy momentum",
    "flight pose — both feet completely off the ground, right knee high and forward, left leg stretched behind, chest lifted slightly, sweat trailing backward",
    "contact pose — right foot hits the ground beneath the hips, left leg fully extended behind, left arm driven forward near the face, right arm thrown back, torso steeply leaned forward",
    "compression pose — right knee bends under body weight, left knee surges upward, pelvis drops slightly, elbows reversing with force, cheeks and torso showing heavy momentum",
    "flight pose — both feet completely off the ground, left knee high and forward, right leg stretched behind, chest lifted slightly, sweat trailing backward",
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
  return set[frameCount] || set[6] || set[4];
}

function normalizeFrameCount(frameCount: number): 4 | 6 {
  return frameCount <= 4 ? 4 : 6;
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

async function callImageModel(apiKey: string, prompt: string, referenceImages: string[] = [], model = BASE_IMAGE_MODEL): Promise<string | null> {
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBaseCharacterPrompt(
  characterPrompt: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
): string {
  return `Create one full-body character sprite on a plain solid-color background.

Character: ${characterPrompt}
Style: ${styleDesc}
Colors: ${paletteDesc}
Facing: ${facingDirection}

CRITICAL RULES:
- Draw exactly one character and nothing else.
- Neutral standing pose, readable silhouette, full body visible including feet and hands.
- Keep the character centered with a small margin around the body.
- Use a plain flat solid-color background.
- No border, no frame layout, no shadow box, no text, no label.`;
}

function buildFramePrompt(
  characterPrompt: string,
  animationType: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
  frameIndex: number,
  frameCount: number,
  pose: string,
): string {
  const motionNotes: Record<string, string> = {
    run: "Show a powerful running silhouette with strong arm-leg opposition, visible torso bob, airborne lift where appropriate, and secondary motion like sweat, cloth bounce, or hair drag.",
    walk: "Show a readable walk cycle with alternating contact and passing poses, clear hip and shoulder counter-rotation, and obvious foot placement changes.",
    idle: "Keep the character mostly still but add subtle breathing, shoulder movement, and tiny body shifts.",
    attack: "Make the attack pose directional and forceful with clear anticipation, impact, and recovery.",
    jump: "Show a clear arc from crouch to launch to peak to landing with obvious leg compression and extension.",
    death: "Show a dramatic loss of balance and collapse with strong silhouette changes in each frame.",
  };

  return `Using the reference image as the exact same character, create one isolated animation frame.

Character: ${characterPrompt}
Style: ${styleDesc}
Colors: ${paletteDesc}
Facing: ${facingDirection}
Animation: ${animationType}
Frame ${frameIndex + 1} of ${frameCount}
Pose instruction: ${pose}

CRITICAL RULES:
- Keep the exact same character identity, body shape, outfit, colors, facial features, and proportions as the reference image.
- Show a clearly different pose from the previous and next frame in the cycle.
- Full body visible, centered, same approximate scale, feet near the same ground line.
- Strong readable silhouette at sprite size.
- Plain flat solid-color background only.
- No text, labels, borders, props, scenery, or multiple characters.
- ${motionNotes[animationType] || motionNotes.idle}
- The limbs must visibly move: arms swing, legs alternate, torso and hips twist naturally, and the pose must not look static.`;
}

async function generateFrameFromReference(
  apiKey: string,
  baseImage: string,
  characterPrompt: string,
  animationType: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
  frameIndex: number,
  frameCount: number,
  pose: string,
): Promise<string | null> {
  const prompt = buildFramePrompt(
    characterPrompt,
    animationType,
    styleDesc,
    paletteDesc,
    facingDirection,
    frameIndex,
    frameCount,
    pose,
  );

  let frame = await callImageModel(apiKey, prompt, [baseImage], FRAME_IMAGE_MODEL);
  if (frame) return frame;

  await sleep(700);

  const retryPrompt = `Create one sprite animation frame from the reference image. Same character, same body type, same outfit, same colors. ${pose}. ${animationType} motion must be obvious with different arm and leg positions. Plain background.`;
  frame = await callImageModel(apiKey, retryPrompt, [baseImage], FRAME_IMAGE_MODEL);
  if (frame) return frame;

  await sleep(700);
  return callImageModel(apiKey, retryPrompt, [baseImage], BASE_IMAGE_MODEL);
}

async function generateAnimationFrames(
  apiKey: string,
  baseImage: string,
  characterPrompt: string,
  animationType: string,
  styleDesc: string,
  paletteDesc: string,
  facingDirection: string,
  poses: string[],
): Promise<string[] | null> {
  const frames: string[] = [];
  const batchSize = 2;

  for (let start = 0; start < poses.length; start += batchSize) {
    const batch = poses.slice(start, start + batchSize);
    const generated = await Promise.all(
      batch.map((pose, offset) =>
        generateFrameFromReference(
          apiKey,
          baseImage,
          characterPrompt,
          animationType,
          styleDesc,
          paletteDesc,
          facingDirection,
          start + offset,
          poses.length,
          pose,
        )
      )
    );

    if (generated.some((frame) => !frame)) {
      return null;
    }

    frames.push(...(generated as string[]));

    if (start + batchSize < poses.length) {
      await sleep(500);
    }
  }

  return frames;
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
    const totalFrames = normalizeFrameCount(Math.min(Math.max(1, Math.round(Number(frameCount) || 1)), MAX_GENERATED_FRAMES));
    const styleDesc = style === "pixel-art" ? "pixel art" : style === "chibi" ? "chibi" : "cel-shaded";
    const paletteDesc = palette === "nes" ? "NES color palette" : palette === "snes" ? "SNES palette" : palette === "gameboy" ? "Game Boy 4-shade green" : "vibrant colors";
    const poses = getPosesForAnimation(animationType, totalFrames);

    let characterPrompt = prompt.trim();

    console.log(`Generating base character for ${totalFrames}-frame ${animationType} animation...`);
    const basePrompt = buildBaseCharacterPrompt(characterPrompt, styleDesc, paletteDesc, facingDirection);
    let baseImage = await callImageModel(LOVABLE_API_KEY, basePrompt, [], BASE_IMAGE_MODEL);

    if (!baseImage) {
      console.log("Base character attempt failed, retrying with simplified prompt...");
      await sleep(1200);
      const simpleBasePrompt = `Create one ${styleDesc} game character sprite of ${characterPrompt}. Facing ${facingDirection}. Neutral standing pose. ${paletteDesc}. Plain background.`;
      baseImage = await callImageModel(LOVABLE_API_KEY, simpleBasePrompt, [], BASE_IMAGE_MODEL);
    }

    if (!baseImage) {
      const rewritten = await simplifySpritePrompt(LOVABLE_API_KEY, characterPrompt, animationType, facingDirection);
      if (rewritten) {
        characterPrompt = rewritten;
        console.log("Retrying base character with rewritten prompt...");
        const retryBasePrompt = buildBaseCharacterPrompt(characterPrompt, styleDesc, paletteDesc, facingDirection);
        baseImage = await callImageModel(LOVABLE_API_KEY, retryBasePrompt, [], BASE_IMAGE_MODEL);
      }
    }

    if (!baseImage) {
      throw new Error("NO_IMAGE_RETURNED");
    }

    console.log(`Generating ${totalFrames} motion frames from base character...`);
    const frames = await generateAnimationFrames(
      LOVABLE_API_KEY,
      baseImage,
      characterPrompt,
      animationType,
      styleDesc,
      paletteDesc,
      facingDirection,
      poses,
    );

    if (!frames) {
      throw new Error("NO_IMAGE_RETURNED");
    }

    console.log("Animation frames generated successfully");

    return new Response(
      JSON.stringify({
        frames,
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
