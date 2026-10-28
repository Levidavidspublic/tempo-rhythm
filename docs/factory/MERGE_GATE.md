## Merge gate (every PR, in this order)

1. **Scope guard.** Any changed file outside the ticket's scope (MUTATES/SCOPE) auto-rejects the PR. Post the reason on the ticket.
2. **CI and programmatic checks** are all green.
3. **Formatting** follows the Google official style guide for each language, using Google's formatter or linter where one exists (TypeScript: `gts`).
4. **Jev judge** (`typesafe/jev-1.13` on OpenRouter) scores clean code, formatting, naming and ticket adherence. Each score must be at least 85%. Any massive violation rejects the PR.
5. **CodeRabbit review.** Fallback, only when CodeRabbit can't keep up: Opus only, through Anthropic's official Claude Code GitHub Action on my Claude subscription token, never an API key. No Sol.
6. **Programmatic merge into `integration`.** Never into `main`/`master`.

Agents push branches to GitHub; a GitHub Action opens the PR as Division6066 so CodeRabbit reviews it on Amit's seat.
The merge gate stays off and not required until CodeRabbit has reviewed a factory PR and Amit has approved the gate PRs.

## Graphify loop

Graphify re-runs every loop or two and partly updates the tickets (MUTATES files and dependents) to match the current code.
