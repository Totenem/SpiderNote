# SpiderNote — Brand Identity & Social Media Marketing Playbook

**Version:** 1.0  
**Product:** SpiderNote, a local-first voice notes and AI summaries app  
**Primary platform:** Android (Expo / React Native)  
**Positioning:** Private, reliable voice capture that turns scattered thoughts into organized notes.

> **Brand promise:** Capture your thoughts. Let SpiderNote weave them into organized notes.

## 1. Brand Strategy

### Purpose
Help people capture ideas, meetings, classes, and personal reflections without losing recordings, being interrupted by ads, or surrendering control of their notes.

### Mission
Make voice-first note-taking dependable, calm, accessible, and useful even when the internet is unavailable.

### Vision
Become the trusted personal home for spoken thoughts and connected ideas.

### Brand values
- **Ownership:** Notes and recordings belong to the user; local storage is the default.
- **Reliability:** Recording must work first; AI is an enhancement, not a dependency.
- **Clarity:** Turn messy spoken thoughts into understandable, actionable notes.
- **Calm:** No intrusive ads or attention-grabbing interruptions while recording.
- **Honesty:** Explain that writing, transcription and note structuring run on-device with bundled models.

### Target audiences
| Audience | Core job | Key message | Content angle |
|---|---|---|---|
| Students | Capture lectures and review ideas | Record now, organize later | Study routines, lecture notes |
| Professionals | Preserve meeting details | Never lose the important follow-up | Meeting recap workflows |
| Creators | Catch spontaneous ideas | Save ideas before they disappear | Idea capture, content brainstorming |
| Journalers | Speak instead of typing | A quieter way to remember | Voice journaling and reflection |

### Competitive positioning
**For** people who think out loud and need their notes to be dependable, **SpiderNote** is a local-first voice note app that saves recordings on-device and organizes them into useful notes. **Unlike** ad-heavy, cloud-dependent alternatives, SpiderNote prioritizes uninterrupted capture, local ownership, and transparent AI processing.

**Avoid unverified claims:** Do not say “100% private,” “fully offline AI,” “end-to-end encrypted,” or “never loses a recording” unless those properties are implemented and tested. For MVP, recording, playback, editing, and search are offline; transcription and summaries may require an explicit online action.

## 2. Naming, Voice & Messaging

**Name:** SpiderNote  
**Pronunciation:** SPY-der-note  
**Primary tagline:** Every thought, connected.  
**Supporting tagline:** Capture it. Weave it. Remember it.  
**One-liner:** A local-first voice notes app that helps you capture, organize, and revisit your thoughts.

### Brand personality
Thoughtful, approachable, quietly clever, helpful, modern. Not childish, overly technical, or overly corporate.

### Tone of voice
- Short, clear sentences; friendly and confident.
- Demonstrate benefits with real use cases, not vague AI hype.
- Use “your notes stay on your device” only for data that actually remains local.
- Explain cloud features in plain language: “This summary uses online AI. Your recording will be uploaded for processing only if you choose to continue.”
- Humor can reference tangled thoughts, threads, webs, and forgotten ideas, but avoid spider-horror imagery.

### Message hierarchy
1. **Capture reliably:** Press record and stay focused.
2. **Keep control:** Recordings and notes are stored locally by default.
3. **Find clarity:** Convert voice into searchable transcripts and optional summaries.
4. **Stay organized:** Tags, folders, and search keep ideas connected.

### Copy examples
- **Hero:** Your thoughts deserve a place to land.
- **Subhead:** Record your ideas, save them locally, and turn them into notes worth keeping.
- **Recording CTA:** Start recording
- **Empty state:** Your web of ideas starts with one note.
- **Successful save:** Safely tucked into your notes.
- **AI disclosure:** Summarizing uses an online service. Continue?
- **Notification (if enabled):** Have a thought? Catch it before it flies away.

## 3. Visual Identity

### Logo concept
A friendly, geometric spider weaving a single continuous thread into a folded sheet of paper or a note card. The web should feel like an elegant organizing pattern rather than a trap.

**Primary icon direction:** Rounded-square dark-violet background; a compact lavender spider silhouette near the upper center; one silk line forming the outline or ruled lines of a small white note. Recognizable at 48 × 48 px.

**Logo variants:** Full-color app icon, one-color silhouette, light-background wordmark, dark-background wordmark, small monochrome notification icon.

**Construction rules:**
- Use 1–2 dominant shapes plus a single thread motif.
- Prefer 4–6 visible legs in small-scale icon variants if eight legs clutter the mark; the full mascot can show eight.
- No tiny text, gradients dependent on subtle contrast, or intricate web strands in the app icon.
- Keep generous safe space and test at 24, 48, 96, and 512 px.
- Create editable vector masters (SVG/Figma), then export platform-specific raster assets.

### Color palette
| Role | Hex | Usage |
|---|---|---|
| Midnight Web | `#17132D` | Primary dark surfaces, app icon background |
| Spider Violet | `#7755E8` | Main CTA, active controls |
| Silk Lavender | `#C5B8FF` | Accents, highlights |
| Paper White | `#F9F8FC` | Light backgrounds |
| Ink Charcoal | `#252238` | Primary text |
| Thread Gray | `#827F92` | Secondary text |
| Mint Signal | `#47B69B` | Saved/success state |
| Alert Coral | `#E76B73` | Errors, recording warnings |

**Accessibility:** Verify WCAG contrast in the final UI; do not assume these pairings are automatically compliant. Use labels/icons in addition to color for status.

### Typography
- **Headlines:** Manrope or Plus Jakarta Sans (SemiBold/Bold).
- **Body/UI:** Inter (Regular/Medium).
- **Numerals/timestamps:** Inter with tabular figures.
- Avoid decorative horror, handwritten, or spider-themed fonts.

### Photography and illustration
Soft desk setups, real phones, study sessions, meeting notes, voice waveforms, paper textures, minimal spider-thread motifs. Use real product screenshots wherever possible. Avoid stock imagery pretending to show the product.

### Motion
A single thread gently draws as recording starts; a subtle web connection appears when a note is saved. Respect reduced-motion settings. Recording state must remain obvious without animation.

## 4. Product Branding Touchpoints

- **Splash screen:** Icon centered on Midnight Web.
- **Onboarding:** Three panels — Capture / Keep / Connect — plus a transparent AI privacy disclosure.
- **Home:** “Your web of notes” with recent recordings and quick record.
- **Recording:** Large, unmistakable recording indicator, elapsed time, pause, stop, and save state.
- **Store listing short description (draft):** “Record voice notes, keep them local, and organize ideas with AI.”
- **Store screenshots:** (1) One-tap recording; (2) Notes saved locally; (3) Search and tags; (4) Optional AI transcript; (5) Clear summary and action items.
- **Store listing honesty:** Only show functionality available in the released build. Follow Google Play’s current listing, permission, data-safety, and AI policies at launch.

## 5. Social Media Strategy

### Objectives (first 90 days)
1. Validate demand for ad-free, local-first voice notes.
2. Build a waitlist or early-access community.
3. Recruit 30–50 Android beta testers.
4. Drive qualified Play Store visits and learn which messages convert.
5. Collect feedback on reliability, transcription quality, and language support.

**These are planning targets, not forecasts.**

### Channel roles
| Channel | Primary format | Purpose | Cadence |
|---|---|---|---|
| TikTok | 15–35 sec vertical demos | Discovery, problem/solution | 3 posts/week |
| Instagram Reels | Recut demos and workflows | Reach and brand recall | 3 posts/week |
| Instagram Stories | Polls, progress, Q&A | Community feedback | 2–4 stories/week |
| Facebook | Short demos, study/productivity communities | Local audience and beta recruitment | 2 posts/week |
| Threads | Build-in-public notes, questions | Conversation and feedback | 3 posts/week |
| YouTube Shorts (optional) | Repurposed short demos | Search/discovery | 1–2 posts/week |

**Production approach:** Film three original vertical clips each week; repurpose with channel-specific captions instead of creating entirely new footage for every channel.

### Content pillars
| Pillar | Share | Examples |
|---|---:|---|
| Product demos | 35% | Recording, playback, note search, summary preview |
| Problems and solutions | 25% | Forgotten ideas, ads during recording, scattered notes |
| Build in public | 20% | Expo/SQLite progress, design choices, bugs fixed |
| Productivity use cases | 15% | Class recap, meetings, journaling |
| Community feedback | 5% | Polls, beta feedback, requested features |

### Creative rules
- Hook in the first 2 seconds with a concrete problem.
- Show the actual app in the first 5 seconds when possible.
- Use on-screen captions and readable phone recordings.
- One video = one problem, one feature, one CTA.
- Avoid fake user testimonials, inflated install claims, or misleading “offline AI” demos.
- Do not show real private recordings or identifiable meeting participants without permission.

## 6. Launch Campaign

### Phase 1 — Prelaunch (Weeks 1–2)
**Goal:** Validate messaging and gather early interest.
- Publish the icon reveal and product concept.
- Show local note saving and a first recording prototype.
- Launch a simple landing page with email signup and privacy notice.
- Ask followers: “What makes a voice note app frustrating?”
- Recruit a small group of students, creators, and professionals.

### Phase 2 — Closed Beta (Weeks 3–4)
**Goal:** Test reliability and capture testimonials with consent.
- Invite 30–50 Android testers through a managed beta channel.
- Test interrupted recording, low storage, app restarts, and offline behavior.
- Publish honest demos and bug-fix updates.
- Collect structured feedback after 3 and 7 days.
- Track crash-free sessions, save success, and successful note retrieval.

### Phase 3 — Public Launch (Weeks 5–6, subject to readiness)
**Goal:** Convert interest into installs and useful feedback.
- Publish a 20–30 second launch video.
- Share Play Store listing with a single clear CTA.
- Post three use-case demos in the launch week.
- Respond to comments and reviews without requesting incentivized ratings.
- Fix critical bugs before increasing promotion.

### Phase 4 — Postlaunch (Weeks 7–12)
**Goal:** Improve retention and discover repeatable acquisition.
- Share requested features and product improvements.
- Test messaging for students vs professionals vs creators.
- Create tutorials based on support questions.
- Publish transparent progress recaps.
- Consider small paid experiments only after activation and retention are healthy.

## 7. Four-Week Social Content Calendar

| Week | Post | Hook / Concept | Format | CTA |
|---|---|---|---|---|
| 1 | 1 | “Ever had a good idea and forgotten it 10 seconds later?” | Problem skit + concept | Follow the build |
| 1 | 2 | “I’m building a voice note app that works without an account.” | Founder/dev demo | Comment your must-have |
| 1 | 3 | “A spider weaving notes? Here’s why.” | Icon reveal | Vote on the icon |
| 2 | 4 | “What happens to your notes when Wi-Fi disappears?” | Offline demo | Join early access |
| 2 | 5 | “One tap. One thought. Saved.” | Recording walkthrough | Join early access |
| 2 | 6 | “SQLite is doing the quiet work behind this app.” | Build-in-public | Follow development |
| 3 | 7 | “I tested recording with airplane mode on.” | Honest device test | Apply for beta |
| 3 | 8 | “Voice note chaos → organized notes.” | Before/after demo | Apply for beta |
| 3 | 9 | “What should the next feature be?” | Poll: tags vs export | Vote |
| 4 | 10 | “Here’s what broke in the beta.” | Dev diary | Send feedback |
| 4 | 11 | “From a lecture recording to a searchable note.” | Student use case | Join beta |
| 4 | 12 | “SpiderNote beta: what works and what’s next.” | Recap | Join waitlist/beta |

**Note:** Demo only features already implemented. Shift dates if product readiness changes.

## 8. Ready-to-Use Social Copy

### Launch teaser — TikTok / Reels
**On-screen hook:** “Your best ideas never arrive when you're ready to type.”

**Script (20–25 sec):**
“Ever think of something important, open your notes app, and forget it? I'm building SpiderNote, a voice note app for capturing thoughts before they disappear. Recordings and notes live on your phone, and AI can help organize them when you choose to use it. Simple recording. Less clutter. More ideas worth keeping. Follow the build.”

**Caption:** “Your thoughts deserve a place to land. 🕸️ SpiderNote is coming to Android. What’s one feature you’d want in a voice note app? #SpiderNote #BuildInPublic #AndroidApps #Productivity”

### Build-in-public — Threads
“Building SpiderNote with Expo + SQLite. The priority isn't flashy AI. It's making sure pressing Record actually means your thought is safely captured—even without internet. AI summaries come after reliability. What’s your biggest frustration with voice note apps?”

### Beta recruitment — Facebook / Instagram
“Looking for Android beta testers for SpiderNote, a local-first voice notes app. If you record lectures, meetings, content ideas, or personal reminders, I'd love your feedback on recording reliability, organization, and the overall experience. Comment ‘BETA’ or sign up through the link in our profile. No need to share private recordings.”

### Launch announcement
“SpiderNote is live on Android. Record your thoughts, keep notes on your device, and organize what matters. Optional AI features help turn recordings into useful notes. Try it here: [verified Play Store URL]. Tell us what you'd like us to improve next.”

## 9. Hashtags & Discoverability

**Branded:** `#SpiderNote` `#EveryThoughtConnected`  
**Category:** `#VoiceNotes` `#NoteTakingApp` `#ProductivityApps`  
**Audience:** `#StudyTips` `#StudentProductivity` `#CreatorTools`  
**Builder:** `#BuildInPublic` `#IndieDev` `#ExpoReactNative`

Use 3–5 relevant tags per post rather than a long repetitive block. Prioritize natural searchable phrases in spoken audio, captions, and titles.

## 10. Landing Page & Funnel

**Landing page structure:** Hero with app demo → three core benefits → privacy/offline explanation → screenshots → beta signup → FAQ → contact/privacy policy.

**Primary CTA:** Join Android early access  
**Secondary CTA:** Watch the 20-second demo

**Suggested FAQ:**
- Does SpiderNote work offline? Recording, playback, note editing, and local search do; AI features may require internet.
- Do I need an account? Not for core local functionality.
- Where are recordings stored? In app-managed local device storage; users should export important recordings until backup is available.
- Is AI processing private? Explain the actual provider, data transfer, retention, and opt-in behavior before shipping.
- Is SpiderNote free? Publish the actual pricing model before launch.

**Funnel:** Social post → landing page / Play Store → install → first successful recording → first saved note → second recording within 7 days.

## 11. Metrics & Experiments

| Metric | Definition | Why it matters |
|---|---|---|
| Video hook retention | Viewers still watching at 3 sec / starts | Creative effectiveness |
| Profile/landing CTR | Link clicks / relevant impressions | Interest |
| Waitlist conversion | Signups / landing visitors | Positioning |
| Install conversion | Installs / store visitors | Listing performance |
| Activation | Users who save a first recording / installs | First-use value |
| D7 retention | Users active on day 7 / install cohort | Habit potential |
| Recording save success | Successfully saved sessions / completed recording attempts | Reliability |
| Transcription completion | Completed jobs / submitted jobs | AI quality |
| Organic review themes | Coded recurring complaints | Product priorities |

**Suggested experiments:**
- “Offline-first” vs “ad-free” vs “never forget an idea” messaging.
- Students vs meeting-heavy professionals as first target segment.
- Product-first demo vs founder story.
- CTA “Try beta” vs “Join early access.”

Use privacy-respecting analytics; avoid sending raw note content, transcripts, or audio to analytics providers.

## 12. Community & Review Management

- Reply to product complaints with acknowledgment, a concrete next step, and no defensive language.
- Never request private recording files publicly.
- Provide a support email or in-app contact path once established.
- Categorize feedback: recording, playback, transcription, summaries, language, privacy, UI, pricing.
- Publish release notes describing fixes, not just “bug fixes and improvements.”
- Ask for reviews neutrally after a genuinely successful experience; do not gate functionality behind ratings.

**Response template:** “Thanks for flagging this. We’re looking into [issue]. If you're comfortable, please send your app version and device model through our support channel—no private recordings needed.”

## 13. Brand Asset Checklist

- [ ] Editable master logo and app icon
- [ ] Light and dark wordmarks
- [ ] Monochrome icon
- [ ] App splash screen
- [ ] Social profile avatars and cover/banner images
- [ ] 9:16 vertical video title/end-card templates
- [ ] 1:1 and 4:5 announcement templates
- [ ] Google Play screenshots and feature graphic
- [ ] Landing page design and waitlist form
- [ ] Privacy policy and support contact
- [ ] Consistent icon, type, and color tokens in the Expo app

## 14. Brand & Marketing Guardrails

- The spider should be **friendly and intelligent**, not creepy, threatening, or childish.
- “Local-first” does **not** mean all AI processing is offline. Disclose each online action.
- Local files may be lost if the app is uninstalled, storage is cleared, or the device fails. Provide export and later backup options.
- Do not claim automatic recording recovery without validating the actual recovery behavior on Android.
- Seek permission before recording or publishing conversations; comply with local consent and privacy laws.
- Verify name, logo, trademark, domain, and store listing availability before committing to launch assets.
- Use the generated icon concept as inspiration, then create a clean, original production vector mark.

## 15. Next Actions

1. Finalize the icon silhouette and wordmark.
2. Create a small Expo design-token package using the palette and typography above.
3. Build a 15–20 second real-device recording demo.
4. Create a waitlist landing page and feedback form.
5. Publish three teaser posts and measure audience response.
6. Recruit beta testers once recording persistence and recovery are stable.
7. Prepare the Play Store listing only after privacy and permission behavior is verified.

---

**Brand summary:** SpiderNote is the calm, dependable home for spoken thoughts. Its visual metaphor is a spider weaving disconnected ideas into a useful web of notes; its product promise is recording reliability and user control first, optional AI second.
