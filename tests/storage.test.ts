/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SQLiteDatabase } from "expo-sqlite";
import { schemaV1 } from "../src/db/schema.ts";
import {
  migrate,
  beginRecording,
  createNote,
  saveNote,
  listNotes,
  finishRecording,
  getNote,
  getTags,
  checkpoint,
} from "../src/db/repository.ts";
import {
  cleanDeletedNotes,
  deleteNote,
  reconcileRecordings,
} from "../src/services/recovery.ts";

function database(path = ":memory:") {
  const raw = new DatabaseSync(path);
  const db = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...args: (string | number | null)[]) =>
      raw.prepare(sql).run(...args),
    getAllAsync: async (sql: string, ...args: (string | number | null)[]) =>
      raw.prepare(sql).all(...args),
    getFirstAsync: async (sql: string, ...args: (string | number | null)[]) =>
      raw.prepare(sql).get(...args) ?? null,
    withExclusiveTransactionAsync: async (
      work: (tx: unknown) => Promise<void>,
    ) => {
      // Model Expo's separate transaction connection without inherited PRAGMAs.
      raw.exec("PRAGMA foreign_keys=OFF; BEGIN");
      try {
        await work(db);
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      } finally {
        raw.exec("PRAGMA foreign_keys=ON");
      }
    },
  } as unknown as SQLiteDatabase;
  return { db, raw };
}

test("indexed search backfills existing notes, matches title and description together, and follows edits", async () => {
  const { db, raw } = database();
  try {
    raw.exec(schemaV1);
    await createNote(db, "search-upgrade", "Quarterly roadmap");
    await saveNote(
      db,
      "search-upgrade",
      "Quarterly roadmap",
      "Budget for next sprint",
      null,
      ["planning"],
    );
    await migrate(db);
    assert.equal((await listNotes(db, "road budg"))[0]?.id, "search-upgrade");
    assert.equal((await listNotes(db, "SPRINT"))[0]?.id, "search-upgrade");
    assert.equal((await listNotes(db, "plann"))[0]?.id, "search-upgrade");
    await saveNote(
      db,
      "search-upgrade",
      "Research review",
      "Interview themes",
      null,
      ["insights"],
    );
    assert.equal((await listNotes(db, "budget")).length, 0);
    assert.equal(
      (await listNotes(db, "review interv"))[0]?.id,
      "search-upgrade",
    );
    assert.equal((await listNotes(db, "planning")).length, 0);
    await db.runAsync(
      "UPDATE tags SET name=? WHERE name=?",
      "findings",
      "insights",
    );
    assert.equal((await listNotes(db, "findings"))[0]?.id, "search-upgrade");
    await deleteNote(db, { size: () => 0, remove: () => {} }, "search-upgrade");
    assert.equal((await listNotes(db, "research")).length, 0);
    assert.equal((await db.getAllAsync("SELECT * FROM note_search")).length, 0);
  } finally {
    raw.close();
  }
});

test("search falls back when FTS5 is unavailable and treats wildcard punctuation literally", async () => {
  const { db, raw } = database();
  const execute = db.execAsync.bind(db);
  db.execAsync = async (sql) => {
    if (sql.includes("CREATE VIRTUAL TABLE"))
      throw new Error("no such module: fts5");
    await execute(sql);
  };
  try {
    await migrate(db);
    await createNote(db, "fallback");
    await saveNote(db, "fallback", "Project 100%", "Budget for launch", null, [
      "work",
    ]);
    assert.equal((await listNotes(db, "project budget"))[0]?.id, "fallback");
    assert.equal((await listNotes(db, "100%"))[0]?.id, "fallback");
    assert.equal((await listNotes(db, "%missing")).length, 0);
    assert.equal((await listNotes(db, "' OR 1=1 --")).length, 0);
  } finally {
    raw.close();
  }
});

test("file-backed notes and finalized audio metadata survive a database restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "spidernote-test-"));
  const path = join(directory, "notes.db");
  let connection = database(path);
  try {
    await migrate(connection.db);
    await beginRecording(connection.db, "persistent", "Audio/persistent.m4a");
    await finishRecording(
      connection.db,
      "persistent",
      30000,
      "Audio/persistent.m4a",
    );
    await saveNote(
      connection.db,
      "persistent",
      "Class recap",
      "Balikan bukas",
      null,
      ["study"],
    );
    connection.raw.close();
    connection = database(path);
    await migrate(connection.db);
    const note = await getNote(connection.db, "persistent");
    assert.equal(note?.body, "Balikan bukas");
    assert.equal(note?.duration_ms, 30000);
    assert.equal(note?.recording_status, "saved");
    assert.deepEqual(await getTags(connection.db, "persistent"), ["study"]);
  } finally {
    connection.raw.close();
    // Only remove the explicitly created SQLite files; never recursively delete temp roots.
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(path + suffix, { force: true });
    rmdirSync(directory);
  }
});

test("late checkpoints cannot regress duration or mutate a finalized recording", async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await beginRecording(db, "checkpoint", "Audio/checkpoint.m4a");
    await checkpoint(db, "checkpoint", 10000);
    await checkpoint(db, "checkpoint", 8000);
    assert.equal((await getNote(db, "checkpoint"))?.duration_ms, 10000);
    await finishRecording(db, "checkpoint", 12000, "Audio/checkpoint.m4a");
    await checkpoint(db, "checkpoint", 14000);
    assert.equal((await getNote(db, "checkpoint"))?.duration_ms, 12000);
  } finally {
    raw.close();
  }
});

test("deleting a notebook preserves its notes and recordings as unfiled", async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await beginRecording(db, "kept", "Audio/kept.m4a");
    await db.runAsync(
      "INSERT INTO notebooks VALUES (?,?,?)",
      "book",
      "Meetings",
      new Date().toISOString(),
    );
    await saveNote(db, "kept", "Meeting", "Follow up", "book", []);
    await db.runAsync("DELETE FROM notebooks WHERE id=?", "book");
    const note = await getNote(db, "kept");
    assert.equal(note?.notebook_id, null);
    assert.equal(note?.recording_id, "kept");
  } finally {
    raw.close();
  }
});

test("migrations are repeatable and a recording draft is atomic", async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await migrate(db);
    await beginRecording(db, "one", "Audio/one.m4a");
    await assert.rejects(beginRecording(db, "one", "Audio/one.m4a"));
    assert.equal((await listNotes(db)).length, 1);
    assert.equal((await getNote(db, "one"))?.recording_status, "recording");
    await finishRecording(db, "one", 9000, "Audio/one.m4a");
    assert.equal((await getNote(db, "one"))?.duration_ms, 9000);
  } finally {
    raw.close();
  }
});

test("edit, notebook, tags and literal keyword search persist with parameterized SQL", async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await createNote(db, "typed");
    await db.runAsync(
      "INSERT INTO notebooks VALUES (?,?,?)",
      "work",
      "Work",
      new Date().toISOString(),
    );
    await saveNote(db, "typed", "Ana's 100% plan", "Bring paper", "work", [
      "Lecture",
      "lecture",
      "Filipino",
    ]);
    assert.deepEqual(await getTags(db, "typed"), ["filipino", "lecture"]);
    assert.equal((await listNotes(db, "100%")).length, 1);
    assert.equal((await listNotes(db, "%anything")).length, 0);
    assert.equal((await listNotes(db, "Filipino", "all", "work")).length, 1);
    assert.equal((await listNotes(db, "", "audio")).length, 0);
    await assert.rejects(
      saveNote(db, "typed", "Broken edit", "", "unknown", []),
    );
    assert.equal((await getNote(db, "typed"))?.title, "Ana's 100% plan");
  } finally {
    raw.close();
  }
});

test("startup marks interrupted/missing audio without deleting any source", async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await beginRecording(db, "valid", "Audio/valid.m4a");
    await beginRecording(db, "lost", "Audio/lost.m4a");
    let deletes = 0;
    await reconcileRecordings(db, {
      size: (path) => (path.includes("valid") ? 1024 : 0),
      remove: () => {
        deletes++;
      },
    });
    assert.equal((await getNote(db, "valid"))?.recording_status, "interrupted");
    assert.equal((await getNote(db, "lost"))?.recording_status, "missing");
    assert.equal(deletes, 0);
  } finally {
    raw.close();
  }
});

test("confirmed deletion survives file failure and retries without losing metadata", async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await beginRecording(db, "delete", "Audio/delete.m4a");
    assert.equal(
      await deleteNote(
        db,
        {
          size: () => 1,
          remove: () => {
            throw Error("Locked file");
          },
        },
        "delete",
      ),
      1,
    );
    assert.equal((await listNotes(db)).length, 0);
    assert.equal((await db.getAllAsync("SELECT * FROM recordings")).length, 1);
    assert.equal(
      await cleanDeletedNotes(db, { size: () => 0, remove: () => {} }),
      0,
    );
    assert.equal((await db.getAllAsync("SELECT * FROM recordings")).length, 0);
  } finally {
    raw.close();
  }
});
