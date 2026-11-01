export class HttpError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export const json = (value: unknown, status = 200, retryAfter?: number) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
export function failure(error: unknown) {
  return error instanceof HttpError
    ? json({ error: error.message }, error.status, error.retryAfter)
    : json(
        {
          error:
            "The service is temporarily unavailable. Your saved transcript is unchanged.",
        },
        503,
      );
}
export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new HttpError(503, "This service is temporarily unavailable.");
  return value;
}
export async function boundedJson(request: Request, maxBytes: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use JSON for this request.");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body missing.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
