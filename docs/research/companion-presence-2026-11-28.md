# Companion presence for Tempo Flow: OpenAmika and Animates (28 Nov 2026)

Research note for PRD §15, TRD §5e and Roadmap §8. Feature-level only: no text, art or assets from either product are copied. Labels: **UNKNOWN** = not checked or not established; **(EXTRAPOLATED)** = our own reasoning; **user-reported** = from store reviews, not the developer.

## Verdict

- **OpenAmika is useful as code, not as a character.** Its harness is MIT, so Tempo may adapt it with the notice kept. Its character, voice, art and model files are under a personal-use licence and are never used. Tempo uses its own coach character.
- **Animates is a good feature checklist for "presence".** Its strongest ideas for Tempo are the coach "sitting with you", watching together over screen share, a daily journal about the user, and a companion that keeps thinking between sessions. Tempo turns these into body doubling and tutoring.

## OpenAmika (github.com/zeekk0/OpenAmika)

- **What it is:** an open-source companion app that runs on the user's own PC: a Live2D avatar that talks by voice and text and remembers the user.
- **Licence:** harness code MIT. Bundled SenseVoice, PixiJS and pixi-live2d-display are MIT. **Live2D Cubism Core is proprietary** (Live2D Proprietary Software License). The character, voice, reference audio, Live2D model, art and name belong to MekaHime Inc. under a personal-use licence: no commercial use, no re-hosting, no training on them. An optional helper (nanoMuse) is GPL-3.0 and installed separately.
- **What Tempo can learn from the code:**
  - Browser avatar on PixiJS with pixi-live2d-display, expressions driven by emotion.
  - Voice loop: speech-to-text (SenseVoice) → language model → emotion-tagged speech, eight emotions, about 900 ms per reply (the authors' claim).
  - Memory: messages retrieved by BM25 keyword search plus vector search (bge-m3 embeddings).
  - "Eyes": a vision model reading the camera or screen, switchable off.
  - Any MCP server added from a Tools page; Discord and Telegram bridges.
- **Maturity:** 6 stars, 2 forks, 41 commits when read. Study it; don't depend on it.
- **Fit with Tempo's licence (HARD_RULES §3):** MIT code is fine with the notice kept. The proprietary avatar runtime is **UNKNOWN** until its licence is read. A VRM-based avatar is a possible fallback, **UNKNOWN** until checked. The GPL-3.0 helper is not a dependency.

## Animates (animates.ai, Animation Inc.)

Source: the Apple App Store and Google Play listings, read 28 Nov 2026. The website itself shows only download links.

**From the developer's listing**
- Real-time voice with emotional range; an animated character whose expressions follow the conversation.
- Memory that carries over: each conversation picks up where the last one stopped.
- The user shapes the personality and "writes the story together".
- Keeps "thinking" about past conversations while the app is closed, and comes back with something new.
- Same companion and conversation by voice in the app or by text in the user's messenger.
- iPhone, iPad, Android, Mac and Windows. Free to download; paid monthly or annual plans add talk time and premium features. Rated 18+ / Mature 17+.

**User-reported (reviews)**
- Screen sharing to watch films or listen to music together; the character reacts and dances.
- A diary entry written about the user each day they talk.
- Built-in characters with their own personality, not only obeying commands.
- Complaints: usage limits that are hard to predict, talk time running out fast on paid plans, a paywall soon on the free plan, the companion hearing its own voice and cutting itself off, no push-to-talk or microphone sensitivity setting.
- Requests: outfits and backgrounds, relationship levels with rewards.

## Mapping to Tempo Flow

| Animates idea | Tempo version | PRD §15 |
|---|---|---|
| "Sits with you", presence | Body-doubling mode: timer, gentle check-ins in the user's own words, celebrate finishes | R-11 |
| Watch together over screen share | Opt-in screen view for body doubling and tutoring; frames are not stored unless the user saves a snapshot to a page | R-11, R-12 |
| Animated, emotional character | Tempo's own coach avatar, reduced-motion aware | R-13 |
| Emotional real-time voice; self-interruption complaint | Emotion-tagged voice, push-to-talk, echo cancellation | R-14 |
| Keeps thinking while the app is closed | Reflection pass; the coach opens with something relevant | R-15 |
| Daily diary about the user | Daily journal draft the user keeps or discards | R-16 |
| Same companion in your messenger | Telegram / Discord bridges (Gen 2+) | R-17 |
| — (OpenAmika's MCP tools page) | The user's tools over MCP via Executor | R-18 |
| Unpredictable limits (complaint) | Visible billing and voice minutes (F-110, F-35) | — |
| Outfits, relationship levels (requests) | Not taken: not a fit for a coach **(EXTRAPOLATED)** | — |

## Sources

- github.com/zeekk0/OpenAmika (README, licence section), read 28 Nov 2026
- mekahime.com/openamika (features and licence summary; it states the repository LICENSE files govern), read 28 Nov 2026
- apps.apple.com/us/app/animates-life-companions/id6758621319, read 28 Nov 2026
- play.google.com/store/apps/details?id=inc.animation.animate, read 28 Nov 2026
