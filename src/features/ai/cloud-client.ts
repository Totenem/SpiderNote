import { randomUUID } from "expo-crypto";
import { accountRequest } from "../account/api";
import { CLOUD_MODEL, cloudRequest } from "./cloud-contract";
import type { GroundedFact, NoteFormat } from "./grounding";
export async function generateOnline(
  transcript: string,
  format: NoteFormat,
  token: string,
  signal: AbortSignal,
) {
  const input = cloudRequest({ requestId: randomUUID(), transcript, format });
  const result = await accountRequest("/api/generate", token, {
    method: "POST",
    body: JSON.stringify(input),
    signal: AbortSignal.any([signal, AbortSignal.timeout(75000)]),
  });
  if (
    typeof result.content !== "string" ||
    result.content.length > 20000 ||
    !Array.isArray(result.facts) ||
    result.model !== CLOUD_MODEL
  )
    throw Error(
      "The server returned an invalid draft. Your transcript is unchanged.",
    );
  return result as { content: string; facts: GroundedFact[]; model: string };
}
