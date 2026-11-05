# SpiderNote

An Android-first Expo SDK 58 notebook. Write formatted notes, record voice, or import audio; optionally turn the raw text into a structured version entirely on-device. No account, API keys, backend, model selection, or in-app model download.

## Development

Use Node and npm (package-lock.json). Install with npm ci. Prepare native model assets with npm run models:prepare before building. Run npm start for Metro. Native AI and the editor need a fresh Android development/preview build; Expo Go cannot run the custom module. Build with npx eas-cli@latest build --profile development --platform android (or preview).

The build checks both asset sizes and SHA-256 checksums. EAS uploads the locally prepared model assets using .easignore; model binaries are intentionally excluded from Git. Never build with missing model files. npm run models:check validates the local weights. llama.rn native artifacts are installed by its approved dependency lifecycle script.

## Included models

- Whisper base multilingual Q8: 81,768,585 bytes, MIT.
- Qwen3.5-0.8B Q4_0: 563,036,064 bytes, Apache-2.0. Text-only, non-thinking, CPU inference.

Pinned source URLs, revisions, hashes and licenses are in assets/models/manifest.json. The Qwen file is below 1 GB; that is not a RAM or installed-app-size promise. Models are shipped in Android assets and copied into private writable storage on first use, with checksum verification. No network connection is needed on first launch. This increases installed storage beyond the combined weight-file size.

## Notes and privacy

The editor uses a bundled contenteditable document in react-native-webview. HTML is restricted to writing formats; pasted text is inserted as plain text. The document blocks network resources and external navigation. Raw and Structured versions are stored separately in SQLite. Search and inference use derived plain text. AI never automatically replaces either saved version.

New recordings and imported M4A/AAC, MP3 and WAV files are saved before transcription. Android decoder support varies; files must be below 512 MB. Processing is foreground-only and cancellable. Notes and recordings stay on the device; SQLite is not encrypted. Uninstalling or clearing storage removes local data. Export important notes first. The optional Help report link opens an external form with no note content attached.

Version 3 migrates old notes, transcripts and drafts without dropping originals. Legacy descriptions remain accessible in note options. Notebook management lives in the library. Settings provides exports, deletion and help only. Android phone navigation hides automatically.

## Checks

- npm run lint
- npm run typecheck
- npm test
- npm run models:check

See SpiderNote_Documents/Android_Beta_Checks.md for required native acceptance tests. Desktop checks do not prove Android editor selection behavior, inference compatibility, quality, memory or speed. Other platforms retain manual note editing; offline AI targets Android only.
