# SpiderNote

Every thought, connected. An Android-first, local voice and written notes app, created with the official Expo SDK 58 default template.

## Run

Use Node.js LTS (Node 24 was used for development) and npm. In Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution policy blocks the `.ps1` wrappers.

```powershell
npm.cmd ci
npx.cmd expo start --dev-client
```

Install an Android development build before connecting to Metro. For a standalone APK that runs without Metro, use the preview profile:

```powershell
npx.cmd eas-cli@latest build --platform android --profile preview
```

EAS project: [@totemn/spidernote](https://expo.dev/accounts/totemn/projects/spidernote), ID `0645aa00-3788-4d8d-ba29-3dbb490147fa`.

## Implemented in this milestone

- Just-in-time microphone permission, recording with pause/resume, timer and live microphone level.
- Source audio recorded directly into document storage, with metadata created before recorder preparation and two-second duration checkpoints.
- Foreground recording: leaving the app attempts to stop/save and marks audio for review. Keep the app open while recording.
- Startup reconciliation exposes interrupted or missing audio without deleting source files. Recovery means preserving available files; an abruptly terminated M4A may not be playable.
- Playback with seek, 1/1.5/2x speed and saved resume position.
- Written notes, explicit save, unsaved-change protection, pinning, notebooks, comma-separated tags, title/body/tag search.
- A dedicated recordings list, explicit title editing with Save/Cancel, and optional Android navigation-bar hiding with safe-area-aware app tabs.
- FTS5 word-prefix search across titles, descriptions and tags, with ranked results, typing debounce, upgrade backfill and keyword fallback.
- Original audio sharing, TXT/Markdown note export, all-written-notes export, confirmed deletion and retryable file cleanup.
- Privacy onboarding, storage information, editable SVG identity and Android launcher/splash assets.

Android arm64 is the supported target. A browser and Expo Go do not include the native inference modules. No AI uploads, accounts, subscriptions or paywalls are implemented.

## Offline AI beta

Open **Settings → Offline AI models & benchmarks** to download multilingual Whisper Base (~78 MiB) or Tiny (~42 MiB), plus official Qwen3 0.6B Q8 (~610 MiB). Downloads are explicit and checked against pinned SHA-256 hashes. No environment variables or API keys are needed. After downloading, inference works without an internet connection.

Open a note and choose **Offline transcription & AI notes**. Transcribe, correct/save the transcript, then choose meeting minutes, recording summary, casual note, study notes, or action checklist. The small model extracts exact source passages; deterministic layouts organize them. This beta produces extractive drafts, not unrestricted prose summaries. Review before accepting. Accepted drafts preserve the previous description for restoration; the recording and title remain intact. Transcript text is searchable.

Only one AI task/download runs at a time. Processing uses CPU with two threads and loads the speech and note models sequentially. Audio is decoded in private storage into 30-second PCM chunks, with a 30-minute/512 MB input limit. Leaving the app cancels processing. Interrupted jobs can be retried. **4 GB RAM is a target, not a validated support claim.**

The benchmark screen runs prerecorded English speech, silence, and English/Filipino/Taglish text fixtures, with optional existing audio import and a reference transcript. Choose one or three repetitions; export JSON timing, sampled memory, thermal status, model hashes and quality scores. No new recording is needed. Bundled tests do not establish natural Taglish speech accuracy or real meeting quality. Test on a physical target device in airplane mode after downloads.

**Report an AI issue** opens [your Google Form](https://forms.gle/ZgD756Q3yxT45BZUA). The existing form is unchanged; only its section-one workflow is used. No audio, transcript, diagnostics, prefilled answers or new sections are submitted by the app. Users can manually include a benchmark Run ID in their description.

See [local AI implementation and validation](SpiderNote_Documents/Local_AI_Implementation.md) for limitations and device acceptance checks.

## Verify

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npx.cmd expo-doctor@latest
npx.cmd expo install --check
npx.cmd expo export --platform android --output-dir dist-android
```

The tests execute the real SQL schema and repository queries against Node SQLite, including rollback, literal search, tags, interrupted recordings, and deletion retry. They model Expo's isolated transaction connections without inherited foreign-key PRAGMAs. They do not simulate Android microphone hardware or prove force-close M4A recovery.

See [Android beta checks](SpiderNote_Documents/Android_Beta_Checks.md) for the device acceptance gate. The SDK 58 toolchain currently has transitive npm advisories; review before public release. Do not apply `npm audit fix --force`, which proposes incompatible Expo downgrades.

The earlier [Groq plan](SpiderNote_Documents/Groq_AI_Implementation_Plan.md) is superseded by the local pipeline. Install the new native APK to use AI; a JavaScript update alone cannot add the inference modules.

## Structure

`src/app` holds Expo Router screens; `src/db` contains migrations and typed queries; `src/services` owns files, exports and recovery; `src/components` and `src/theme` provide the UI. Only confirmed deletion removes audio. A durable tombstone hides deleted notes while file cleanup retries.

Regenerate branded PNG assets with `npm.cmd run brand:generate`. The masters are in `assets/brand`. Android's automatic backup is disabled; users should export important notes/audio. App-managed SQLite is not encrypted. Clearing app storage or uninstalling may remove the library.

## Expo references

- [Create a project](https://docs.expo.dev/get-started/create-a-project/)
- [SDK 58 Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/)
- [SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)
- [Android APK builds](https://docs.expo.dev/build-reference/apk/)
