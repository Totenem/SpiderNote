import type { SQLiteDatabase } from "expo-sqlite";
import { getNote, transaction } from "../../db/repository.ts";
import { sanitizeHtml, htmlToPlain } from "./content.ts";

export async function saveRichNote(
  db: SQLiteDatabase,
  id: string,
  title: string,
  html: string,
  structured: boolean,
  notebook: string | null,
  tags: string[],
  expectedRevision: number,
) {
  const clean = sanitizeHtml(html);
  await transaction(db, async (tx) => {
    const note = await getNote(tx, id);
    if (!note) throw Error("This note was deleted.");
    if (note.raw_revision !== expectedRevision)
      throw Error("The raw note changed. Reopen it before saving.");
    const text = htmlToPlain(clean);
    await tx.runAsync(
      "UPDATE notes SET title=?,notebook_id=?,body=?,updated_at=? WHERE id=?",
      title.trim() || "Untitled note",
      notebook,
      structured ? note.body : text,
      new Date().toISOString(),
      id,
    );
    await tx.runAsync("DELETE FROM note_tags WHERE note_id=?", id);
    for (const name of [
      ...new Set(
        tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean),
      ),
    ].slice(0, 20)) {
      await tx.runAsync(
        "INSERT OR IGNORE INTO tags(id,name) VALUES(?,?)",
        name,
        name,
      );
      await tx.runAsync(
        "INSERT INTO note_tags(note_id,tag_id) SELECT ?,id FROM tags WHERE name=?",
        id,
        name,
      );
    }
    if (structured) {
      await tx.runAsync(
        "UPDATE notes SET structured_source_revision=CASE WHEN structured_html='' THEN ? ELSE structured_source_revision END,structured_html=?,structured_text=? WHERE id=?",
        note.raw_revision,
        clean,
        text,
        id,
      );
    } else {
      await tx.runAsync(
        "UPDATE notes SET raw_html=?,raw_revision=raw_revision+CASE WHEN raw_html<>? THEN 1 ELSE 0 END WHERE id=?",
        clean,
        clean,
        id,
      );
    }
  });
}

export async function saveStructuredDraft(
  db: SQLiteDatabase,
  id: string,
  noteId: string,
  sourceRevision: number,
  format: string,
  html: string,
  model: string,
) {
  const clean = sanitizeHtml(html);
  await transaction(db, async (tx) => {
    const note = await getNote(tx, noteId);
    if (!note || note.raw_revision !== sourceRevision)
      throw Error(
        "The raw note changed or was deleted. Generate again from the latest text.",
      );
    await tx.runAsync(
      "INSERT INTO ai_drafts(id,note_id,source_revision,format,content,facts_json,model_id,created_at,rich_html,raw_source_revision) VALUES(?,?,?,?,?,'[]',?,?,?,?)",
      id,
      noteId,
      sourceRevision,
      format,
      htmlToPlain(clean),
      model,
      new Date().toISOString(),
      clean,
      sourceRevision,
    );
  });
}
export async function acceptStructuredDraft(
  db: SQLiteDatabase,
  draftId: string,
) {
  await transaction(db, async (tx) => {
    const draft = await tx.getFirstAsync<{
      note_id: string;
      rich_html: string;
      raw_source_revision: number;
    }>("SELECT * FROM ai_drafts WHERE id=?", draftId);
    if (!draft?.rich_html) throw Error("This draft is unavailable.");
    const note = await getNote(tx, draft.note_id);
    if (!note || note.raw_revision !== draft.raw_source_revision)
      throw Error("The raw note changed. Generate a fresh version.");
    await tx.runAsync(
      "INSERT INTO note_revisions(note_id,body,created_at) VALUES(?,?,?)",
      note.id,
      note.structured_html,
      new Date().toISOString(),
    );
    await tx.runAsync(
      "UPDATE notes SET structured_html=?,structured_text=?,structured_source_revision=?,updated_at=? WHERE id=?",
      draft.rich_html,
      htmlToPlain(draft.rich_html),
      draft.raw_source_revision,
      new Date().toISOString(),
      note.id,
    );
    await tx.runAsync(
      "UPDATE ai_drafts SET reviewed_at=? WHERE note_id=? AND raw_source_revision=? AND reviewed_at IS NULL",
      new Date().toISOString(),
      note.id,
      note.raw_revision,
    );
  });
}
