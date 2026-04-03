import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

async function generateImage(apiKey: string, prompt: string, referenceImage?: string): Promise<string | null> {
  const content: any[] = [{ type: "text", text: prompt }];

  if (referenceImage) {
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
      model: "google/gemini-3.1-flash-image-preview",
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

  // Log response structure for debugging
  const finishReason = data.choices?.[0]?.finish_reason;
  console.log("AI response:", JSON.stringify({
    messageKeys: message ? Object.keys(message) : [],
    hasImages: !!message?.images,
    imagesLen: message?.images?.length,
    contentType: typeof message?.content,
    contentIsArray: Array.isArray(message?.content),
    finishReason,
  }));

  if (finishReason === "content_filter" || finishReason === "safety") {
    console.warn("Content was filtered by AI safety");
    return null;
  }

  // Extract image from response - try all known paths
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

// Animation pose descriptions for each type
const POSE_GUIDES: Record<string, (frame: number, total: number) => string> = {
  idle: (f, t) => {
    const phase = f / t;
    const breathe = Math.sin(phase * Math.PI * 2);
    return breathe > 0
      ? `standing still, slight upward breathing motion, relaxed pose, frame ${f + 1} of ${t}`
      : `standing still, slight downward breathing motion, relaxed pose, frame ${f + 1} of ${t}`;
  },
  walk: (f, t) => {
    const phase = WALK_PHASES[Math.floor((f / t) * WALK_PHASES.length) % WALK_PHASES.length];
    return `walking cycle, ${phase}, frame ${f + 1} of ${t}`;
  },
  run: (f, t) => {
    const phase = RUN_PHASES[Math.floor((f / t) * RUN_PHASES.length) % RUN_PHASES.length];
    return `running cycle, ${phase}, frame ${f + 1} of ${t}`;
  },
  attack: (f, t) => {
    const poses = ["winding up arm pulled back", "mid-swing arm moving forward", "full extension striking forward", "follow through arm extended", "recovering returning to stance"];
    return `attack animation, ${poses[f % poses.length]}, frame ${f + 1} of ${t}`;
  },
  jump: (f, t) => {
    const phase = f / (t - 1);
    if (phase < 0.2) return `crouching down preparing to jump, frame ${f + 1} of ${t}`;
    if (phase < 0.5) return `rising upward arms up jumping, frame ${f + 1} of ${t}`;
    if (phase < 0.8) return `at peak of jump floating, frame ${f + 1} of ${t}`;
    return `descending legs down landing, frame ${f + 1} of ${t}`;
  },
  death: (f, t) => {
    const phase = f / (t - 1);
    if (phase < 0.3) return `hit reaction flinching backward, frame ${f + 1} of ${t}`;
    if (phase < 0.6) return `falling over tilting sideways, frame ${f + 1} of ${t}`;
    return `collapsed on ground lying flat, frame ${f + 1} of ${t}`;
  },
};

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
    const styleDesc = style === "pixel-art" ? "pixel art" : style === "chibi" ? "chibi" : "cel-shaded";
    const paletteDesc = palette === "nes" ? "NES color palette" : palette === "snes" ? "SNES palette" : palette === "gameboy" ? "Game Boy 4-shade green" : "vibrant colors";

    // STEP 1: Generate base character image
    console.log("Step 1: Generating base character...");
    const basePrompt = `Create a single ${styleDesc} game character sprite: ${prompt}.
Standing in a neutral pose facing ${facingDirection}. ${fw}x${fw} pixel resolution.
Use ${paletteDesc}. ${FRAMING_RULES}.
This is a game sprite for animation, so make it clear, iconic, readable at small size, and keep the character framed consistently.`;

    let baseImage = await generateImage(LOVABLE_API_KEY, basePrompt);

    // Retry once with a simpler prompt if the first attempt failed
    if (!baseImage) {
      console.log("First attempt failed, retrying with simplified prompt...");
      await new Promise((r) => setTimeout(r, 1500));
      const simplePrompt = `Generate a ${styleDesc} game character sprite: ${prompt}. Neutral standing pose facing ${facingDirection}. ${fw}x${fw} pixels. ${paletteDesc}. Plain background.`;
      baseImage = await generateImage(LOVABLE_API_KEY, simplePrompt);
    }

    if (!baseImage) {
      throw new Error("Failed to generate base character. Try a different description.");
    }
    console.log("Base character generated successfully");

    // STEP 2: Generate each animation frame using image-to-image
    const frames: string[] = [];
    const getPose = POSE_GUIDES[animationType] || POSE_GUIDES.idle;

    // We'll limit concurrent requests to avoid rate limiting
    for (let i = 0; i < frameCount; i++) {
      const poseDesc = getPose(i, frameCount);
      console.log(`Step 2: Generating frame ${i + 1}/${frameCount}: ${poseDesc.slice(0, 60)}`);

      const framePrompt = `Edit this exact ${styleDesc} game character sprite into animation frame ${i + 1} of ${frameCount}: ${poseDesc}.
Keep the SAME character design, face, outfit, colors, proportions, and ${styleDesc} style.
Keep the framing locked: ${FRAMING_RULES}. Same ${fw}x${fw} pixel size.
Only change the body pose slightly from the reference to create smooth frame-by-frame motion.
Do not redesign the character, do not add new details, and do not create a sprite sheet.`;

      let frameImage: string | null = null;
      let retries = 0;
      
      while (!frameImage && retries < 2) {
        try {
          const referenceImage = i === 0 ? baseImage : frames[i - 1];
          // Small delay between requests to avoid rate limiting
          if (i > 0 || retries > 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }
          frameImage = await generateImage(LOVABLE_API_KEY, framePrompt, referenceImage);
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

      // Fall back to base image if frame generation fails
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

    return new Response(
      JSON.stringify({
        error: msg === "RATE_LIMITED"
          ? "Rate limited. Please try again in a moment."
          : msg === "CREDITS_EXHAUSTED"
          ? "AI credits exhausted. Add funds in Settings > Workspace > Usage."
          : msg,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
