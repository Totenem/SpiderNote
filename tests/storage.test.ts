/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrate, beginRecording, createNote, saveNote, listNotes, finishRecording, getNote, getTags } from '../src/db/repository.ts';
import { cleanDeletedNotes, deleteNote, reconcileRecordings } from '../src/services/recovery.ts';

function database() {
  const raw = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...args: (string | number | null)[]) => raw.prepare(sql).run(...args),
    getAllAsync: async (sql: string, ...args: (string | number | null)[]) => raw.prepare(sql).all(...args),
    getFirstAsync: async (sql: string, ...args: (string | number | null)[]) => raw.prepare(sql).get(...args) ?? null,
    withExclusiveTransactionAsync: async (work: (tx: unknown) => Promise<void>) => {
      raw.exec('BEGIN');
      try { await work(db); raw.exec('COMMIT'); } catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  } as unknown as SQLiteDatabase;
  return { db, raw };
}

test('migrations are repeatable and a recording draft is atomic', async () => {
  const { db, raw } = database();
  try {
    await migrate(db); await migrate(db);
    await beginRecording(db, 'one', 'Audio/one.m4a');
    await assert.rejects(beginRecording(db, 'one', 'Audio/one.m4a'));
    assert.equal((await listNotes(db)).length, 1);
    assert.equal((await getNote(db, 'one'))?.recording_status, 'recording');
    await finishRecording(db, 'one', 9000, 'Audio/one.m4a');
    assert.equal((await getNote(db, 'one'))?.duration_ms, 9000);
  } finally { raw.close(); }
});

test('edit, notebook, tags and literal keyword search persist with parameterized SQL', async () => {
  const { db, raw } = database();
  try {
    await migrate(db); await createNote(db, 'typed');
    await db.runAsync('INSERT INTO notebooks VALUES (?,?,?)', 'work', 'Work', new Date().toISOString());
    await saveNote(db, 'typed', "Ana's 100% plan", 'Bring paper', 'work', ['Lecture', 'lecture', 'Filipino']);
    assert.deepEqual(await getTags(db, 'typed'), ['filipino', 'lecture']);
    assert.equal((await listNotes(db, '100%')).length, 1);
    assert.equal((await listNotes(db, '%anything')).length, 0);
    assert.equal((await listNotes(db, 'Filipino', 'all', 'work')).length, 1);
    assert.equal((await listNotes(db, '', 'audio')).length, 0);
    await assert.rejects(saveNote(db, 'typed', 'Broken edit', '', 'unknown', []));
    assert.equal((await getNote(db, 'typed'))?.title, "Ana's 100% plan");
  } finally { raw.close(); }
});

test('startup marks interrupted/missing audio without deleting any source', async () => {
  const { db, raw } = database();
  try {
    await migrate(db);
    await beginRecording(db, 'valid', 'Audio/valid.m4a');
    await beginRecording(db, 'lost', 'Audio/lost.m4a');
    let deletes = 0;
    await reconcileRecordings(db, { size: path => path.includes('valid') ? 1024 : 0, remove: () => { deletes++; } });
    assert.equal((await getNote(db, 'valid'))?.recording_status, 'interrupted');
    assert.equal((await getNote(db, 'lost'))?.recording_status, 'missing');
    assert.equal(deletes, 0);
  } finally { raw.close(); }
});

test('confirmed deletion survives file failure and retries without losing metadata', async () => {
  const { db, raw } = database();
  try {
    await migrate(db); await beginRecording(db, 'delete', 'Audio/delete.m4a');
    assert.equal(await deleteNote(db, { size: () => 1, remove: () => { throw Error('Locked file'); } }, 'delete'), 1);
    assert.equal((await listNotes(db)).length, 0);
    assert.equal((await db.getAllAsync('SELECT * FROM recordings')).length, 1);
    assert.equal(await cleanDeletedNotes(db, { size: () => 0, remove: () => {} }), 0);
    assert.equal((await db.getAllAsync('SELECT * FROM recordings')).length, 0);
  } finally { raw.close(); }
});
