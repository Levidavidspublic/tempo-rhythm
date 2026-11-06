# Voice research, 6 November 2026

WALK. Read-only research. No voice generated, no paid request, no account changed. Candidate names below describe observed provider metadata; product instructions should use roles with versioned configuration mappings.

## Verified hosted options

| Candidate | Published price, USD | Hebrew evidence | Limitation |
|---|---:|---|---|
| NanoGPT Whisper-Large-V3 | 0.000495/input minute | NanoGPT advertises multilingual; Hebrew-specific deployment result UNKNOWN | Old weights conflict with recent-model rule; no paid use authorized by this research |
| NanoGPT Elevenlabs-Scribe-V2 | 0.051/input minute | Live model metadata explicitly includes `heb` | Proprietary; conflicts with open-weight-only NanoGPT rule |
| NanoGPT Elevenlabs-V3 | 0.17/1,000 input characters | Upstream Eleven v3 explicitly includes `he` | Same policy conflict; actual Hebrew output untested |
| NanoGPT Omnivoice | 0.05/1,000 characters | UNKNOWN for this deployment | Release age, license and Hebrew must be verified before selection |
| Direct Fish s2.1-pro | 15/million UTF-8 input bytes | Fish voice-agent language table includes Hebrew; older S2-Pro model card includes `he` | Exact s2.1-pro Hebrew quality untested; cannot equate supported language with acceptable accent |
| Direct Fish s2.1-pro-free | 0 | Same model family | Fair-use development option; no TTFA or DPA guarantee |
| Direct Fish transcribe-1-pro | 0.36/input hour | Model-specific Hebrew evidence UNKNOWN in inspected docs | Do not infer ASR support from TTS language list |
| Direct ElevenLabs Scribe v2 | 0.22/input hour | Official Hebrew STT page | Account-effective charge/minimums UNKNOWN |
| Direct ElevenLabs v3 | 0.08/1,000 characters | Official model language table includes Hebrew | Separate vendor adapter; do not silently reroute |

NanoGPT prices came from an unauthenticated, read-only GET of [public audio-model metadata](https://api.nano-gpt.com/api/v1/audio-models); [catalog endpoint documentation](https://docs.nano-gpt.com/api-reference/endpoint/audio-models). NanoGPT's prose says approximately 0.0005/min for Whisper and “varies” for v3; the live numeric metadata is the more precise quote. No subscription entitlement is inferred.

Fish prices use **UTF-8 bytes, not characters**. A Hebrew reply must be counted after encoding. [Fish pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits), [model guarantees](https://docs.fish.audio/developer-guide/models-pricing/models-overview), [language settings](https://docs.fish.audio/agents/build/voice-language), [S2-Pro official model card](https://huggingface.co/fishaudio/s2-pro).

ElevenLabs direct quotes are from the currently opened [API pricing](https://elevenlabs.io/pricing/api), superseding older cached search prices. [Models](https://elevenlabs.io/docs/overview/models) distinguish v3/v4 Hebrew from Flash v2.5 and Multilingual v2, whose published language lists do not include Hebrew. [Hebrew transcription](https://elevenlabs.io/speech-to-text/hebrew) proves language coverage, not current price.

## Endpoints

| Stage | Endpoint | Status |
|---|---|---|
| NanoGPT STT | POST https://api.nano-gpt.com/api/v1/audio/transcriptions | Documented multipart audio endpoint |
| NanoGPT text | POST https://api.nano-gpt.com/api/v1/chat/completions | Hosted text role, eligible open weights only |
| NanoGPT TTS | POST https://api.nano-gpt.com/api/v1/audio/speech | Documented; v3 supports streamed audio according to TTS guide |
| Fish TTS | POST https://api.fish.audio/v1/tts | Model selected in HTTP header |
| Fish ASR | POST https://api.fish.audio/v1/asr | Exact `model: transcribe-1-pro` header; missing/mistyped header silently selects older model |

Sources: [Nano STT](https://docs.nano-gpt.com/api-reference/endpoint/audio-transcriptions), [Nano TTS](https://docs.nano-gpt.com/api-reference/endpoint/speech), [Nano streaming](https://docs.nano-gpt.com/api-reference/text-to-speech), [Fish TTS](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech), [Fish ASR](https://docs.fish.audio/features/speech-to-text). An OpenAI-compatible protocol does not authorize OpenAI-priced models.

## Apriel, not APL

The official model is **ServiceNow Apriel Voice 27B Preview**, MIT licensed. It consumes audio and emits text/tool calls; external TTS is required. Its published optimized deployment uses four H100 80 GB GPUs. The English evaluation's 1.91-second mean includes a particular external speech synthesizer and is not a forecast for these products. Hebrew quality, one-3090/4090 operation, cold start and rental cost are UNKNOWN. The model card currently lists no hosted Inference Provider. Do not claim it is a ready single-GPU speech-to-speech service. [Official model card](https://huggingface.co/ServiceNow-AI/Apriel-Voice-27B-preview), [paper](https://arxiv.org/abs/2610.40738).

## Cost worksheet for one possible preview

Fixed bounds: one **10.000-second input**; at most **120 output Unicode characters and 240 UTF-8 bytes**; one text response. Output audio duration is not guaranteed to be 10 seconds. Reject longer input; shorten text before synthesis. No automatic paid retries.

| Audio path | Exact arithmetic from published units | Audio estimate |
|---|---|---:|
| Nano Scribe + Nano v3 | 10/60 × 0.051 + 120/1000 × 0.17 | $0.028900 |
| Nano Whisper + Nano v3 | 10/60 × 0.000495 + 120/1000 × 0.17 | $0.0204825 |
| Direct Fish ASR + paid Fish TTS | 10/3600 × 0.36 + 240/1,000,000 × 15 | $0.004600 |
| Direct Eleven STT + v3 | 10/3600 × 0.22 + 120/1000 × 0.08 | $0.010211112, rounded upward |

These are mathematical quotes, **not invoices or authorized executable defaults**. The Nano paths retain the policy conflict; Fish ASR retains the Hebrew evidence gap. Actual provider rounding, minimums, account discounts and text/safety costs remain UNKNOWN until preflight. Full-chain cost is audio + text + safety + hosting. Proposed enforced reservation: **$0.05 per single attempt**, comprising at most $0.03 audio, $0.005 text, $0.005 safety, $0.01 hosting/rounding. If any term cannot be bounded, do not submit. This is a proposed test allocation, not an account budget change or new spending approval. Independent fallback is a new attempt, never an invisible retry.

Latency: all product measurements UNKNOWN. Proposed diagnostic ceilings (EXTRAPOLATED, not vendor claims): upload/turn finalization 1s, STT 2s, safety+text 2s, TTS first audio 2s, playback startup 0.5s: total 7.5s from recording end. Record actual stage timings rather than claim this passed.

## Check

- [x] Official prices, endpoints and Hebrew evidence distinguished.
- [x] Arithmetic computed with Python Decimal.
- [x] No Venice in product runtime; no generation or secrets.
- [ ] Hebrew preview, heard output and measured latency: NOT RUN.
- [ ] Recent open-weight NanoGPT STT/TTS pair satisfying all rules: UNKNOWN.
