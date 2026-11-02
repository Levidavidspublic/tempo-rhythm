# Experiments backlog (set by Amit, 2 Nov 2026)

Not started. These run only after the two factory loops (Tempo Flow and OmniAgent) have run reliably for at least one to two weeks. Run them first on a dummy project that matters less than these two, then apply what is learned to the loops.

## Loop rollout before any experiment
- First 5 loops: 6 tickets at a time across the providers, on Sonnet (Claude) and Terra (Codex), to get a baseline.
- Next 5 loops: 5 to 10 tickets per provider, sized from the cost seen so far. Run that for a week.
- The loops are not 24/7: tickets do not start while the QA agents are working.
- Target: the two loops together use 40% to 60% of Amit's weekly inference across his plans, leaving room for other work.

## Experiments to run later
- Cheap model against strong model on the same tickets: Haiku against Sonnet, Luna against Terra, Grok 4.7 medium against high (via Cursor), DeepSeek (via OpenCode) as a baseline. Measure reliability per finished ticket, not just per-token price.
- Log per ticket: model, effort, tokens in and out, wall time, passed first time or not, fix rounds, gate results, Jev scores, share of the weekly plan used. Expect the OpenAI models to be the most token-efficient, then Grok.
- Decision rule: if the cheap model gets about 90% of the strong model's reliability at much lower usage, use the cheap one for that kind of ticket; if it wastes runs, stay on the strong one.
- OpenCode capacity: how much work one $40/month OpenCode plan carries, to decide whether several OpenCode plans beat the other subscriptions.
- The logs double as a portfolio piece: cost efficiency as well as code quality.
