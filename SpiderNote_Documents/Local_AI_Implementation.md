# Offline AI implementation

The current product contract is the offline workflow documented in ../README.md. Both fixed models ship in Android assets via plugins/with-bundled-models.cjs. Run npm run models:prepare before a native build; the build fails on missing or mismatched weights.

Whisper base multilingual Q8 transcribes recorded or imported audio. Qwen3.5-0.8B Q4_0 organizes raw note text with no thinking mode and a 4096-token context. Notes are chunked rather than silently truncated. Output is sanitized rich text reviewed before acceptance. Raw and Structured versions are independently editable, and raw revision checks reject stale generated results.

Only one inference job runs at once. Models are loaded lazily and released after processing. The Android native support module handles asset provisioning, hashing, audio preparation and memory sampling. Audio is decoded to temporary 30-second PCM16 WAV chunks. Source files remain in app-private storage.

No account, cloud inference, server quota, billing, API key, model picker or runtime model download exists. EAS is used for native builds, not note processing.

Device acceptance is mandatory: successful JavaScript checks cannot establish native model compatibility or summary quality. Do not substitute another model if Qwen fails; record the failure and resolve compatibility.
