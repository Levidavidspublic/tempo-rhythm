# Hebrew crisis keyword candidates

WALK — This is a machine-drafted candidate list behind an OFF-by-default option, not a clinically reviewed lexicon. No production caller enables it. Hebrew live voice stays disabled until Amit's clinical review and a separately verified activation change. Imperfect Hebrew pronunciation is acceptable under Amit's 22 October instruction; clinical review is a separate requirement.

Checked 22 October 2026. No real conversation, health record, provider call or paid research was used.

## Primary-source access

| Intended primary source | Access result | Evidence available here |
| --- | --- | --- |
| [ERAN](https://www.eran.org.il/) | Public HTTPS request returned CONNECT 403 at 07:04 UTC on 22 October 2026 | No page text or phrase guidance retrieved; no quotation is attributed to ERAN |
| [Israeli Ministry of Health public guidance](https://me.health.gov.il/) | Public HTTPS request returned CONNECT 403 at 07:05 UTC on 22 October 2026 | No page text or phrase guidance retrieved; no quotation is attributed to the Ministry |

These are source-access records, not citations establishing the candidate wording below. The existing English phrases in `convex/lib/crisisWords.ts` informed the candidate concepts, but that source file is not clinical validation either. Source-grounded clinical research remains incomplete. Before activation, obtain the actual relevant guidance pages, record their title, URL, publication/access date and exact supporting passage, and distinguish those passages from proposed grammatical variants. Do not replace inaccessible sources with invented quotes or remembered hotline information.

## Candidate wording for review

All Hebrew in this table is machine-drafted and needs Amit's clinical review. The English column explains the intended meaning; it does not certify a translation or diagnostic interpretation. Singular `רוצה` has the same unpointed spelling for the common masculine and feminine forms.

| Hebrew candidate | Intended English meaning |
| --- | --- |
| רוצה למות | want to die, singular |
| רוצים למות | want to die, masculine/mixed plural |
| רוצות למות | want to die, feminine plural |
| רוצה להתאבד | want to end one's life, singular |
| רוצים להתאבד | want to end one's life, masculine/mixed plural |
| רוצות להתאבד | want to end one's life, feminine plural |
| חושב על התאבדות | thinking about suicide, masculine singular |
| חושבת על התאבדות | thinking about suicide, feminine singular |
| חושבים על התאבדות | thinking about suicide, masculine/mixed plural |
| חושבות על התאבדות | thinking about suicide, feminine plural |
| מתכוון להתאבד | intend to end one's life, masculine singular |
| מתכוונת להתאבד | intend to end one's life, feminine singular |
| מתכוונים להתאבד | intend to end one's life, masculine/mixed plural |
| מתכוונות להתאבד | intend to end one's life, feminine plural |
| להרוג את עצמי | to kill myself |
| לפגוע בעצמי | to hurt myself |
| לחתוך את עצמי | to cut myself |
| אין לי סיבה לחיות | I have no reason to live |
| לא רוצה לחיות | do not want to live, singular |
| לא רוצים לחיות | do not want to live, masculine/mixed plural |
| לא רוצות לחיות | do not want to live, feminine plural |
| לשים קץ לחיי | to end my life |

Standalone broad words such as `התאבדות` are not added: an educational discussion containing only that word should not match this candidate set. This choice is a narrow implementation default, not a reviewed clinical sensitivity/specificity decision.

## Matching behavior and limits

The existing `isCrisisText(text)` English path is unchanged. The optional second argument `{ hebrewEnabled: true }` enables candidate matching only inside that call. Omitted options, an empty object, explicit `false` and non-boolean truthy values do not activate it. There is no new public endpoint parameter, environment setting, persisted flag or production caller change in this ticket.

For the opt-in Hebrew path only, matching applies compatibility decomposition, removes Hebrew niqqud/cantillation and formatting controls, turns punctuation/whitespace into token separators, and checks whole-token candidate sequences. This covers pointed text, maqaf, repeated whitespace, directional marks and Hebrew presentation forms. It avoids matching `רוצה למות` inside `רוצה למותם` or `לפגוע בעצמי` inside `לפגוע בעצמיות`.

This is lexical matching, not an assessment of intent or risk. In particular:

- Negation is not understood: `אני לא רוצה למות` can match the shorter candidate `רוצה למות`.
- Quoted, hypothetical, third-person or historical text can match. The tests preserve that limitation explicitly; they do not claim contextual understanding.
- Prefixes, slang, misspellings, transliteration, mixed languages, indirect wording and transcription errors can be missed. For example, a prefixed word such as `שרוצה` is a different token from `רוצה`.
- No match is not evidence of safety. A match is not a diagnosis or evidence of imminent intent. Sensitivity, specificity and performance on real audio/transcripts are UNKNOWN.

Raw text is neither stored nor sent anywhere by this pure function. The fixed English resource card and its existing generic-country limitation are unchanged. Hebrew activation requires a reviewed localized response and caller-level crisis-before-model behavior; a phrase match alone does not establish that complete flow.

## Clinical review and activation boundary

AT — Before any live Hebrew crisis path is enabled, Amit's clinical review must cover the actual retrieved guidance, every candidate/translation and grammatical form, normalization behavior, false positives and false negatives, negation/quotation examples, and the fixed response/resources the person will receive. Record the approved lexicon version and clinical decision with evidence. Native-perfect read-aloud is not required by this ticket, but pronunciation must not alter the reviewed response's meaning.

After that review, a separate scoped activation must wire the approved flag through the real callers, prove crisis interception before model/tool calls, preserve privacy and no-AI-mutation behavior, verify the Hebrew fixed response, and test the voice transcript/stop path. Do not enable `voicePolicy.laneFor("he")` as a side effect of merging this candidate matcher. Its existing return value remains `null`.

## Validation status

WALK — Isolated Bun 1.3.9 test run: **17 pass, 0 fail, 163 assertions**, including all six existing cases and eleven new cases. The new cases cover default-OFF behavior for every candidate, explicit opt-in, gender/plural forms, niqqud/cantillation, punctuation/maqaf/spacing, directional/presentation forms, token boundaries, ordinary text, existing English compatibility, known lexical limitations and strict boolean opt-in. Fictional phrase fragments only.

The prepared source, test and this document are the only ticket changes. Schema, routes, production callers, environment values and voice policy are unchanged. Mandatory repository lint/typecheck/full tests/scans/Playwright/build and current hosted CI/CodeRabbit/guards still require the coordinator's available checkout and validation slot. The isolated test is not a whole-product or live-voice acceptance claim.

UNKNOWN — primary ERAN/Ministry guidance content; clinical suitability and real-world error rates; live Hebrew ASR/read-aloud behavior; current full repository checks. No clinical enablement is authorized by the test result.
