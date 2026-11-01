# Cloud generation setup — 0.3.0

Recording, playback, Whisper transcription, transcript editing, search, saved notes, exports and draft review remain local. A user session is required only for online account actions and Pro AI generation. Generation sends the selected transcript and format to the backend and Groq; original audio is never uploaded. A confirmation appears before sending. There is no background upload or offline generation queue.

## 1. Add local values

In `C:\Users\Totem\Documents\personal-project\SpiderNote`, copy `.env.example` to `.env.local` if you do not already have a local environment file. Fill the blank values in that file, never in `app.json`, source code or chat. `.env.local` is ignored by Git.

| Variable | Where to get it | Scope |
| --- | --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API keys, `pk_test_...` for testing | Public app configuration |
| `EXPO_PUBLIC_API_URL` | Your deployed backend origin, for example `https://YOUR_SUBDOMAIN.expo.app` (no `/api` suffix) | Public app configuration |
| `GROQ_API_KEY` | Groq Console → API keys | Server only |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys, same application/instance as publishable key | Server only |
| `CLERK_JWT_ISSUER` | Exact issuer/Frontend API URL of that Clerk instance, normally `https://....clerk.accounts.dev` in development | Server only |
| `CLERK_JWT_KEY` | Optional Clerk JWT public key in PEM format; use `\n` for newlines | Server only configuration; enables networkless JWT validation |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis database → REST API HTTPS endpoint | Server only |
| `UPSTASH_REDIS_REST_TOKEN` | Same database → REST API token (write-capable, not read-only) | Server only |
| `SPIDERNOTE_DEV_CLERK_USER_IDS` | Clerk Dashboard → Users → your exact `user_...` ID; comma-separated if needed | Server only |

Enable Clerk's Native API and register Android namespace/package `com.totemn.spidernote` under Native applications. Hosted sign-in uses Clerk's Account Portal and the callback registered by the `@clerk/expo` config plugin. Enable the desired email sign-in/sign-up options. Create/sign in to your own user, then put its ID in `SPIDERNOTE_DEV_CLERK_USER_IDS`. This grants that identity SpiderNote Pro automatically on the server, without a purchase or a paid Clerk subscription. It does not bypass usage limits. Do not grant Pro using public or unsafe metadata.

For local development, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8081` for an Android emulator, or use an HTTPS development endpoint for a physical phone. Only loopback/emulator HTTP origins are accepted in development. Restart Metro with `npx.cmd expo start --clear --dev-client` after changing values. Native Clerk/secure-store/hashing changes require a new native build.

## 2. Set EAS variables

Open your Expo project → Environment variables. Use the **preview** environment while testing; use **production** for a production deployment. Add the same names/values as above. Choose **Plain text** for the two `EXPO_PUBLIC_` variables and **Sensitive** for the server credentials. EAS Hosting currently deploys Plain text/Sensitive variables, not variables with Secret visibility. Sensitive server credentials remain server-only because only `+api.ts` handlers import `src/server` and no server credential uses the public prefix.

The preview APK profile explicitly uses the preview environment. Public values are compiled into the APK. Adding them later on the server cannot activate an APK built without the publishable key or backend URL: build again after adding/changing those two values. Server credentials can change independently after a backend redeployment.

## 3. Export and deploy the backend

```powershell
npm.cmd run backend:export
npx.cmd eas-cli@latest deploy --environment preview --alias preview
```

The first deployment may ask for an EAS Hosting subdomain; choose it in Expo's Hosting settings or the CLI. `backend:export` uses Expo's documented `--no-ssg` mode and creates only API/server artifacts in `dist`, avoiding a website version of the native app. Use the returned HTTPS alias origin for `EXPO_PUBLIC_API_URL` in `.env.local` and the preview EAS environment, then build the APK:

```powershell
npx.cmd eas-cli@latest build --platform android --profile preview --non-interactive --no-wait
```

For production, set production environment variables, re-export, and run `npx.cmd eas-cli@latest deploy --environment production --prod`. Environment variables are attached to immutable deployments, so re-export/redeploy after server-variable changes. The app uses an absolute backend URL; it does not depend on experimental automatic server deployment. No EAS build status/log polling is needed after the build starts.

## Limits and entitlements

The server verifies the JWT signature, issuer, expiration, user subject and session ID. It never trusts user IDs, plan flags, models or prompts supplied in the body. Developer IDs are a server-only allowlist. For future subscription integration, only server-controlled Clerk `privateMetadata.spidernote = { plan: "pro", expiresAt: "ISO timestamp" }` grants other users Pro access. RevenueCat checkout and verified webhook processing are not implemented yet; use the Clerk user ID as the eventual RevenueCat app user ID. Public and unsafe metadata grant nothing.

Upstash runs one atomic Lua reservation before Groq: one active job/user, three attempts per fixed UTC minute, thirty attempts/user/UTC day, and default global budgets of 200,000 transcript characters and 100 attempts/UTC day. The app pins `openai/gpt-oss-120b`, at most 20,000 transcript characters and 4,096 completion tokens/request. Failed attempts count; request IDs cannot be replayed for 24 hours; locks expire and are released on completion/error. Missing auth/Redis/Groq configuration fails closed. Redis stores counters, IDs and locks only, not transcripts or drafts. Set Groq project spend limits as an additional account-level control.

Groq strict structured outputs are checked again on the server. Every note item requires an exact evidence quote from the source. The generated paraphrase may still misrepresent its evidence: this is not semantic factuality verification. Users must review drafts. No tools, browsing or code execution are provided to the model. Prompts contain no credentials. Keeping prompts on the server reduces exposure but does not guarantee immunity to prompt injection or prompt disclosure.

## Validation and pending live checks

Automated checks cover signed/forged/expired/wrong-issuer JWTs, free-user denial, oversized/forged requests, quota-denied calls never reaching Groq, pinned model and no tools, truncated/provider failures, lock-release callbacks, evidence validation and existing SQLite draft revision/restore behavior. These tests use generated test keys and mocked upstream services. The exported backend must also be smoke-tested with real Clerk/Groq/Upstash credentials after they are added. In particular, validate real Redis Lua execution/concurrency and EAS Hosting's free-plan CPU/subrequest limits. No claim of a live authenticated Groq completion is made without those checks.

On a phone: sign in, refresh your plan, verify Pro for your developer ID, generate each format from an existing transcript, review/accept/restore, then enable airplane mode and verify recording/transcription/editing/search/saving still work. Sign-out leaves the device's local library intact; this version does not synchronize libraries or isolate them by Clerk account. The local Qwen runtime is retired. Prior Qwen downloads are not used or deleted automatically. Offline benchmarks now test speech only; historical reports remain readable.

References: [Groq overview](https://console.groq.com/docs/overview), [structured outputs](https://console.groq.com/docs/structured-outputs), [Clerk Expo setup](https://clerk.com/docs/expo/getting-started/quickstart), [Expo API routes](https://docs.expo.dev/router/web/api-routes/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/usage/).
