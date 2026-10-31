import { Directory, File, FileMode, Paths } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { modelSpec, type ModelId } from "./catalog";
import {
  acquireAiTask,
  finishAiTask,
  getAiStatus,
  setAiStatus,
} from "./status";
import { errorMessage } from "@/utils/format";

const verified = new Set<ModelId>();
const directory = () => {
  const dir = new Directory(Paths.document, "ai-models");
  dir.create({ idempotent: true, intermediates: true });
  return dir;
};
export const modelFile = (id: ModelId) =>
  new File(directory(), modelSpec(id).file);
const marker = (id: ModelId) =>
  new File(directory(), `${modelSpec(id).file}.verified.json`);
export function isModelInstalled(id: ModelId) {
  const file = modelFile(id);
  const receipt = marker(id);
  if (!file.exists || file.size !== modelSpec(id).bytes || !receipt.exists)
    return false;
  try {
    return JSON.parse(receipt.textSync()).sha256 === modelSpec(id).sha256;
  } catch {
    return false;
  }
}
export async function verifyFile(
  file: File,
  expected: string,
  signal: AbortSignal,
) {
  const hash = sha256.create();
  const handle = file.open(FileMode.ReadOnly);
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await handle.readBytes(1024 * 1024);
      if (!chunk.length) break;
      hash.update(chunk);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    handle.close();
  }
  if (bytesToHex(hash.digest()) !== expected)
    throw Error(
      "Model verification failed. The file will not be used. Download it again.",
    );
}
export async function requireModel(id: ModelId, signal: AbortSignal) {
  if (!isModelInstalled(id))
    throw Error(`Download ${modelSpec(id).name} in Offline AI first.`);
  if (!verified.has(id)) {
    setAiStatus({ ...getAiStatus(), phase: `Verifying ${modelSpec(id).name}` });
    await verifyFile(modelFile(id), modelSpec(id).sha256, signal);
    verified.add(id);
  }
  return modelFile(id).uri;
}
export async function downloadModel(id: ModelId) {
  const spec = modelSpec(id);
  if (isModelInstalled(id) && verified.has(id)) return;
  const abort = new AbortController();
  let task: ReturnType<typeof createDownloadResumable> | undefined;
  acquireAiTask(`Downloading ${spec.name}`, () => {
    abort.abort();
    task?.cancelAsync().catch(() => {});
  });
  const partial = new File(directory(), `${spec.file}.part`);
  try {
    if (partial.exists) partial.delete();
    if (Paths.availableDiskSpace < spec.bytes + 128 * 1024 * 1024)
      throw Error(
        "Not enough free storage for this model and temporary audio.",
      );
    task = createDownloadResumable(spec.url, partial.uri, {}, (progress) => {
      if (progress.totalBytesWritten > spec.bytes + 1024) {
        abort.abort();
        task?.cancelAsync().catch(() => {});
      }
      setAiStatus({
        ...getAiStatus(),
        phase: `Downloading ${spec.name}`,
        progress: Math.min(
          0.95,
          (progress.totalBytesWritten / spec.bytes) * 0.95,
        ),
      });
    });
    const result = await task.downloadAsync();
    abort.signal.throwIfAborted();
    if (
      !result ||
      result.status !== 200 ||
      !partial.exists ||
      partial.size !== spec.bytes
    )
      throw Error("The download was incomplete. Retry when connected.");
    setAiStatus({
      ...getAiStatus(),
      phase: "Verifying model SHA-256",
      progress: 0.97,
    });
    await verifyFile(partial, spec.sha256, abort.signal);
    abort.signal.throwIfAborted();
    const destination = modelFile(id);
    if (destination.exists) destination.delete();
    partial.move(destination);
    marker(id).write(
      JSON.stringify({ sha256: spec.sha256, bytes: spec.bytes }),
    );
    verified.add(id);
    finishAiTask();
  } catch (error) {
    if (partial.exists) partial.delete();
    finishAiTask(
      abort.signal.aborted
        ? "Download cancelled. You can retry later."
        : errorMessage(error),
    );
    throw error;
  }
}
export function deleteModel(id: ModelId) {
  if (getAiStatus().busy)
    throw Error(
      "Finish or cancel the current AI task before removing a model.",
    );
  const file = modelFile(id);
  const receipt = marker(id);
  if (file.exists) file.delete();
  if (receipt.exists) receipt.delete();
  verified.delete(id);
}
