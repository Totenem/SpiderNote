import type { SQLiteDatabase } from "expo-sqlite";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { nativeAiSupport } from "../../../modules/local-ai-support";
import { MODEL_CATALOG, type ModelId } from "./catalog";
import { isModelInstalled } from "./models";
import {
  acquireAiTask,
  finishAiTask,
  getAiStatus,
  setAiStatus,
} from "./status";
import { measureResources, transcribeLocal, extractLocal } from "./runtime";
import {
  coverage,
  JFK_REFERENCE,
  TEXT_FIXTURES,
  wordErrorRate,
} from "./benchmark";
import { FORMATS, renderDraft } from "./grounding";
import { errorMessage } from "@/utils/format";

export type BenchmarkResult = {
  sampleId: string;
  modelId: string;
  kind: string;
  iteration: number;
  status: "completed" | "failed";
  metrics?: unknown;
  scores?: unknown;
  error?: string;
};
export type BenchmarkReport = {
  id: string;
  createdAt: string;
  appVersion: string;
  device: unknown;
  models: unknown;
  protocol: string;
  limitations: string[];
  results: BenchmarkResult[];
};
function silenceFile() {
  const samples = 16000 * 5;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    Array.from(value).forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  const file = new File(Paths.cache, "ai-benchmark-silence.wav");
  file.write(bytes);
  return file;
}
export async function runBenchmark(
  db: SQLiteDatabase,
  repeats: number,
  imported?: { uri: string; reference: string; language: "auto" | "en" | "tl" },
) {
  const abort = new AbortController();
  const id = randomUUID();
  const results: BenchmarkResult[] = [];
  const report: BenchmarkReport = {
    id,
    createdAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? "development",
    device: {
      model: Device.modelName,
      android: Device.osVersion,
      ...nativeAiSupport().getMemoryStats(),
    },
    models: MODEL_CATALOG.filter((model) => isModelInstalled(model.id)).map(
      ({ id, sha256, bytes }) => ({ id, sha256, bytes }),
    ),
    protocol:
      "v1: fresh CPU context per case; 2 threads; measured load/verification included; 500 ms PSS samples",
    limitations: [
      "Read English speech, silence and English/Filipino/Taglish text fixtures only. Natural Taglish speech and real meetings are not covered by the bundled pack.",
      "Coverage is literal fact-fragment matching, not a complete factuality or usefulness score.",
      "Observed PSS is sampled; RSS high-water is process lifetime, not an isolated per-test peak. Battery energy is not measured.",
      "4 GB support is unverified until measured on a physical target phone.",
    ],
    results,
  };
  acquireAiTask("Starting benchmark", () => abort.abort());
  try {
    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3)
      throw Error("Choose one to three benchmark repetitions.");
    const speechModels = MODEL_CATALOG.filter(
      (model) => model.kind === "speech" && isModelInstalled(model.id),
    );
    const hasNotes = isModelInstalled("qwen3-06b-q8");
    if (!speechModels.length && !hasNotes)
      throw Error("Download at least one offline model before benchmarking.");
    const asset = await Asset.fromModule(
      require("../../../assets/benchmark/jfk.wav"),
    ).downloadAsync();
    const silence = silenceFile();
    const audioCases = [
      {
        id: "jfk-en-1",
        uri: asset.localUri!,
        reference: JFK_REFERENCE,
        language: "en" as const,
      },
      {
        id: "silence-5s",
        uri: silence.uri,
        reference: "",
        language: "auto" as const,
      },
      ...(imported ? [{ id: "imported-audio", ...imported }] : []),
    ];
    for (let iteration = 1; iteration <= repeats; iteration++) {
      for (const model of speechModels)
        for (const sample of audioCases) {
          abort.signal.throwIfAborted();
          setAiStatus({
            ...getAiStatus(),
            phase: `Benchmark ${sample.id} · run ${iteration}`,
            progress: 0,
          });
          const measurement = measureResources();
          try {
            const result = await transcribeLocal(
              sample.uri,
              model.id as ModelId,
              sample.language,
              abort.signal,
            );
            results.push({
              sampleId: sample.id,
              modelId: model.id,
              kind: "transcription",
              iteration,
              status:
                sample.id === "silence-5s" && result.content.trim()
                  ? "failed"
                  : "completed",
              metrics: {
                ...measurement.stop(),
                audioDurationMs: result.durationMs,
              },
              scores: sample.reference
                ? wordErrorRate(sample.reference, result.content)
                : {
                    recognizedWords: result.content.trim().split(/\s+/).length,
                    referenceProvided: false,
                  },
            });
          } catch (error) {
            const noSpeech =
              sample.id === "silence-5s" &&
              errorMessage(error).startsWith("No speech was recognized");
            results.push({
              sampleId: sample.id,
              modelId: model.id,
              kind: "transcription",
              iteration,
              status: noSpeech ? "completed" : "failed",
              metrics: measurement.stop(),
              ...(noSpeech
                ? { scores: { recognizedWords: 0 } }
                : { error: errorMessage(error) }),
            });
          }
        }
      if (hasNotes)
        for (const sample of TEXT_FIXTURES) {
          abort.signal.throwIfAborted();
          const measurement = measureResources();
          try {
            const facts = await extractLocal(sample.text, abort.signal);
            const formats = FORMATS.map((format) => ({
              id: format.id,
              nonempty: renderDraft(format.id, facts).length > 0,
            }));
            results.push({
              sampleId: sample.id,
              modelId: "qwen3-06b-q8",
              kind: "note_generation",
              iteration,
              status: "completed",
              metrics: measurement.stop(),
              scores: {
                ...coverage(sample.facts, facts),
                formats,
                sourceValidated: true,
              },
            });
          } catch (error) {
            results.push({
              sampleId: sample.id,
              modelId: "qwen3-06b-q8",
              kind: "note_generation",
              iteration,
              status: "failed",
              metrics: measurement.stop(),
              error: errorMessage(error),
            });
          }
        }
    }
    abort.signal.throwIfAborted();
    finishAiTask();
  } catch (error) {
    report.limitations.push(
      abort.signal.aborted
        ? "Run cancelled; completed cases are retained."
        : errorMessage(error),
    );
    finishAiTask(
      abort.signal.aborted ? "Benchmark cancelled." : errorMessage(error),
    );
  }
  await db.runAsync(
    "INSERT INTO benchmark_runs VALUES(?,?,?)",
    id,
    JSON.stringify(report),
    report.createdAt,
  );
  return report;
}
