import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 8;

interface SpriteRequest {
  referenceImage: string;
  gridSize: string;
  viewingAngle: string;
  pose: string;
  frameCount: number;
  styleId?: string;
  styleKeywords?: string;
  styleNegative?: string;
  palette?: { id?: string; colors?: string[] };
}

async function callImageModel(
  apiKey: string,
  prompt: string,
): Promise<string | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      max_tokens: 4096,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Image gen error:", resp.status, errText);
    const err: any = new Error(`Image generation failed (${resp.status})`);
    err.status = resp.status;
    throw err;
  }

  const result = await resp.json();
  const message = result.choices?.[0]?.message;
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
  return imageBase64;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function stitchBatches(
  batchDataUrls: string[],
  frameSize: number,
  framesPerBatch: number[],
  totalFrames: number,
): Promise<string> {
  const totalWidth = frameSize * totalFrames;
  const stitched = new Image(totalWidth, frameSize);

  let xOffset = 0;
  for (let b = 0; b < batchDataUrls.length; b++) {
    const bytes = dataUrlToBytes(batchDataUrls[b]);
    const img = await Image.decode(bytes);

    const batchCount = framesPerBatch[b];
    const expectedW = frameSize * batchCount;

    // Resize batch image to the expected width/height if model returned a different size.
    let batchImg = img;
    if (img.width !== expectedW || img.height !== frameSize) {
      console.log(
        `Batch ${b} size mismatch: got ${img.width}x${img.height}, resizing to ${expectedW}x${frameSize}`,
      );
      batchImg = img.resize(expectedW, frameSize);
    }

    stitched.composite(batchImg, xOffset, 0);
    xOffset += expectedW;
  }

  const encoded = await stitched.encode();
  let binStr = "";
  for (let i = 0; i < encoded.length; i++) binStr += String.fromCharCode(encoded[i]);
  const b64 = btoa(binStr);
  return `data:image/png;base64,${b64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SpriteRequest = await req.json();
    const {
      referenceImage,
      gridSize,
      viewingAngle,
      pose,
      frameCount,
      styleId,
      styleKeywords,
      styleNegative,
      palette,
    } = body;

    if (!referenceImage) {
      return new Response(JSON.stringify({ error: "Reference image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const size = parseInt(gridSize) || 32;
    const frames = Math.min(Math.max(Number(frameCount) || 1, 1), 24);

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
    const characterDescription =
      analysisResult.choices?.[0]?.message?.content || "a game character";
    console.log("Character analysis:", characterDescription.substring(0, 200));

    const styleLine =
      styleKeywords && styleKeywords.length > 0
        ? styleKeywords
        : `${styleId || "pixel-16bit"} art style`;
    const negativeLine = styleNegative || "";

    const paletteLine =
      palette && Array.isArray(palette.colors) && palette.colors.length > 0
        ? `- Use ONLY these colours (snap every pixel to one of them): ${palette.colors
            .slice(0, 32)
            .join(", ")}`
        : "";

    // Split into batches of up to BATCH_SIZE frames
    const numBatches = Math.ceil(frames / BATCH_SIZE);
    const framesPerBatch: number[] = [];
    for (let b = 0; b < numBatches; b++) {
      const count = Math.min(BATCH_SIZE, frames - b * BATCH_SIZE);
      framesPerBatch.push(count);
    }

    const batchPrompts = framesPerBatch.map((count, b) => {
      const startFrame = b * BATCH_SIZE + 1;
      const endFrame = startFrame + count - 1;
      const frameRangeHint =
        frames > 1
          ? `This is frames ${startFrame}-${endFrame} of ${frames} total, continuing the ${pose} animation in smooth sequence.`
          : "";

      return `Create a ${size * count}x${size} sprite strip image.

ART STYLE: ${styleLine}

CHARACTER: ${characterDescription}

REQUIREMENTS:
- ${count > 1
          ? `${count} frames side by side horizontally (total image: ${size * count}x${size} pixels, each frame exactly ${size}x${size})`
          : `Single ${size}x${size} sprite`}
- Viewing angle: ${viewingAngle}
- Pose/action: ${pose}
- ${frameRangeHint}
- The background MUST be a clean solid white (#FFFFFF). The character should be fully opaque and clearly separable from the white background.
- The character should fill most of each ${size}x${size} frame
- Use the exact colors described above from the reference character
${paletteLine ? paletteLine + "\n" : ""}${negativeLine ? `- ${negativeLine}` : ""}`;
    });

    const batchImages: string[] = [];
    for (let b = 0; b < batchPrompts.length; b++) {
      try {
        const img = await callImageModel(LOVABLE_API_KEY, batchPrompts[b]);
        if (!img) throw new Error(`Batch ${b + 1} returned no image`);
        batchImages.push(img);
      } catch (err: any) {
        if (err?.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (err?.status === 402) {
          return new Response(
            JSON.stringify({
              error: "Credits exhausted. Please add funds in Settings > Workspace > Usage.",
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw err;
      }
    }

    let finalImage: string;
    if (batchImages.length === 1) {
      // Single batch — still normalise via imagescript so that the caller gets a
      // canonically-sized strip (some models return slightly mis-sized output).
      const bytes = dataUrlToBytes(batchImages[0]);
      const img = await Image.decode(bytes);
      const expectedW = size * frames;
      if (img.width !== expectedW || img.height !== size) {
        console.log(
          `Single batch size mismatch: got ${img.width}x${img.height}, resizing to ${expectedW}x${size}`,
        );
        const resized = img.resize(expectedW, size);
        const encoded = await resized.encode();
        let binStr = "";
        for (let i = 0; i < encoded.length; i++) binStr += String.fromCharCode(encoded[i]);
        finalImage = `data:image/png;base64,${btoa(binStr)}`;
      } else {
        finalImage = batchImages[0];
      }
    } else {
      finalImage = await stitchBatches(batchImages, size, framesPerBatch, frames);
    }

    console.log(
      `Successfully generated ${frames} frames across ${batchImages.length} batch(es)`,
    );

    return new Response(
      JSON.stringify({
        type: "generated-image",
        imageData: finalImage,
        frameCount: frames,
        frameWidth: size,
        frameHeight: size,
        frameSize: size,
        batches: batchImages.length,
        description: characterDescription.substring(0, 300),
        styleId: styleId || "pixel-16bit",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-sprite error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
