# UX guidelines

## Verdict

The person has ADHD, often severe dyslexia, and may listen instead of read. The UI is calm, honest, and fast enough to trust. It does not nag for the sake of a streak. Hebrew is a first-class layout, not a translation pasted onto an English screen.

## Timing

Show that the coach is working. A reply that appears with no visible thinking is easy to distrust. That rule is from the Tempo docs job of 4 Nov 2026. It is a product rule, not a cited lab result.

Published limits, for orientation only. They are not Tempo pass lines unless [SPEC.md](./SPEC.md) already adopted them.

- WCAG 2.2, as cited by the ticket standard of 1 Nov 2026: text contrast at least 4.5:1, target size at least 24 by 24 CSS pixels (WCAG 2.5.8).
- Core Web Vitals, as cited there from web.dev: INP 200 ms or less, LCP 2.5 s or less, CLS 0.1 or less.
- Nielsen Norman Group's three response-time limits are often stated as about 0.1 s, 1 s and 10 s. The article was not re-opened in this session. The exact page date is UNKNOWN. Do not add them as Tempo pass lines until that page is checked.
- `docs/HARD_RULES.md` section 7.4 says skeletons, not spinners, when a content area is expected to take more than 100 ms. That number is the repo rule.

Touch and swipe latency per gesture, as a Tempo target, is UNKNOWN. Do not invent milliseconds.

## States

Every screen has default, loading, empty, error, and offline. The words match the real state. Do not say the work is saved while the write is still going. Source: design note 2026-10-21.

Empty and error copy never calls the person lazy or a failure. A gap after missed days says welcome back. Source: `docs/HARD_RULES.md` section 1.

## Feedback

- One primary action per screen.
- Visible focus.
- Proposal cards: Accept, Edit, Reject, with the exact change.
- Undo shows the time left.
- Reduced motion is on when the person asks for it, and when the OS asks for it.
- Mobile haptics: a small tap on completing a task. Not on errors. Source: `docs/HARD_RULES.md` section 7.4. Celebration haptics are in that file. How often a celebration may fire is UNKNOWN. Prefer rare.

## Nudges

Reminders, several email accounts, WhatsApp, and Discord are Gen 1.1 and 1.5, not the alpha (Amit and Nir, 2026-11-05). Recurring tasks and automatic email alerts sit there too. The alpha and the MVP do not nag from email or WhatsApp.

Reminders that work for Amit come from a friend or use his own wording. A generic "drink water" reminder does not. Source: Basic Memory, 2026-09-19. Nags use the person's phrases (`nags` table).

Do not stack badges, streaks that punish, or daily guilt. `HabitRing` may show progress. It may not scold.

A study that would justify a points system was not attached. Any gamification beyond the habit ring and a rare celebration is EXTRAPOLATED and out of the MVP until Amit asks for it.

## Hebrew

- The layout mirrors. The data does not.
- Logical CSS properties, not left and right margins.
- The person's paragraph can be Hebrew inside an English page, and the reverse.
- Times, code, and product literals that are identifiers stay left-to-right.
- Type: Frank Ruhl Libre and Assistant, from the 21 Oct design note.
- Voice-to-voice must handle Hebrew in the MVP (Amit, 2026-11-05). The older "Hebrew is read-aloud only" line does not win.

## Notifications

Ask before a new channel. A notification that repeats without a new fact is a failure. Quiet hours are UNKNOWN. Do not invent a clock time.

## Verification

Council check (Amit and Nir, 2026-11-05). Three strong models from different providers each score screenshots out of 10, compared with Brainrot (thebrainrotapp.com), NotePlan, and Instacook (instacook.app). Fix and re-score until every model gives 9 or more. Record scores per round. No round has been run.

## Sources

`docs/HARD_RULES.md` sections 1, 7 and 8 at `5504fc40`. Design note 2026-10-21. Ticket standard on `docs/source-2026-11-01` (1 Nov 2026) citing WCAG 2.2 and web.dev. Amit, 2026-11-05. Job file `Downloads/claude-jobs-2026-11-04/03-t3-tempo-docs.md`. Nielsen article date: UNKNOWN. Amit and Nir, 2026-11-05, from `Downloads/nir-followup-2026-11-05/01-cursor-tempo-docs-nir-update.md`.
