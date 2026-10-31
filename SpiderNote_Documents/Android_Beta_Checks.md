# Android beta acceptance gate

Status: automated storage checks and Android JS export are available. The following device checks are pending; do not treat an EAS build success as proof of recording reliability.

## Test devices

Record app version, Android API level, device model, free storage and build URL. Test at least two supported Android API levels before public release.

## Core offline flow

1. Install the preview APK, launch, complete onboarding. Confirm microphone permission has not yet been requested.
2. Enable airplane mode. Create a written note, edit/save, pin, assign a notebook, add English/Filipino tags, then find it through title, body and tag search.
3. Start recording, grant permission, speak for 30 seconds, pause for 10 seconds, resume for 10 seconds. Stop/save. Confirm the duration excludes the pause and playback contains both segments.
4. Seek, change speed and pause. Leave/reopen the note; confirm playback resumes near the saved position (two-second checkpoint tolerance).
5. Export TXT, Markdown and original audio. Open each exported file in another app. Exports of written notes do not contain the audio.
6. Record for 30 minutes with SpiderNote open. Save, play beginning/middle/end, restart and recheck.

## Interruptions and errors

- Deny microphone permission; notes remain usable. Deny permanently; use the app's settings shortcut and retry after granting permission.
- Start a recording then switch apps or lock the screen. Relaunch: inspect the interrupted note and review audio before keeping it.
- Force-stop during an active recording. Reopen: confirm the draft is visible as interrupted/missing, and no source audio is silently deleted. A buffered/unfinalized M4A may not play; record the observed result.
- Force-stop immediately after Stop & save. Confirm the finalized recording remains accessible.
- Stop immediately after starting. Confirm the UI can leave the recorder and exposes an unavailable/interrupted recording rather than claiming a valid save.
- Test a phone call, Bluetooth/headphone disconnection, and low storage. Check errors are visible, source files remain, and saving/reviewing or explicit discard is possible.
- Edit a note and press Android Back. Verify save/discard/stay choices. Cancel deletion; confirm audio and text remain. Confirm deletion removes both and a restart does not resurrect them.
- Delete a notebook; notes must remain unfiled. Create duplicate notebook names; receive an error without losing notes.
- Export important data, then test delete-all with both confirmations. Reopen and verify an empty library.

## Accessibility and layout

Test TalkBack labels, large text, keyboard avoidance, small phone layout, Android back gestures, and controls near navigation bars. Recording state must be understandable without relying on color or animation.

Cloud AI integration remains gated on these reliability checks. No network uploads are performed by the product flow in this build. Development tooling may communicate with Expo/Metro.

## Feedback regression checks (October 31)

- Upgrade in place using the same Android package and signing key; do not uninstall or clear storage. Confirm existing audio and descriptions remain available.
- Recordings tab lists existing recordings, excludes typed-only notes, and opens the saved audio. Its New recording action starts a fresh session.
- In three-button and gesture navigation modes, all app-tab labels stay above visible system controls. Hide phone navigation bar is enabled by default. Toggle it off/on in Settings and restart; the preference persists. Swipe from the bottom to reveal transient controls. Open/close the keyboard and system dialogs, then recheck the tabs. Check TalkBack and a large display/text size.
- Library no longer has a search shortcut; the Search tab remains available.
- Edit title: the bordered, labelled input is obvious, Cancel keeps the original title, Save title persists it across restart, and empty titles cannot be saved through the title action. Editing then pressing Back invokes the unsaved-change guard.
- Change the description, then save only the title. The description must remain marked unsaved; saving the title must not silently commit or discard those edits. Export with an unsaved title through the normal Save flow and check the exported title is correct.
- Search a word in a title, a word found only in a description, a tag, and a multiword query split between title and description. Word-start prefixes should match. Existing notes are indexed on upgrade. Edits and deletions immediately change results. Verify literal punctuation such as 100% does not become a wildcard. Type quickly and confirm old responses do not replace newer results.

Cloud AI design now has a separate [implementation plan](Groq_AI_Implementation_Plan.md). Planning can proceed from the user's positive basic-recording feedback while the longer hardware acceptance tests remain pending.
