# Contract VOICE — live voice lifecycle, provider, usage and privacy

Ticket: TEMPO-VOICE-CONTRACT-01 (#868). Batch CORE-WEB. Type: spec. Written 2026-10-11 against `integration` at `6cca807`.

**Status: PROPOSED, NOT ADOPTED. Blocked, not contract-valid.**

- Nothing here is policy until Amit adopts it. Adoption is recorded outside this file, bound to the exact commit (section 9). A file cannot contain its own commit hash.
- Open OWNER-DECISION entries (section 8) mean blocked. Unresolved required decisions are never contract-valid.
- This document is not runtime proof. It invokes no provider, uses no credential, spends nothing and changes no code, schema, config or generated file. Reviewing it proves nothing about microphones, transcripts or audible output (section 7).
- It is not a batch API contract in the `docs/contracts/README.md` sense. It lists no Convex function signatures. Where a dependent ticket proposes a path or a name, that is marked PROPOSED and is not an existing API.

## 0. How to read this document

### Decision tags

| Tag | Meaning |
|---|---|
| OWNER-DECIDED | Amit already decided it in a canonical doc or an owner amendment. The deciding line is quoted with its section. |
| ADOPTED-ENGINEERING | An engineering rule with no new provider, privacy, retention, spend or architecture content. It follows from merged code or an OWNER-DECIDED line. It takes effect when this contract is adopted, and Amit can veto it. |
| OWNER-DECISION | Not decided anywhere I could find. It needs Amit. A recommended default is given. Until decided it blocks the tickets listed in section 8. |
| EXTRAPOLATED | A guess by the author of this document, or a line the source doc itself marks EXTRAPOLATED. Never treat it as verified. |
| UNKNOWN | Not verifiable from the repo, the owner docs or this session. Nothing is filled in by inference. |

### Precedence and sources read

- Precedence is the PRD header's: "HARD_RULES > ticket > PRD > chat prompt." Conflicting historical language is not new approval (#868 WHY).
- Canonical docs read at `integration` `6cca807`: `docs/PRD.md` (§3.1, §4.3, §6, §7, §10, §11), `docs/TRD.md` (§1, §2, §3, §5a, §5b, §7, §9), `docs/HARD_RULES.md` (§1, §2, §6, §8, §9, §10), `AGENTS.md`, `factory/SLOTS.md`.
- Owner doc pack compiled 10 Oct 2026, Part A ("Decisions newer than the repo docs ... Where Part A and Part B disagree, Part A wins"). It was supplied by the owner and is not in the repo. It holds no voice decision. The only entry that touches cost modelling is the 8 Oct pricing standard: "assume every user is a whale. A whale = your own monthly Claude usage × 1.5." How that maps to voice minutes is UNKNOWN, so no cap in this contract is derived from it.
- Tickets read: #868, #859 to #866, #444 (including the 9 Oct core-web amendments), #276, #298, #744, #746, #785.
- Code read: `apps/web/components/coach/voice/voiceSession.ts` (merged by PR #835; #276 is closed), `convex/lib/aiGate.ts`, `convex/lib/approval.ts`, `convex/lib/entitlements.ts`, `convex/lib/crisisWords.ts`, `convex/crisis.ts`, `convex/coach.ts`, `convex/lib/accountDeletion.ts`, `convex/schema.ts`, `convex/lib/ai_router.ts`.
- Graphify and Understand Anything: `docs/TEMPLATE_STATE.md` records the committed Graphify snapshot (`docs/graphs/tempo-rhythm.json`) as generated 2026-09-17, which is older than the voice reducer. `.ua/knowledge-graph.json` is "not generated". Neither was used as evidence. Direct source reading at `6cca807` was used instead.
- Open-PR overlap on `docs/contracts/VOICE.md`: a title/body search for "voice" found no PR aimed at this path. A file-level search was not done. UNKNOWN beyond that.

## 1. Field checklist for #868 steps 2 to 5

Every field has a decision or an UNKNOWN entry. IDs are defined in the sections named.

| #868 field | Section | Status |
|---|---|---|
| Open-weight exception | 3 (E-6) | OWNER-DECISION; the rule is not defined anywhere in the docs |
| STT model and provider | 3 (P-1, P-2) | OWNER-DECIDED |
| STT processing region | 3 (E-1) | OWNER-DECISION |
| STT no-training terms | 3 (E-2) | OWNER-DECISION |
| STT data classes and provider retention | 3 (E-3, E-7) | OWNER-DECISION |
| TTS model and provider (separate from STT) | 3 (P-3) | OWNER-DECIDED for Hebrew; English use is EXTRAPOLATED in the docs, so OWNER-DECISION to confirm |
| TTS hosting region, no-training, retention (separate from STT) | 3 (E-4, E-5, E-7) | OWNER-DECISION |
| Approved existing-credit budget and enforcement | 5 (A-7, A-8) | OWNER-DECISION |
| Microphone start/stop and permission lifecycle | 4 (L-1 to L-3) | OWNER-DECIDED (explicit start) plus ADOPTED-ENGINEERING |
| Session versus turn lifetimes | 4 (L-4, L-5) | ADOPTED-ENGINEERING definitions; continuous capture is OWNER-DECISION |
| Speech-detected interruption | 4 (L-6, L-7) | OWNER-DECIDED trigger plus ADOPTED-ENGINEERING guards |
| Sentence-delta behaviour | 4 (L-8) | OWNER-DECISION (the TRD text is itself EXTRAPOLATED) |
| Cancellation and late-event fencing | 4 (L-9, L-10) | ADOPTED-ENGINEERING |
| Same-key retry | 4 (L-11) | ADOPTED-ENGINEERING; depends on a backend key that is UNKNOWN |
| Crisis speech suppression | 4 (L-12) | OWNER-DECIDED principle; Hebrew coverage and speaking the card are OWNER-DECISION |
| Account/session switching and teardown | 4 (L-13 to L-15) | ADOPTED-ENGINEERING; timeout values OWNER-DECISION |
| Server-enforced admission and usage limits | 5 (A-1 to A-6, A-9 to A-12) | OWNER-DECIDED order and tier numbers plus ADOPTED-ENGINEERING |
| Revocation for already-open sessions | 5 (A-3, A-8, A-9) | ADOPTED-ENGINEERING, with a stated hard limit |
| No raw recordings by default; retention, deletion, logging | 6 (R-1 to R-8) | ADOPTED-ENGINEERING; provider retention OWNER-DECISION |
| Synthetic real-provider acceptance | 7 (T-3, T-4) | ADOPTED-ENGINEERING; run authorisation OWNER-DECISION |
| Human microphone and spoken-output checks | 7 (T-5) | OWNER-DECIDED check; named browsers OWNER-DECISION |
| Private recordings and history | 7 (T-6) | ADOPTED-ENGINEERING: forbidden without separate approval |

## 2. Scope and what already exists

### In scope

Explicit-start live voice in the shared coach thread: browser microphone to Deepgram, final transcript into the same Agent thread as typed chat, sentence audio from Chatterbox on DeepInfra, playback, speech-detected interruption, Stop. Web only. English and Hebrew.

### Out of scope

| Item | Where it lives |
|---|---|
| Push-to-talk (walkie-talkie). HARD_RULES §9: "Walkie-talkie (push-to-talk) voice is universal across all tiers." No ticket in #859 to #866 covers it. | UNKNOWN owner |
| Browser Web Speech stopgap | #746, held, distinct. Never counts as provider voice. |
| Spoken template edits | #785. It consumes final transcripts and the shared action path. It is not a transport. |
| Lecture capture | #819 and #820. |
| English speech-to-speech on NVIDIA | PRD F-34: licence and languages UNKNOWN, MVP. Not enabled here. |
| Native clients, avatars, LiveKit/WebRTC rooms, voice cloning, custom voices | #444 amendment, #785 DO NOT, #864 DO NOT. |

### Facts about the code at `6cca807` that this contract builds on

| Fact | Source |
|---|---|
| The reducer is pure and inert. It returns effects as data and executes none. Phases are `idle`, `listening`, `transcribing`, `awaitingReply`, `speaking`, `error`. | `voiceSession.ts` |
| Identity is `{conversationId, turnId, requestKey, generation}`. `requestKey` is 1 to 128 of `[A-Za-z0-9_-]`. Ids are at most 256 characters. Text is at most 4000 UTF-16 units. A local `replyAttempt` fences retries. | `voiceSession.ts` |
| One reducer session is one turn. `final` emits `cancelCapture` and `submitTurn`. `playbackEnded` returns to `idle`. So the microphone lifetime equals the turn lifetime today. | `voiceSession.ts` |
| `reply` emits one `speak` effect with the whole text. There is no sentence or delta support. | `voiceSession.ts` |
| `bargeIn` is accepted only in `speaking`. It emits `cancelPlayback`, `cancelCapture`, `clearBuffers`, then starts a new listening turn with `startCapture`. | `voiceSession.ts` |
| `reply` with `crisis: true` ends the session and emits no `speak`. Repeated `stop` when idle is rejected as `stale_event` with no effects. | `voiceSession.ts` |
| `replace` can move an open session to another conversation. | `voiceSession.ts` |
| `requireApprovedForAi(ctx)` exists. Its comment says to call it first in every action that calls an LLM, STT or TTS provider. | `convex/lib/aiGate.ts` |
| Crisis detection is a fixed English phrase list plus a fixed generic card. It contains no Hebrew phrase. `coach.sendMessage` checks it server-side and skips the model. | `convex/lib/crisisWords.ts`, `convex/coach.ts` |
| No `voiceSessions` table and no `profiles` table exist. `USER_OWNED_TABLES` has no voice entry. The time zone is `userPreferences.timeZone`. The locale is `userPreferences.locale` (`en` or `he`). | `convex/schema.ts`, `convex/lib/accountDeletion.ts` |
| `GRANTED_ENTITLEMENT_TIER` is `"max"`. Every account gets the top tier today. Tiers are `none`, `basic`, `pro`, `max`, `god`. | `convex/lib/entitlements.ts`, `convex/schema.ts` |
| The DeepInfra text seam exists and reads `DEEPINFRA_API_KEY`. Nothing in `convex/` reads `DEEPGRAM_API_KEY`. | `convex/lib/ai_router.ts` |
| `convex/chat.ts` does not exist. #744's contract is `api.chat.send(args: {conversationId, content}) -> {reply: string, crisis?: true}`. It names no idempotency key. | #744, repo tree |

## 3. Providers, data classes and eligibility (step 2)

### Provider decisions

| ID | Decision | Tag | Basis |
|---|---|---|---|
| P-1 | STT English: Deepgram Flux `flux-general-en`, streaming. | OWNER-DECIDED | TRD §3: "Deepgram Flux `flux-general-en`, streaming, with turn detection", env var `DEEPGRAM_API_KEY`, horizon NW. PRD §7 table, row "Speech-to-text, English": "Deepgram Flux". |
| P-2 | STT Hebrew: Deepgram Nova-3, language `he`, streaming. | OWNER-DECIDED | TRD §3: "Deepgram Nova-3, language `he`, streaming". PRD §7: "Deepgram Nova-3 `he` (Flux has no Hebrew)". |
| P-3 | TTS: DeepInfra `ResembleAI/chatterbox-multilingual`. Hebrew is decided. English use is flagged EXTRAPOLATED by the docs. | OWNER-DECIDED (Hebrew); OWNER-DECISION to confirm English | TRD §3: "DeepInfra `ResembleAI/chatterbox-multilingual` (Hebrew included)", `DEEPINFRA_API_KEY`, "NW (5 Oct) English use [EXTRAPOLATED]". PRD §7: "Chatterbox multilingual on DeepInfra (Hebrew included)", "NW [EXTRAPOLATED for English]". Recommended default: confirm, because the PRD's own exit check 9 needs English voice. |
| P-4 | The browser streams microphone audio straight to Deepgram using a 30-second token minted by a Convex action. | OWNER-DECIDED | TRD §7 rule 2, "amended, accepted by Amit 5 Oct": "One exception: the browser streams microphone audio directly to Deepgram using a 30-second token minted by a Convex action." TRD §5a step 1. |
| P-5 | Text and TTS calls run in Convex actions. No separate voice server. | OWNER-DECIDED | TRD §5a: "Convex-only: no separate voice server." TRD §7 rule 2: "No long-lived key ever reaches a shell. No separate voice server exists". |
| P-6 | Secrets are names only: `DEEPGRAM_API_KEY`, `DEEPINFRA_API_KEY`. They live in Convex environment variables only and never reach the client or a log. | Names: OWNER-DECIDED. Placement: ADOPTED-ENGINEERING | TRD §3. TRD §7 rule 1: "Secrets by name only. Never a value, prefix or fragment anywhere." AGENTS.md: "Read, print, log or commit a secret value" is a Never. Whether either key is set on the test deployment: UNKNOWN. |
| P-7 | No vendor SDK and no new dependency. Native `fetch` and the browser `WebSocket` only. | ADOPTED-ENGINEERING | TRD §1 "native `fetch` only". TRD §9 forbids "single-vendor AI SDKs". EXTRAPOLATED reading: a Deepgram or DeepInfra SDK counts as one. #863 DO NOT: no new dependencies. |
| P-8 | No silent provider fallback. Gemini Live (TRD §3 opt-in lane, "off by default"), Deepgram Voice Agent API or ElevenLabs Agents (TRD §5a latency fallback), and Nemotron Voicechat (MVP) are not enabled by this contract. Any switch is a new OWNER-DECISION. | ADOPTED-ENGINEERING | #863 DO NOT "silent provider fallback"; #864 DO NOT "silent cross-boundary fallback". |
| P-9 | The server picks the lane from `userPreferences.locale`: `en` selects P-1, `he` selects P-2. The client cannot choose model, endpoint, region or parameters. Any other locale means voice is unavailable and typed chat stays. | ADOPTED-ENGINEERING | TRD §5a step 1: "plus the model to use (`flux-general-en`, or Nova-3 with `he`, from the user's locale)". TRD §5b writes `users.locale`; the repo stores it on `userPreferences` (ticket-sync note). |
| P-10 | DeepInfra needs a written Service Order before any paid tier. Dev and beta use does not. | OWNER-DECIDED | PRD §7 Gate: "DeepInfra requires a written Service Order before any paid tier (16 Sep §7). Dev and beta are fine." The order itself is PRD §10 item 12, UNKNOWN. This line settles the contract gate only. It does not settle privacy eligibility (E-1 to E-6) or spend authority (A-7, A-8). |

### Eligibility records the owner must complete

No document I read decides any of these. #862 says "Preserve EU endpoint and model-improvement opt-out where adopted", and none is adopted. STT approval does not carry to TTS: #864 WHEN says "STT region approval does not approve TTS hosting."

Precedent only, not a voice rule: HARD_RULES §6.1 justified its (since superseded) Mistral routing as "EU-hosted, GDPR-native, no training on paid API data by default". The recommended defaults below follow that posture.

| ID | Field | Provider | Tag | Value | Recommended default |
|---|---|---|---|---|---|
| E-1 | Processing region | Deepgram | OWNER-DECISION | UNKNOWN | An EU-processing endpoint, if Deepgram offers one for the plan in use. Availability and exact endpoint: UNKNOWN until read from Deepgram's current docs. |
| E-2 | No-training or model-improvement terms | Deepgram | OWNER-DECISION | UNKNOWN | Opt out, if offered. Otherwise Amit decides to accept or reject. |
| E-3 | Provider-side retention of audio and transcripts | Deepgram | OWNER-DECISION | UNKNOWN | No retention beyond processing, if offered. |
| E-4 | Hosting location and region | DeepInfra (Chatterbox) | OWNER-DECISION | UNKNOWN | Stated hosting location in writing. Not assumed from STT. |
| E-5 | No-training and retention terms | DeepInfra (Chatterbox) | OWNER-DECISION | UNKNOWN | A zero-retention statement is a provider claim. It is not eligibility evidence until the owner records the source (E-8). |
| E-6 | Open-weight exception | Both | OWNER-DECISION | The ticket calls it "applicable". A search of `docs/PRD.md`, `docs/TRD.md`, `docs/HARD_RULES.md` and `docs/ROADMAP.md` finds "open-weight" only in the embeddings rows (PRD §7, TRD §5). Its meaning is UNKNOWN. | No exception is adopted. Both providers need E-1 to E-5 evidence. The docs do not call either voice model open-weight, so whether it applies to anything here is UNKNOWN. Amit must say what it is. |
| E-7 | Data classes allowed per provider | Both | OWNER-DECISION to approve the proposal below | Proposal below | Approve as proposed. |
| E-8 | Evidence standard | Both | ADOPTED-ENGINEERING | Each eligibility claim records source link, date read and who verified. A missing or unverifiable item means the server refuses the grant and the synthesis. | Fail closed. The configuration mechanism and its name are UNKNOWN. #862 defines it with owner approval. This contract creates no environment variable name. |

### Data classes (proposal for E-7)

| Class | Goes to | Persisted by Tempo | Rule |
|---|---|---|---|
| Raw microphone audio | Deepgram only, browser direct | Never | R-1 |
| Temporary STT token | Convex action to the caller | Never stored, never logged | A-4, R-5 |
| Interim transcript | Browser memory | Never | R-2 |
| Final transcript | Convex as an ordinary user message in the coach thread, then the text model | Yes, same as a typed message and the same retention | R-3. The text model's own eligibility is outside this contract; it receives the same text typed chat sends it. |
| Coach reply sentences, which may contain content drawn from the user's notes or memory | DeepInfra (Chatterbox) | Reply text already exists in the thread. TTS input is not stored by Tempo. | Needs E-4, E-5. A-10 |
| Synthesised audio | DeepInfra to a Convex action to the browser | Never. Not in Convex file storage. | R-1 |
| Voice usage metadata | Convex | Yes, content-free | R-4 |
| A crisis turn | Nothing | Text card only | L-12 |

## 4. Lifecycle (step 3)

### Definitions (ADOPTED-ENGINEERING)

- **Session**: the microphone and speech-socket lifetime, plus one server lease (A-3). It runs from an explicit Start to Stop, revoke, switch, unmount, expiry or crisis.
- **Turn**: one accepted final transcript and the one reply that answers it, spoken and shown.
- **Sentence**: one TTS unit of a reply, numbered from 0 within the reply.
- The merged reducer fuses session and turn. The next section says what must change.

### Decisions

| ID | Decision | Tag | Basis |
|---|---|---|---|
| L-1 | The microphone is requested only inside the handler of an explicit Start click or key press. Never on page load, route change, focus, restore from background, reconnect, or after a refusal. Reconnect after a network drop reuses the open stream and never re-prompts. | OWNER-DECIDED | #444 owner amendment, 9 Oct 2026: "explicit-start/stop voice". #866: "keep mic off until click". |
| L-2 | Stop is always visible while a session exists. It ends the whole session. It is idempotent: a second Stop has no effect. | ADOPTED-ENGINEERING | #276: "Explicit start/stop only". The reducer already rejects a repeated stop with no effects. |
| L-3 | Permission and support states are `unsupported`, `prompt`, `granted`, `denied` and `lost` (track ended or revoked mid-session). They map to the reducer errors `unsupported_transport`, `permission_denied` and `capture_failed`. A refusal is never retried automatically. Typed chat is always available in every state. Copy never blames the user. Recorder formats are feature-detected and never guessed; if none is supported the result is `unsupported_transport`. | ADOPTED-ENGINEERING | HARD_RULES §1 "Never shame the user." #863 DO NOT "recorder-format guessing". HARD_RULES §8 accessibility. |
| L-4 | A session holds many turns. Turn identity changes per final transcript. Session identity (server lease id) never enters the reducer. The runtime fences on it (L-9). | ADOPTED-ENGINEERING | See the reducer facts in section 2. |
| L-5 | **Continuous capture.** Option A: capture ends at `final` and restarts after playback. Then nobody is listening while the coach speaks, so a spoken interruption is impossible. Option B: one microphone stream and one speech socket stay open for the session, across turns and during the reply. Option B is the only one that satisfies the PRD and TRD wording. Cost and privacy exposure rise, because the socket is open and the microphone is live while the coach speaks. Mitigations are L-15 and A-3 to A-8. | OWNER-DECISION. Recommended: Option B, bounded by L-15. | PRD F-30: "a hands-free conversation where you can interrupt the coach mid-sentence". TRD §5a step 5, "Barge-in: when Deepgram reports the user is speaking again". The docs imply B but never choose between A and B. #868 step 3 requires an explicit adopted decision. |
| L-6 | Interruption fires on provider-reported user speech while the session is in `awaitingReply` or `speaking`. It is never a UI button and never a client-side detector. Required effects, in order: stop playback, drop pending synthesis, bump the turn fence, then continue the new turn on the same open capture. The first words of the interruption are part of the new turn and are not lost. | Trigger: OWNER-DECIDED. Effects: ADOPTED-ENGINEERING | TRD §5a step 5: "when Deepgram reports the user is speaking again, the browser stops playback at once and the new turn starts." The merged `bargeIn` restarts capture (`cancelCapture` then `startCapture`); under L-5 option B #859 must keep it instead. If a provider variant has no speech-start event, the first non-empty interim transcript is the trigger (EXTRAPOLATED; wire events are UNKNOWN here and #863 reads them from the provider's current docs). |
| L-7 | Echo and assistant recapture. The microphone constraints ask for browser echo cancellation. The transport drops any interim or final whose normalised text is contained in the sentences currently playing or just played. A dropped item never triggers an interruption and never reaches the reducer. | ADOPTED-ENGINEERING; effectiveness EXTRAPOLATED/UNKNOWN until T-5 | #865 DONE lists "echo/assistant recapture exclusion". Speakers with an open microphone is the hard case. T-5 must test it with speakers and with headphones. |
| L-8 | **Sentence-delta behaviour.** Text streams to the screen as deltas through Convex. Audio is made one completed sentence at a time. Sentence text is resolved on the server from reply id and sentence index, never supplied by the client (A-10). Sentences play strictly in index order. The reducer needs sentence-indexed speak effects, or its `speak` must carry an index. | OWNER-DECISION to confirm. Recommended: adopt. | TRD §5a step 4: "As each sentence of the reply completes, a Convex action sends it to Chatterbox multilingual on DeepInfra ... [EXTRAPOLATED]". TRD §5a: "Audio is made one sentence at a time, not streamed byte by byte, so first-audio latency is UNKNOWN until measured." The TRD marks the mechanism EXTRAPOLATED, so Amit has not confirmed it. Fallback if too slow, per the TRD, is a managed voice agent. That is an architecture change and is not adopted (P-8). |
| L-9 | **Fences and cancellation order.** Every effect result and every callback carries the fence it was issued under: `conversationId`, `turnId`, `requestKey`, `generation`, `replyAttempt` (all in the merged reducer), plus lease id and sentence index (new; held by the runtime, not the pure reducer). A result applies only if every part equals the current value at application time. Teardown order: (1) bump the fence synchronously, (2) cancel playback and release buffers and object URLs, (3) abandon in-flight synthesis, (4) stop microphone tracks, close the socket and clear timers, (5) clear buffers, (6) end the server lease best-effort. The merged reducer already orders playback, then capture, then buffers. | ADOPTED-ENGINEERING | `voiceSession.ts` `cancellation()`. #865 DONE: "No callback can apply after cancellation." |
| L-10 | **Late events.** An event or result that fails L-9 is dropped with no state change and no effect. A late synthesis result that arrives after cancellation is discarded and never played. A Convex action already running cannot be recalled by the client (EXTRAPOLATED; #864 verifies), so the spend is incurred and only the result is dropped. That is why synthesis runs at most K sentences ahead (A-10). | ADOPTED-ENGINEERING | #864 STEPS. |
| L-11 | **Same-key retry.** One `requestKey` is minted per accepted final transcript and kept until its reply commits or the session ends. Retry sends the same `conversationId`, the same `requestKey` and byte-identical accepted text. Different text under the same key is rejected (`request_key_reused`). Each retry raises only the local `replyAttempt`. A late result from an earlier attempt is dropped. The backend must treat `(user, conversationId, requestKey)` with identical content as the same request and return the existing result. With different content it must refuse. Voice uses the one canonical text-send path and creates no second chat store. | ADOPTED-ENGINEERING. The backend half is UNKNOWN. | #276 "Stable retry uses the same request key and exact accepted text". Reducer comment: "durable deduplication across older sessions belongs to the canonical backend". #744's contract has no idempotency key, so the text path must gain one, or voice cannot claim exactness. Ticket-sync note for #744/#745. |
| L-12 | **Crisis speech.** (a) Detection is server-side from the fixed list only, with no model classifier. (b) A crisis turn makes no TTS request and ends the session; the mic closes. (c) The crisis card is shown as text. Whether to speak it aloud: OWNER-DECISION, default no. (d) Hebrew coverage: today's list has no Hebrew phrase, and the PRD exit check requires Hebrew voice. OWNER-DECISION, default: do not enable Hebrew live voice until the owner approves a Hebrew phrase list; the alternative is to accept and record the residual risk. (e) The client-side `reply.crisis` flag is the server's verdict, not the client's own. | (a)(b)(e): OWNER-DECIDED principle plus ADOPTED-ENGINEERING. (c)(d): OWNER-DECISION | PRD F-24: "Fixed crisis card: when a user signals crisis, the coach stops coaching and shows real resources. The card text is fixed, never model-written." TRD §7 rule 7: "Crisis card text is fixed content, never written by a model." #276: "Crisis-resource responses do not generate speech effects". #746 STEPS 4: "Don't speak crisis resource cards aloud". The reducer already ends the session on `crisis: true`. |
| L-13 | **Conversation, account and session switching.** A conversation switch, a sign-out and an account change each end the session (Stop semantics). Identity, state and buffers never carry across users or conversations, and the next session needs an explicit Start. The reducer's `replace` must not be used to carry an open microphone into another conversation or account. | ADOPTED-ENGINEERING | The merged reducer allows `replace` across conversations. Under this contract the runtime never emits it for a switch. #859 may remove or restrict it. |
| L-14 | **Teardown triggers.** Stop; unmount; `pagehide`; conversation switch; sign-out or account change; revocation or account deletion seen at admission, heartbeat or synthesis; budget exhausted; lease expired; heartbeat unreachable past the expiry window (fail closed, locally); permission lost; crisis; unrecoverable provider or socket error. All use the L-9 order. | ADOPTED-ENGINEERING | #859, #865. |
| L-15 | **Time bounds.** Idle timeout with no detected speech and no playback; maximum session length; behaviour when the page is hidden. Recommended defaults, all EXTRAPOLATED: idle 90 seconds, maximum 15 minutes, end the session after 30 seconds hidden. Each bound also ends the lease. | OWNER-DECISION (values) | The ticket asks that an open socket be bounded. No doc gives a number. |
| L-16 | Voice has no action path of its own. A spoken request produces the same proposal/confirm/edit/reject card, the same result and the same 5-minute Undo as typed text. Speech cannot confirm or reject a card. Cancelling speech never rolls back a committed action or deletes thread text. | OWNER-DECIDED principle; ADOPTED-ENGINEERING mechanics | PRD F-31: "Voice can do everything the text coach does". HARD_RULES §1: "Accept-reject flow is law. The AI never silently mutates user state." HARD_RULES §6.2: "Never call a mutation directly from an `action` with AI-generated arguments and no user confirm." TRD §5a step 3: "same tools, same Undo". #865 DO NOT. Spoken confirmation of cards is not decided and not enabled. |
| L-17 | Every spoken reply is also shown as text (read-back). The screen shows listening, transcribing, thinking, speaking and error states in words, not only by colour or sound. | OWNER-DECIDED | PRD F-30: "every spoken reply is also shown as text (read-back)". |
| L-18 | The coach and voice answer in the user's chosen language. | OWNER-DECIDED | PRD F-73: "The coach and voice answer in the user's chosen language." EXTRAPOLATED tag in the PRD. Mixed-language speech inside one turn: UNKNOWN. |

### What #859 must change in the merged reducer

| Merged behaviour at `6cca807` | Required by this contract |
|---|---|
| `final` emits `cancelCapture` and `submitTurn`. | Under L-5 option B, `final` emits `submitTurn` only. Capture stays open. |
| `playbackEnded` returns to `idle` and ends the session. | The turn ends and the session returns to `listening`. The session ends only by L-14. |
| `bargeIn` only from `speaking`. It cancels capture and restarts it. | Allowed from `awaitingReply` and `speaking`. It cancels playback and pending synthesis, keeps capture, and starts a new turn identity (L-6). |
| `reply` emits one `speak` for the whole text. | If L-8 is adopted: sentence-indexed speak effects. Otherwise unchanged. |
| `replace` can cross conversations. | Not used for switching (L-13). |
| `crisis: true` ends the session with no speech. | Unchanged. |
| Failures cancel playback, capture and buffers. | Unchanged. The lease stays until Stop, expiry or L-14. No capture while an error is shown unless the user resumes. |

## 5. Admission, usage limits and revocation (step 4)

### Honest limit (read first)

The browser holds the Deepgram socket (P-4). Convex cannot close it. TRD §5a step 1 says the token "only has to be valid when the WebSocket opens", so the 30-second grant bounds connection setup and nothing after it. A modified client can keep a socket open and ignore every heartbeat. The only true ceiling on spend is a cap set at the provider. AGENTS.md names that enforcement: "Spend money the ticket doesn't authorise (paid APIs, paid services). Enforced by: scoped keys and spend caps on each provider." App-side limits control honest clients and cost. They are not a hard bound. Nothing in this contract may present a token TTL or a client clock as a hard provider cap.

Making the app the hard bound would need a relay or a managed voice agent. That changes TRD §7 rule 2 and is a separate OWNER-DECISION, not recommended now (P-8).

### Decisions

| ID | Decision | Tag | Basis |
|---|---|---|---|
| A-1 | **Admission order** for session start, grant and synthesis: authenticate, then `requireApprovedForAi` (approved, live, not deleted), then an owned and non-deleted conversation, then entitlement tier, then daily budget (A-6), then one-lease rule (A-2), then request-rate limits, then eligibility present (E-8). Any failure refuses before any provider request. | OWNER-DECIDED order | TRD §7 rule 3: "Server-side order before any model call: auth → entitlement → quota." TRD §7 rule 4. `aiGate.ts`: "Call FIRST in every Convex action that calls an LLM, STT or TTS provider." |
| A-2 | One active lease per user. A new start while one is active ends the older lease (last start wins), so an abandoned tab cannot lock the user out. Starting is idempotent by a client session key; a duplicate start with the same key returns the same lease. | ADOPTED-ENGINEERING (EXTRAPOLATED mechanics) | #861 DONE: "concurrent admission, duplicate start/close". |
| A-3 | **Lease and heartbeat.** The client renews the lease on an interval. Every renewal re-checks approval, account state and remaining budget, and returns one of: ok, revoked, exhausted, expired. Any non-ok answer means client teardown (L-14). A lease with no renewal past the expiry window is closed by the server, lazily at the user's next admission and by a scheduled sweep. Recommended defaults, EXTRAPOLATED: renew every 15 seconds, expire after 45 seconds of silence. | ADOPTED-ENGINEERING | #868 step 4: "a 30-second grant alone does not bound an open socket or spending." Cooperative only; see the honest limit. |
| A-4 | **Grant.** A grant needs an active lease. It returns only the temporary credential plus allowlisted configuration: model id, endpoint, language. It never returns a key. A bad provider response is rejected. Limits: a small number of grants per lease for reconnects, and a per-minute rate per user (recommended: 3 per lease, 5 per minute, EXTRAPOLATED). The token is never persisted, logged or echoed in an error. The grant is an authenticated Convex action, not a public HTTP route. | TTL: OWNER-DECIDED. Rest: ADOPTED-ENGINEERING | TRD §5a step 1: "a token with a 30-second TTL". #862 STEPS and DO NOT. |
| A-5 | **Accounting unit and clock.** The unit is server lease time: from the server's `startedAt` to the server's `endedAt`. For an abandoned lease the end is the last renewal plus one renewal interval. Client-reported audio milliseconds may be stored as telemetry. They are never used to lower a charge and never as a cap. | ADOPTED-ENGINEERING; owner may veto | HARD_RULES §9: "Tracking is in minutes of real audio, not tokens. A `voiceSessions` row opens on session start with `startedAt`, closes with `endedAt`, and computes `durationMs`." Lease time is at least audio time, so it errs toward counting more. This reads "real audio" as an upper bound. A client clock is not trustworthy. |
| A-6 | **Daily budget.** The day total is the sum of `durationMs` for the user's local calendar day. It resets at local midnight. If less than one minute remains, live voice is refused with the upgrade prompt. Time zone source is `userPreferences.timeZone`, read at admission through the repo's existing local-date helper (named in #861). A session counts toward the local day of its `startedAt`. The maximum session length (L-15) bounds the skew at midnight. A time-zone change moves the day boundary from then on. Each change can grant at most one extra daily budget. That is accepted as residual risk and sits under the provider cap. DST uses the zone rules, never a fixed 24-hour day. | OWNER-DECIDED rule; time-zone source and tie-breaks ADOPTED-ENGINEERING | HARD_RULES §9: "The daily budget is the sum of `durationMs` for the user's local calendar day." "Daily budgets reset at the user's local midnight (derived from `profiles.timezone`)." "Session start checks available budget; if < 1 minute remains, walkie-talkie remains available, live voice is gated behind an upgrade prompt." No `profiles` table exists; ticket-sync note. |
| A-7 | **Cap values.** HARD_RULES §9 gives the tier numbers: Basic 30, Pro 90, Max 180 live minutes per day. Three conflicts block treating them as the preview cap. (1) PRD F-35 says live conversation is "on Pro/Max at 90/180 minutes a day", with no Basic live tier. HARD_RULES outranks the PRD, but Amit should confirm. (2) Every account is `max` today (`GRANTED_ENTITLEMENT_TIER`), and TRD §7 rule 10 and PRD §10 item 9 say approved users get the premium tier. Each approved tester could use 180 minutes a day. (3) PRD §11 lists "A per-user daily voice-minute cap during preview, so testers can't run up API spend", under "Ideas to ask me about later (Claude's own — NOT in scope)". It is not adopted. Also needed, none of it in any doc: a daily TTS cap in the provider's own unit (characters or seconds), and a global daily ceiling across all users. | OWNER-DECISION | Recommended default: fail closed. No live voice runs until a per-user live-minute cap, a TTS cap and a global ceiling are all set. For preview, a per-user cap of 15 minutes per day (EXTRAPOLATED), never above the HARD_RULES tier number. Provider unit prices: UNKNOWN here; the owner takes them from the provider's pricing page or invoice, not from this file. Whether idle silence on an open socket is billed: UNKNOWN. |
| A-8 | **Spend ceiling.** An "approved existing-credit budget" means spending only credit the owner already holds, with no new purchase. It is enforced by (a) the app caps in A-7 for honest clients and (b) a spend cap or credit limit set at each provider by the owner. (b) is the real bound. Neither exists in a document I read. Whether Deepgram and DeepInfra accept such a cap for the plan in use: UNKNOWN. | OWNER-DECISION. Principle OWNER-DECIDED (AGENTS.md). | AGENTS.md Never list. #868 DO NOT: no paid capacity without approval. |
| A-9 | **Revocation and deletion for open sessions.** Revoked or soft-deleted accounts are refused at every admission step immediately. An open session learns at its next renewal (at most one renewal interval plus the network delay) and tears down. Synthesis checks account state on every call, so a revoked user gets no further audio even before the next renewal. The Deepgram socket itself can stay open until the client closes it or the provider cap trips (honest limit). | ADOPTED-ENGINEERING | `approval.ts` (revoked state); `accountDeletion.ts` `isInactiveAccount`. #861 DONE: "revoked account". |
| A-10 | **Synthesis admission and bounds.** The action takes identifiers only: conversation, reply and sentence index. It never takes text. It resolves the committed or streamed reply text on the server and splits it into sentences deterministically. It checks account state, ownership and a live lease; refuses a deleted, stale or foreign reply; refuses a crisis turn; and refuses an index far ahead of the playhead. It bounds sentence length, audio size and content type, applies a timeout, and deduplicates repeated requests for the same index. At most K sentences are requested ahead of playback (recommended K = 2, EXTRAPOLATED), so a cancel wastes little. Output is transient bytes with no storage, no cloning and no external URL. Provider size and length limits are UNKNOWN here and come from the provider's docs in #864. | ADOPTED-ENGINEERING | #864 STEPS and DO NOT: "arbitrary-text rejection", "no persisted/logged audio/text", "custom voice/cloning, arbitrary external audio URL". |
| A-11 | **Midnight, DST and zone changes** are covered by A-6. The tests in #861 DONE must use fixed, synthetic clocks. | ADOPTED-ENGINEERING | #861 DONE. |
| A-12 | **Close and abandon.** Closing an already-closed lease is a no-op. Stale session keys are refused. A lease closed by expiry is never later reopened. | ADOPTED-ENGINEERING | #861 DONE: "duplicate start/close, stale session". |

## 6. Privacy, retention and logging (step 4)

All of this is ADOPTED-ENGINEERING, adds no retention, and is vetoable by Amit. Provider-side retention is E-3 and E-5 and stays an OWNER-DECISION.

| ID | Rule |
|---|---|
| R-1 | **No raw audio is persisted by default.** Not in Convex tables, Convex file storage, `localStorage`, IndexedDB, caches, logs or PR evidence. Microphone audio exists only in the browser and in the provider's pipe. Synthesised audio exists only as transient bytes and playback buffers, released on teardown. Persisting any audio needs a separate explicit adoption. #863 DO NOT: "hidden recording, raw audio persistence". |
| R-2 | **Interim transcripts** live only in browser memory. They are never sent to the backend, stored or logged. |
| R-3 | **Final transcripts** become the same kind of user message typed chat writes. They get the same retention and deletion as chat: TRD §7 rule 5 "Soft delete everywhere, 30-day grace"; HARD_RULES §10 "Account deletion soft-deletes immediately ... with a 30-day grace window where the user can restore. After 30 days, a scheduled job hard-deletes." Voice adds no duplicate copy and no separate transcript store. |
| R-4 | **Voice usage metadata** (the `voiceSessions` row HARD_RULES §9 names) holds: owner, conversation, status, `startedAt`, last renewal, `endedAt`, `durationMs`, end reason, local date key, locale lane, and counts (grants, sentences, characters). It holds no audio, transcript, reply text, token, provider response or secret. It is user-owned data: soft-deleted with the account, covered by the data export (HARD_RULES §10 "one per table"), and enrolled in `USER_OWNED_TABLES` (#860). Whether usage rows outlive account hard-deletion: OWNER-DECISION, default no. |
| R-5 | **Logging.** Never log a token, key, audio, transcript, reply text, TTS input, provider response body or request URL carrying a credential. Allowed: content-free events (event name, ids already in the database, durations, sizes, counts, allowlisted error codes such as the reducer's `VoiceSessionError`). Convex verbose or debug output is not used for voice. |
| R-6 | **Analytics** stay opt-in (HARD_RULES §10 "Analytics are opt-in."). No voice content ever goes to analytics. Opted-in voice events, if any, are content-free. |
| R-7 | **Provider data** is limited to the classes in section 3. No provider receives a user's notes or memory beyond what appears in the reply sentences the user hears (E-7). |
| R-8 | **Evidence hygiene.** PRs, tickets and test artifacts carry no real private audio, transcripts, screenshots of private data or tokens. Synthetic content only (T-6). |

## 7. Acceptance (step 5)

### What each level proves

| Level | What it is | What it proves | What it cannot prove |
|---|---|---|---|
| T-1 | Contract review (this file) | The decisions are explicit and adopted at an exact commit | Anything at runtime |
| T-2 | Reducer and adapter unit tests with fakes and synthetic wire fixtures (#859, #862 to #865) | Logic, fencing and failure handling | Real microphones, providers or audio |
| T-3 | Rendered mount test (#866) | Controls and states render and call the runtime | Audio, transcripts or providers |
| T-4 | **Synthetic real-provider run** | Real providers accept the grant, return a transcript of a scripted synthetic phrase, and return audio; cancellation closes the socket and stops requests | A human hearing it, or any browser's real microphone path |
| T-5 | **Human microphone and spoken-output check** | A person speaks, sees the transcript in the shared thread, hears the reply, interrupts it and stops it | Provider eligibility or cost |
| T-6 | Data rule | No private recording or history is used | Not a test |

Mocks, injected events, the mount test and skipped tests never close actual voice acceptance (#866 DONE; #863 DONE; #444 amendment). The acceptance ladder from #444 applies: planned, coded, locally-tested, preview-tested, shipped-and-running. Reports state each separately. Adopting this contract moves voice to "planned" and no further.

### T-4 synthetic real-provider run

Preconditions, all required: this contract adopted at a recorded commit; E-1 to E-8 and A-7, A-8 decided; both keys present on the test Convex deployment (names only; TRD §2: "a bare `npx convex env list` prints values; use the names-only form"); a provider-side spend cap in place; the owner's written authorisation naming the date and a spend ceiling. Authorisation is itself an OWNER-DECISION (section 8).

It is a human-triggered run. It is never part of `ci` or the cloud-agent checklist, which says not to "run tests against a preview or live URL" and not to use real keys (AGENTS.md).

Inputs are scripted synthetic phrases in English and Hebrew, read by the tester or produced offline. They carry no personal content.

Pass evidence, each item recorded:

1. A grant is issued for an approved synthetic user and refused for pending, revoked, deleted, foreign-conversation and over-budget synthetic users.
2. The browser opens the speech socket with the granted token. The provider returns interim and final transcripts for the scripted phrase. The transcript text of the synthetic phrase may be recorded.
3. The final transcript appears as a user message in the same thread, and a model reply commits. A same-key retry makes no second message.
4. Each reply sentence returns non-empty audio of the expected type, in order.
5. Stop during transcription and Stop during playback: audio goes silent, the socket closes, and no further synthesis request is counted afterwards (content-free counters).
6. A scripted second utterance during playback interrupts it (L-6). The stop time in milliseconds is recorded.
7. A synthetic user revoked mid-session is torn down within the expiry window (A-3). A synthetic user at the cap boundary is refused (A-6).
8. Provider dashboards before and after show spend within the authorised ceiling.
9. Inspection shows no audio, transcript, token or provider body in Convex tables, storage or logs (R-1, R-5).

One possible harness is Chromium's fake-microphone input from a file under Playwright. Flags and APIs must be checked against current docs when used (EXTRAPOLATED).

### T-5 human check

This extends PRD §3.1 exit check 9: "Manual check: one live voice round trip in English and one in Hebrew, each including one interruption and one action ("add X to today")." The preview is `preview.tempoflow.dev`, which "follows `integration`" (TRD §2).

Record for every run: preview build commit; the Convex test deployment's deployed commit (they must match, since `convex-deploy-test` deploys `integration`'s `convex/` to `ceaseless-dog-617`); browser, version, OS, device; input and output devices; speakers or headphones; language.

| Step | Expected |
|---|---|
| Open the coach with voice available | The microphone is off. No prompt appears. |
| Press Start and deny permission | A calm message appears. Typed chat works. No retry loop. |
| Press Start and allow | The state reads listening. |
| Speak a scripted request | The transcript appears in the same thread as typed chat. |
| Wait for the reply | The reply appears as text and is audible. The text matches what was said. |
| Say "add X to today" | A confirm card appears, as with typed text. Speech does not confirm it. Undo works for 5 minutes after confirm. |
| Speak over the reply | Audio stops at once. The new turn begins without losing the first words. Repeat with speakers and with headphones; note any echo self-trigger (L-7). |
| Press Stop mid-reply | Audio is silent within 500 ms (EXTRAPOLATED threshold; the measured time is recorded). The microphone indicator goes off. |
| Switch conversation or sign out mid-session | The session ends. Nothing carries over. |
| Close the tab mid-reply | Audio stops. The lease expires on the server within the expiry window. |
| Say a scripted crisis phrase, English | The fixed card appears. No synthesis happens. The session ends. |
| Say a scripted crisis phrase, Hebrew | Blocked until L-12(d) is decided. Record the observed behaviour. |
| Reach the daily cap on a synthetic account | Live voice is refused with the upgrade prompt. Typed chat still works. |
| Inspect browser storage and the network panel | No audio or transcript stored. No key in the browser. |

Named browsers and devices: UNKNOWN. OWNER-DECISION. Recommended default: current desktop Chrome and Safari, plus iOS Safari and Android Chrome, in English and Hebrew. #298 and #282 later require approved real EN/HE audio and speech-detected interruption on named browsers (#866 DONE).

### T-6 data rule

Real private recordings and history need a separate, specific approval (#868 step 5). Until then, only synthetic fixtures are used, and nothing recorded is stored.

## 8. Owner decision queue

Each item is open until Amit decides. The default is a recommendation, not an adoption. "Blocks" lists the tickets that must not be admitted until the item is decided.

| # | Decision | Recommended default | Blocks |
|---|---|---|---|
| 1 | STT eligibility: region, no-training, provider retention, data classes (E-1, E-2, E-3, E-7) | EU processing if offered; opt out of training if offered; proceed only with evidence recorded (E-8) | #862, #863 |
| 2 | TTS eligibility: hosting, no-training, retention (E-4, E-5, E-7), kept separate from STT; confirm English use (P-3) | No assumption from STT; evidence required | #864 |
| 3 | Open-weight exception (E-6): what it is, whether it exists | None adopted | #862, #864 |
| 4 | Caps and spend (A-7, A-8): per-user live minutes (resolve the PRD F-35 versus HARD_RULES §9 conflict), preview override, TTS cap, global ceiling, provider-side spend cap | Fail closed until all set; 15 minutes per user per day for preview (EXTRAPOLATED) | #860, #861, #862, #864 |
| 5 | Continuous capture inside a session (L-5) | Option B, bounded by item 8 | #859, #863, #865 |
| 6 | Sentence-level TTS (L-8; TRD §5a step 4 is EXTRAPOLATED) | Adopt | #859, #864, #865 |
| 7 | Crisis: Hebrew phrase list before Hebrew live voice; whether the card is spoken (L-12) | Hebrew voice stays off until approved; card is text only | #859, #865, #866 |
| 8 | Time bounds (L-15): idle, maximum session, hidden page | 90 s, 15 min, 30 s (EXTRAPOLATED) | #859, #861 |
| 9 | Authorisation of the T-4 run: date, spend ceiling, who triggers it | After items 1 to 4 | acceptance only |
| 10 | Named browsers and devices for T-5 | Chrome and Safari, desktop and mobile | acceptance only |
| 11 | Usage rows after account hard-deletion (R-4) | Deleted with the account | #860 |
| 12 | Who owns push-to-talk (out of scope here) | UNKNOWN | none |

## 9. Dependent tickets, UNKNOWN register, ticket-sync notes, adoption

### What each dependent ticket takes from this contract

| Ticket | Takes | Still needs before admission |
|---|---|---|
| #859 reducer | L-4 to L-16 and the change table in section 4 | Decisions 5, 6, 7, 8. The reducer owner's path release (#276 is closed and #835 merged at `6cca807`; the release itself is a coordinator step, UNKNOWN). |
| #860 schema | A-3, A-5, A-6, R-4 | Decision 11. #851 and #808 per its WHEN. No `voiceSessions` table exists today. |
| #861 budget | A-1 to A-3, A-5, A-6, A-9, A-11, A-12 | Decision 4 and a generated-API route. |
| #862 grant | P-1 to P-10, A-1, A-4, E-1 to E-8 | Decisions 1, 3, 4 and a generated-API route. |
| #863 transport | P-1, P-2, L-1 to L-3, L-6, L-7, L-10 | Provider wire formats and event names (UNKNOWN here; read from Deepgram's current docs). #859 and #862. |
| #864 TTS | P-3, E-4, E-5, A-10, L-8, L-12 | Decisions 2, 3, 4, 6. #743, #807, #809 for canonical reply reads. |
| #865 runtime | L-5 to L-16, A-3 | #859, #863, #864, #744 (idempotent send, L-11). |
| #866 mount | L-1 to L-3, L-17, T-3, T-5 | #865, #745, #794, and `CoachChat.tsx` ownership handoff from #746 and #785. |

### UNKNOWN register

- Eligibility values E-1 to E-6, and the meaning of the open-weight exception.
- Every cap value, provider price, whether idle silence is billed, and whether either provider accepts a spend cap.
- Whether `DEEPGRAM_API_KEY` and `DEEPINFRA_API_KEY` are set on `ceaseless-dog-617`.
- Deepgram wire events and auth details for browsers; Chatterbox sentence and size limits; Convex action size limits; whether a running Convex action can be cancelled by the client.
- Idempotency key support in the canonical text-send path (#744's contract names none; `convex/chat.ts` is absent).
- Hebrew crisis phrases; mixed-language turns; Hebrew TTS quality.
- First-audio latency (TRD §5a: "UNKNOWN until measured"); echo behaviour on speakers.
- Named browsers for T-5; whether the DeepInfra Service Order exists (PRD §10 item 12).
- Push-to-talk ownership.

### Notes for ticket sync (this build ticket edits no canonical doc)

1. HARD_RULES §9 says Basic gets 30 live minutes. PRD F-35 says live is Pro/Max only. Needs Amit's call (A-7).
2. HARD_RULES §9 names `profiles.timezone` and a `voiceSessions` table. The repo has `userPreferences.timeZone` and no voice table. TRD §5b names `users.locale`. The repo has `userPreferences.locale`.
3. HARD_RULES §2 and §6.1 still describe Mistral routing for model calls. TRD §3 and `convex/lib/ai_router.ts` use DeepInfra. HARD_RULES says nothing about Deepgram or DeepInfra, so the provider choice rests on PRD §7 and TRD §3.
4. `factory/SLOTS.md` Secrets lists neither `DEEPGRAM_API_KEY` nor `DEEPINFRA_API_KEY`.
5. `convex/lib/entitlements.ts` still says "Signup is open" while sign-up is approval-gated. Every account still gets tier `max`.
6. #744/#745 need an idempotency key for the voice retry rule (L-11).
7. #868 asks for coordination with the "sole #276/PR #835 reducer owner". That issue is closed and the PR merged.
8. `convex/lib/crisisWords.ts` has no Hebrew phrases while PRD §3.1 requires Hebrew voice.

### Adoption record

Left unfilled on purpose. #868 DONE needs owner adoption "bound to the exact commit". Fill these in the ticket or PR, never in this file.

| Item | Value |
|---|---|
| Contract commit SHA | pending |
| Owner adoption (who, when, where) | pending |
| Decisions 1 to 8 resolved | pending |
| Independent review | pending |
| Ownership check on `docs/contracts/VOICE.md` | At authoring the path did not exist at `6cca807`. Re-check at admission. |
| Remaining UNKNOWNs at adoption | pending |
