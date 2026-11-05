# Kit

## Verdict

Shared UI lives in `packages/ui`. Web and mobile import it. Do not invent a second kit. Do not add a component here unless a ticket names it.

`docs/HARD_RULES.md` section 7.3 says shadcn/ui is the web foundation. The package that is actually exported is `@tempo/ui`. Radix packages are installed in `apps/web`. Both facts stand. A new screen uses `@tempo/ui` first.

## Public exports

From `packages/ui/src/primitives/index.ts` and `packages/ui/src/index.ts` at `5504fc40`:

- `Button`, `Field`, `Pill`, `SoftCard`, `TaskRow`, `CoachBubble`, `HabitRing`, `Ring`
- `BrandMark`, `Wordmark`
- Tokens: `tempoColors`, `tempoColorsDark`, `tempoFonts`, `tempoMotion`, `tempoRadii`, `tempoSpacing`, `accessibleReadingTokens`

Import paths, from the package comment:

- `@tempo/ui`
- `@tempo/ui/icons` and `@tempo/ui/icons/native`
- `@tempo/ui/brand` and `@tempo/ui/brand/native`
- `@tempo/ui/theme`
- `@tempo/ui/native`

## Blocks

Pages are markdown. json-render draws the blocks. The JSON stays hidden. `packages/utils` holds block helpers (`packages/utils/src/blocks.ts`). The block catalogue in `packages/ui/src/blocks/` includes a decision-steps block. The full catalogue is that folder, not this file.

## What the MVP uses

- `TaskRow` for a task on the day.
- `CoachBubble` for the coach.
- `SoftCard` for a proposal or a template card.
- `Field` for composer and forms.
- `Button` for the one primary action.
- `HabitRing` only if a habit is on the day page. A shame-streak is forbidden. See [UX-GUIDELINES.md](./UX-GUIDELINES.md).

Graphs and other interactive blocks are part of the MVP magic. Their exact component names beyond this kit are UNKNOWN. A ticket names the export before anyone builds it.

## Hebrew

The kit must not hard-code left-to-right margins. Use logical properties. Hebrew type faces are in [DESIGN.md](./DESIGN.md).

## Sources

`packages/ui/src/index.ts` and `packages/ui/src/primitives/index.ts` at `5504fc40`. [DESIGN.md](./DESIGN.md).
