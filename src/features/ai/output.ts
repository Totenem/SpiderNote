import { validateFacts } from "./grounding.ts";

export type CompletionEnvelope = {
  text: string;
  content?: string;
  reasoning_content?: string;
  tokens_predicted?: number;
  tokens_evaluated?: number;
  truncated?: boolean;
  context_full?: boolean;
  interrupted?: boolean;
  stopped_limit?: number;
};
export function completionDiagnostics(result: CompletionEnvelope) {
  return {
    channel: typeof result.content === "string" ? "content" : "text",
    rawCharacters: result.text.length,
    contentCharacters: result.content?.length ?? 0,
    contentShape: !result.content?.trim()
      ? "empty"
      : result.content.trim().startsWith("{")
        ? "object-prefix"
        : "other",
    reasoningCharacters: result.reasoning_content?.length ?? 0,
    predictedTokens: result.tokens_predicted,
    evaluatedTokens: result.tokens_evaluated,
    truncated: result.truncated,
    contextFull: result.context_full,
    interrupted: result.interrupted,
    stoppedLimit: result.stopped_limit,
  };
}
export function completionFacts(result: CompletionEnvelope, source: string) {
  if (result.interrupted)
    throw Error(
      "Note generation was interrupted. Your transcript is unchanged.",
    );
  if (result.truncated || result.context_full || result.stopped_limit)
    throw Error(
      "Note generation reached its token or context limit. Try a shorter transcript.",
    );
  // Never salvage a JSON-looking substring from reasoning or arbitrary prose.
  const content =
    typeof result.content === "string" ? result.content : result.text;
  if (!content.trim())
    throw Error(
      "The model returned no answer content. Your transcript is unchanged.",
    );
  return validateFacts(content, source);
}

const marker =
  /\[(?:BLANK_AUDIO|NO_SPEECH|SILENCE)\]|<\|(?:nospeech|endoftext)\|>/gi;
export function cleanSpeechText(text: string) {
  return text.replace(marker, "").replace(/\s+/g, " ").trim();
}
export class NoSpeechError extends Error {
  constructor() {
    super("No speech was recognized. The recording has not been changed.");
  }
}

// Only digital near-zero samples are gated. This is not a general speech VAD:
// quiet speech, room noise and music must still be evaluated by the decoder.
export function hasAudiblePcm16(bytes: Uint8Array) {
  if (bytes.length % 2) throw Error("Invalid PCM sample boundary.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length; i += 2)
    if (Math.abs(view.getInt16(i, true)) > 1) return true;
  return false;
}
