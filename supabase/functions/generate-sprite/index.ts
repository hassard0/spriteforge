import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referenceImage, gridSize, viewingAngle, pose, frameCount } = await req.json();

    if (!referenceImage) {
      return new Response(JSON.stringify({ error: "Reference image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const size = parseInt(gridSize) || 32;
    const frames = Math.min(Math.max(frameCount || 1, 1), 4);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Use vision model to analyze the reference image and describe it
    const analysisPrompt = `Analyze this character image. Describe in detail:
1. The character's appearance (body shape, clothing, armor, accessories)
2. The exact colors used (list hex codes for skin, hair, outfit, accessories)
3. The art style
4. Any distinctive features

Be specific and concise. This description will be used to generate pixel art.`;

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

    // Step 2: Generate pixel art sprite image using image generation model
    const spriteWidth = size * frames;
    const spritePrompt = `Create a ${size}x${size} pixel art sprite sheet image.

CHARACTER: ${characterDescription}

REQUIREMENTS:
- Pixel art style with a clean ${size}x${size} pixel grid
- ${frames > 1 ? `${frames} animation frames side by side horizontally (total image: ${spriteWidth}x${size} pixels)` : `Single ${size}x${size} sprite`}
- Viewing angle: ${viewingAngle}
- Pose/action: ${pose}
- CRITICAL: The background MUST be a flat, solid, uniform bright magenta color (#FF00FF) with NO variation, NO gradients, NO shadows, NO texture. Every single background pixel must be exactly #FF00FF.
- Sharp pixel edges, no anti-aliasing, no blur, no soft edges between sprite and background
- Each pixel should be clearly defined as a single solid color
- The character should fill most of the ${size}x${size} grid
- Do NOT use magenta (#FF00FF) anywhere on the character itself
${frames > 1 ? `- Each frame should show progressive ${pose} animation` : ''}
- Use the exact colors described above from the reference character`;

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
      throw new Error(`Image generation failed (${imageResponse.status})`);
    }

    const imageResult = await imageResponse.json();
    console.log("Image gen response keys:", JSON.stringify(Object.keys(imageResult)));

    // Extract the generated image from the response
    const choice = imageResult.choices?.[0];
    const message = choice?.message;

    let imageBase64: string | null = null;

    // Primary format: message.images[] array
    if (message?.images && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img?.image_url?.url) {
          imageBase64 = img.image_url.url;
          break;
        }
      }
    }

    // Fallback: check content array
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

    console.log("Successfully got image, base64 length:", imageBase64.length);

    return new Response(
      JSON.stringify({
        type: "generated-image",
        imageData: imageBase64,
        frameCount: frames,
        frameWidth: size,
        frameHeight: size,
        description: characterDescription.substring(0, 300),
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
