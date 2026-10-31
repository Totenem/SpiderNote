import { nativeAiSupport } from "../../../modules/local-ai-support";
import type { MemorySample } from "../../../modules/local-ai-support";
import type { GroundedFact } from "./grounding";
import {
  EXTRACTION_PROMPT,
  EXTRACTION_SCHEMA,
  splitTranscript,
  validateFacts,
} from "./grounding";
import { requireModel } from "./models";
import type { ModelId } from "./catalog";
import { getAiStatus, setAiStatus } from "./status";
import type { SpeechContext, SpeechRuntime } from "./speech-types";

export type InferenceMetrics = {
  elapsedMs: number;
  observedPeakPssBytes: number;
  processHighWaterRssBytes: number;
  initialAvailableBytes: number;
  totalDeviceBytes: number;
  maxThermalStatus: number;
  memorySamplingMs: number;
  samples: number;
  outputTokens?: number;
};
export function measureResources() {
  const support = nativeAiSupport();
  const initial = support.getMemoryStats();
  const start = Date.now();
  let peak = initial.pssBytes;
  let high = initial.highWaterRssBytes;
  let thermal = initial.thermalStatus;
  let samples = 1;
  const sample = () => {
    try {
      const value: MemorySample = support.getMemoryStats();
      peak = Math.max(peak, value.pssBytes);
      high = Math.max(high, value.highWaterRssBytes);
      thermal = Math.max(thermal, value.thermalStatus);
      samples++;
    } catch {
      /* Sampling failure does not remove a completed result. */
    }
  };
  const timer = setInterval(sample, 500);
  return {
    stop: (): InferenceMetrics => {
      clearInterval(timer);
      sample();
      return {
        elapsedMs: Date.now() - start,
        observedPeakPssBytes: peak,
        processHighWaterRssBytes: high,
        initialAvailableBytes: initial.availableBytes,
        totalDeviceBytes: initial.totalBytes,
        maxThermalStatus: thermal,
        memorySamplingMs: 500,
        samples,
      };
    },
  };
}
export async function transcribeLocal(
  uri: string,
  speechModel: ModelId,
  language: "auto" | "en" | "tl",
  signal: AbortSignal,
) {
  const support = nativeAiSupport();
  const model = await requireModel(speechModel, signal);
  signal.throwIfAborted();
  setAiStatus({
    ...getAiStatus(),
    phase: "Preparing audio in 30-second chunks",
    progress: 0,
  });
  const onAbort = () => support.cancelPrepare();
  signal.addEventListener("abort", onAbort);
  let prepared: Awaited<ReturnType<typeof support.prepareAudio>> | undefined;
  let context: SpeechContext | undefined;
  try {
    prepared = await support.prepareAudio(uri);
    signal.throwIfAborted();
    // Lazy native loading also avoids pulling optional inference into app startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initWhisper } = require("whisper.rn/index") as SpeechRuntime;
    context = await initWhisper({
      filePath: model,
      useGpu: false,
      useCoreMLIos: false,
    });
    signal.throwIfAborted();
    const segments: { text: string; startMs: number; endMs: number }[] = [];
    const texts: string[] = [];
    for (const [index, segment] of prepared.segments.entries()) {
      signal.throwIfAborted();
      const task = context.transcribe(segment.uri, {
        language,
        translate: false,
        maxThreads: 2,
        nProcessors: 1,
        maxContext: 256,
        temperature: 0,
        temperatureInc: 0,
        onProgress: (value) =>
          setAiStatus({
            ...getAiStatus(),
            phase: `Transcribing ${index + 1}/${prepared!.segments.length}`,
            progress: (index + value / 100) / prepared!.segments.length,
          }),
      });
      const stop = () => {
        task.stop().catch(() => {});
      };
      signal.addEventListener("abort", stop);
      try {
        const result = await task.promise;
        signal.throwIfAborted();
        if (result.isAborted) throw Error("Transcription cancelled.");
        texts.push(result.result.trim());
        segments.push(
          ...result.segments.map((item) => ({
            text: item.text,
            startMs: segment.offsetMs + item.t0 * 10,
            endMs: segment.offsetMs + item.t1 * 10,
          })),
        );
      } finally {
        signal.removeEventListener("abort", stop);
      }
    }
    const content = texts.filter(Boolean).join("\n");
    if (!content)
      throw Error(
        "No speech was recognized. The recording has not been changed.",
      );
    return { content, segments, durationMs: prepared.durationMs };
  } finally {
    signal.removeEventListener("abort", onAbort);
    try {
      await context?.release();
    } finally {
      if (prepared) support.removePrepared(prepared.directory);
    }
  }
}
export async function extractLocal(content: string, signal: AbortSignal) {
  const support = nativeAiSupport();
  if (support.getMemoryStats().availableBytes < 768 * 1024 * 1024)
    throw Error(
      "Available memory is low. Close other apps and try again. Your transcript is kept.",
    );
  const model = await requireModel("qwen3-06b-q8", signal);
  signal.throwIfAborted();
  setAiStatus({ ...getAiStatus(), phase: "Loading Qwen on CPU", progress: 0 });
  const { initLlama } = await import("llama.rn");
  const context = await initLlama({
    model,
    n_ctx: 2048,
    n_parallel: 1,
    n_batch: 64,
    n_ubatch: 64,
    n_threads: 2,
    n_gpu_layers: 0,
    use_mmap: true,
    use_mlock: false,
    state_cache_budget_mb: 0,
  });
  const stop = () => {
    context.stopCompletion().catch(() => {});
  };
  signal.addEventListener("abort", stop);
  try {
    const queue = splitTranscript(content);
    const facts: GroundedFact[] = [];
    let completed = 0;
    while (queue.length) {
      signal.throwIfAborted();
      const chunk = queue.shift()!;
      const tokens = await context.tokenize(EXTRACTION_PROMPT + chunk);
      if (tokens.tokens.length > 1000) {
        if (chunk.length < 200)
          throw Error(
            "This text cannot fit the small-model context. Shorten the transcript.",
          );
        queue.unshift(...splitTranscript(chunk, Math.floor(chunk.length / 2)));
        continue;
      }
      if (completed + queue.length > 100)
        throw Error("The transcript is too long for this phone preset.");
      setAiStatus({
        ...getAiStatus(),
        phase: `Drafting source passages ${completed + 1}/${completed + queue.length + 1}`,
        progress: completed / (completed + queue.length + 1),
      });
      const result = await context.completion({
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: JSON.stringify({ SOURCE_DATA: chunk }) },
        ],
        enable_thinking: false,
        thinking_budget_tokens: 0,
        n_predict: 768,
        temperature: 0,
        seed: 42,
        response_format: {
          type: "json_schema",
          json_schema: { strict: true, schema: EXTRACTION_SCHEMA },
        },
      });
      signal.throwIfAborted();
      facts.push(...validateFacts(result.text, chunk));
      completed++;
    }
    return facts;
  } finally {
    signal.removeEventListener("abort", stop);
    await context.release();
  }
}
