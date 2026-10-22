# Voice Agent transport preparation — 22 October 2026

WALK — Candidate 3 is frozen and blocked by validation failures. Implemented behind an unset/off switch. This is not verified live voice. No provider connection, model call, audio upload, key/config change, signup, deployment or paid check was performed during preparation.

## Scope and dependencies

- Ticket #1253: `convex/http.ts`, `apps/web/components/coach/voice/useVoiceCall.ts`, `apps/web/components/coach/CoachChat.tsx`, `tests/unit/tempo-voice-agent.test.tsx` and this evidence only.
- Durable bridge #1278 / PR #1289 (`88e9e266d18c90355e1e5943622dcd2a210408e3`) provides the owned lease, opaque capability, monotonic receipts, canonical message link and atomic speech allowance reservation. No changes to `voice.ts`, `coach.ts` or schema in this ticket.
- CoachChat starts from frozen composer #1279. Typed research/cancel and the existing legacy voice caller are preserved.
- Settings router #1255 provides `resolveAiModel`; the browser never invents a model ID. Actual generation remains in the authenticated `coach.replyWithControls` action and its existing router.
- Canonical flag declaration is a separate ticket (#1287). `TEMPO_VOICE_AGENT_ENABLED` stays unset/off. No env file is edited here.

## Implemented contract

`GET /voice/agent/config` returns `{enabled:false}` by default. When its flag, existing server keys, model setting and HTTPS Convex site are configured, it returns only `{enabled:true,model,endpoint}`. It exposes no credential, account or lease. The browser accepts only the matching deployment's HTTPS callback endpoint.

`POST /voice/agent/think` accepts an opaque lease capability in the Authorization header and the lease ID in `X-Tempo-Voice-Session`. Backend bridge functions revalidate the active owned lease, current approval, limits and receipt. No capability is put in a URL or log. The callback body is bounded to 64 KiB, 64 messages and five seconds, and abort cancels its reader. New speech is bounded to 4,000 characters and normalized consistently with the bridge. Unsupported roles, malformed framing, missing/conflicting tool anchors and foreign/stale backend receipts fail closed.

The first callback returns one deferred client function, `tempo_coach_reply`, with `{text,receipt}`. The browser saves the current page before `beginAgentTurn`; scope/abort fences run before and after every asynchronous stage. Admission inserts the canonical user message exactly once. The existing coach action runs using its returned request/message key. `completeAgentTurn` must confirm the exact server-linked assistant reply before a function response is sent. Provider history, model, system text, tool-result content and assistant IDs never become authoritative context or speech. The callback resolves the linked saved answer, supporting both JSON and bounded OpenAI-compatible SSE framing without adding an SDK or another runtime provider.

The mounted VoiceCall hook waits for Welcome and SettingsApplied before sending raw little-endian PCM. An AudioWorklet batches microphone frames into 20 ms blocks at the actual context sample rate. Output is 24 kHz PCM with a bounded playback queue. Muting toggles the existing microphone track. End, account/thread/page changes, microphone loss, socket failure, renewal failure and canceled work tear down capture, worklet port, tracks, playback, context, socket, timers and lease. Module blob URLs are revoked.

No automatic reconnect or function replay occurs after teardown. A canceled pending/running receipt has no completed-parent anchor; that lease ends and the person must choose Start again. Barge-in after a completed answer can clear playback while retaining its completed parent. The documented History reporting is disabled. Valid bounded LatencyReport messages are ignored without logging or extending idle time.

The existing client crisis guard runs before page persistence so a failed save cannot hide the fixed resources card. Backend crisis admission independently preserves the existing fixed card, stops voice, and never reaches the model or speech response. Hebrew live voice remains off pending clinical review. No proposal is accepted by voice transport; existing Accept/Undo behavior remains in the canonical coach flow. Speech allowance is reserved by #1278 at answer save; an exhausted allowance yields no function response/audio. Failed delivery does not refund a reservation.

## Validation ledger

Preparation uses Bun 1.3.9, isolated synthetic fixtures and read-only dependency overlays. No live account or provider is used.

| Pass | Result |
| --- | --- |
| Candidate 1 focused contracts | 24 pass, 0 fail, 137 assertions |
| Candidate 2 focused contracts | 26 pass, 0 fail, 146 assertions; added whole-body deadline/abort and documented passive telemetry regressions |
| Candidate 2 strict real TypeScript graph | 0 diagnostics, 543 source files; actual #1278 schema/API/router and #1279 composer overlays |
| Candidate 2 mounted diagnostic | Fixture build failed resolving installed React/ReactDOM from the scratch entry; no browser launched and no mounted assertion ran. Explicit package resolution prepared for candidate 3. |
| Candidate 3 focused + mounted | 26 pure tests pass, 146 assertions; mounted fixture setup fails resolving `./todayBounds` and the scratch i18n path. No Chromium launch and none of the five mounted cases executed. |
| Candidate 3 strict real graph | 17 TS2769 diagnostics across 563 source files, all in the mounted test assertions: untyped string-form Playwright `page.evaluate` infers `undefined`. No source-file diagnostic was reported; the combined check fails. |
| Candidate 3 scoped lint | UNKNOWN: Biome could not resolve the app configuration’s `../../packages/config/biome.json` from the scratch invocation. No lint pass is claimed. |

The three-candidate limit is reached. No fourth implementation repair or test rerun was made. Root receives the prepared draft and the failures; it must not merge this as green. The original mounted setup limit (90 seconds) and per-case limit (30 seconds) remain unchanged.

Read-only review by the backend owner confirmed the HTTP deadline and passive telemetry fixes, and found no additional concrete issue in the inspected page-save/key/canonical linkage or PCM teardown. This is not CodeRabbit clearance.

UNKNOWN: mandatory full lint/typecheck/test/scans/build and repository Playwright, CodeRabbit review and merge guards are root-coordinated after publication. No full-app check or preview result is inferred from focused tests.

## Protocol evidence and activation blockers

Original implementation follows the checked protocol descriptions; no upstream implementation code or SDK was copied.

- [Deepgram pinned AsyncAPI](https://github.com/deepgram/deepgram-api-specs/blob/d9a54c0013e29c3d2bd4021e592bbc00727624d1/asyncapi.yml): Welcome/Settings, function IDs and cancellation, deferred dispatch, PCM, History flags and LatencyReport.
- [Deepgram maintained Voice Agent reference](https://github.com/deepgram/skills/blob/0fc13fad726fb78e17fb1f05ba5942f0d022990f/skills/voice-agent/SKILL.md): custom thinker endpoint and client-side function wait.
- [Rust SDK deferred function contract](https://github.com/deepgram/deepgram-rust-sdk/blob/bc3d0b6cf3a18d97453377649c530c7499ff26a0/src/agent/think/mod.rs).
- [Deepgram custom-think JSON/SSE example](https://github.com/deepgram/deepclaw/blob/3a26a64531d4d076e2133559479737bd80494120/deepclaw/voice_agent_server.py).
- [Compatible streaming tool-call wire types](https://github.com/openai/openai-python/blob/7db9d884c33b0d5ef252e9a4b6e7ae0bbd217e5b/src/openai/types/chat/chat_completion_chunk.py): protocol only; no provider/package added.

UNKNOWN: actual post-function callback body and preservation of the completed tool anchor; callback retry/abort/timeout ordering; provider acceptance of configured model ID and generated tool-call SSE; late raw audio ordering after barge-in; audible latency, actual mobile AudioWorklet capture/output and Hebrew quality. These require a separately authorized bounded conformance run. Keep activation off until they are resolved. Synthetic tests prove Tempo's own fences and wire formatting, not the provider trace.

## Final failure receipts

`bun test tests/unit/tempo-voice-agent.test.tsx` (Bun 1.3.9):

```text
(pass) HTTP registration with guarded backend boundary > revoked/foreign/expired backend refusal never returns canonical content [4.24ms]
(pass) HTTP registration with guarded backend boundary > HTTP emits only server-linked answer and never passes supplied history/model/result [5.08ms]
(pass) HTTP registration with guarded backend boundary > new callback forwards only normalized input/parent and uses stable server receipt [8.22ms]
4 | import { getLocalDayBoundsMs, nextLocalDayRolloverDelayMs } from "./todayBounds";
                                                                     ^
error: Could not resolve: "./todayBounds"
    at /workspace/work/overnight/live-voice-transport-oct22/apps/web/lib/useLocalDayBounds.ts:4:66

1 | import {translate} from "/workspace/work/overnight/live-voice-transport-oct22/apps/web/lib/i18n.ts";expor
                            ^
error: Could not resolve: "/workspace/work/overnight/live-voice-transport-oct22/apps/web/lib/i18n.ts"
    at @/components/providers/LocaleProvider:1:25
(fail) mounted VoiceCall with synthetic transport > (unnamed) [5156.30ms]

1 tests failed:
(fail) mounted VoiceCall with synthetic transport > (unnamed) [5156.30ms]

 26 pass
 1 fail
 146 expect() calls
Ran 27 tests across 1 file. [5.71s]

```

Strict actual-source graph (final 20 lines):

```text
  Overload 1 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'true' is not assignable to parameter of type 'undefined'.
  Overload 2 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'true' is not assignable to parameter of type 'undefined'.
/workspace/work/lane2-features/tests/unit/tempo-voice-agent.test.tsx:1014:12 TS2769: No overload matches this call.
  Overload 1 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'false' is not assignable to parameter of type 'undefined'.
  Overload 2 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'false' is not assignable to parameter of type 'undefined'.
/workspace/work/lane2-features/tests/unit/tempo-voice-agent.test.tsx:1016:7 TS2769: No overload matches this call.
  Overload 1 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'true' is not assignable to parameter of type 'undefined'.
  Overload 2 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'true' is not assignable to parameter of type 'undefined'.
/workspace/work/lane2-features/tests/unit/tempo-voice-agent.test.tsx:1033:12 TS2769: No overload matches this call.
  Overload 1 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'true' is not assignable to parameter of type 'undefined'.
  Overload 2 of 2, '(expected: undefined): void', gave the following error.
    Argument of type 'true' is not assignable to parameter of type 'undefined'.
Strict type graph: 17 diagnostic(s), 563 files; actual backend1278/schema/router and composer1279 overlaid read-only.

```

Scoped lint:

```text
configuration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Failed to resolve the configuration from ../../packages/config/biome.json
    
    Caused by:
      Could not resolve ../../packages/config/biome.json: module not found
  


```

AGENTS report:

```text
status: stuck
ticket: #1253
evidence: Bun 1.3.9 focused contracts 26 pass; mounted setup 1 fail; final strict graph 17 test diagnostics; scoped lint UNKNOWN (config resolution)
changed: convex/http.ts; apps/web/components/coach/voice/useVoiceCall.ts; apps/web/components/coach/CoachChat.tsx; tests/unit/tempo-voice-agent.test.tsx; scoped evidence
unknowns: mounted behavior, full checks/review/guards, live provider conformance; activation remains off
notes for ticket sync: one further scoped repair requires the lead’s applicable exception under AGENTS; fix mounted fixture resolution and typed Playwright evaluation results before claiming validation. No product/API scope expansion is proposed.
```
