# How to add a feature

Short operator guide. Agents execute tickets; humans merge.

**This repo (`tempo-rhythm`):** base branch **`integration`**. Docs live under
`docs/` only — there is no GitHub Wiki tab. Graphify path:
`docs/graphs/tempo-rhythm.json` (see `docs/TEMPLATE_STATE.md`). Understand
Anything `.ua/` is **not generated** — do not invent it.

## Flow

1. **Find the ticket** (or create one) on this repo’s Issues.
2. Write / confirm the **seven-field body** with **GOAL first**:
   GOAL → CONTEXT → ACCEPTANCE → CONSTRAINTS → BUDGET → STOP → EVIDENCE.
3. Add a **MODEL** line using **mid-tier only**:
   - Allowed: GPT 5.6 Terra, GLM 5.3 Flash, DeepSeek V4.1 Flash,
     Claude Sonnet 5, Grok 4.5, Grok 4.6
   - Never: Fable, Astra, Opus, Soul
   - Unused: Haiku, Luna
4. **CONTEXT** must point at the Graphify path recorded in
   `docs/TEMPLATE_STATE.md` (and `.ua/…` only if that file is marked
   **generated**). Do not invent Understand Anything graphs.
5. Implement on a feature branch. Open a **draft** PR that references the
   issue. Keep the diff small; no secrets; no ENV values.
6. **Never merge yourself.** Wait for Amit (Gate 2).
7. **Never apply `agent:ready`.** That label is Gate 1 only.

## “I want to add feature XYZ” checklist

- [ ] Ticket exists with GOAL first and all seven fields filled
- [ ] MODEL line is mid-tier only
- [ ] CONTEXT cites `docs/TEMPLATE_STATE.md` Graphify path
- [ ] Acceptance is testable without secrets in chat
- [ ] Branch named clearly (e.g. `feat/xyz-…` or ticket id)
- [ ] Draft PR opened; CI watched; Checker PREFLIGHT comment if available
- [ ] No `agent:ready` label applied by the agent
- [ ] No merge by the agent
- [ ] After merge (human): Graphify regenerate follow-up if layout changed

## Related

- `docs/HARNESS.md` — roles, stop codes, regenerate-on-merge
- `docs/TECH_STACK.md` — current stack names
- `docs/TEMPLATE_STATE.md` — live graph paths

Last synced: 2026-09-17
