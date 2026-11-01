export function apiUrl(path: string) {
  const origin = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (
    !origin ||
    (!origin.startsWith("https://") &&
      !(
        __DEV__ &&
        /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin)
      ))
  )
    throw Error(
      "Online features are temporarily unavailable. Your local library is still available.",
    );
  return `${origin}${path}`;
}
export async function accountRequest(
  path: string,
  token: string,
  options: RequestInit = {},
) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: options.signal ?? AbortSignal.timeout(15000),
  });
  const payload = await response
    .json()
    .catch(() => ({ error: "The service could not be reached." }));
  if (!response.ok)
    throw Error(payload.error ?? "The request could not be completed.");
  return payload;
}
