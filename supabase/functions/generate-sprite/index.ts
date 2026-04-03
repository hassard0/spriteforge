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
    const { prompt, animationType, style, palette, resolution, frameCount, facingDirection } = await req.json();

    if (!prompt || !animationType || !resolution || !frameCount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const fw = parseInt(resolution);
    const paletteDesc = palette === 'nes' ? 'NES 54-color palette' :
      palette === 'snes' ? 'SNES 256-color palette' :
      palette === 'gameboy' ? 'Game Boy 4-shade green palette' :
      'vibrant custom palette';
    const styleDesc = style === 'pixel-art' ? 'pixel art' :
      style === 'chibi' ? 'chibi style' : 'cel-shaded';

    const aiPrompt = `Create a ${styleDesc} sprite sheet for a game character: ${prompt}. 
The sprite sheet should show a "${animationType}" animation with exactly ${frameCount} frames arranged in a single horizontal row.
Each frame is ${fw}x${fw} pixels. The total image should be ${fw * frameCount}x${fw} pixels.
Use a ${paletteDesc}. The character should face ${facingDirection}.
The background of each frame should be transparent or a single solid dark color.
Make it look like a professional retro game sprite sheet. Each frame should show a slightly different pose for the ${animationType} animation cycle.`;

    console.log("Generating sprite with prompt:", aiPrompt.slice(0, 100));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: aiPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", status, errorText);
      throw new Error(`AI gateway returned ${status}`);
    }

    const data = await response.json();
    console.log("AI response keys:", JSON.stringify(Object.keys(data)));
    console.log("Choices count:", data.choices?.length);
    
    const message = data.choices?.[0]?.message;
    console.log("Message keys:", message ? JSON.stringify(Object.keys(message)) : "no message");
    
    // Try multiple possible image locations in the response
    let imageUrl = message?.images?.[0]?.image_url?.url;
    
    // Some models return inline image content differently
    if (!imageUrl && message?.content) {
      // Check if content itself contains a data URI
      const match = typeof message.content === 'string' 
        ? message.content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/)
        : null;
      if (match) {
        imageUrl = match[1];
      }
    }
    
    // Check for image in multimodal content array
    if (!imageUrl && Array.isArray(message?.content)) {
      const imgPart = message.content.find((p: any) => p.type === 'image_url' || p.type === 'image');
      imageUrl = imgPart?.image_url?.url || imgPart?.url;
    }

    if (!imageUrl) {
      console.error("Full AI response:", JSON.stringify(data).slice(0, 2000));
      throw new Error("No image returned from AI model. The model may have declined the request.");
    }

    return new Response(
      JSON.stringify({ imageData: imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-sprite error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
