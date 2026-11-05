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

export const schemaV2 = `
CREATE TABLE transcripts (
  note_id TEXT PRIMARY KEY NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, segments_json TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'auto', model_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE ai_jobs (
  id TEXT PRIMARY KEY NOT NULL, note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','cancelled','interrupted')),
  source_revision INTEGER, format TEXT, error_message TEXT, metrics_json TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE ai_drafts (
  id TEXT PRIMARY KEY NOT NULL, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  source_revision INTEGER NOT NULL, format TEXT NOT NULL, content TEXT NOT NULL,
  facts_json TEXT NOT NULL, model_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE note_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE benchmark_runs (id TEXT PRIMARY KEY NOT NULL, report_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX ai_jobs_note ON ai_jobs(note_id,created_at DESC);
CREATE INDEX ai_drafts_note ON ai_drafts(note_id,created_at DESC);
DROP TRIGGER IF EXISTS search_note_insert;
DROP TRIGGER IF EXISTS search_note_update;
DROP TRIGGER IF EXISTS search_note_delete;
DROP TRIGGER IF EXISTS search_tag_insert;
DROP TRIGGER IF EXISTS search_tag_delete;
DROP TRIGGER IF EXISTS search_tag_rename;
DROP TABLE IF EXISTS note_search;
PRAGMA user_version=2;
`;

export const schemaV3 = `
ALTER TABLE notes ADD COLUMN raw_html TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN raw_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN structured_html TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN structured_text TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN structured_source_revision INTEGER;
ALTER TABLE notes ADD COLUMN legacy_body TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_drafts ADD COLUMN rich_html TEXT;
ALTER TABLE ai_drafts ADD COLUMN raw_source_revision INTEGER;
ALTER TABLE ai_drafts ADD COLUMN reviewed_at TEXT;
DROP TRIGGER IF EXISTS search_note_insert;
DROP TRIGGER IF EXISTS search_note_update;
DROP TRIGGER IF EXISTS search_note_delete;
DROP TRIGGER IF EXISTS search_tag_insert;
DROP TRIGGER IF EXISTS search_tag_delete;
DROP TRIGGER IF EXISTS search_tag_rename;
DROP TRIGGER IF EXISTS search_transcript_insert;
DROP TRIGGER IF EXISTS search_transcript_update;
DROP TRIGGER IF EXISTS search_transcript_delete;
DROP TABLE IF EXISTS note_search;
PRAGMA user_version=3;
`;
