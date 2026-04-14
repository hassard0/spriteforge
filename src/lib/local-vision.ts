/**
 * Browser-local vision-describe via SmolVLM-500M-Instruct on transformers.js v4+.
 *
 * Runs the first (vision analysis) stage of the sprite generation pipeline entirely
 * on-device using WebGPU. The edge function skips its Gemini vision call when a
 * precomputed description is provided. The second (image generation) stage still
 * runs server-side via Gemini.
 *
 * Note: transformers.js v4 does NOT expose an 'image-text-to-text' pipeline task
 * for this model, so we use the lower-level AutoProcessor + AutoModelForVision2Seq
 * API directly (which SmolVLM registers for).
 */

export type VisionProgress = {
  status: 'idle' | 'downloading' | 'loading' | 'ready' | 'inferring' | 'error';
  progress?: number; // 0-1
  loaded?: number; // bytes
  total?: number; // bytes
  message?: string;
};

export type VisionAvailability = 'webgpu' | 'wasm' | 'unavailable';

const MODEL_ID = 'HuggingFaceTB/SmolVLM-500M-Instruct';
// Try these dtypes in order until one loads. SmolVLM publishes q4f16 on HF.
const DTYPE_CANDIDATES = ['q4f16', 'q4', 'q8', 'fp16'] as const;

type LoadedModel = {
  processor: any;
  tokenizer: any;
  model: any;
  dtype: string;
};

let cached: LoadedModel | null = null;
let loadingPromise: Promise<LoadedModel> | null = null;

export function isVisionLoaded(): boolean {
  return cached !== null;
}

export function getLoadedDtype(): string | null {
  return cached?.dtype ?? null;
}

export async function detectVisionBackend(): Promise<VisionAvailability> {
  try {
    const nav = navigator as any;
    if ('gpu' in nav && nav.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
    // WASM fallback exists but is effectively unusable for a 500M VLM.
    // Downgrade to 'unavailable' so callers route to server vision.
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function loadModel(onProgress?: (p: VisionProgress) => void): Promise<LoadedModel> {
  if (cached) return cached;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const tjs: any = await import('@huggingface/transformers');
    const { AutoProcessor, AutoTokenizer, AutoModelForVision2Seq } = tjs;

    const progress_callback = (evt: any) => {
      if (!onProgress) return;
      const status: VisionProgress['status'] =
        evt?.status === 'progress' || evt?.status === 'download' || evt?.status === 'initiate'
          ? 'downloading'
          : 'loading';
      onProgress({
        status,
        progress: typeof evt?.progress === 'number' ? evt.progress / 100 : undefined,
        loaded: evt?.loaded,
        total: evt?.total,
        message: evt?.file ? `${evt.status}: ${evt.file}` : evt?.status,
      });
    };

    onProgress?.({ status: 'loading', message: 'Loading processor and tokenizer…' });
    const processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback });
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback });

    let lastErr: unknown = null;
    for (const dtype of DTYPE_CANDIDATES) {
      try {
        onProgress?.({ status: 'loading', message: `Loading model weights (${dtype})…` });
        const model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
          device: 'webgpu',
          dtype,
          progress_callback,
        });
        cached = { processor, tokenizer, model, dtype };
        onProgress?.({ status: 'ready', message: `Model ready (${dtype})` });
        return cached;
      } catch (err) {
        lastErr = err;
        console.warn(`[local-vision] dtype ${dtype} failed:`, err);
      }
    }
    onProgress?.({
      status: 'error',
      message: `Failed to load model: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    });
    throw lastErr instanceof Error ? lastErr : new Error('Failed to load SmolVLM model');
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

const DESCRIBE_PROMPT =
  'Describe this character for a pixel-art sprite artist. Cover: body proportions, clothing/armor, primary colors as hex codes, distinctive features (hair, weapon, accessories), and overall art style. Be concise — 3-5 sentences max. No markdown.';

async function dataUrlToRawImage(dataUrl: string): Promise<any> {
  const tjs: any = await import('@huggingface/transformers');
  const { RawImage } = tjs;
  return RawImage.fromURL(dataUrl);
}

export async function describeReferenceImage(
  imageDataUrl: string,
  options?: { onProgress?: (p: VisionProgress) => void; signal?: AbortSignal },
): Promise<string> {
  const { onProgress, signal } = options || {};
  if (signal?.aborted) throw new Error('Aborted');

  const { processor, tokenizer, model } = await loadModel(onProgress);
  if (signal?.aborted) throw new Error('Aborted');

  onProgress?.({ status: 'inferring', message: 'Analyzing reference image…' });

  const image = await dataUrlToRawImage(imageDataUrl);

  // Build chat-formatted prompt via the tokenizer's chat template. SmolVLM
  // expects a single <image> token in the user message; the processor expands
  // it into the full visual-token block before tokenisation.
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'image' },
        { type: 'text', text: DESCRIBE_PROMPT },
      ],
    },
  ];

  let text: string;
  try {
    text = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      tokenize: false,
    });
  } catch {
    // Fallback: hand-built template matching SmolVLM's format.
    text = `<|im_start|>User:<image>${DESCRIBE_PROMPT}<end_of_utterance>\nAssistant:`;
  }

  const inputs = await processor(text, image);
  if (signal?.aborted) throw new Error('Aborted');

  const generated = await model.generate({
    ...inputs,
    max_new_tokens: 200,
    do_sample: false,
  });
  if (signal?.aborted) throw new Error('Aborted');

  // Slice off the prompt tokens so we only decode what the model generated.
  const inputIds = inputs.input_ids;
  const inputLen = inputIds?.dims?.[1] ?? 0;
  let generatedIds: any = generated;
  if (inputLen > 0 && typeof generated?.slice === 'function' && generated?.dims?.length >= 2) {
    try {
      generatedIds = generated.slice(null, [inputLen, null]);
    } catch {
      generatedIds = generated;
    }
  }

  const decoded: string[] = tokenizer.batch_decode(generatedIds, { skip_special_tokens: true });
  const raw = (decoded?.[0] ?? '').toString();
  const cleaned = raw
    .replace(/^\s*assistant\s*:?\s*/i, '')
    .replace(/<end_of_utterance>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|im_start\|>/g, '')
    .trim();

  onProgress?.({ status: 'ready', message: 'Done' });
  return cleaned;
}

export async function clearVisionCache(): Promise<void> {
  cached = null;
  // Best-effort cache cleanup. transformers.js uses the Cache Storage API for
  // ONNX/model files, plus an IndexedDB fallback in some browsers.
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.includes('transformers') || n.includes('huggingface'))
          .map((n) => caches.delete(n)),
      );
    }
  } catch (err) {
    console.warn('[local-vision] cache clear failed:', err);
  }
  try {
    if (typeof indexedDB !== 'undefined') {
      const dbNames = ['transformers-cache', 'transformers.js', 'huggingface-cache'];
      for (const name of dbNames) {
        try {
          indexedDB.deleteDatabase(name);
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.warn('[local-vision] idb clear failed:', err);
  }
}
