import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import type { FileAccess } from "./recovery";

export const recordingPath = (id: string) =>
  `${Platform.OS === "ios" ? "ExpoAudio" : "Audio"}/${id}.m4a`;
export function audioFile(path: string) {
  if (!/^(Audio|ExpoAudio)\/[a-zA-Z0-9-]+\.m4a$/.test(path))
    throw new Error("Invalid recording path.");
  return new File(Paths.document, path);
}
export const localFiles: FileAccess = {
  size: (path) => {
    const file = audioFile(path);
    return file.exists ? file.size : 0;
  },
  remove: (path) => {
    const file = audioFile(path);
    if (file.exists) file.delete();
  },
};
export function relativeAudioPath(uri: string) {
  const base = `${Paths.document.uri.replace(/\/$/, "")}/`;
  if (!uri.startsWith(base))
    throw new Error("Recording was not saved in persistent document storage.");
  const path = uri.slice(base.length);
  audioFile(path);
  return path;
}
export async function exportText(
  id: string,
  title: string,
  body: string,
  markdown: boolean,
) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  const directory = new Directory(Paths.cache, "exports");
  directory.create({ idempotent: true, intermediates: true });
  const safeTitle =
    title.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "note";
  const file = new File(
    directory,
    `${safeTitle}-${id}.${markdown ? "md" : "txt"}`,
  );
  file.write(`${markdown ? "# " : ""}${title}\n\n${body}\n`);
  await Sharing.shareAsync(file.uri, {
    mimeType: markdown ? "text/markdown" : "text/plain",
    dialogTitle: "Export your note",
  });
}
