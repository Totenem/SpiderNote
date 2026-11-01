import { createClerkClient, verifyToken } from "@clerk/backend";
import { HttpError, required } from "./http.ts";
export async function identity(request: Request) {
  const match = /^Bearer (\S+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match || match[1].length > 12000)
    throw new HttpError(401, "Sign in to continue.");
  const secretKey = required("CLERK_SECRET_KEY");
  const issuer = required("CLERK_JWT_ISSUER");
  let token;
  try {
    token = await verifyToken(match[1], {
      secretKey,
      issuer,
      jwtKey: process.env.CLERK_JWT_KEY?.replace(/\\n/g, "\n"),
      authorizedParties: process.env.CLERK_AUTHORIZED_PARTIES?.split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
  } catch {
    throw new HttpError(401, "Your session expired. Please sign in again.");
  }
  if (
    token.sts === "pending" ||
    !token.sub?.startsWith("user_") ||
    typeof token.sid !== "string" ||
    !token.sid.startsWith("sess_")
  )
    throw new HttpError(401, "A signed-in user session is required.");
  return { userId: token.sub, secretKey };
}
export async function entitlement(userId: string, secretKey: string) {
  const developer = (process.env.SPIDERNOTE_DEV_CLERK_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(userId);
  if (developer) return { plan: "pro" as const, source: "developer" as const };
  const user = await createClerkClient({
    secretKey,
    telemetry: { disabled: true },
  }).users.getUser(userId);
  // Only server-owned private metadata is trusted. A future verified RevenueCat
  // webhook can update this object; public/unsafe metadata never grants access.
  const access = user.privateMetadata.spidernote as
    { plan?: unknown; expiresAt?: unknown } | undefined;
  const pro =
    access?.plan === "pro" &&
    typeof access.expiresAt === "string" &&
    Date.parse(access.expiresAt) > Date.now();
  return {
    plan: pro ? ("pro" as const) : ("free" as const),
    source: pro ? ("subscription" as const) : ("none" as const),
  };
}
