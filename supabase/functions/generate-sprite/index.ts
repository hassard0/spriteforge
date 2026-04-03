import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_GENERATED_FRAMES = 6;
const TEXT_MODEL = "google/gemini-3-flash-preview";

const WALK_PHASES = [
  "contact pose, left heel forward, right leg pushing back, right arm forward, left arm back",
  "down pose, weight settling on left leg, torso slightly lowered, arms mid-swing",
  "passing pose, right knee crossing under body, torso upright, arms passing center",
  "up pose, body lifted slightly, right knee coming forward, left heel lifting",
  "contact pose, right heel forward, left leg pushing back, left arm forward, right arm back",
  "down pose, weight settling on right leg, torso slightly lowered, arms mid-swing",
  "passing pose, left knee crossing under body, torso upright, arms passing center",
  "up pose, body lifted slightly, left knee coming forward, right heel lifting",
];

const RUN_PHASES = [
  "left foot contact, body leaning forward, right leg stretched behind, right arm driving forward",
  "compression pose, left leg bent under body, torso lowered, arms pumping",
  "flight pose, both feet off ground, right knee driving forward, left leg trailing",
  "high point, torso lifted, right thigh high, left arm forward, right arm back",
  "right foot contact, body leaning forward, left leg stretched behind, left arm driving forward",
  "compression pose, right leg bent under body, torso lowered, arms pumping",
  "flight pose, both feet off ground, left knee driving forward, right leg trailing",
  "high point, torso lifted, left thigh high, right arm forward, left arm back",
];

const FRAMING_RULES = "single full-body sprite only, centered in frame, same camera distance, same sprite scale, same ground line, same silhouette proportions, no duplicate character, no extra limbs, no weapon changes, plain flat background";

function extractTextContent(message: any): string | null {
  if (!message?.content) return null;
  if (typeof message.content === "string") return message.content.trim() || null;
  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
      .map((part: any) => part.text.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    return text || null;
  }

  return null;
}

async function simplifySpritePrompt(apiKey: string, prompt: string, animationType: string, facingDirection: string): Promise<string | null> {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content: "You rewrite game sprite requests into safe, concise, production-ready image prompts. Keep the core subject, body type, motion, and major visual traits when possible. Remove nudity, sexual content, and overly complex wording. If clothing is missing, add simple practical clothing. Return exactly one short sentence and nothing else.",
        },
        {
          role: "user",
          content: `Rewrite this sprite request into a safe, concise game-character description for image generation. Preserve the subject and action where possible. Animation type: ${animationType}. Facing: ${facingDirection}. Original request: ${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error(`Prompt rewrite API error ${response.status}:`, txt.slice(0, 500));
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    return null;
  }

  const data = await response.json();
  const rewrittenPrompt = extractTextContent(data.choices?.[0]?.message)
    ?.replace(/^['"\s]+|['"\s]+$/g, "")
    .slice(0, 220);

  console.log("Prompt rewrite:", JSON.stringify({
    originalPreview: prompt.slice(0, 120),
    rewrittenPreview: rewrittenPrompt ?? null,
  }));

  return rewrittenPrompt && rewrittenPrompt !== prompt ? rewrittenPrompt : null;
}

async function generateImage(apiKey: string, prompt: string, referenceImages: string[] = []): Promise<string | null> {
  const content: any[] = [{ type: "text", text: prompt }];

  for (const referenceImage of referenceImages.filter(Boolean)) {
    content.push({
      type: "image_url",
      image_url: { url: referenceImage },
    });
  }

  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
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
  const message = data.choices?.[0]?.message;
  const refusal = message?.refusal;

  const finishReason = data.choices?.[0]?.finish_reason;
  console.log("AI response:", JSON.stringify({
    messageKeys: message ? Object.keys(message) : [],
    hasImages: !!message?.images,
    imagesLen: message?.images?.length,
    hasRefusal: !!refusal,
    refusalPreview: typeof refusal === "string" ? refusal.slice(0, 160) : null,
    contentType: typeof message?.content,
    contentIsArray: Array.isArray(message?.content),
    finishReason,
  }));

  if (finishReason === "content_filter" || finishReason === "safety") {
    console.warn("Content was filtered by AI safety");
    return null;
  }

  let url = message?.images?.[0]?.image_url?.url;
  if (!url && typeof message?.content === "string") {
    const m = message.content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
    if (m) url = m[1];
  }
  if (!url && Array.isArray(message?.content)) {
    const img = message.content.find((p: any) => p.type === "image_url" || p.type === "image");
    url = img?.image_url?.url || img?.url;
  }

  return url || null;
}

const POSE_GUIDES: Record<string, (frame: number, total: number) => string> = {
  idle: (f, t) => {
    const phase = f / t;
    const breathe = Math.sin(phase * Math.PI * 2);
    return breathe > 0
      ? `standing still, chest slightly lifted, shoulders slightly raised, arms relaxed with tiny sway, frame ${f + 1} of ${t}`
      : `standing still, chest slightly lowered, shoulders relaxed, arms relaxed with tiny sway, frame ${f + 1} of ${t}`;
  },
  walk: (f, t) => {
    const phase = WALK_PHASES[Math.floor((f / t) * WALK_PHASES.length) % WALK_PHASES.length];
    return `walking cycle, ${phase}, left and right limbs clearly offset in opposite directions, frame ${f + 1} of ${t}`;
  },
  run: (f, t) => {
    const phase = RUN_PHASES[Math.floor((f / t) * RUN_PHASES.length) % RUN_PHASES.length];
    return `running cycle, ${phase}, strong arm pump, clear stride separation, forward-leaning athletic motion, frame ${f + 1} of ${t}`;
  },
  attack: (f, t) => {
    const poses = ["winding up with striking arm pulled far back and chest twisted", "mid-swing with shoulders rotating forward", "full extension striking forward with weight committed", "follow through with torso carried past center", "recovering back into stance with arms resetting"];
    return `attack animation, ${poses[f % poses.length]}, frame ${f + 1} of ${t}`;
  },
  jump: (f, t) => {
    const phase = f / (t - 1);
    if (phase < 0.2) return `crouching low preparing to jump, knees bent, arms down and back, frame ${f + 1} of ${t}`;
    if (phase < 0.5) return `rising upward, legs extending, arms lifting, frame ${f + 1} of ${t}`;
    if (phase < 0.8) return `at peak of jump, body stretched upward, frame ${f + 1} of ${t}`;
    return `descending to land, knees preparing to absorb impact, arms dropping, frame ${f + 1} of ${t}`;
  },
  death: (f, t) => {
    const phase = f / (t - 1);
    if (phase < 0.3) return `hit reaction, torso jerking backward, arms losing control, frame ${f + 1} of ${t}`;
    if (phase < 0.6) return `falling over with weight collapsing sideways, frame ${f + 1} of ${t}`;
    return `collapsed on ground, limbs slack, frame ${f + 1} of ${t}`;
  },
};

function getSecondaryMotion(animationType: string): string {
  switch (animationType) {
    case "idle":
      return "tiny breathing motion in the chest and shoulders, with a subtle cloth or hair sway";
    case "walk":
      return "gentle vertical body bob, shoulders twisting opposite the hips, and light cloth or hair sway";
    case "run":
      return "strong vertical body bob, shoulders twisting opposite the hips, slight cloth or hair bounce, and a few small sweat droplets near the head to show exertion";
    case "attack":
      return "clear torso twist, shoulder rotation, and trailing secondary motion in clothing or hair";
    case "jump":
      return "upward lift in clothing or hair during ascent and compressed impact on landing";
    case "death":
      return "progressive loss of tension so the limbs feel heavier and looser each frame";
    default:
      return "natural secondary motion that supports the pose without changing the character design";
  }
}

type FramePromptOptions = {
  animationType: string;
  characterPrompt: string;
  frameIndex: number;
  totalFrames: number;
  poseDesc: string;
  previousPoseDesc: string | null;
  styleDesc: string;
  frameSize: number;
};

function buildFramePrompt({
  animationType,
  characterPrompt,
  frameIndex,
  totalFrames,
  poseDesc,
  previousPoseDesc,
  styleDesc,
  frameSize,
}: FramePromptOptions): string {
  const locomotionRule = animationType === "walk" || animationType === "run"
    ? "Arms must counter-swing opposite the legs, with one side forward while the other side moves back."
    : "The body posture must clearly advance through the action from the previous frame.";

  return `Create the NEXT animation frame for this exact ${styleDesc} sprite character.
Reference image 1 is the canonical character design.${previousPoseDesc ? " Reference image 2 is the previous animation frame." : ""}

DO NOT keep the same pose as the reference image.
This frame must show clear visible movement in the limbs and body.

Target animation: ${animationType}.
Previous frame pose: ${previousPoseDesc ?? "base character pose"}.
New target pose for frame ${frameIndex + 1} of ${totalFrames}: ${poseDesc}.

Required body changes:
- Move the left arm and right arm into visibly different positions.
- Move the left leg and right leg into visibly different positions.
- Change the torso angle, shoulder line, and head height to match the action.
- Make the silhouette clearly different from the previous frame while preserving the same character.
- ${locomotionRule}
- Add this secondary motion: ${getSecondaryMotion(animationType)}.

Character description: ${characterPrompt}.
Keep the exact same face, outfit, colors, proportions, and overall character identity.
Keep the framing locked: ${FRAMING_RULES}. Same ${frameSize}x${frameSize} pixel size.
Output one single full-body sprite frame only. No sprite sheet, no duplicate character, no redesign.`;
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

    const fw = parseInt(resolution);
    const requestedFrameCount = Math.max(1, Math.round(Number(frameCount) || 1));
    const totalFrames = Math.min(requestedFrameCount, MAX_GENERATED_FRAMES);
    const styleDesc = style === "pixel-art" ? "pixel art" : style === "chibi" ? "chibi" : "cel-shaded";
    const paletteDesc = palette === "nes" ? "NES color palette" : palette === "snes" ? "SNES palette" : palette === "gameboy" ? "Game Boy 4-shade green" : "vibrant colors";
    const getPose = POSE_GUIDES[animationType] || POSE_GUIDES.idle;
    const openingPose = getPose(0, totalFrames);
    const buildBasePrompt = (characterPrompt: string) => `Create a single ${styleDesc} game character sprite: ${characterPrompt}.
Pose: ${openingPose}. Facing ${facingDirection}. ${fw}x${fw} pixel resolution.
Use ${paletteDesc}. ${FRAMING_RULES}.
This is a game sprite for animation, so make it clear, iconic, readable at small size, and keep the character framed consistently.`;
    const buildSimplePrompt = (characterPrompt: string) => `Generate a ${styleDesc} game character sprite: ${characterPrompt}. Pose ${openingPose}. Facing ${facingDirection}. ${fw}x${fw} pixels. ${paletteDesc}. Plain background.`;

    console.log("Step 1: Generating base character...");
    let characterPrompt = prompt.trim();

    let baseImage = await generateImage(LOVABLE_API_KEY, buildBasePrompt(characterPrompt));

    if (!baseImage) {
      console.log("First attempt failed, retrying with simplified prompt...");
      await new Promise((r) => setTimeout(r, 1500));
      baseImage = await generateImage(LOVABLE_API_KEY, buildSimplePrompt(characterPrompt));
    }

    if (!baseImage) {
      const rewrittenPrompt = await simplifySpritePrompt(LOVABLE_API_KEY, characterPrompt, animationType, facingDirection);

      if (rewrittenPrompt) {
        characterPrompt = rewrittenPrompt;
        console.log("Retrying base generation with rewritten prompt...");
        baseImage = await generateImage(LOVABLE_API_KEY, buildBasePrompt(characterPrompt));

        if (!baseImage) {
          await new Promise((r) => setTimeout(r, 1500));
          baseImage = await generateImage(LOVABLE_API_KEY, buildSimplePrompt(characterPrompt));
        }
      }
    }

    if (!baseImage) {
      throw new Error("NO_IMAGE_RETURNED");
    }
    console.log("Base character generated successfully");

    const frames: string[] = [baseImage];

    for (let i = 1; i < totalFrames; i++) {
      const poseDesc = getPose(i, totalFrames);
      const previousPoseDesc = getPose(i - 1, totalFrames);
      console.log(`Step 2: Generating frame ${i + 1}/${totalFrames}: ${poseDesc.slice(0, 60)}`);

      const framePrompt = buildFramePrompt({
        animationType,
        characterPrompt,
        frameIndex: i,
        totalFrames,
        poseDesc,
        previousPoseDesc,
        styleDesc,
        frameSize: fw,
      });

      let frameImage: string | null = null;
      let retries = 0;

      while (!frameImage && retries < 2) {
        try {
          const referenceImages = i === 1 ? [baseImage] : [baseImage, frames[i - 1]];
          if (i > 0 || retries > 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }
          frameImage = await generateImage(LOVABLE_API_KEY, framePrompt, referenceImages);
        } catch (e) {
          if ((e as Error).message === "RATE_LIMITED") {
            console.log("Rate limited, waiting 3s...");
            await new Promise((r) => setTimeout(r, 3000));
            retries++;
          } else {
            throw e;
          }
        }
      }

      frames.push(frameImage || frames[i - 1] || baseImage);
    }

    console.log(`Generated ${frames.length} frames successfully`);

    return new Response(
      JSON.stringify({
        baseImage,
        frames,
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
