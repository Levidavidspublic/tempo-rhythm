# Rules — Pointer

## Canonical sources (in precedence order)

1. **`docs/HARD_RULES.md`** — the one file that wins when anything conflicts. 17 sections, each flat and enforceable. Read before touching Convex, auth, payments, or AI.
2. **`.cursor/rules/*.mdc`** — Cursor-specific rule files that auto-attach to matching files or sessions. Each is a distillation of a HARD_RULES slice into what Cursor should do moment-to-moment.
3. **`docs/CURSOR_RULES.md`** — long-form rationale for the `.cursor/rules/` set.
4. **`docs/CURSOR_PROMPTS.md`** — reusable prompt snippets for common Cursor workflows.

## Tempo-specific Cursor rules (scaffolded in Phase 3)

All live in `.cursor/rules/` and each one references HARD_RULES with `@docs/HARD_RULES.md` rather than copying content.

| Rule file | Attach mode | What it enforces |
|---|---|---|
| `tempo-hard-rules.mdc` | `alwaysApply: true` | The top-of-session primer: shame-proof, accept-reject, undo, forbidden tech. |
| `tempo-convex-schema.mdc` | `globs: convex/**/*.ts` | Schema shape — `userId` optional, soft delete, indexes, generic tables. |
| `tempo-hard-rules.mdc` (AI section) | `alwaysApply` | LLM calls via Mistral API (`convex/lib/ai_router.ts`); no direct provider SDKs. |
| `tempo-accept-reject.mdc` | `agentRequested` | AI mutations must flow through `convex/proposals.ts`. |
| `tempo-design-tokens.mdc` | `globs: packages/ui/**`, `apps/web/app/globals.css` | Token usage, no arbitrary hex. |
| `tempo-brand.mdc` | `alwaysApply` when touching UI files | Auto-attaches the brand knowledge base to any UI session. |
| `tempo-skills.mdc` | `alwaysApply: true` | Green-list / red-list of which `skills.sh` skills are safe for Tempo. |

## Precedence recap

```
HARD_RULES  >  .cursor/rules/  >  Ticket  >  PRD  >  Chat prompt  >  Skill default
```

Firebase is allowed (HARD_RULES §2, Amit, 2026-11-08). A skill that recommends another forbidden tool does not override HARD_RULES §2. The `tempo-skills.mdc` rule enumerates which skills are green-listed for Tempo; anything not green-listed is either red-listed or neutral (use with judgment).
