import type { SQLiteDatabase } from "expo-sqlite";
import { transaction } from "../../db/repository.ts";
import type { NoteFormat, GroundedFact } from "./grounding.ts";
export type Transcript = {
  note_id: string;
  content: string;
  revision: number;
  segments_json: string;
  language: string;
  model_id: string;
  updated_at: string;
};
export type Draft = {
  id: string;
  note_id: string;
  source_revision: number;
  format: NoteFormat;
  content: string;
  facts_json: string;
  model_id: string;
  created_at: string;
};
export type Job = {
  id: string;
  kind: string;
  status: string;
  error_message: string | null;
  created_at: string;
  metrics_json: string | null;
};
export const getTranscript = (db: SQLiteDatabase, noteId: string) =>
  db.getFirstAsync<Transcript>(
    "SELECT * FROM transcripts WHERE note_id=?",
    noteId,
  );
export const getDrafts = (db: SQLiteDatabase, noteId: string) =>
  db.getAllAsync<Draft>(
    "SELECT * FROM ai_drafts WHERE note_id=? ORDER BY created_at DESC LIMIT 20",
    noteId,
  );
export const getJobs = (db: SQLiteDatabase, noteId: string) =>
  db.getAllAsync<Job>(
    "SELECT * FROM ai_jobs WHERE note_id=? ORDER BY created_at DESC LIMIT 8",
    noteId,
  );
export async function saveTranscript(
  db: SQLiteDatabase,
  noteId: string,
  content: string,
  model: string,
  language = "auto",
  segments: unknown[] = [],
  expectedRevision?: number,
) {
  if (content.length > 100000)
    throw Error("The transcript exceeds this device preset’s limit.");
  await transaction(db, async (tx) => {
    const note = await tx.getFirstAsync(
      "SELECT id FROM notes WHERE id=? AND deleted_at IS NULL",
      noteId,
    );
    if (!note) throw Error("The source note was deleted.");
    const current = await getTranscript(tx, noteId);
    if (
      expectedRevision !== undefined &&
      (current?.revision ?? 0) !== expectedRevision
    )
      throw Error(
        "The transcript changed during processing. Your newer text was kept.",
      );
    await tx.runAsync(
      `INSERT INTO transcripts(note_id,content,revision,segments_json,language,model_id,updated_at) VALUES(?,?,1,?,?,?,?)
      ON CONFLICT(note_id) DO UPDATE SET content=excluded.content,revision=transcripts.revision+1,segments_json=excluded.segments_json,language=excluded.language,model_id=excluded.model_id,updated_at=excluded.updated_at`,
      noteId,
      content,
      JSON.stringify(segments),
      language,
      model,
      new Date().toISOString(),
    );
  });
}
export async function saveDraft(
  db: SQLiteDatabase,
  id: string,
  noteId: string,
  revision: number,
  format: NoteFormat,
  content: string,
  facts: GroundedFact[],
) {
  await transaction(db, async (tx) => {
    const current = await getTranscript(tx, noteId);
    if (!current || current.revision !== revision)
      throw Error(
        "The transcript changed. Generate a new draft from the latest text.",
      );
    const note = await tx.getFirstAsync(
      "SELECT id FROM notes WHERE id=? AND deleted_at IS NULL",
      noteId,
    );
    if (!note) throw Error("The source note was deleted.");
    await tx.runAsync(
      "INSERT INTO ai_drafts VALUES(?,?,?,?,?,?,?,?)",
      id,
      noteId,
      revision,
      format,
      content,
      JSON.stringify(facts),
      "qwen3-06b-q8/prompt-v1",
      new Date().toISOString(),
    );
  });
}
export async function acceptDraft(db: SQLiteDatabase, draftId: string) {
  await transaction(db, async (tx) => {
    const draft = await tx.getFirstAsync<Draft>(
      "SELECT * FROM ai_drafts WHERE id=?",
      draftId,
    );
    if (!draft) throw Error("The draft is no longer available.");
    const transcript = await getTranscript(tx, draft.note_id);
    if (transcript?.revision !== draft.source_revision)
      throw Error(
        "This draft uses an older transcript. Generate it again before accepting.",
      );
    const note = await tx.getFirstAsync<{ body: string }>(
      "SELECT body FROM notes WHERE id=? AND deleted_at IS NULL",
      draft.note_id,
    );
    if (!note) throw Error("The note is no longer available.");
    await tx.runAsync(
      "INSERT INTO note_revisions(note_id,body,created_at) VALUES(?,?,?)",
      draft.note_id,
      note.body,
      new Date().toISOString(),
    );
    await tx.runAsync(
      "UPDATE notes SET body=?,updated_at=? WHERE id=?",
      draft.content,
      new Date().toISOString(),
      draft.note_id,
    );
  });
}
export async function restoreDescription(db: SQLiteDatabase, noteId: string) {
  await transaction(db, async (tx) => {
    const revision = await tx.getFirstAsync<{ id: number; body: string }>(
      "SELECT id,body FROM note_revisions WHERE note_id=? ORDER BY id DESC LIMIT 1",
      noteId,
    );
    if (!revision) throw Error("No previous description is available.");
    await tx.runAsync(
      "UPDATE notes SET body=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
      revision.body,
      new Date().toISOString(),
      noteId,
    );
    await tx.runAsync("DELETE FROM note_revisions WHERE id=?", revision.id);
  });
}
