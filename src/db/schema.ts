export const schemaV1 = `
CREATE TABLE notebooks (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL COLLATE NOCASE UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE notes (
 id TEXT PRIMARY KEY NOT NULL, notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
 title TEXT NOT NULL DEFAULT 'Untitled note', body TEXT NOT NULL DEFAULT '',
 is_pinned INTEGER NOT NULL DEFAULT 0, deleted_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE recordings (
 id TEXT PRIMARY KEY NOT NULL, note_id TEXT NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
 file_path TEXT NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0,
 position_ms INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL CHECK(status IN ('recording','saved','interrupted','missing')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE tags (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
CREATE TABLE note_tags (note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
 tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(note_id, tag_id));
CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE INDEX notes_updated_at ON notes(updated_at DESC);
CREATE INDEX recordings_note_id ON recordings(note_id);
CREATE INDEX note_tags_tag_id ON note_tags(tag_id);
PRAGMA user_version = 1;
`;
