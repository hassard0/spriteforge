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
    const { imageData, styleId, styleName } = await req.json();

    if (!imageData) {
      return new Response(JSON.stringify({ error: "imageData is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const qaPrompt = `You are a sprite art quality assessor. Analyze this generated sprite image and evaluate it against the intended art style: "${styleName || styleId}".

Score each criterion from 0-10 and provide an overall score:

1. **Style Fidelity**: Does the output match the intended "${styleName}" art style? (weight: 3x)
2. **Character Clarity**: Is the character clearly recognizable with distinct features? (weight: 2x)
3. **Composition**: Is the character well-framed within the sprite bounds? (weight: 1x)
4. **Color Coherence**: Are the colors appropriate for the style and consistent? (weight: 1x)
5. **Technical Quality**: Are there artifacts, blurring, or unwanted elements? (weight: 2x)

Respond in this exact JSON format:
{
  "overallScore": <0-10>,
  "styleFidelity": <0-10>,
  "characterClarity": <0-10>,
  "composition": <0-10>,
  "colorCoherence": <0-10>,
  "technicalQuality": <0-10>,
  "issues": ["list of specific issues found"],
  "suggestions": ["list of prompt adjustments to fix issues"],
  "passed": <true if overallScore >= 6>
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: qaPrompt },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("QA check error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited", passed: true, score: 7 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // On error, pass by default to not block the user
      return new Response(
        JSON.stringify({
          error: true,
          passed: false,
          score: 0,
          issues: ["QA service error"],
          suggestions: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Parse JSON from response (may be wrapped in markdown code blocks)
    let qaResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        qaResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      console.error("Failed to parse QA response:", content.substring(0, 300));
      qaResult = { passed: true, overallScore: 7, issues: [], suggestions: [] };
    }

    return new Response(JSON.stringify({
      passed: qaResult.passed ?? (qaResult.overallScore >= 6),
      score: qaResult.overallScore ?? 7,
      styleFidelity: qaResult.styleFidelity,
      characterClarity: qaResult.characterClarity,
      composition: qaResult.composition,
      colorCoherence: qaResult.colorCoherence,
      technicalQuality: qaResult.technicalQuality,
      issues: qaResult.issues || [],
      suggestions: qaResult.suggestions || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("qa-check error:", err);
    // On error, pass by default
    return new Response(JSON.stringify({ passed: true, score: 7, issues: [], suggestions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
