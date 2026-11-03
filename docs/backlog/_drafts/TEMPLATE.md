# Ticket template (v2) — used by every drafting sub-agent

Copy this per ticket, in this exact order. Every field filled, or `OPEN` with who answers, or `none`.
Never leave a field blank, never use banned vague words (nice, clean, smooth, intuitive, simple, etc.).

```
### TFV2-XXXX — <Title>
- **Stage:** <A|B|C|D|E|F> · **Pass:** 1 · **Depends:** <TFV2 ids or none> · **Folds-in:** <#issue or none>
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after <Depends>, or `first`.
- **WHY:** <doc references, e.g. PRD F-xx; TRD §x; DESIGN.md §x; APP-FLOW §x>.
- **GOAL:** <one sentence — what exists after this ticket lands>.
- **SCOPE:** <exact files, at most 3 source files + 1 test file>.
- **MUTATES:** <systems/data changed, or `none`>.
- **STEPS:** 1) Graphify code-map check of the MUTATES files (the unit may already exist — then verify and add the missing test); 2) …; n) …
- **DONE:** <exact `bun` command> → <expected output>.
- **EVIDENCE:** <what to paste into the PR>.
- **DO NOT:** <things that look helpful but are out of bounds>.
- **REPORT:** <status / evidence / changed / unknowns / notes for ticket sync>.
- **SPEC:** <UI: layout + tokens (name `--tp-*` tokens) + every state (default, loading, empty, error, offline, success, disabled, + any others) with what shows in each + exact copy EN and HE for every visible string + RTL behaviour + keyboard and screen-reader behaviour + breakpoints (390/768/1024/1280) + motion (≤250 ms, name easing). Backend: exact function/table, args and return types, auth rule, error cases, limits>.
- **TESTS:** Given … / When … / Then … (exact cases; UI adds a Playwright click-through that asserts each state at 390 and 1280, EN and HE).
- **NUMBERS:** <number → pass range (source) | UNKNOWN (who answers)>.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** <list, or `none`>.
```

Rules for every ticket:
- EN copy and HE copy are both required for every visible string; list them as `EN: … / HE: …`.
- Numbers are industry-standard with a source URL (e.g. WCAG 2.2 AA contrast 4.5:1, target 24×24 px), or `UNKNOWN` with the answerer named.
- Backend tickets test every error case; UI tickets include a Playwright end-to-end click-through.
- A ticket touching an OPEN conflict (REWRITE-PLAN-v2.md §4) marks that value `UNKNOWN` and names "Amit".
