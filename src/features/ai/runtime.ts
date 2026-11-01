import { nativeAiSupport } from "../../../modules/local-ai-support";
import type { MemorySample } from "../../../modules/local-ai-support";
import { File, FileMode } from "expo-file-system";
import { cleanSpeechText, hasAudiblePcm16, NoSpeechError } from "./output";
import { requireModel } from "./models";
import type { ModelId } from "./catalog";
import { getAiStatus, setAiStatus } from "./status";
import type { SpeechContext, SpeechRuntime } from "./speech-types";

export type RuntimeDiagnostics = Record<string, unknown>;
type DiagnosticsObserver = (value: RuntimeDiagnostics) => void;
async function isDigitalSilence(uri: string, signal: AbortSignal) {
  const handle = new File(uri).open(FileMode.ReadOnly);
  try {
    // prepareAudio always emits our own 44-byte PCM16 WAV header.
    await handle.readBytes(44);
    while (true) {
      signal.throwIfAborted();
      const bytes = await handle.readBytes(64 * 1024);
      if (!bytes.length) return true;
      if (hasAudiblePcm16(bytes)) return false;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    handle.close();
  }
}

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
  observe?: DiagnosticsObserver,
  bypassSilenceGate = false,
) {
  const diagnostic: RuntimeDiagnostics = {
    silenceGateBypassed: bypassSilenceGate,
    skippedSilentChunks: 0,
    removedMarkerChunks: 0,
  };
  const support = nativeAiSupport();
  const verifyStart = Date.now();
  const model = await requireModel(speechModel, signal);
  diagnostic.verificationMs = Date.now() - verifyStart;
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
    const prepareStart = Date.now();
    prepared = await support.prepareAudio(uri);
    diagnostic.preparationMs = Date.now() - prepareStart;
    diagnostic.audioDurationMs = prepared.durationMs;
    diagnostic.chunkCount = prepared.segments.length;
    signal.throwIfAborted();
    const audibleSegments = [];
    for (const segment of prepared.segments) {
      if (!bypassSilenceGate && (await isDigitalSilence(segment.uri, signal))) {
        diagnostic.skippedSilentChunks =
          Number(diagnostic.skippedSilentChunks) + 1;
      } else audibleSegments.push(segment);
    }
    if (!audibleSegments.length) throw new NoSpeechError();
    // Lazy native loading also avoids pulling optional inference into app startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initWhisper } = require("whisper.rn/index") as SpeechRuntime;
    const loadStart = Date.now();
    context = await initWhisper({
      filePath: model,
      useGpu: false,
      useCoreMLIos: false,
    });
    diagnostic.modelLoadMs = Date.now() - loadStart;
    const inferenceStart = Date.now();
    signal.throwIfAborted();
    const segments: { text: string; startMs: number; endMs: number }[] = [];
    const texts: string[] = [];
    for (const [index, segment] of audibleSegments.entries()) {
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
            phase: `Transcribing ${index + 1}/${audibleSegments.length}`,
            progress: (index + value / 100) / audibleSegments.length,
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
        const clean = cleanSpeechText(result.result);
        if (!clean && result.result.trim())
          diagnostic.removedMarkerChunks =
            Number(diagnostic.removedMarkerChunks) + 1;
        texts.push(clean);
        segments.push(
          ...result.segments
            .map((item) => ({
              text: cleanSpeechText(item.text),
              startMs: segment.offsetMs + item.t0 * 10,
              endMs: segment.offsetMs + item.t1 * 10,
            }))
            .filter((item) => item.text.length > 0),
        );
      } finally {
        signal.removeEventListener("abort", stop);
      }
    }
    diagnostic.inferenceMs = Date.now() - inferenceStart;
    const content = texts.filter(Boolean).join("\n");
    if (!content) throw new NoSpeechError();
    return { content, segments, durationMs: prepared.durationMs };
  } finally {
    signal.removeEventListener("abort", onAbort);
    try {
      await context?.release();
    } finally {
      if (prepared) support.removePrepared(prepared.directory);
      observe?.(diagnostic);
    }
  }
}
