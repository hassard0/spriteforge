import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Style prompt templates — keyed by style ID
const STYLE_PROMPTS: Record<string, { keywords: string; negative: string }> = {
  'pixel-8bit': {
    keywords: 'pixel art, NES 8-bit style, very limited color palette of at most 8 colors, blocky pixels, retro game sprite, no anti-aliasing, no gradients, sharp pixel edges',
    negative: 'Do NOT use smooth gradients, anti-aliasing, or photo-realistic rendering.',
  },
  'pixel-16bit': {
    keywords: 'pixel art, 16-bit SNES style, rich color palette up to 32 colors, detailed pixel sprite, retro RPG style, clean pixel edges',
    negative: 'Do NOT use photo-realistic rendering or blurry anti-aliased edges.',
  },
  'hand-drawn-dark': {
    keywords: 'hand-drawn gothic art style, dark moody sketch, ink illustration, bold dark outlines, atmospheric, muted dark color palette',
    negative: 'Do NOT use bright cheerful colors, pixel art, or 3D rendering.',
  },
  'hand-drawn-bright': {
    keywords: 'hand-drawn cartoon, bright vibrant colors, thick black outlines, flat colors, whimsical playful style, cel-shaded cartoon',
    negative: 'Do NOT use dark moody tones, pixel art, or 3D rendering.',
  },
  'anime-cel': {
    keywords: 'anime style character, cel-shaded, vivid vibrant colors, large expressive eyes, smooth shading with hard shadow edges, Japanese animation style',
    negative: 'Do NOT use pixel art, western cartoon style, or photo-realistic rendering.',
  },
  'monochrome-silhouette': {
    keywords: 'monochrome silhouette, black and white only, dark shadow figure, minimalistic, dramatic backlight, absolutely no color',
    negative: 'Do NOT use any color. Only pure black and pure white.',
  },
  'vector-flat': {
    keywords: 'vector art style, simple geometric shapes, flat solid colors, no shading, clean crisp edges, modern minimalist illustration',
    negative: 'Do NOT use pixel art, gradients, realistic textures, or sketchy lines.',
  },
  'chibi-manga': {
    keywords: 'chibi manga style, cute exaggerated proportions, very large head, big round eyes, small body, kawaii, pastel colors',
    negative: 'Do NOT use realistic proportions, dark horror themes, or pixel art.',
  },
  'sketch-ink': {
    keywords: 'pen and ink sketch, loose hand-drawn lines, crosshatching, visible brush strokes, raw expressive illustration, black ink on white',
    negative: 'Do NOT use clean digital art, pixel art, or smooth gradients.',
  },
  'realistic-stylized': {
    keywords: 'stylized 3D character, smooth soft lighting, vibrant colors, exaggerated cartoon proportions, rounded shapes, Pixar-like quality',
    negative: 'Do NOT use pixel art, flat colors, sketch style, or photographic realism.',
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referenceImage, gridSize, viewingAngle, pose, frameCount, styleId } = await req.json();

    if (!referenceImage) {
      return new Response(JSON.stringify({ error: "Reference image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const size = parseInt(gridSize) || 32;
    const frames = Math.min(Math.max(frameCount || 1, 1), 4);
    const style = STYLE_PROMPTS[styleId || 'pixel-16bit'] || STYLE_PROMPTS['pixel-16bit'];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Analyze reference image
    const analysisPrompt = `Analyze this character image. Describe in detail:
1. The character's appearance (body shape, clothing, armor, accessories)
2. The exact colors used (list hex codes for skin, hair, outfit, accessories)
3. The art style
4. Any distinctive features

Be specific and concise. This description will be used to generate sprite art in a specific style.`;

    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              { type: "image_url", image_url: { url: referenceImage } },
            ],
          },
        ],
      }),
    });

    if (!analysisResponse.ok) {
      const errText = await analysisResponse.text();
      console.error("Analysis error:", analysisResponse.status, errText);
      throw new Error(`Image analysis failed (${analysisResponse.status})`);
    }

    const analysisResult = await analysisResponse.json();
    const characterDescription = analysisResult.choices?.[0]?.message?.content || "a game character";
    console.log("Character analysis:", characterDescription.substring(0, 200));

    // Step 2: Generate sprite with style-specific prompt
    const spriteWidth = size * frames;
    const spritePrompt = `Create a ${size}x${size} sprite image in the following art style.

ART STYLE: ${style.keywords}

CHARACTER: ${characterDescription}

REQUIREMENTS:
- ${frames > 1 ? `${frames} frames side by side horizontally (total image: ${spriteWidth}x${size} pixels)` : `Single ${size}x${size} sprite`}
- Viewing angle: ${viewingAngle}
- Pose/action: ${pose}
- CRITICAL: The background MUST be a flat, solid, uniform bright magenta color (#FF00FF) with NO variation, NO gradients, NO shadows, NO texture. Every single background pixel must be exactly #FF00FF.
- The character should fill most of the ${size}x${size} grid
- Do NOT use magenta (#FF00FF) anywhere on the character itself
${frames > 1 ? `- Each frame should show progressive ${pose} animation` : ''}
- Use the exact colors described above from the reference character
- ${style.negative}`;

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        max_tokens: 4096,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: spritePrompt,
          },
        ],
      }),
    });

    if (!imageResponse.ok) {
      const errText = await imageResponse.text();
      console.error("Image gen error:", imageResponse.status, errText);

      if (imageResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (imageResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Image generation failed (${imageResponse.status})`);
    }

    const imageResult = await imageResponse.json();

    // Extract generated image
    const choice = imageResult.choices?.[0];
    const message = choice?.message;
    let imageBase64: string | null = null;

    if (message?.images && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img?.image_url?.url) {
          imageBase64 = img.image_url.url;
          break;
        }
      }
    }

    if (!imageBase64 && message?.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part?.type === "image_url" && part?.image_url?.url) {
          imageBase64 = part.image_url.url;
          break;
        }
      }
    }

    if (!imageBase64) {
      console.error("No image in response. Message:", JSON.stringify(message).substring(0, 500));
      return new Response(JSON.stringify({
        error: "AI did not generate an image. Try again.",
        debug: typeof message?.content === "string" ? message.content.substring(0, 200) : "no text content",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Successfully generated image, base64 length:", imageBase64.length);

    return new Response(
      JSON.stringify({
        type: "generated-image",
        imageData: imageBase64,
        frameCount: frames,
        frameWidth: size,
        frameHeight: size,
        description: characterDescription.substring(0, 300),
        styleId: styleId || 'pixel-16bit',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("generate-sprite error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
