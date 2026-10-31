import type { SQLiteDatabase } from "expo-sqlite";
import type { Recording, RecordingStatus } from "../db/repository.ts";

export type FileAccess = {
  size: (path: string) => number;
  remove: (path: string) => void;
};

export function reconciledStatus(
  status: RecordingStatus,
  bytes: number,
): RecordingStatus {
  if (bytes <= 0) return "missing";
  return status === "recording" || status === "missing"
    ? "interrupted"
    : status;
}

// Only called during startup, before recording UI is mounted. Never deletes source audio.
export async function reconcileRecordings(
  db: SQLiteDatabase,
  files: FileAccess,
) {
  const rows = await db.getAllAsync<Recording>(
    "SELECT r.* FROM recordings r JOIN notes n ON n.id=r.note_id WHERE n.deleted_at IS NULL",
  );
  for (const row of rows) {
    const next = reconciledStatus(row.status, files.size(row.file_path));
    if (next !== row.status)
      await db.runAsync(
        "UPDATE recordings SET status=?,updated_at=? WHERE id=?",
        next,
        new Date().toISOString(),
        row.id,
      );
  }
}

// A persistent tombstone makes a confirmed deletion retryable across crashes/file failures.
export async function cleanDeletedNotes(db: SQLiteDatabase, files: FileAccess) {
  const notes = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM notes WHERE deleted_at IS NOT NULL",
  );
  let pending = 0;
  for (const note of notes) {
    try {
      const recordings = await db.getAllAsync<Recording>(
        "SELECT * FROM recordings WHERE note_id=?",
        note.id,
      );
      for (const row of recordings) files.remove(row.file_path);
      await db.runAsync("DELETE FROM notes WHERE id=?", note.id);
    } catch {
      pending++;
    }
  }
  return pending;
}

export async function deleteNote(
  db: SQLiteDatabase,
  files: FileAccess,
  id: string,
) {
  await db.runAsync(
    "UPDATE notes SET deleted_at=? WHERE id=?",
    new Date().toISOString(),
    id,
  );
  return cleanDeletedNotes(db, files);
}
