import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { getNote } from "@/db/repository";
import { audioFile } from "@/services/files";
import { getTranscript, saveTranscript, saveDraft } from "./repository";
import { extractLocal, measureResources, transcribeLocal } from "./runtime";
import { renderDraft, type NoteFormat } from "./grounding";
import {
  acquireAiTask,
  finishAiTask,
  getAiStatus,
  setAiStatus,
} from "./status";
import type { ModelId } from "./catalog";
import { errorMessage } from "@/utils/format";

export async function runNoteAi(
  db: SQLiteDatabase,
  noteId: string,
  options: {
    transcribe: boolean;
    generate: boolean;
    format: NoteFormat;
    speechModel: ModelId;
    language: "auto" | "en" | "tl";
  },
) {
  const abort = new AbortController();
  acquireAiTask("Starting offline AI", () => abort.abort(), noteId);
  const id = randomUUID();
  const now = new Date().toISOString();
  let stopMeasurement: ReturnType<typeof measureResources> | undefined;
  try {
    await db.runAsync(
      "INSERT INTO ai_jobs(id,note_id,kind,status,format,created_at,updated_at) VALUES(?,?,?,'running',?,?,?)",
      id,
      noteId,
      options.transcribe ? "transcription" : "generation",
      options.format,
      now,
      now,
    );
    stopMeasurement = measureResources();
    let transcript = await getTranscript(db, noteId);
    if (options.transcribe) {
      const note = await getNote(db, noteId);
      if (!note?.file_path || note.recording_status === "missing")
        throw Error("The source recording is not available.");
      const result = await transcribeLocal(
        audioFile(note.file_path).uri,
        options.speechModel,
        options.language,
        abort.signal,
      );
      abort.signal.throwIfAborted();
      await saveTranscript(
        db,
        noteId,
        result.content,
        options.speechModel,
        options.language,
        result.segments,
        transcript?.revision ?? 0,
      );
      transcript = await getTranscript(db, noteId);
    }
    if (options.generate) {
      if (!transcript?.content.trim())
        throw Error("Create or edit a transcript before generating a note.");
      // The speech context is fully released by transcribeLocal before Qwen is initialized.
      const facts = await extractLocal(transcript.content, abort.signal);
      abort.signal.throwIfAborted();
      await saveDraft(
        db,
        randomUUID(),
        noteId,
        transcript.revision,
        options.format,
        renderDraft(options.format, facts),
        facts,
      );
    }
    const metrics = stopMeasurement.stop();
    stopMeasurement = undefined;
    await db.runAsync(
      "UPDATE ai_jobs SET status='succeeded',metrics_json=?,updated_at=? WHERE id=?",
      JSON.stringify(metrics),
      new Date().toISOString(),
      id,
    );
    finishAiTask();
  } catch (error) {
    const metrics = stopMeasurement?.stop();
    stopMeasurement = undefined;
    const message = abort.signal.aborted
      ? "Processing cancelled. Saved transcripts and source audio were kept."
      : errorMessage(error);
    await db
      .runAsync(
        "UPDATE ai_jobs SET status=?,error_message=?,metrics_json=?,updated_at=? WHERE id=?",
        abort.signal.aborted ? "cancelled" : "failed",
        message.slice(0, 500),
        metrics ? JSON.stringify(metrics) : null,
        new Date().toISOString(),
        id,
      )
      .catch(() => {});
    finishAiTask(message);
    throw new Error(message);
  } finally {
    stopMeasurement?.stop();
    if (getAiStatus().busy && getAiStatus().noteId === noteId) {
      setAiStatus({ ...getAiStatus(), busy: false });
    }
  }
}
