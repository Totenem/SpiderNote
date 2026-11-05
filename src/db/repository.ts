import { transaction } from "./transactions.ts";
import {
  plainToHtml,
  markdownToHtml,
  htmlToPlain,
} from "../features/notes/content.ts";
import type { SQLiteDatabase } from "expo-sqlite";
import { schemaV1, schemaV2, schemaV3 } from "./schema.ts";
import { hasSearchIndex, initializeSearch, prepareSearch } from "./search.ts";

export { transaction } from "./transactions.ts";

export type RecordingStatus = "recording" | "saved" | "interrupted" | "missing";
export type Note = {
  id: string;
  title: string;
  body: string;
  raw_html: string;
  raw_revision: number;
  structured_html: string;
  structured_text: string;
  structured_source_revision: number | null;
  legacy_body: string;
  notebook_id: string | null;
  notebook_name: string | null;
  is_pinned: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  recording_id: string | null;
  file_path: string | null;
  duration_ms: number | null;
  position_ms: number | null;
  recording_status: RecordingStatus | null;
};
export type Recording = {
  id: string;
  note_id: string;
  file_path: string;
  status: RecordingStatus;
  duration_ms: number;
};
export type Notebook = { id: string; name: string; count: number };
const selectNote = `SELECT n.*, b.name AS notebook_name, r.id AS recording_id, r.file_path,
 r.duration_ms, r.position_ms, r.status AS recording_status FROM notes n
 LEFT JOIN notebooks b ON b.id=n.notebook_id LEFT JOIN recordings r ON r.note_id=n.id`;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((version?.user_version ?? 0) > 3)
    throw new Error("This database needs a newer version of SpiderNote.");
  if (!version?.user_version)
    await transaction(db, async (tx) => {
      await tx.execAsync(schemaV1);
    });
  if ((version?.user_version ?? 0) < 2)
    await transaction(db, async (tx) => {
      await tx.execAsync(schemaV2);
    });
  if ((version?.user_version ?? 0) < 3)
    await transaction(db, async (tx) => {
      await tx.execAsync(schemaV3);
      const rows = await tx.getAllAsync<{
        id: string;
        body: string;
        transcript: string | null;
      }>(
        "SELECT n.id,n.body,t.content AS transcript FROM notes n LEFT JOIN transcripts t ON t.note_id=n.id",
      );
      for (const row of rows) {
        const raw = row.transcript ?? row.body;
        const draft = await tx.getFirstAsync<{ content: string }>(
          "SELECT content FROM ai_drafts WHERE note_id=? ORDER BY created_at DESC LIMIT 1",
          row.id,
        );
        const structured = draft ? markdownToHtml(draft.content) : "";
        await tx.runAsync(
          "UPDATE notes SET legacy_body=?,body=?,raw_html=?,raw_revision=1,structured_html=?,structured_text=? WHERE id=?",
          row.body,
          raw,
          plainToHtml(raw),
          structured,
          htmlToPlain(structured),
          row.id,
        );
      }
    });
  await initializeSearch(db);
}

export function listNotes(
  db: SQLiteDatabase,
  query = "",
  filter = "all",
  notebookId?: string,
) {
  const search = prepareSearch(query);
  const filterSql = `n.deleted_at IS NULL
    AND (? = 'all' OR (? = 'audio' AND r.id IS NOT NULL) OR (? = 'pinned' AND n.is_pinned=1))
    AND (? IS NULL OR n.notebook_id=?)`;
  const params = [
    filter,
    filter,
    filter,
    notebookId ?? null,
    notebookId ?? null,
  ];
  if (search.fts && hasSearchIndex(db)) {
    return db.getAllAsync<Note>(
      `${selectNote} JOIN note_search ON note_search.note_id=n.id
      WHERE ${filterSql} AND note_search MATCH ?
      ORDER BY (lower(n.title)=lower(?)) DESC, bm25(note_search,0,8,3,1), n.updated_at DESC`,
      ...params,
      search.fts,
      search.text,
    );
  }
  const terms = search.terms.length ? search.terms : [""];
  const matches = terms
    .map(
      () => `(n.title LIKE ? ESCAPE '\\' OR (n.body || ' ' || n.structured_text) LIKE ? ESCAPE '\\'
    OR EXISTS (SELECT 1 FROM note_tags nt JOIN tags t ON t.id=nt.tag_id WHERE nt.note_id=n.id AND t.name LIKE ? ESCAPE '\\')
    OR EXISTS (SELECT 1 FROM transcripts tr WHERE tr.note_id=n.id AND tr.content LIKE ? ESCAPE '\\'))`,
    )
    .join(" AND ");
  const needles = terms.flatMap((term) => {
    const escaped = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    return [escaped, escaped, escaped, escaped];
  });
  return db.getAllAsync<Note>(
    `${selectNote} WHERE ${filterSql} AND ${matches}
    ORDER BY n.is_pinned DESC, n.updated_at DESC`,
    ...params,
    ...needles,
  );
}
export function getNote(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Note>(
    `${selectNote} WHERE n.id=? AND n.deleted_at IS NULL`,
    id,
  );
}
export async function createNote(
  db: SQLiteDatabase,
  id: string,
  title = "Untitled note",
) {
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO notes (id,title,created_at,updated_at) VALUES (?,?,?,?)",
    id,
    title,
    now,
    now,
  );
}
export async function beginRecording(
  db: SQLiteDatabase,
  id: string,
  relativePath: string,
) {
  const now = new Date().toISOString();
  await transaction(db, async (tx) => {
    await tx.runAsync(
      "INSERT INTO notes (id,title,created_at,updated_at) VALUES (?,?,?,?)",
      id,
      `Recording · ${new Date().toLocaleDateString()}`,
      now,
      now,
    );
    await tx.runAsync(
      "INSERT INTO recordings (id,note_id,file_path,status,created_at,updated_at) VALUES (?,?,?,'recording',?,?)",
      id,
      id,
      relativePath,
      now,
      now,
    );
  });
}
export async function checkpoint(
  db: SQLiteDatabase,
  id: string,
  duration: number,
) {
  await db.runAsync(
    "UPDATE recordings SET duration_ms=MAX(duration_ms,?), updated_at=? WHERE id=? AND status='recording'",
    Math.round(duration),
    new Date().toISOString(),
    id,
  );
}
export async function finishRecording(
  db: SQLiteDatabase,
  id: string,
  duration: number,
  path: string,
  status: RecordingStatus = "saved",
) {
  const now = new Date().toISOString();
  await transaction(db, async (tx) => {
    await tx.runAsync(
      "UPDATE recordings SET duration_ms=MAX(duration_ms,?),file_path=?,status=?,updated_at=? WHERE id=?",
      Math.round(duration),
      path,
      status,
      now,
      id,
    );
    await tx.runAsync("UPDATE notes SET updated_at=? WHERE id=?", now, id);
  });
}
export async function saveNote(
  db: SQLiteDatabase,
  id: string,
  title: string,
  body: string,
  notebook: string | null,
  tags: string[],
) {
  const names = [
    ...new Set(
      tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean),
    ),
  ].slice(0, 20);
  await transaction(db, async (tx) => {
    await tx.runAsync(
      "UPDATE notes SET title=?,body=?,notebook_id=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
      title.trim() || "Untitled note",
      body,
      notebook,
      new Date().toISOString(),
      id,
    );
    await tx.runAsync("DELETE FROM note_tags WHERE note_id=?", id);
    for (const name of names) {
      await tx.runAsync(
        "INSERT OR IGNORE INTO tags (id,name) VALUES (?,?)",
        name,
        name,
      );
      await tx.runAsync(
        "INSERT INTO note_tags (note_id,tag_id) SELECT ?,id FROM tags WHERE name=?",
        id,
        name,
      );
    }
  });
}
export async function getTags(db: SQLiteDatabase, id: string) {
  return (
    await db.getAllAsync<{ name: string }>(
      "SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=? ORDER BY t.name",
      id,
    )
  ).map((t) => t.name);
}
export function listNotebooks(db: SQLiteDatabase) {
  return db.getAllAsync<Notebook>(
    "SELECT b.*,COUNT(n.id) AS count FROM notebooks b LEFT JOIN notes n ON n.notebook_id=b.id AND n.deleted_at IS NULL GROUP BY b.id ORDER BY b.name COLLATE NOCASE",
  );
}
export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
) {
  await db.runAsync(
    "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    key,
    value,
  );
}
export async function getSetting(db: SQLiteDatabase, key: string) {
  return (
    await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key=?",
      key,
    )
  )?.value;
}
