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
    const frames = Math.min(Math.max(frameCount || 1, 1), 8);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt for Gemini vision
    const systemPrompt = `You are a pixel art sprite generator. You will analyze a reference character image and produce pixel art grid data.

TASK:
1. Analyze the reference image to identify the character, their colors, and key visual features.
2. Extract a color palette (max 16 colors including transparent as index 0).
3. Generate ${frames} frame(s) of pixel art on a ${size}x${size} grid showing the character in the specified pose and viewing angle.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "palette": ["transparent", "#hex1", "#hex2", ...],
  "frames": [[0,1,2,...], [0,1,2,...], ...],
  "description": "Brief description of what was generated"
}

RULES:
- palette[0] MUST be "transparent" (background)
- Each frame is a flat array of ${size * size} palette indices (row by row, left to right, top to bottom)
- The sprite should be centered in the grid with transparent padding
- Use the colors from the reference image as closely as possible
- For animation frames, show progressive motion (e.g., for walking: legs alternate, arms swing)
- The character should face the specified viewing angle
- Match the pose/action specified
- Keep the pixel art style clean with clear outlines
- For larger grids (128+), add more detail like shading, highlights, and anti-aliasing with palette colors

VIEWING ANGLE: ${viewingAngle}
POSE/ACTION: ${pose}
GRID: ${size}x${size}
FRAMES: ${frames}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Generate a ${size}x${size} pixel art sprite sheet with ${frames} frame(s). The character should be shown from a ${viewingAngle} angle in a ${pose} pose. Analyze the reference image for colors and character design. Return ONLY valid JSON.`,
              },
              {
                type: "image_url",
                image_url: { url: referenceImage },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway returned ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from the response (strip markdown fences if present)
    let jsonStr = content;
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1];
    }
    jsonStr = jsonStr.trim();

    let parsed: { palette: string[]; frames: number[][]; description?: string };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "AI returned invalid data. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate
    if (!Array.isArray(parsed.palette) || !Array.isArray(parsed.frames) || parsed.frames.length === 0) {
      return new Response(JSON.stringify({ error: "AI returned incomplete sprite data." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure palette[0] is transparent
    if (parsed.palette[0] !== "transparent") {
      parsed.palette.unshift("transparent");
    }

    // Clamp frame data to valid palette indices
    const maxIdx = parsed.palette.length - 1;
    const expectedPixels = size * size;
    parsed.frames = parsed.frames.map((frame) => {
      const arr = Array.isArray(frame) ? frame : [];
      const padded = new Array(expectedPixels).fill(0);
      for (let i = 0; i < Math.min(arr.length, expectedPixels); i++) {
        const v = typeof arr[i] === "number" ? arr[i] : 0;
        padded[i] = Math.max(0, Math.min(v, maxIdx));
      }
      return padded;
    });

    return new Response(
      JSON.stringify({
        type: "pixel-data",
        palette: parsed.palette,
        frames: parsed.frames,
        frameCount: parsed.frames.length,
        frameWidth: size,
        frameHeight: size,
        logicalFrameWidth: size,
        logicalFrameHeight: size,
        description: parsed.description || "",
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
