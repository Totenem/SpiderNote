import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireAiTask,
  cancelAndWaitForAi,
  finishAiTask,
  getAiStatus,
} from "../src/features/ai/status.ts";

test("library deletion waits for native-task cleanup before proceeding", async () => {
  let aborted = false,
    released = false;
  acquireAiTask(
    "Working",
    () => {
      aborted = true;
    },
    "note",
  );
  const waiting = cancelAndWaitForAi();
  let resolved = false;
  waiting.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  assert.equal(aborted, true);
  assert.equal(resolved, false);
  assert.equal(getAiStatus().busy, true);
  released = true;
  finishAiTask();
  await waiting;
  assert.equal(released, true);
  assert.equal(resolved, true);
  assert.equal(getAiStatus().busy, false);
  await cancelAndWaitForAi();
});

test("only one local inference task can acquire the runtime", () => {
  acquireAiTask("First", () => {}, "first");
  try {
    assert.throws(
      () => acquireAiTask("Second", () => {}, "second"),
      /Another AI task/,
    );
    assert.equal(getAiStatus().noteId, "first");
  } finally {
    finishAiTask();
  }
});
