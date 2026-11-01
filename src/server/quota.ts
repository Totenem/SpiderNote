import { HttpError, required } from "./http.ts";
// Atomic Redis reservation: one in-flight job/user, 3/minute, 30/day, and an
// application-wide daily character budget. Failed attempts still count to
// prevent retries from defeating cost controls. No transcript is stored.
export const RESERVE_LUA = `
if redis.call('EXISTS',KEYS[1]) == 1 then return 'duplicate' end
if redis.call('EXISTS',KEYS[2]) == 1 then return 'busy' end
if tonumber(redis.call('GET',KEYS[3]) or '0') >= 3 then return 'minute' end
if tonumber(redis.call('GET',KEYS[4]) or '0') >= 30 then return 'day' end
if tonumber(redis.call('GET',KEYS[5]) or '0') + tonumber(ARGV[2]) > tonumber(ARGV[3]) then return 'global' end
if tonumber(redis.call('GET',KEYS[6]) or '0') >= tonumber(ARGV[4]) then return 'global' end
redis.call('SET',KEYS[1],'1','EX',86400)
redis.call('SET',KEYS[2],ARGV[1],'EX',120)
redis.call('INCR',KEYS[3]); redis.call('EXPIRE',KEYS[3],120)
redis.call('INCR',KEYS[4]); redis.call('EXPIRE',KEYS[4],172800)
redis.call('INCRBY',KEYS[5],ARGV[2]); redis.call('EXPIRE',KEYS[5],172800)
redis.call('INCR',KEYS[6]); redis.call('EXPIRE',KEYS[6],172800)
return 'ok'`;
const RELEASE_LUA = `if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
async function command(args: (string | number)[]) {
  const url = required("UPSTASH_REDIS_REST_URL");
  if (!url.startsWith("https://"))
    throw new HttpError(503, "Quota service unavailable.");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("UPSTASH_REDIS_REST_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new HttpError(503, "Quota service unavailable.");
  const data = await response.json();
  if (data.error) throw new HttpError(503, "Quota service unavailable.");
  return data.result;
}
export async function reserve(
  userId: string,
  requestId: string,
  characters: number,
) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const day = new Date(now).toISOString().slice(0, 10);
  const prefix = `spidernote:{quota}:v1:${userId}`;
  const lock = `${prefix}:active`;
  const budget = Number(process.env.AI_GLOBAL_DAILY_CHAR_LIMIT ?? "200000");
  const requestBudget = Number(
    process.env.AI_GLOBAL_DAILY_REQUEST_LIMIT ?? "100",
  );
  if (
    !Number.isSafeInteger(budget) ||
    budget < 1 ||
    !Number.isSafeInteger(requestBudget) ||
    requestBudget < 1
  )
    throw new HttpError(503, "Quota service unavailable.");
  const result = await command([
    "EVAL",
    RESERVE_LUA,
    6,
    `${prefix}:request:${requestId}`,
    lock,
    `${prefix}:minute:${minute}`,
    `${prefix}:day:${day}`,
    `spidernote:{quota}:v1:global:${day}`,
    `spidernote:{quota}:v1:global-requests:${day}`,
    requestId,
    characters,
    budget,
    requestBudget,
  ]);
  if (result !== "ok")
    throw new HttpError(
      result === "duplicate" ? 409 : 429,
      result === "duplicate"
        ? "This request was already submitted. Start a new generation to retry."
        : result === "busy"
          ? "A note is already being generated. Please wait."
          : "AI usage limit reached. Please try again later.",
      60,
    );
  return async () => {
    await command(["EVAL", RELEASE_LUA, 1, lock, requestId]);
  };
}
