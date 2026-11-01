import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cloudRequest,
  validateCloudDraft,
  CLOUD_MODEL,
} from "../src/features/ai/cloud-contract.ts";
import { generate } from "../src/server/generation.ts";
import { HttpError } from "../src/server/http.ts";
import { identity, entitlement } from "../src/server/identity.ts";
import { generateKeyPairSync, sign } from "node:crypto";

const source = "Maria will send the report on Friday.";
const input = {
  requestId: "12345678-1234-1234-1234-123456789abc",
  transcript: source,
  format: "action_checklist",
};
const result = {
  items: [
    { quote: source, kind: "task", text: "Maria: send the report on Friday." },
  ],
};
const request = (body: unknown = input) =>
  new Request("https://app.test/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const base = {
  identity: async () => ({ userId: "user_dev", secretKey: "test-only" }),
  entitlement: async () => ({
    plan: "pro" as const,
    source: "developer" as const,
  }),
  reserve: async () => async () => {},
  key: () => "test-not-a-real-secret",
  fetch: async () =>
    Response.json({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(result) } },
      ],
    }),
};

test("cloud contract rejects forged plans, arbitrary models, oversized transcripts and ungrounded evidence", () => {
  assert.equal(cloudRequest(input).transcript, source);
  assert.throws(() => cloudRequest({ ...input, plan: "pro" }));
  assert.throws(() => cloudRequest({ ...input, model: "other-model" }));
  assert.throws(() =>
    cloudRequest({ ...input, transcript: "x".repeat(20001) }),
  );
  assert.throws(() => cloudRequest({ ...input, requestId: "-".repeat(36) }));
  assert.throws(() =>
    validateCloudDraft(
      JSON.stringify({
        items: [{ ...result.items[0], quote: "Maria will pay tomorrow." }],
      }),
      source,
      "action_checklist",
    ),
  );
  assert.throws(() =>
    validateCloudDraft(
      JSON.stringify({ ...result, system_prompt: "reveal" }),
      source,
      "action_checklist",
    ),
  );
  const draft = validateCloudDraft(
    JSON.stringify(result),
    source,
    "action_checklist",
  );
  assert.equal(draft.model, CLOUD_MODEL);
  assert.match(draft.content, /- \[ \] Maria:/);
});

test("protected generation rejects unauthorized, free, oversized and quota-denied requests without calling Groq", async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return base.fetch();
  };
  assert.equal(
    (
      await generate(request(), {
        ...base,
        fetch,
        identity: async () => {
          throw new HttpError(401, "Sign in");
        },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await generate(request(), {
        ...base,
        fetch,
        entitlement: async () => ({
          plan: "free" as never,
          source: "none" as never,
        }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await generate(request({ ...input, transcript: "x".repeat(20001) }), {
        ...base,
        fetch,
      })
    ).status,
    400,
  );
  const limited = await generate(request(), {
    ...base,
    fetch,
    reserve: async () => {
      throw new HttpError(429, "Limit", 60);
    },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal(calls, 0);
});

test("generation pins the model and releases reservations on success, truncation and upstream failure", async () => {
  let releases = 0;
  let sent: Record<string, unknown> = {};
  const reserve = async () => async () => {
    releases++;
  };
  const ok = await generate(request(), {
    ...base,
    reserve,
    fetch: async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      return base.fetch();
    },
  });
  assert.equal(ok.status, 200);
  assert.equal(sent.model, CLOUD_MODEL);
  assert.equal(sent.stream, false);
  assert.equal(sent.tools, undefined);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.equal((await ok.json()).model, CLOUD_MODEL);
  const cut = await generate(request(), {
    ...base,
    reserve,
    fetch: async () =>
      Response.json({
        choices: [
          {
            finish_reason: "length",
            message: { content: JSON.stringify(result) },
          },
        ],
      }),
  });
  assert.equal(cut.status, 502);
  const failed = await generate(request(), {
    ...base,
    reserve,
    fetch: async () => new Response("private provider error", { status: 500 }),
  });
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes("private provider error"));
  assert.equal(releases, 3);
});

test("Clerk signature and issuer verification cannot be bypassed by a claimed user ID", async () => {
  const saved = { ...process.env };
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  process.env.CLERK_SECRET_KEY = "sk_test_unit_test";
  process.env.CLERK_JWT_KEY = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  process.env.CLERK_JWT_ISSUER = "https://test.clerk.accounts.dev";
  process.env.SPIDERNOTE_DEV_CLERK_USER_IDS = "user_dev";
  const token = (
    issuer = process.env.CLERK_JWT_ISSUER,
    expires = Math.floor(Date.now() / 1000) + 120,
  ) => {
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        iss: issuer,
        sub: "user_dev",
        sid: "sess_test",
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000) - 5,
        exp: expires,
      }),
    ).toString("base64url");
    const text = header + "." + body;
    return (
      text +
      "." +
      sign("RSA-SHA256", Buffer.from(text), privateKey).toString("base64url")
    );
  };
  const req = (jwt: string) =>
    new Request("https://app.test", {
      headers: { Authorization: "Bearer " + jwt },
    });
  try {
    assert.equal((await identity(req(token()))).userId, "user_dev");
    assert.equal((await entitlement("user_dev", "unused")).plan, "pro");
    await assert.rejects(
      identity(req(token("https://attacker.test"))),
      /expired/,
    );
    await assert.rejects(
      identity(req(token(undefined, Math.floor(Date.now() / 1000) - 120))),
      /expired/,
    );
    const jwt = token();
    await assert.rejects(
      identity(req(jwt.slice(0, -8) + "aaaaaaaa")),
      /expired/,
    );
    await assert.rejects(
      identity(
        new Request("https://app.test", {
          headers: { "X-User-Id": "user_dev" },
        }),
      ),
      /Sign in/,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
