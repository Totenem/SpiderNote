import type { SQLiteDatabase } from "expo-sqlite";
import { AppState, Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { getNote, getTags } from "@/db/repository";
import { audioFile } from "@/services/files";
import { getTranscript, saveTranscript } from "./repository";
import { saveRichNote, saveStructuredDraft } from "../notes/repository";
import { plainToHtml } from "../notes/content";
import { measureResources, transcribeLocal } from "./runtime";
import { structureLocal } from "./structure";
import { SPEECH_MODEL, NOTE_MODEL } from "./catalog";
import type { NoteFormat } from "./grounding";
import { acquireAiTask, finishAiTask } from "./status";
import { errorMessage } from "@/utils/format";

export async function runLocalTask(
  db: SQLiteDatabase,
  noteId: string,
  kind: "transcription" | "generation",
  format: NoteFormat = "recording_summary",
) {
  if (Platform.OS !== "android")
    throw Error(
      "Offline transcription and structuring require the Android native build. You can still write and edit notes here.",
    );
  if (AppState.currentState !== "active")
    throw Error("Return to SpiderNote before starting offline processing.");
  const abort = new AbortController();
  acquireAiTask(
    kind === "transcription" ? "Preparing audio" : "Preparing structured note",
    () => abort.abort(),
    noteId,
  );
  const jobId = randomUUID();
  const draftId = randomUUID();
  let measurement: ReturnType<typeof measureResources> | undefined;
  try {
    const note = await getNote(db, noteId);
    if (!note) throw Error("This note was deleted.");
    const now = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO ai_jobs(id,note_id,kind,status,source_revision,format,created_at,updated_at) VALUES(?,?,?,'running',?,?,?,?)",
      jobId,
      noteId,
      kind,
      note.raw_revision,
      format,
      now,
      now,
    );
    measurement = measureResources();
    if (kind === "transcription") {
      if (!note.file_path || note.recording_status === "missing")
        throw Error("The source audio is unavailable.");
      const transcript = await getTranscript(db, noteId);
      const result = await transcribeLocal(
        audioFile(note.file_path).uri,
        SPEECH_MODEL,
        "auto",
        abort.signal,
      );
      abort.signal.throwIfAborted();
      await saveRichNote(
        db,
        noteId,
        note.title,
        plainToHtml(result.content),
        false,
        note.notebook_id,
        await getTags(db, noteId),
        note.raw_revision,
      );
      await saveTranscript(
        db,
        noteId,
        result.content,
        SPEECH_MODEL,
        "auto",
        result.segments,
        transcript?.revision ?? 0,
      );
    } else {
      if (!note.body.trim())
        throw Error("Write or transcribe a raw note first.");
      const html = await structureLocal(note.body, format, abort.signal);
      abort.signal.throwIfAborted();
      await saveStructuredDraft(
        db,
        draftId,
        noteId,
        note.raw_revision,
        format,
        html,
        NOTE_MODEL,
      );
    }
    const metrics = measurement.stop();
    measurement = undefined;
    await db.runAsync(
      "UPDATE ai_jobs SET status='succeeded',metrics_json=?,updated_at=? WHERE id=?",
      JSON.stringify(metrics),
      new Date().toISOString(),
      jobId,
    );
    return kind === "generation" ? draftId : undefined;
  } catch (error) {
    const message = abort.signal.aborted
      ? "Processing cancelled. Saved notes and audio were kept."
      : errorMessage(error);
    await db
      .runAsync(
        "UPDATE ai_jobs SET status=?,error_message=?,updated_at=? WHERE id=?",
        abort.signal.aborted ? "cancelled" : "failed",
        message,
        new Date().toISOString(),
        jobId,
      )
      .catch(() => {});
    throw Error(message);
  } finally {
    measurement?.stop();
    finishAiTask();
  }
}
