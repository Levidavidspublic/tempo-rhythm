# Tempo Flow voice-to-voice — proposed draft

6 November 2026. WALK. Not merged, deployed or tested. Integrated into the local docs correction draft; not committed or published. Default-branch rules remain authoritative until owner-reviewed changes land. Source decisions: supplied VOICE-TO-VOICE-BRIEF.md and current docs-fixes SPEC.md / PRICING-AND-PLANS.md. Dated provider evidence and arithmetic: [research worksheet](./VOICE-RESEARCH.md).

## Product boundary

Hebrew and English conversational voice belong to MVP, not Alpha. Start with hosted speech-to-text → text reasoning → speech synthesis. A GPU is conditional on hosted quality failing; “voice GPU” wording elsewhere must not make rented hardware an MVP dependency. No Venice in Tempo runtime.

$20 is bare essential; $50 adds voice. Whether $100 includes voice is UNKNOWN. The older 300/1,800 monthly-minute split and 30/90/180 daily-minute rule disagree with later plan wording; neither becomes a new allowance here. Map schema plan names and resolve entitlements in the owner-reviewed decisions before enforcement. Until then, preview voice is limited to explicitly invited test access, not a public plan feature switch.

## Hosted implementation proposal

Browser records one bounded turn and displays editable Hebrew transcript. A protected Vercel preview function authenticates the tester, reserves cost, calls configured STT, invokes the existing text/safety path, then synthesizes and streams the approved answer. Keep credentials server-side through the dev-vault injection path. Firebase stores only the application state allowed by the product's retention policy. Retention of raw voice and full transcripts is UNKNOWN; this draft does not enable storage.

Use roles `VOICE_STT`, `VOICE_REASONING`, `VOICE_TTS`, and `VOICE_SAFETY`; resolve provider/model versions in configuration, not permanent prompts. NanoGPT is the requested initial chain, but a recent open-weight Hebrew STT/TTS pair is not yet verified. Priced proprietary or old-model candidates in the research worksheet are not default approval. Direct Fish or ElevenLabs can be evaluated as explicit alternatives; never silently swap providers. No OpenAI-priced endpoint.

Tempo's requested crisis safeguard remains the safety role, with gpt-oss-safeguard 20B recorded as the brief's candidate mapping, not hardcoded into policy. Apply existing crisis handling to the transcript and proposed reply before audio. If safety checks fail or time out, retain the text fallback and existing crisis flow. Voice must not invent a separate clinical policy or bypass tool approvals. Barge-in stops local playback immediately, cancels pending generation best-effort, and ignores stale chunks by turn ID; already incurred provider cost is still recorded. Mutating background actions require the same permissions as text actions.

Start with explicit push-to-talk/end-turn for the preview. Automatic turn detection and full-duplex interruption are later acceptance work, not proved by file upload. Hebrew transcript/reply areas use RTL; numbers, times and code use isolated LTR spans. Always retain text alongside playable audio and expose stop/replay/mute controls.

## Cost, latency and later GPU

One input minute is not one conversation minute. Meter input-audio seconds, output characters/UTF-8 bytes, text tokens, safeguard tokens and hosting separately. At the observed Nano rates, one minute input plus 720 output characters would be $0.1734 audio using Scribe/v3; this is an illustrative workload, not a plan allowance or approved lane. Actual output density and total margin remain UNKNOWN.

Use the worksheet's possible 10-second test reservation of $0.05 only after authorization and all quote/policy gates pass. It is a local per-attempt reservation, not a provider budget change. Proposed end-of-input-to-playback diagnostic ceiling 7.5s; measured latency UNKNOWN.

Later: an authenticated per-use GPU worker may replace a stage if hosted Hebrew fails. Rental provider, model, GPU fit, cold start, hourly quote and active utilization must be measured first; stop idle GPUs. Cost per served minute = (billed GPU hours × hourly rate + storage/egress) / served voice minutes, plus external TTS if required. Apriel Voice 27B is audio-to-text; its official four-H100 configuration does not prove single-3090/4090 feasibility. Hebrew and single-GPU costs remain UNKNOWN.

## Preview check, not yet run

Proposed endpoint: authenticated POST `/api/preview/voice/turn`, no production route. Accept one synthetic/nonprivate Hebrew clip of exactly 10 seconds; return transcript, answer text, playable audio, request IDs, stage timings and itemized cost with no secrets. Verify Hebrew intelligibility, text/audio meaning match, RTL, cancellation, silence/error handling and budget stop. Record actual input duration and output bytes. Reject unsupported language/model or an unbounded quote before paid work. One explicitly budgeted alternate approach is permitted by the run rules; no automatic retry loop.

Done: architecture and cost research draft. Needs Amit: plan entitlements through the existing consolidated decisions list. UNKNOWN: compliant Nano audio pair, provider retention terms, preview playback/latency, GPU economics. No paid test performed.
