---
name: soul-loop
description: Use when Amit says soul loop.
---

# Soul loop

A different model reviews your change before the PR is ready.

1. Make the smallest change that meets the intent. Nothing extra.
2. Send the diff and the intent to the reviewer: GPT 6.1 Soul. One reviewer at a time, never two at once.
3. Fix what the reviewer gets right.
4. Push back on scope creep. If a comment asks for more than the intent, say no in one line and say why.
5. Repeat. At most 3 rounds. Up to 5 rounds only when there is a security or data-loss risk.
6. Stop when the reviewer has no blocking points, or at the round limit.
7. Add this line to the PR description: "Reviewed with soul loop: N rounds, verdict".

Rules
- Never use Gemini 4 Argon as the reviewer.
- (Extrapolated) If you are GPT 6.1 Soul yourself, use a different non-Gemini model and name it in the PR line.
