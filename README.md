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
- Original audio sharing, TXT/Markdown note export, all-written-notes export, confirmed deletion and retryable file cleanup.
- Privacy onboarding, storage information, editable SVG identity and Android launcher/splash assets.

Android is the supported test target. A browser is not a supported storage/recording target for this milestone. No AI uploads, accounts, subscriptions or paywalls are implemented. The product plan requires audio durability and real-device recovery validation before cloud AI work.

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

## Structure

`src/app` holds Expo Router screens; `src/db` contains migrations and typed queries; `src/services` owns files, exports and recovery; `src/components` and `src/theme` provide the UI. Only confirmed deletion removes audio. A durable tombstone hides deleted notes while file cleanup retries.

Regenerate branded PNG assets with `npm.cmd run brand:generate`. The masters are in `assets/brand`. Android's automatic backup is disabled; users should export important notes/audio. App-managed SQLite is not encrypted. Clearing app storage or uninstalling may remove the library.

## Expo references

- [Create a project](https://docs.expo.dev/get-started/create-a-project/)
- [SDK 58 Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/)
- [SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)
- [Android APK builds](https://docs.expo.dev/build-reference/apk/)
