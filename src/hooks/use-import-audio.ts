import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { useSQLiteContext } from "expo-sqlite";
import { beginRecording, finishRecording } from "@/db/repository";
import { errorMessage } from "@/utils/format";

export function useImportAudio() {
  const db = useSQLiteContext(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const importAudio = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    let destination: File | undefined,
      cache: File | undefined,
      saved = false;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0],
        extension = asset.name.split(".").pop()?.toLowerCase();
      cache = new File(asset.uri);
      if (!extension || !["m4a", "aac", "mp3", "wav"].includes(extension))
        throw Error("Choose an M4A, AAC, MP3, or WAV audio file.");
      if (!cache.exists || cache.size <= 0 || cache.size >= 512 * 1024 * 1024)
        throw Error("Audio must contain data and be smaller than 512 MB.");
      if (Paths.availableDiskSpace < cache.size + 128 * 1024 * 1024)
        throw Error("Not enough free space to save and process this audio.");
      const id = randomUUID(),
        directory = new Directory(Paths.document, "Audio");
      directory.create({ idempotent: true, intermediates: true });
      destination = new File(directory, `${id}.${extension}`);
      cache.copy(destination);
      await beginRecording(db, id, `Audio/${id}.${extension}`);
      saved = true;
      await finishRecording(db, id, 0, `Audio/${id}.${extension}`);
      await db.runAsync(
        "UPDATE notes SET title=? WHERE id=?",
        asset.name.replace(/\.[^.]+$/, ""),
        id,
      );
      router.push({ pathname: "/note/[id]", params: { id, transcribe: "1" } });
    } catch (e) {
      Alert.alert("Could not import audio", errorMessage(e));
    } finally {
      if (!saved && destination?.exists) destination.delete();
      if (cache?.exists && cache.uri.startsWith(Paths.cache.uri))
        cache.delete();
      lock.current = false;
      setBusy(false);
    }
  };
  return { importAudio, busy };
}
