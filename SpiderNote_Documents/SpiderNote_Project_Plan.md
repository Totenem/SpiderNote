# SpiderNote — Product Requirements & Technical Plan

**Version:** 0.1 | **Platform:** Android first | **Framework:** Expo / React Native + TypeScript | **Database:** SQLite | **Strategy:** Local-first, no account required

> **Tagline:** Every thought, connected.

## 1. Product vision
SpiderNote is a privacy-conscious voice recorder and AI-assisted note organizer. Users should be able to record, replay, edit, organize, and search notes without an internet connection. Transcription and AI summarization are optional enhancements; neither should block access to the original recording.

### Target users
Students, lecturers, professionals, interviewers, and people who capture spontaneous ideas. Primary initial market: Android users, including bilingual English/Filipino speakers.

### Differentiation
- No disruptive ads while recording or editing.
- Offline-first capture, playback, editing, and search; no sign-in required.
- Durable recordings and transparent processing status, with retry after failure.
- Explicit consent before audio/transcript leaves the device.
- Simple organization by notebooks and tags.

## 2. Brand and icon
**Name:** SpiderNote. **Concept:** a small friendly spider weaving a strand that turns into a folded sheet of lined paper, with web threads suggesting connected notes. **Style:** minimal vector mark, readable at 48px, rounded-square Android adaptive icon with foreground/background layers. **Palette:** ink #17132B, violet #7454D6, lavender #DCD1FF, cream #FCFAFF. Avoid fine details that disappear at launcher sizes. Produce monochrome notification icon and adaptive icon variants. **Tagline:** Every thought, connected.

## 3. Core user journeys
1. Tap Record → immediately create draft recording row and audio file → pause/resume → stop → see saved recording in library.
2. Open a recording → play/scrub audio → optionally request transcription → edit transcript → request summary → save note.
3. Create typed note without audio → tag or assign notebook → search by title/content.
4. Kill/restart app mid-session → recover any finalized audio segments and show interrupted recording with recovery guidance.
5. Go offline → recordings, playback, notes, tags, and full-text search still work; cloud AI tasks show 'Waiting for connection' and are user-initiated.

## 4. MVP requirements
### P0 — ship first
- Android onboarding (privacy-first, no login), permission request only when recording.
- Audio recording with pause/resume where supported; elapsed time, level indicator, recording status.
- Persistent audio storage via `expo-file-system` (or current supported file API) in app document directory, not cache.
- SQLite metadata and notes, notebooks, tags, audio paths, timestamps, durations, processing states.
- Audio playback with seek, speed options if supported, and resume position.
- Text note editor, search (SQLite FTS5 if available, otherwise indexed LIKE fallback), rename/delete, confirmation and local export TXT/Markdown.
- Processing jobs with queued/running/succeeded/failed states; clear errors and retry.
- User-controlled cloud transcription + summary through a server proxy; show consent and estimated data sharing before upload.
- Recording integrity checks on app restart; never delete source audio automatically after transcription failure.

### P1 — after MVP
- Speaker labels (only if provider supports them), transcript timestamps, summary templates (meeting, lecture, ideas), share sheet, backup/restore, biometric app lock, richer language selection.

### P2 — research / advanced
- Fully on-device STT, optional on-device summarization, semantic search, cross-device encrypted sync, linked notes / visual idea web, widgets, background recording.

## 5. Offline and AI policy
**Offline guaranteed:** recording (while app is active), saved audio playback, typed notes, notebook/tag management, search, exports. **Online in MVP:** speech-to-text and LLM summaries. Display this honestly in UI; do not call MVP 'fully offline AI'. Audio is uploaded only after an explicit user action. Users can opt out of all AI. Never embed vendor API keys in the Expo app.

**AI flow:** app → consent → short-lived authenticated upload/job request to backend → STT provider → transcript returned → optional LLM summary → local SQLite persistence. For no-account MVP, use rate-limited ephemeral device-scoped credentials or a controlled quota; treat device IDs as untrusted and abuse-prone. Delete server-side temporary files after processing and document provider retention. For cost control, cap audio duration/size and AI requests.

**Potential backend:** FastAPI + external STT and LLM provider adapters; host on a service with secure secrets and request limits. Backend is optional until online AI ships, but production client should never call paid AI providers using embedded secrets.

## 6. Recommended stack
| Layer | Choice | Reason |
|---|---|---|
| App | Expo + React Native + TypeScript | Fast Android delivery |
| Navigation | Expo Router | File-based navigation |
| DB | `expo-sqlite` | Durable offline relational storage |
| Audio | Current supported Expo audio recording/playback library (prefer `expo-audio`, verify SDK APIs) | Capture and replay |
| Files | `expo-file-system` | Persistent audio and export files |
| State | Zustand | Lightweight local UI state |
| DB queries | Typed repository layer + SQL migrations | Predictable storage and schema evolution |
| UI | NativeWind or custom StyleSheet tokens | Cohesive accessible design |
| AI backend | FastAPI (optional MVP service) | API key protection, quotas, provider flexibility |
| Tests | Jest / React Native Testing Library + Android E2E | Recovery and data integrity |
| Distribution | EAS Build + Google Play internal testing | Release workflow |

**Compatibility:** Confirm actual APIs and background behavior against the chosen Expo SDK and Android versions before implementation. Background recording and large on-device models may require a development build/native modules; do not assume Expo Go supports them.

## 7. Proposed database schema
```sql
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled', body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE recordings (
  id TEXT PRIMARY KEY, note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('recording','saved','interrupted','missing')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY, recording_id TEXT NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
  content TEXT NOT NULL, language TEXT, provider TEXT, created_at TEXT NOT NULL
);
CREATE TABLE summaries (
  id TEXT PRIMARY KEY, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'general', created_at TEXT NOT NULL
);
CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(note_id,tag_id)
);
CREATE TABLE ai_jobs (
  id TEXT PRIMARY KEY, recording_id TEXT REFERENCES recordings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('transcription','summary')),
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
  error_message TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
```
Enable `PRAGMA foreign_keys=ON`; use transactions for related writes. Add indexes on notes.updated_at, recordings.note_id, and ai_jobs.status. Add FTS5 with triggers after verifying runtime support. Keep file paths relative to the app document directory where practical so migrations/backups work.

## 8. Recording reliability design
- Create recording metadata first, then initialize persistent file. Use a temporary segment path during recording and atomically rename/finalize when supported.
- Persist checkpoints and periodically verify segment existence. App termination cannot guarantee the final buffered seconds will survive; recover valid file data where possible and disclose loss honestly.
- On launch, reconcile DB rows with existing audio files, mark interrupted/missing, and offer recovery rather than silently deleting.
- If using multiple segments for pause/resume, preserve segment manifest and merge only when safe; never overwrite the only source.
- Separate recording status from AI job status; an AI error must never corrupt or remove audio.
- Delete audio only after explicit confirmation, and keep deletion consistent with DB state.

## 9. Screens and navigation
**Tabs:** Library, Record (primary action), Search, Settings.
- Library: recent notes, filter by recordings/notebooks, pinned items, empty states.
- Recorder: large record button, timer, pause/resume, audio meter, save/discard.
- Note detail: title, audio player, transcript, summary, editable text, tags, share/export.
- Search: instant keyword search across title, body, transcript.
- Settings: privacy explanation, AI consent, language, export, storage usage, delete all local data.

## 10. Privacy, permissions, and security
Request microphone permission just-in-time. Keep notes and recordings in app-private storage. Use HTTPS for AI requests; never log raw audio/transcript or embed secrets. Disclose that cloud AI sends data to service providers. Provide per-recording delete and delete-all options. Consider OS-level file encryption, optional app lock, and encrypted backups later; SQLite by itself is **not encrypted**. If an app is uninstalled, app-private data may be lost unless separately backed up/exported. Define Google Play Data safety declarations according to actual implementation, not aspirational promises.

## 11. Monetization — planned, NOT part of initial build
**Decision (October 31, 2026):** SpiderNote Pro will be priced at **₱239 PHP/month** when monetization launches. This is a proposed price, not a currently available product. Annual pricing is **TBD**. RevenueCat is the intended subscription/paywall integration, but the developer needs time to create and configure a RevenueCat account and Google Play Billing first.

### Strict implementation scope
- **Phase 1 / initial app build:** Do **not** install RevenueCat SDKs, create paywall screens, implement Google Play Billing, add subscription database tables, build entitlement checks, or lock existing functionality behind a subscription. Build and test the app first.
- **Phase 2 / core app validation:** Test local recording, recovery, notes, search, transcription, summaries, and usability. AI cloud calls may require an explicit developer-configured API budget, rate limits, and consent, but **no paid plans or paywalls**. For an unreleased test build, developer-controlled AI quotas are acceptable to prevent unexpected costs.
- **Phase 3 / monetization (only after explicit approval):** Create RevenueCat project, configure Android products in Google Play Console, map RevenueCat entitlement (e.g. `pro`), add purchase/restore flows, design paywall, implement backend-verified entitlement and AI quotas, and test purchase lifecycle. Do not start this phase automatically.

### Future tier concept (subject to cost validation)
| Tier | Price | Planned positioning |
|---|---:|---|
| SpiderNote Free | ₱0 | Unlimited local recordings, offline notes, playback, organization, and search; limited cloud AI allowance when monetization is enabled |
| SpiderNote Pro | **₱239/month** | Larger monthly AI transcription allowance, advanced summaries, action items, AI note chat, and premium exports |

**AI minutes and limits are TBD**, pending measurement of real transcription and summarization costs. Avoid promising unlimited cloud AI. Existing local user notes and recordings must remain accessible if a subscription expires. Keep the app ad-free during recording and editing. RevenueCat's pricing and store fees should be rechecked when integration begins.

**Codex instruction:** Treat monetization as future roadmap documentation only. Do not write subscription or paywall code during the initial implementation, even if it appears in product mockups or future-feature lists.

## 12. Delivery roadmap
**Sprint 1 — Foundation (week 1):** Expo project, navigation, theme, SQLite migrations, typed repositories, basic Library UI.

**Sprint 2 — Reliable capture (week 2):** recording/playback, file persistence, recovery states, Android permissions, interrupted-session testing.

**Sprint 3 — Notes & discovery (week 3):** editor, notebooks/tags, search, exports, offline QA.

**Sprint 4 — AI integration (week 4):** FastAPI job API, consent flow, transcription, summarization, retries, quotas, privacy copy.

**Sprint 5 — Polish & beta (week 5):** usability, accessibility, storage cleanup, crash handling, internal Play test, privacy policy, store assets.

## 13. Definition of done / acceptance criteria
- Record a 30-minute session on a supported Android test device without losing the saved audio under normal conditions.
- Airplane mode: create, play, edit, search, and export notes with no account.
- Force-close/relaunch: finalized recordings remain accessible; interrupted recordings are detected and recoverable when underlying audio exists.
- Failed AI requests leave the source recording intact and support retry.
- No AI data is uploaded without an affirmative user action and clear disclosure.
- Delete note/audio operation behaves consistently; storage usage and cleanup are testable.
- Permissions, empty states, errors, and accessibility are verified on multiple Android API levels.

## 14. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Android app suspension / recording interruption | Foreground-first MVP; explicit recovery, device testing |
| Audio loss | Durable file paths, checkpoints, reconciliation, non-destructive retries |
| STT and LLM API costs | Limits, quotas, opt-in processing, transparent pricing |
| Sensitive audio upload | Consent, secure backend, retention policy, delete controls |
| Expo native compatibility | Pin Expo SDK, validate libraries in development build |
| SQLite FTS not available | Fallback to indexed keyword queries |
| Offline AI too heavy for typical devices | Defer to a separately benchmarked phase |

## 15. Suggested repository structure
```text
spidernote/
  app/                 # Expo Router screens
  src/components/      # Reusable UI
  src/features/        # recording, notes, search, ai
  src/db/              # SQLite migrations, repositories
  src/services/        # audio, files, API, recovery
  src/theme/           # tokens and styles
  assets/              # icon, splash, adaptive icon
  backend/             # optional FastAPI AI proxy
  tests/               # unit, integration, E2E
```

## 16. First implementation milestone
Deliver a fully offline **Record → Save → Play → Create/Edit Note → Search** vertical slice. Do not add AI until audio durability and recovery pass tests. This is SpiderNote's trust foundation.
