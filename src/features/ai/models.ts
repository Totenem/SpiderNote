import { File, Directory, Paths } from "expo-file-system";
import { nativeAiSupport } from "../../../modules/local-ai-support";
import { modelSpec, type ModelId } from "./catalog";
import { getAiStatus, setAiStatus } from "./status";
const verified = new Set<ModelId>();
export async function requireModel(id: ModelId, signal: AbortSignal) {
  signal.throwIfAborted();
  const spec = modelSpec(id);
  const directory = new Directory(Paths.document, "ai-models");
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, spec.file);
  const support = nativeAiSupport();
  if (file.exists && file.size !== spec.bytes) file.delete();
  if (!file.exists) {
    if (Paths.availableDiskSpace < spec.bytes + 128 * 1024 * 1024)
      throw Error(
        "Not enough free storage to prepare the bundled model. Free space and retry.",
      );
    setAiStatus({ ...getAiStatus(), phase: "Preparing " + spec.name });
    await support.provisionModel(spec.file);
  }
  signal.throwIfAborted();
  if (!verified.has(id)) {
    setAiStatus({ ...getAiStatus(), phase: "Verifying " + spec.name });
    const stop = () => support.cancelHash();
    signal.addEventListener("abort", stop);
    try {
      const hash = await support.hashModel(file.uri);
      signal.throwIfAborted();
      if (file.size !== spec.bytes || hash !== spec.sha256) {
        file.delete();
        throw Error(
          "Bundled model verification failed. Retry to restore it from the app.",
        );
      }
      verified.add(id);
    } finally {
      signal.removeEventListener("abort", stop);
    }
  }
  return file.uri;
}
