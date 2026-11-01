import {
  FORMATS,
  renderDraft,
  validateFacts,
  type NoteFormat,
} from "./grounding.ts";
export const CLOUD_MODEL = "openai/gpt-oss-120b";
export const MAX_CLOUD_TRANSCRIPT = 20000;
export type CloudRequest = {
  requestId: string;
  transcript: string;
  format: NoteFormat;
};
export function cloudRequest(value: unknown): CloudRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid request.");
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !["requestId", "transcript", "format"].includes(key),
    ) ||
    typeof data.requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      data.requestId,
    ) ||
    typeof data.transcript !== "string" ||
    !data.transcript.trim() ||
    data.transcript.length > MAX_CLOUD_TRANSCRIPT ||
    !FORMATS.some((item) => item.id === data.format)
  )
    throw Error(
      "Choose a note format and a transcript of up to 20,000 characters.",
    );
  return data as CloudRequest;
}
export const CLOUD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote", "kind", "text"],
        properties: {
          quote: { type: "string" },
          kind: {
            type: "string",
            enum: ["key_point", "decision", "task", "question", "definition"],
          },
          text: { type: "string" },
        },
      },
    },
  },
};
export function validateCloudDraft(
  raw: string,
  source: string,
  format: NoteFormat,
) {
  if (raw.length > 20000) throw Error("The AI draft exceeded its size limit.");
  const value = JSON.parse(raw);
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "items") ||
    !Array.isArray(value.items) ||
    value.items.length > 8
  )
    throw Error("The AI response had an invalid format.");
  for (const item of value.items)
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some(
        (key) => !["quote", "kind", "text"].includes(key),
      ) ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 600
    )
      throw Error("The AI response had an invalid passage.");
  const facts = validateFacts(
    JSON.stringify({
      items: value.items.map((item: { quote: unknown; kind: unknown }) => ({
        quote: item.quote,
        kind: item.kind,
      })),
    }),
    source,
  );
  const content = renderDraft(
    format,
    facts.map((fact, index) => ({
      ...fact,
      quote: value.items[index].text.trim(),
    })),
  );
  return { content, facts, model: CLOUD_MODEL };
}
