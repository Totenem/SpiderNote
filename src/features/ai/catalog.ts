import manifest from "../../../assets/models/manifest.json";
export type ModelId = "whisper-base-q8" | "qwen35-08b-q4";
export const MODEL_CATALOG = manifest;
export const SPEECH_MODEL: ModelId = "whisper-base-q8";
export const NOTE_MODEL: ModelId = "qwen35-08b-q4";
export function modelSpec(id: string) {
  const model = manifest.find((item) => item.id === id);
  if (!model) throw Error("Unknown bundled model.");
  return model;
}
export const REPORT_URL = "https://forms.gle/ZgD756Q3yxT45BZUA";
