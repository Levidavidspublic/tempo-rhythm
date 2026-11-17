<!--
Tempo Flow PR template. Format mandated by docs/HARD_RULES.md §12.
Owner-tag discipline is enforced by §14.
-->

## Summary

<!-- 2–3 sentences. Explain *why* this change exists, not *what* files moved. -->

<!--
What changed:
Why:
Where the risk is:
-->

## Linked task(s)

<!-- One or more TASKS.md IDs. Keep the exact `T-XXXX` format. -->

Task: T-XXXX

## Screenshots / screen recording

<!-- Required for any UI change (web or mobile). Paste images or a short clip.
     For non-UI changes, write "N/A — no user-visible surface". -->

## Test plan

- [ ] Local `bun run typecheck` passes
- [ ] Local `bun run lint` passes
- [ ] Relevant unit / integration tests added or updated
- [ ] Manual QA steps performed (list them below)
- [ ] Reproduces the acceptance criteria below

<!-- Add extra checks specific to this change. -->

## Acceptance criteria

<!-- Copy the acceptance criteria from the TASKS.md row or the linked issue.
     Do not paraphrase — the reviewer uses these to decide merge. -->

## HARD_RULES compliance checklist

Read @docs/HARD_RULES.md before ticking. Unchecked boxes must have a note.

- [ ] No forbidden tech added (§2): no Supabase, Prisma/Drizzle, Clerk/Auth0/NextAuth, direct OpenAI/Anthropic/Google AI SDKs, Redux/Zustand/Jotai, Axios.
- [ ] AI-originated state changes surface an accept / edit / reject card with preview (§1, §6).
- [ ] Schema changes respect `v.*` validators, indexes, soft-delete, and RAM-only fields (§5).
- [ ] Styling uses design tokens from `packages/ui` — no ad-hoc hex or rogue Tailwind utilities (§7).
- [ ] Accessibility: keyboard nav, focus-visible, `prefers-reduced-motion`, color contrast (§8).
- [ ] No secrets committed; new env vars documented in `.env.example` with a one-line comment (§13).
- [ ] Voice rules honored — never shame the user; empty states are kind (§1, §9).

## Owner tag (§14)

<!-- Pick exactly one. This tells reviewers who is allowed to act on this PR.
     Code agents must only submit PRs under their own tag. -->

- [ ] `cursor-ide`
- [ ] `cursor-cloud-1`
- [ ] `cursor-cloud-2`
- [ ] `cursor-cloud-3`
- [ ] `twin`
- [ ] `pokee`
- [ ] `zo`
- [ ] `human-amit`

## Reviewer

<!-- Default: Amit (human-amit). For code-agent PRs, a second agent may be tagged
     with `reviewer` after human approval. -->

Rule 9. PR flow: ticket branch -> loop branch (loop/claude-&lt;date&gt; or loop/codex-&lt;date&gt;), merged on CI + Jev green by the lead. One loop PR -> integration through Gate 1 (Claude lane) or Gate 2 (Codex lane): CodeRabbit + security check + unit tests, max 3 fix rounds, then the lead merges. integration -> preview. Release PR integration -> master, Gate 3: CodeRabbit on what's new since last preview + security check + unit tests. After several previews, Gate 4: final full review on the same release PR; Amit merges -> production; if production checks fail, roll back.

## Risk

<!-- Describe affected behavior, failure modes, and any remaining uncertainty. -->

## How to revert

<!-- Name the commit to revert and any configuration restoration required. -->

## Checks

- CI result:
- Jev score:
- CodeRabbit gate result:
- Council score:
