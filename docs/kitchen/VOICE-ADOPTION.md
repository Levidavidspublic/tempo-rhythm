# VOICE.md adoption record

The voice contract is `docs/contracts/VOICE.md` on PR #871 (head `62f39af`). Its section 9 says the adoption record goes in the ticket or PR, never in the contract file. This is that record, kept with the kitchen run that applies it.

- **Adopted by:** Amit, 18 Oct 2026, in the kitchen run's session ("I approve the voice.md ... You can write it your own"). Where Amit named a value, it is his. Everywhere else the contract's recommended default is taken, as he allowed.
- **Contract commit:** `62f39af1c42e6f25898df82e5d21edc9d1416787`.
- **Independent review:** pending.

## Section 8 decisions

| # | Decision | Taken | Where it lives |
|---|---|---|---|
| 1 | STT eligibility (E-1, E-2, E-3, E-7) | EU processing: Deepgram's EU endpoint `api.eu.deepgram.com`. No training: `mip_opt_out=true` on every stream. Retention: with the opt-out, Deepgram keeps request data only while processing it. Data classes (E-7) approved as proposed. | `convex/lib/voicePolicy.ts` (`DEEPGRAM_HOST`, both lanes), commit "stream speech through Deepgram's EU endpoint" |
| 2 | TTS eligibility (E-4, E-5, E-7); English use (P-3) | Chatterbox multilingual on DeepInfra for Hebrew and English. DeepInfra states inputs stay in memory during inference and aren't written to disk, and it doesn't train on API data (models other than Google's and Anthropic's). Its privacy policy allows keeping inputs and outputs for a limited time for debugging. Hosting region: DeepInfra offers no region choice we found, so it stays UNKNOWN and is accepted for the beta. | `convex/voice.ts` (`speak`), study read-aloud |
| 3 | Open-weight exception (E-6) | None adopted. | none |
| 4 | Caps and spend (A-7, A-8) | **50 live minutes per person per local day for the beta testers (Amit).** Every account is on `max`, so that is the cap for everyone today. Lower tiers keep their HARD_RULES §9 numbers (Basic 30), so the PRD F-35 "no Basic live" difference is settled by HARD_RULES. Recording shares the same minutes. TTS: 20,000 characters per person per day, shared by the coach voice and study read-aloud. Global ceiling: 120 minutes a day for everyone together (unchanged, see open items). Provider spend caps: to set at Deepgram and DeepInfra (open items). | `VOICE_LIMITS` in `convex/lib/voicePolicy.ts` |
| 5 | Continuous capture inside a session (L-5) | Option B, bounded by item 8. | voice runtime (#865) |
| 6 | Sentence-level TTS (L-8) | Adopted. | `speechSentences`, `speak` |
| 7 | Crisis (L-12) | Hebrew live voice stays off until a Hebrew crisis phrase list is approved. The crisis card is shown as text, never spoken. | `laneFor` returns no Hebrew lane |
| 8 | Time bounds (L-15) | 90 seconds idle, 15 minutes per session, 30 seconds on a hidden page. | `VOICE_LIMITS.maxSessionMs`; idle and hidden-page timers in the voice reducer (#859) |
| 9 | T-4 synthetic real-provider run | Runs after items 1 to 4. Date, spend ceiling and who triggers it: open (Amit). | open |
| 10 | T-5 browsers and devices | Chrome and Safari, desktop and mobile. | acceptance only |
| 11 | Usage rows after account hard-delete (R-4) | Deleted with the account. | `USER_OWNED_TABLES` |
| 12 | Push-to-talk owner | UNKNOWN. Blocks nothing. | none |

## Evidence (E-8), read 18 Oct 2026

Read from the providers' public pages by the kitchen run. These are the providers' own claims. They aren't a contract.

- Deepgram EU endpoint: [regional endpoints](https://developers.deepgram.com/reference/regional-endpoints) (`/v1/listen` and `/v2/listen` on the EU host; Whisper isn't offered there) and [EU endpoint generally available](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available). Deepgram guarantees EU hosting, not a fixed country.
- Deepgram training and retention: [Model Improvement Partnership Program](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program) (`mip_opt_out=true`; opted-out data is "retained only for the duration necessary to process the request"). Pricing: the [5 March 2026 changelog](https://developers.deepgram.com/changelog/2026/3/5) says opting in or out doesn't change Pay as you Go or Growth rates.
- DeepInfra: [data privacy](https://docs.deepinfra.com/account/data-privacy) and [privacy policy](https://deepinfra.com/privacy).

## Still open after adoption

1. **Global ceiling.** 120 minutes a day for everyone together means three testers using their full 50 minutes reach it, and then voice rests for everyone until the next UTC day. Raise it to the testers' total (50 × `BETA_MAX_TESTERS`) or keep it as a spend guard. Amit's call.
2. **Provider spend caps** (A-8, the real ceiling): set a cap or credit limit at Deepgram and at DeepInfra.
3. **Account plan check:** confirm the Deepgram plan is Pay as you Go or Growth, the plans where the March 2026 changelog says the opt-out costs nothing extra.
4. **Hebrew crisis phrase list** (item 7) before Hebrew live voice.
5. **T-4 run** (item 9): date, ceiling, who runs it. This is also the first real check of the EU endpoint and the opt-out parameter. The sandbox had no key and made no paid call.
6. **DeepInfra hosting region** (E-4): ask DeepInfra in writing if it matters.
