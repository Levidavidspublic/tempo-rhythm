# Roadmap

## Verdict

Four levels, in order. MVP, then Gen 1, then Gen 2, then Gen 3. These are not phases. A phase is a one-to-two-week project that someone schedules later. No calendar date is set. Dates in older roadmaps (the 2–4 Oct 2026 weekend, "next week" from 4 Oct) are history.

## MVP — an ADHD daily planner that just works

Goal. A person can sign in, plan the day, study, keep lecture notes, take a break, talk to the coach, and connect Gmail. The four parts in [PRD.md](./PRD.md) work together. Voice-to-voice includes Hebrew, or the voice ticket stays open until the model and GPU are chosen.

Exit. All of these, on the preview he names, not on a mock:

- Magic link sign-in. No password.
- A day page and a note, with no JSON visible.
- A brain-dump chat that can push back and can add a task only after Accept, Edit, or Reject. The confidence clash in [SPEC.md](./SPEC.md) is either decided or the exit uses the stricter ask-every-time rule.
- A template that can be turned on.
- Memory import that he can review before it is kept.
- Hebrew layout flips to right-to-left.
- One voice round trip in English and one in Hebrew. If the GPU or the model is still UNKNOWN, this exit item stays open and the rest may still ship as an alpha. He separated the alpha from the MVP voice work on 2026-11-05. What the alpha contains besides "not the Hebrew voice-to-voice rental" is UNKNOWN.

Not in this level: proactive mail, website-to-API, phone calls.

## Gen 1 — proactive

Goal. Tempo speaks first from email and WhatsApp, in his wording. Examples: the electricity bill, and leaving earlier because the bus is slow.

Exit. A connected inbox can produce one accepted reminder, and the raw message is not stored. WhatsApp does the same, or the WhatsApp provider is still UNKNOWN and the exit stays open.

## Gen 2 — website-to-API

Goal. The $100 plan can turn a site into an API. Examples: public transport through Apify or Firecrawl, and a VM sign-in such as Maccabi.

Exit. One public source and one signed-in source return structured data the coach can show, after he accepts it. The vendor accounts are his to open.

## Gen 3 — acting for the person

Goal. Tempo can phone the bank, wait on hold, and bring him in when a person answers. It can negotiate a cable bill.

Exit. UNKNOWN until he defines a safe test that does not spend his money or bind him to a contract by accident. Do not invent that test.

## Parked history

Native App Store and Play builds, a Rust desktop client, and a plugin marketplace were in the 16 Sep 2026 and 5 Oct 2026 ladders. They have no level in his 5 Nov words. Leave them parked.

## Sources

Amit, 2026-11-05. [PRD.md](./PRD.md). Older `docs/ROADMAP.md` (updated 2026-10-03) is history.
