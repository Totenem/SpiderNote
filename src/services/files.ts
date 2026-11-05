import type { Note } from "@/db/repository";
import { renderExport } from "@/features/notes/export";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import type { FileAccess } from "./recovery";

export const recordingPath = (id: string) =>
  `${Platform.OS === "ios" ? "ExpoAudio" : "Audio"}/${id}.m4a`;
export function audioFile(path: string) {
  if (!/^(Audio|ExpoAudio)\/[a-zA-Z0-9-]+\.(m4a|aac|mp3|wav)$/.test(path))
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
export async function exportNotes(notes: Note[], html: boolean) {
  if (!notes.length) throw Error("Create a note before exporting.");
  if (!(await Sharing.isAvailableAsync()))
    throw Error("File sharing is unavailable on this device.");
  const directory = new Directory(Paths.cache, "exports");
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(
    directory,
    "spidernote-" + Date.now() + (html ? ".html" : ".txt"),
  );
  file.write(renderExport(notes, html));
  await Sharing.shareAsync(file.uri, {
    mimeType: html ? "text/html" : "text/plain",
    dialogTitle: "Export written notes",
  });
}
