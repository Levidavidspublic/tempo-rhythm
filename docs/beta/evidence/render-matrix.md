# Render matrix: 32 routes x 8 variants (256 loads)

Measured on https://preview.tempoflow.dev with the test account (Dana), 16 Oct 2026.
Every load: HTTP 200 and no bounce to /sign-in. Cell = `ok` when sideways overflow is 0 px and there are no console errors.
In Hebrew cells, `EN n` = English words that are app wording, not user content. Not counted: the brand and product names, the "English" language button, and the auto page titles in the sidebar ("Week 42", "Friday, 16 October", reported once as a finding).
Screenshots and raw rows stayed in the conductor's scratch folder (not committed).

| route | 390-light-en | 390-light-he | 390-dark-en | 390-dark-he | 1280-light-en | 1280-light-he | 1280-dark-en | 1280-dark-he | notes |
|---|---|---|---|---|---|---|---|---|---|
| /today | ok | ok · EN 169 | ok | ok · EN 169 | ok | ok · EN 169 | ok | ok · EN 169 | h1 count 2 |
| /daily-note | ok | ok · EN 124 | ok | ok · EN 124 | ok | ok · EN 124 | ok | ok · EN 124 |  |
| /brain-dump | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /coach | ok | ok · EN 26 | ok | ok · EN 26 | ok | ok · EN 26 | ok | ok · EN 26 |  |
| /plan | ok | ok · EN 10 | ok | ok · EN 10 | ok | ok · EN 10 | ok | ok · EN 10 | h1 count 0 |
| /tasks | ok | ok · EN 34 | ok | ok · EN 34 | ok | ok · EN 34 | ok | ok · EN 34 |  |
| /notes | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /journal | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /calendar | ok | ok · EN 40 | ok | ok · EN 40 | ok | ok · EN 40 | ok | ok · EN 40 |  |
| /habits | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /routines | ok | ok · EN 1 | ok | ok · EN 1 | ok | ok · EN 1 | ok | ok · EN 1 |  |
| /goals | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /projects | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /insights | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /history | ok | ok · EN 43 | ok | ok · EN 43 | ok | ok · EN 43 | ok | ok · EN 43 |  |
| /activity | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /tracking | ok | ok · EN 58 | ok | ok · EN 58 | ok | ok · EN 58 | ok | ok · EN 58 | 2 <main> |
| /templates | ok | ok · EN 72 | ok | ok · EN 72 | ok | ok · EN 72 | ok | ok · EN 72 |  |
| /templates/builder | ok | ok | ok | ok | ok | ok | ok | ok | h1 count 0 |
| /search | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /modules | ok | ok · EN 1 | ok | ok · EN 1 | ok | ok · EN 1 | ok | ok · EN 1 |  |
| /week | ok | ok · EN 2 | ok | ok | ok | ok | ok | ok | 2 <main> (some loads); h1 count 1/0; → /notes/<id> |
| /settings | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /settings/profile | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /settings/preferences | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /settings/integrations | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /settings/privacy | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /settings/nags | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /settings/memory | ok | ok | ok | ok | ok | ok | ok | ok |  |
| /billing | ok | ok · EN 3 | ok | ok · EN 3 | ok | ok · EN 3 | ok | ok · EN 3 |  |
| /notifications | ok | ok · EN 1 | ok | ok · EN 1 | ok | ok · EN 1 | ok | ok · EN 1 |  |
| /ask-founder | ok | ok · EN 125 | ok | ok · EN 125 | ok | ok · EN 125 | ok | ok · EN 125 | 2 <main> |

Totals: 256/256 loads HTTP 200; 0 bounces to /sign-in; 0 loads with sideways overflow; 0 console errors; every Hebrew load had dir=rtl.
Hebrew pages with the most English app wording: /today (169), /ask-founder (125, dev scaffold), /daily-note (124, dev scaffold), /templates (74, built-in template text), /tracking (59, known #981), /history (43), /calendar (41), /tasks (34, known #983), /coach (26), /plan (10).
Notes: the /settings/integrations, /settings/memory and /billing counts are brand or plan names (Google Calendar, ChatGPT, Max, Pro and similar), which is fine. The /week loads in he sometimes caught the "Loading note." state, which is English with 2 <main> and no h1.
