# SpiderNote

Every thought, connected. An Android-first Expo SDK 58 app for recording, transcribing and keeping notes offline, with optional Pro AI note generation through Groq.

## Current workflow — 0.3.0

- Recording, playback, Whisper transcription, writing, notebooks/tags, FTS5 search, exports and saved drafts work locally without an account.
- Pro AI generation uses `openai/gpt-oss-120b` through server-only Expo API routes. Only the selected transcript and format are sent, after confirmation; audio stays local.
- Clerk hosted sign-in uses secure token storage. The backend verifies sessions and Pro entitlement. A server allowlist grants the developer account Pro; RevenueCat purchase/webhook integration is reserved for a later milestone.
- Upstash Redis atomically enforces concurrent-job, per-user, global and request-replay limits before contacting Groq. Backend configuration failures deny generation safely.
- Generated drafts retain exact source evidence, need user review, and cannot replace a description automatically. Accepting preserves the previous description. Transcript revisions protect against stale drafts.
- The home recording banner is compact. Settings contains account, preferences, notebooks, library actions and help. Offline benchmarks are no longer shown in normal Settings.
- Local Qwen generation/native bindings are retired. Whisper model downloads remain available. Native streaming SHA-256 replaces slow JavaScript model verification.

## Add your credentials

Copy [.env.example](.env.example) to `.env.local` in this project root and fill it in. See [Cloud setup and deployment](SpiderNote_Documents/Cloud_Setup.md) for each credential's source, EAS visibility, developer Pro access and exact commands.

The two public app values are `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL`. Set both before creating an APK. Groq, Clerk backend and Upstash credentials are server-only and must never use the public prefix. No real credentials are committed. Online features remain unavailable until credentials and a deployed backend are provided.

## Run and deploy

Use Node.js LTS and npm. In PowerShell, use the `.cmd` wrappers when script policy blocks `.ps1`.

```powershell
npm.cmd ci
npx.cmd expo start --dev-client
npm.cmd run backend:export
npx.cmd eas-cli@latest deploy --environment preview --alias preview
npx.cmd eas-cli@latest build --platform android --profile preview --non-interactive --no-wait
```

Set the deployed backend origin as the public API URL before building. Install a fresh native build for Clerk, secure storage and native hashing; Expo Go and old APKs cannot provide these modules. EAS project: [@totemn/spidernote](https://expo.dev/accounts/totemn/projects/spidernote), ID `0645aa00-3788-4d8d-ba29-3dbb490147fa`.

## Verify

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npx.cmd expo-doctor@latest
npx.cmd expo export --platform android --output-dir dist-android
npm.cmd run backend:export
```

Tests cover real SQL migrations/revision protection, recovery/deletion, grounding, cloud request validation, signed/invalid JWTs, entitlement denial and upstream failure handling. Cloud tests use generated test keys and mocked providers. Real Groq/Clerk/Upstash integration, native hashing/device behavior, free-hosting runtime limits and 4 GB phone support require live validation after setup. Benchmarks use prerecorded audio; no new recording is needed. Historical reports remain readable.

## Data and references

Source audio stays in app-private document storage. Only confirmed library deletion removes recordings; tombstones retain retryable cleanup. Local data is not synced to an account or separately encrypted by this app. Uninstalling/clearing storage may remove it; export important recordings and notes. [Report an issue](https://forms.gle/ZgD756Q3yxT45BZUA) opens your existing form without attachments or prefills.

See [Android acceptance checks](SpiderNote_Documents/Android_Beta_Checks.md), [current cloud setup](SpiderNote_Documents/Cloud_Setup.md), and the historical [local AI notes](SpiderNote_Documents/Local_AI_Implementation.md). SDK 58 still has transitive npm advisories; review before public release rather than forcing incompatible upgrades.

[Expo API routes](https://docs.expo.dev/router/web/api-routes/) · [SDK 58 Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/) · [SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) · [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
