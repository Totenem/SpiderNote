import { requireOptionalNativeModule } from "expo-modules-core";
export type MemorySample = {
  pssBytes: number;
  highWaterRssBytes: number;
  availableBytes: number;
  totalBytes: number;
  thermalStatus: number;
};
export type PreparedAudio = {
  directory: string;
  durationMs: number;
  segments: { uri: string; offsetMs: number; durationMs: number }[];
};
type Support = {
  provisionModel(name: string): Promise<string>;
  hashModel(uri: string): Promise<string>;
  cancelHash(): void;
  prepareAudio(uri: string): Promise<PreparedAudio>;
  cancelPrepare(): void;
  removePrepared(directory: string): void;
  getMemoryStats(): MemorySample;
};
export function nativeAiSupport(): Support {
  const module = requireOptionalNativeModule<Support>("LocalAiSupport");
  if (!module)
    throw Error(
      "Offline AI needs the latest Android build. It is not available in Expo Go or the older beta.",
    );
  return module;
}
