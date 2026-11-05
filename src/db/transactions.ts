import type { SQLiteDatabase } from "expo-sqlite";
const webWrites = new WeakMap<SQLiteDatabase, Promise<void>>();
export async function transaction(
  db: SQLiteDatabase,
  task: (tx: SQLiteDatabase) => Promise<void>,
) {
  const checked = async (tx: SQLiteDatabase) => {
    await task(tx);
    // Exclusive native transactions open a separate connection; verify relations
    // even when connection-local foreign_keys is not inherited.
    if (await tx.getFirstAsync("PRAGMA foreign_key_check"))
      throw Error("The related notebook or note is no longer available.");
  };
  if (process.env.EXPO_OS === "web") {
    // Expo's exclusive transaction API is native-only. Serialize browser writes.
    const next = (webWrites.get(db) ?? Promise.resolve()).then(() =>
      db.withTransactionAsync(() => checked(db)),
    );
    webWrites.set(
      db,
      next.catch(() => {}),
    );
    return next;
  }
  await db.withExclusiveTransactionAsync(checked);
}
