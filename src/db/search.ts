import type { SQLiteDatabase } from "expo-sqlite";

const indexedConnections = new WeakSet<SQLiteDatabase>();
export const hasSearchIndex = (db: SQLiteDatabase) =>
  indexedConnections.has(db);

// A derived index, not a second source of truth. Existing notes are backfilled once.
export async function initializeSearch(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync(
    "SELECT name FROM sqlite_master WHERE name='note_search'",
  );
  try {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS note_search USING fts5(
          note_id UNINDEXED, title, body, tags, tokenize='unicode61 remove_diacritics 2', prefix='2 3 4'
        );
        CREATE TRIGGER IF NOT EXISTS search_note_insert AFTER INSERT ON notes WHEN new.deleted_at IS NULL BEGIN
          INSERT INTO note_search(rowid,note_id,title,body,tags) VALUES(new.rowid,new.id,new.title,new.body,'');
        END;
        CREATE TRIGGER IF NOT EXISTS search_note_update AFTER UPDATE ON notes BEGIN
          DELETE FROM note_search WHERE rowid=old.rowid;
          INSERT INTO note_search(rowid,note_id,title,body,tags)
            SELECT new.rowid,new.id,new.title,new.body,COALESCE((SELECT group_concat(t.name,' ') FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=new.id),'')
            WHERE new.deleted_at IS NULL;
        END;
        CREATE TRIGGER IF NOT EXISTS search_note_delete AFTER DELETE ON notes BEGIN
          DELETE FROM note_search WHERE rowid=old.rowid;
        END;
        CREATE TRIGGER IF NOT EXISTS search_tag_insert AFTER INSERT ON note_tags BEGIN
          UPDATE note_search SET tags=COALESCE((SELECT group_concat(t.name,' ') FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=new.note_id),'') WHERE note_id=new.note_id;
        END;
        CREATE TRIGGER IF NOT EXISTS search_tag_delete AFTER DELETE ON note_tags BEGIN
          UPDATE note_search SET tags=COALESCE((SELECT group_concat(t.name,' ') FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=old.note_id),'') WHERE note_id=old.note_id;
        END;
        CREATE TRIGGER IF NOT EXISTS search_tag_rename AFTER UPDATE OF name ON tags BEGIN
          UPDATE note_search SET tags=COALESCE((SELECT group_concat(t.name,' ') FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=note_search.note_id),'')
            WHERE note_id IN (SELECT note_id FROM note_tags WHERE tag_id=new.id);
        END;
      `);
      if (!existing)
        await tx.execAsync(`INSERT INTO note_search(rowid,note_id,title,body,tags)
        SELECT n.rowid,n.id,n.title,n.body,COALESCE((SELECT group_concat(t.name,' ') FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id=n.id),'')
        FROM notes n WHERE n.deleted_at IS NULL;`);
    });
    indexedConnections.add(db);
  } catch (error) {
    if (!/no such module: fts5/i.test(String(error))) throw error;
    // A runtime without FTS5 keeps keyword search; initialization errors are not hidden.
  }
}

export function prepareSearch(query: string) {
  const text = query.trim().slice(0, 200);
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  // Search punctuation literally instead of treating it as FTS operators or LIKE wildcards.
  const literal = /[^\p{L}\p{N}\s]/u.test(text);
  return {
    text,
    terms: literal ? [text] : words.slice(0, 12),
    fts:
      !literal && words.length
        ? words
            .slice(0, 12)
            .map((word) => `"${word}"*`)
            .join(" AND ")
        : null,
  };
}
