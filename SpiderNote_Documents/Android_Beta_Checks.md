# Android native acceptance checklist

## Fresh install and model packaging
- Run npm run models:check; verify Qwen is 563,036,064 bytes and bundled Whisper is 81,768,585 bytes.
- Build a new native Android APK through EAS. Missing or corrupt model assets must fail the build.
- Install on a physical Android phone, enable airplane mode BEFORE first launch, and keep it enabled throughout core workflow checks.
- Write a note, record and transcribe voice, import and transcribe local audio, and generate a structured note. No login, network call, download or model selection may be required.

## Visual editor
- Verify open writing area, title, Back, Undo, Redo, More and Done using SpiderNote colors.
- Apply H1-H4/body, bold/italic/underline/strike, bullets, numbering, checklists, indent/outdent and each alignment.
- Select text, open Aa and apply a format: the original selection must remain selected. Test cursor insertion styles, Android IME composing text, long notes, paste, undo/redo, screen rotation restrictions and small screens.
- Toolbar stays above keyboard without covering the caret. Done saves the final keystroke, hides keyboard, and survives reopening. Back offers save/discard for unsaved changes.
- Paste HTML with links, scripts and image URLs: text must remain readable, no scripts or network navigation may execute.

## Voice and structuring
- Test English, Filipino and mixed Taglish. Review actual transcription accuracy and structure quality.
- Test M4A/AAC, MP3 and WAV; cancel picker; reject empty, corrupt, unsupported and 512 MB files. Source audio must stay playable after cancellation, errors or app interruption.
- Correct raw text, generate, inspect preview, save, retry and discard. Neither raw nor old structured content may be replaced without acceptance.
- Edit raw text after generation: structured version becomes outdated. Stale results cannot be accepted.
- Test silence, 30-second chunk boundaries, long notes, output/context limits, low storage, low memory, cancel, background, process termination, retry and restart recovery.

## Library and data
- Upgrade an existing v1/v2 database. Preserve notes, descriptions, transcripts, recordings, drafts, tags and notebooks.
- Search both raw and structured text. Verify create/rename/delete notebooks, tag changes, pins and recordings filter.
- Export TXT/HTML and inspect both versions. Cancel deletion; confirm deletion during inference; restart and verify no deleted content returns. Models must remain usable after library deletion.
- Phone navigation auto-hides after resume and keyboard dismissal; swipe still reveals system controls. No preference toggle exists.

## Measurements (not yet established by desktop tests)
Record phone/Android/build version, total/free RAM, model loading time, transcription duration, generation time, peak PSS/RSS, thermal status, APK size and installed storage. Check a 4 GB RAM phone and a newer device. Reuse ai_jobs.metrics_json for completed-job timings and memory samples. A sub-1 GB model file does not guarantee sub-1 GB RAM usage.
