# Ticket verification loop (set by Amit, 2 Nov 2026)

Every batch of tickets that gets written or repaired goes through this check before any build loop may take them. No ticket batch enters a loop without passing it.

1. Write or repair the tickets in phases of about 100, with DeepSeek and sub-agents.
2. After each phase, pick 20 tickets from that phase at random.
3. A fresh reviewer, a strong model with no context from the writing (Opus), reads all 20 against docs/backlog/TICKET-STANDARD.md and answers four questions per ticket:
   - Does it have enough detail that Haiku or Luna would practically always build it right in about 2 hours? Yes or no.
   - Does it follow Amit's rules (AGENTS.md, the standard)? Yes or no.
   - Would its PR be able to pass every gate (scope guard, tests, numbers, Jev, process check)? Yes or no.
   - Is anything left to decide that should have made it OPEN? Yes or no.
4. All 20 pass: the phase is accepted and the next phase starts.
   Any fail: the failures and the reviewer's notes go back to a repair session for that phase, then a fresh sample of 20 is checked. After two failed repair rounds, the phase stops and goes to Amit with the exact problems.
5. Whether the instructions produce good software is only known once the tickets are built. That is the build loop's job, not this check's.
