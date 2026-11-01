const ALL_MODEL_FILES = [
  {
    id: "whisper-tiny-q8",
    kind: "speech",
    name: "Whisper tiny · multilingual",
    file: "whisper-tiny-q8.bin",
    bytes: 43537433,
    sha256: "c2085835d3f50733e2ff6e4b41ae8a2b8d8110461e18821b09a15c40c42d1cca",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny-q8_0.bin",
    license: "MIT",
    description:
      "Fastest transcription. English and Filipino quality needs review.",
  },
  {
    id: "whisper-base-q8",
    kind: "speech",
    name: "Whisper base · multilingual",
    file: "whisper-base-q8.bin",
    bytes: 81768585,
    sha256: "c577b9a86e7e048a0b7eada054f4dd79a56bbfa911fbdacf900ac5b567cbb7d9",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q8_0.bin",
    license: "MIT",
    description: "Recommended starting point for accuracy; slower than tiny.",
  },
  {
    id: "qwen3-06b-q8",
    kind: "notes",
    name: "Qwen3 0.6B · Q8",
    file: "qwen3-06b-q8.gguf",
    bytes: 639446688,
    sha256: "9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031",
    url: "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf",
    license: "Apache-2.0",
    description:
      "Official Qwen quantization. Extracts grounded passages into five note formats. Experimental on 4 GB phones.",
  },
] as const;
export const MODEL_CATALOG = ALL_MODEL_FILES.filter(
  (model) => model.kind === "speech",
);
export type ModelId = (typeof ALL_MODEL_FILES)[number]["id"];
export type ModelSpec = (typeof ALL_MODEL_FILES)[number];
export function modelSpec(id: string): ModelSpec {
  const spec = ALL_MODEL_FILES.find((model) => model.id === id);
  if (!spec) throw new Error("Unknown offline model.");
  return spec;
}
export const REPORT_URL = "https://forms.gle/ZgD756Q3yxT45BZUA";
