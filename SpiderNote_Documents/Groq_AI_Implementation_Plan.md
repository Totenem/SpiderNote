# SpiderNote — next iteration and Groq AI plan

Date: October 31, 2026. Status: superseded by [the local AI implementation](Local_AI_Implementation.md). Retained as historical context. No Groq provider calls or credentials are enabled. The user's device feedback confirms basic recording/playback works; long-session and interruption checks remain part of beta testing.

## 1. UX corrections before AI

- Recordings tab: show all saved recordings, including interrupted/missing drafts that need review, with a New recording action. Library remains the combined home for written and voice notes.
- Respect bottom safe-area insets for the app tabs and screen content. Add a persisted Android Hide phone navigation bar preference, enabled by default, using Expo SDK 58's NavigationBar API. Android can reveal transient controls on swipe or while a system UI/keyboard is open; the app must remain usable when controls reappear.
- Note title: display the saved title with an explicit Edit title action; editing opens a bordered, labelled input with Save title and Cancel. Saving the title does not silently save unrelated description/tag edits. Leaving with an unsaved title still invokes the unsaved-changes guard.
- Strengthen visible input borders and keep labels on description and tags.
- Remove the duplicate search shortcut from Library. Keep search in the Search tab.
- Index titles, descriptions and tags with SQLite FTS5, including backfill for existing notes and triggers for edits/deletes. Match multiple word prefixes across fields and rank title matches more strongly. Debounce typing, cancel stale result delivery and avoid reloading notebooks per keystroke. Keep literal punctuation search and a parameterized keyword fallback when FTS5 is unavailable.

## 2. Five generated note formats

| Format ID | Display name | Draft structure |
| --- | --- | --- |
| meeting_minutes | Minutes of the meeting | Stated meeting details, discussed topics, decisions, action items, owners/dates only when present, open questions |
| recording_summary | Recording summary | Short overview, key points, conclusions, unresolved points |
| casual_note | Casual note | Clean, natural paragraphs that preserve the speaker's intent and voice |
| study_notes | Study / lecture notes | Concepts, definitions, explained examples, review questions clearly marked as generated |
| action_checklist | Action checklist | Concrete tasks and next steps, explicit owner/deadline or null, supporting source references |

Default: Recording summary. The user chooses one format before processing; the app automatically transcribes and generates that chosen draft after affirmative upload consent. Generating another format reuses the transcript rather than uploading/transcribing the same audio again. Do not generate all five by default: that increases cost and clutter.

Preserve the source language by default, including English/Filipino code-switching. Make output language a constrained option rather than silently translating every recording into English. Evaluate bilingual samples before advertising language quality. Missing people, dates, speaker identities and decisions must not be invented. A suggested title is a draft; never overwrite a manually edited title automatically.

## 3. User flow and local behavior

1. Open a saved recording and select Turn into a note.
2. Select format and output language. Show duration, estimated upload bytes, provider/retention disclosure and quota availability.
3. Confirm: audio will be sent to SpiderNote's processing server and Groq; the transcript will also be sent to Groq to draft the note. This is optional and requires internet. Preserve source audio locally.
4. Upload only after confirmation. Persist a local job first. Display waiting for connection, uploading, queued, transcribing, generating, succeeded, failed or cancelled accurately. Consent is bound to that recording, transcript revision and operation; an offline task does not become blanket permission for unrelated uploads.
5. Save the transcript locally as soon as transcription succeeds. If generation fails, retain that transcript and retry generation independently.
6. Show the generated draft beside the original recording and transcript. The user reviews/edits it. Accept into the written description only after an explicit action, with confirmation if an existing description will be replaced. Preserve the previous description as a local revision.
7. Generate another format from the transcript through a separate, quota-checked action. Changing a transcript invalidates stale generation results; a late response cannot overwrite newer edits.

Original audio, typed notes, playback and local search remain available if the backend is offline, quotas are exhausted, credentials expire or the user declines AI. Generated drafts are labelled as AI-generated and potentially inaccurate.

## 4. Backend and provider design

Use a separate HTTPS FastAPI service, a durable job store (Postgres), Redis for shared quotas/queue coordination, and a bounded worker for Groq and audio conversion. Do not perform long transcription work inside an HTTP request or an in-memory-only background task. Start with a single managed region/container deployment; choose the hosting account before live deployment.

The phone talks only to this service. The service owns the Groq API key, prompt templates, model allowlist, quotas and retention policy. Never expose a general-purpose chat proxy, arbitrary provider URL, raw messages array, custom system prompt or caller-selected model.

Groq supports M4A transcription, multilingual Whisper models, and strict structured outputs on selected text models. Benchmark `whisper-large-v3` and `whisper-large-v3-turbo` using consented/synthetic English/Filipino samples. For generation, evaluate a strict-schema model such as `qwen/qwen3.8-27b` from the current supported list; pin the chosen model and prompt version after quality/cost tests. Recheck availability during implementation. If the configured model disappears, return a clear retryable/configuration error rather than silently switching providers or weakening output validation.

Proposed v1 API:

- POST /v1/enroll: redeem an administrator-issued, single-use beta invitation for installation credentials; never an unrestricted credential-minting endpoint.
- POST /v1/session/refresh: rotate credentials with replay/revocation checks.
- POST /v1/jobs/transcribe: authenticated multipart upload, template/language enums and idempotency key.
- POST /v1/jobs/generate: authenticated transcript revision and format; transcript itself may be supplied when the temporary server copy has expired. Show text-sharing consent before sending a locally edited transcript.
- GET /v1/jobs/{id}: status/result for the authenticated owner only. Use bounded polling/backoff.
- DELETE /v1/jobs/{id}: owner-authorized cancellation/result deletion; stop pending work when possible and discard late results. Do not claim an already-sent provider request can always be recalled.

Tie each job, result and quota to the server enrollment identity. Test ownership on every read, retry, cancel and result fetch; do not rely on unguessable job IDs. Installation identifiers supplied by the phone are untrusted. Keep device credentials in Expo SecureStore when implementing the client. A static shared API secret embedded in the APK is not authentication.

Closed-beta enrollment limits new identities without requiring a user account. Use short-lived access tokens (proposed 10 minutes), rotating refresh credentials and server revocation. Reinstalling or spoofing a device ID must not create unlimited new quotas. For public release, evaluate Play Integrity or real account authentication; an open anonymous service cannot strongly prevent Sybil abuse using device IDs alone.

## 5. Upload and job limits

These are proposed application limits, not Groq's published account allowance. Keep them in server configuration and revise them after measuring real costs and the account's Limits dashboard.

| Control | Initial beta proposal |
| --- | --- |
| Incoming recording | 50 MB and 30 minutes maximum; reject over-limit input before a provider call |
| Provider upload | Normalize a temporary copy to mono AAC/M4A, target <=20 MB, then verify final bytes; current Groq direct-attachment cap is 25 MB |
| New expensive jobs | 2/minute and 10/day per enrollment, atomic shared counter |
| Audio allowance | 60 uploaded audio minutes/day per enrollment; reserve before processing, reconcile verified duration |
| Generation allowance | 20 drafts/day per enrollment, <=5 per recording/day |
| Concurrency | 1 active expensive job per enrollment; 2 workers globally initially |
| Status polls | 30/minute per enrollment with client backoff |
| Service ceiling | Explicit developer-approved daily currency budget, audio-second and token ceilings; default disabled until configured |

Check an ingress-wide and trusted-proxy-aware IP limit as additional protection, not as the user's identity. Avoid unfairly blocking a whole campus/shared mobile network with a tiny IP quota. Distributed counters and reservations must be atomic across workers/restarts. Fail closed on quota-store failure for new paid work, while keeping local app functions usable.

Groq limits apply to the organization and include request, token and audio-second dimensions. Respect provider 429 responses and Retry-After; use bounded exponential backoff with jitter (at most two retries), never tight retry loops. Reserve token/output budgets before dispatch. Cache/deduplicate by enrollment + audio digest or transcript revision + format + model/prompt version, never across different users. A lost response after provider acceptance can still incur cost; do not promise exactly-once billing without provider support. Surface ambiguous failures and avoid automatic duplicate submissions.

Validate actual byte count, file signatures and decoded duration; do not trust client MIME type, extension, Content-Length or claimed duration. Use random server filenames, temporary private storage, a decoder/transcoder with CPU/memory/time limits, restricted file-only protocols and no user-controlled command strings. Reject remote audio URLs to avoid SSRF. Keep the original phone recording unchanged. Add a chunking design later for recordings beyond the beta AI limit; local capture itself is not capped by the AI limit.

## 6. Prompt-injection and leakage defenses

No system prompt can be guaranteed unextractable. Treat prompt text as instructions, not a secret or authorization boundary. This is consistent with OWASP's guidance on system-prompt leakage. The app must remain protected even if someone learns the template wording.

- Keep keys, access tokens, database credentials, internal request headers, other users' notes and authorization rules out of model context entirely. Model input is only the authorized transcript and required, bounded metadata.
- Fixed, versioned server system prompt per operation; user requests contain only constrained format/language options. Treat all recording/transcript text as untrusted source material. An audio recording can contain spoken prompt injection.
- Provide transcript as a separate, clearly delimited data payload with segment IDs. Tell the model to summarize statements, not obey instructions embedded in them. Delimiters and warnings are defense in depth, not a proof of safety.
- Disable tools, browsing, code execution and arbitrary retrieval. The model cannot read server files/env vars, execute actions, choose an upload destination or change quota/identity. Network egress for the worker is limited to required provider/infrastructure hosts.
- Request strict structured output on a supported model, then independently validate it server-side with bounded fields, enum format IDs, capped arrays/output length and no unexpected properties. Schema adherence does not establish factual correctness or prevent all prompt injection.
- Require source segment references for decisions/action items; verify referenced IDs and any evidence quotes against the supplied transcript. Keep unknown owners/deadlines null. Let the user review generated content.
- Return only validated note fields. Never expose raw provider envelopes, hidden reasoning, full prompts, stack traces or debugging context to the app. Use redacted, fixed public error codes.
- Detect copied internal-template fragments/canaries and suspicious output for rejection/review; never depend solely on phrase filters. Display generated text as inert text/controlled Markdown. Do not execute HTML or automatically open/fetch generated links.
- Keep authentication, job ownership, quotas, request validation and spending controls in ordinary server code, never in the prompt. No model output is allowed to authorize operations or alter these rules.

Security tests must cover spoken/written "ignore previous instructions", fake system/developer roles, requests for the prompt/env variables, encoded and bilingual injections, malicious links, schema-shaped misinformation, replayed jobs, parallel quota races, spoofed installation IDs, unauthorized result access, oversized uploads and log redaction. Include adversarial generation evaluations; deterministic API tests alone cannot prove model safety.

## 7. Privacy and retention

Before enabling cloud processing, review the actual Groq account Data Controls and set Zero Data Retention where appropriate. Groq documents retention exceptions for abuse/reliability investigation unless opted out; do not promise that provider data is never retained without verifying account settings. Avoid Groq batch/fine-tuning features in this implementation.

Proposed SpiderNote server policy: delete temporary audio immediately after transcription on success/failure/cancellation; a scheduled sweeper enforces a short maximum lifetime for crash leftovers. Keep encrypted-at-rest transcript/results only for pending generation and client delivery, maximum 24 hours, then expire/delete. Support owner-triggered earlier deletion. Persist job status/usage counters without raw content. Redact audio, transcripts, prompts, authorization headers and signed URLs from logs/analytics/error reporting. Document backup TTL and deletion behavior for each managed service before shipping.

The phone retains its local source audio, transcript, accepted draft and prior description revision until the user deletes them. Cloud consent must explain both SpiderNote server handling and Groq handling, including cross-border processing where applicable. Provider retention settings do not automatically delete copies on SpiderNote's server.

## 8. Environment setup — before live integration, not before planning

Server secret manager / server environment only:

```dotenv
GROQ_API_KEY=<set privately on the backend host>
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_NOTE_MODEL=<validated strict-schema model>
DATABASE_URL=<server database credential>
REDIS_URL=<server quota/queue credential>
AUTH_SIGNING_KEY=<server-generated signing material>
AI_ENABLED=false
AI_DAILY_BUDGET_USD=0
AI_MAX_UPLOAD_MB=50
AI_MAX_AUDIO_SECONDS=1800
AI_MAX_PROVIDER_UPLOAD_MB=20
AI_ENROLLMENT_DAILY_AUDIO_SECONDS=3600
AI_ENROLLMENT_DAILY_GENERATIONS=20
```

These names are planned configuration, not implemented settings yet. Enable AI and set a nonzero daily budget only after test credentials, quotas and provider/account limits are verified. Configure exact global token/audio ceilings before enabling workers. Never commit actual secrets or paste them into chat.

Phone/EAS public configuration, once a real HTTPS backend exists:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://<your-backend-host>
```

Expo public variables are embedded in the bundle. Never create EXPO_PUBLIC_GROQ_API_KEY, and never move the Groq key into EAS client build variables and assume it stays secret if application code uses it. Server key rotation should not require rebuilding the APK. The public API URL must be set before building the cloud-enabled client (unless a separate reviewed runtime configuration design is adopted). UI-only builds and backend scaffolding do not require a Groq key.

## 9. Delivery sequence and gates

1. Ship/test the UX fixes independently. Recheck existing recordings and new search backfill after an in-place app upgrade. Do not uninstall the old build to upgrade, because that may erase local data.
2. Choose the backend hosting account, database/Redis region and Groq project; configure provider data controls and developer spending limits privately. Confirm how beta invitations are issued/revoked.
3. Build the API, durable queue and mocked Groq adapters with AI disabled. Add authentication, ownership, validation, quotas, idempotency and retention tests first.
4. Add transactional local migrations for transcripts (source + editable revision), jobs, generated drafts and description revisions. Jobs track template, source revision/digest, provider model and prompt version. Expand the search index to saved transcript text; rebuild the derived index without touching source audio.
5. Add per-request consent, upload/progress/retry UI, transcript editing and five draft templates. An unavailable/unconfigured backend must not disable local features.
6. Set the actual backend environment and a controlled nonzero budget, then run consented bilingual quality/cost tests and adversarial injection tests. Measure word accuracy, omissions, invented details, latency, memory, token use and audio cost.
7. Configure the public backend URL, create the cloud-enabled EAS preview APK and test on the user's Android device: offline behavior, consent, quota exhaustion, interrupted upload, failed generation after successful transcription, server restart, stale responses, duplicate taps and deletion during processing.
8. Public availability only after privacy/retention review, abuse controls and long-recording/recovery tests pass. Monetization remains outside this iteration.

## Sources reviewed

- [Expo SDK 58 NavigationBar](https://docs.expo.dev/versions/v58.0.0/sdk/navigation-bar/)
- [Expo SDK 58 SQLite / FTS configuration](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Groq speech-to-text](https://console.groq.com/docs/speech-to-text)
- [Groq strict structured outputs and model support](https://console.groq.com/docs/structured-outputs)
- [Groq organization rate limits and headers](https://console.groq.com/docs/rate-limits)
- [Groq data retention and controls](https://console.groq.com/docs/your-data)
- [Groq security onboarding](https://console.groq.com/docs/production-readiness/security-onboarding)
- [OWASP system-prompt leakage](https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/)
- [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
