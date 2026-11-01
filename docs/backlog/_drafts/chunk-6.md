# Chunk 6 — Stage F · Gen 2 (later) (tickets TFV2-0397 … TFV2-0456, 60 tickets)

Draft under `docs/backlog/TICKET-STANDARD.md` (v2, 1 Nov 2026). Template: `_drafts/TEMPLATE.md`.
Sources: REWRITE-PLAN-v2.md §4–§7 · PRD §3.3 (V1.5/V2/later), §4.4 F-45, §4.10, §4.11 F-122/F-123, §4.12, §5 ·
TRD §1, §4a, §6, §7 · DESIGN.md §8/§10 · components.md §2.11–§2.18 · screen-map.md · `convex/connections.ts`,
`convex/lib/connections/*` (OAuth/Executor), `convex/lib/entitlements.ts`, `convex/lib/subscriptionGuards.ts`,
`convex/notifications.ts`, `convex/crons.ts`, `convex/lib/ai_router.ts`, `convex/preferences.ts`, `convex/templates.ts`,
`convex/lib/templateCatalog.ts` · `apps/mobile/package.json` (Expo ~54, RevenueCat, no push/camera deps),
`apps/mobile/app.json`. Fold-ins: none (§7). OPEN conflicts touching this chunk: §4.2 (prices — family plans), §4.3
(interim text model — offline inference), §4.13 (time-zone storage — calendar sync). Every Gen 2 unit in this chunk is
MISSING in the code today (verified against `integration`): each is a build ticket that names the undecided facts
`UNKNOWN` and names "Amit" rather than inventing them. Depends names only earlier tickets in this chunk.

---

### TFV2-0397 — Plugin manifest schema (Zod) `packages/types/src/plugins.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `types`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.4 F-45 (Plugin SDK + marketplace, authors keep 100%); PRD §5 (modules ↔ Claude Code mods); TRD §4a (modules are validated data, Zod on every field); REWRITE-PLAN-v2 §6 chunk 6 "Plugin SDK".
- **GOAL:** A single Zod schema describes a Tempo plugin manifest — id, name, version, summary, author, permissions, the catalog components/actions it extends, and a min Tempo version — so every later ticket validates against one source of truth.
- **SCOPE:** `packages/types/src/plugins.ts` · `packages/types/src/index.ts` (export) · test `packages/types/src/plugins.test.ts`.
- **MUTATES:** none (adds a pure schema module; no table, route or env).
- **STEPS:** 1) Graphify code-map of `packages/types/src/` (no `plugins.ts` exists today — confirmed MISSING); 2) write `plugins.ts` exporting `pluginManifestSchema`, `pluginPermissionSchema` and the inferred types `PluginManifest`, `PluginPermission`; 3) mirror the existing block-schema style (Zod, `v: 1`, kebab-case names) used by `packages/utils/src/blocks.ts`; 4) export both from `packages/types/src/index.ts`; 5) write the test file for every error case below.
- **DONE:** `bun test packages/types/src/plugins.test.ts` → all tests pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output (pass count) and the `typecheck` exit code.
- **DO NOT:** do not add a table or a Convex module here; do not depend on any runtime-only package; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, any `.env` or workflow.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `pluginManifestSchema` fields: `id` (`^[a-z0-9][a-z0-9-]*$`, max 64), `name` (1–60 chars), `version` (semver string), `summary` (1–200 chars), `description?` (markdown string, max 8,000 chars), `author { name, email? }`, `permissions` (array of `pluginPermissionSchema` literals, e.g. `"read_pages"`, `"write_today"`, `"schedule_job"`, `"web_request"`), `components` (array of catalog `data-component` names, max 24), `actions` (array of catalog action names, max 24), `minTempoVersion` (semver). Unknown keys are stripped. Any unknown `components`/`actions`/`permissions` name is an error (the catalog is the only authority, mirroring TRD §4a validation). The `permissions` enum is deliberately conservative and OPEN below.
- **TESTS:** Given a valid manifest / When parsed / Then it round-trips and no error. Given a missing `name` / Then a Zod issue names `name`. Given a `components` entry not in the allowed catalog / Then a Zod issue is raised. Given an `id` with uppercase or spaces / Then invalid. Given an unknown top-level key / Then it is stripped, not failed. Given `minTempoVersion` non-semver / Then invalid.
- **NUMBERS:** manifest size cap 8 KiB and description cap 8,000 chars (repo convention; deterministic, no external range) · permission list content → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the exact permission enum and the `components`/`actions` catalog allowlist (which catalog names a plugin may extend) — Amit.

### TFV2-0398 — Plugin manifest validator `packages/utils/src/plugin-validate.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0397 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `utils`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0397.
- **WHY:** TRD §4a (a module that fails validation never goes live; Zod on every field); PRD §5 module RULES; REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** `validatePluginManifest(raw)` returns a discriminated result — `{ ok: true, manifest }` or `{ ok: false, issues[] }` with a human-readable issue per field — so no later install path has to hand-roll manifest checks.
- **SCOPE:** `packages/utils/src/plugin-validate.ts` · test `packages/utils/src/plugin-validate.test.ts`.
- **MUTATES:** none (pure validator).
- **STEPS:** 1) Graphify code-map of `packages/utils/src/` (no `plugin-validate.ts` — MISSING); 2) wrap `pluginManifestSchema` (TFV2-0397) in `safeParse`; 3) map Zod issues to `{ path, message }` with no raw JSON in the message; 4) add the catalog-name cross-check (`components`/`actions` must be known catalog names — pass the catalog list as an argument); 5) write the test file.
- **DONE:** `bun test packages/utils/src/plugin-validate.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not log the raw manifest on failure (redact `description`); do not call the network or a model; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Signature: `validatePluginManifest(raw: unknown, catalog: { components: string[]; actions: string[] }): { ok: true; manifest: PluginManifest } | { ok: false; issues: { path: string; message: string }[] }`. An issue message is one short sentence, never the offending value in full, and never JSON. Errors are collected (all issues, not first-only). An empty `components` and empty `actions` both is allowed (a plugin may be metadata-only), but a plugin with any `web_request` permission must also declare at least one action.
- **TESTS:** Given a valid manifest and a catalog containing its names / When validated / Then `ok: true`. Given an unknown component name / Then `ok: false` with an issue at `components`. Given a `web_request` permission with no actions / Then `ok: false`. Given malformed JSON / Then `ok: false` with a single parse issue and no throw. Given three invalid fields / Then three issues are returned (all collected).
- **NUMBERS:** issue list cap 50 (deterministic bound) · catalog-name source of truth → `UNKNOWN` (Amit: the json-render catalog export name).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** catalog-name source (the exact export that lists valid `data-component`/action names) — Amit.

### TFV2-0399 — Plugin pack/parse `.tempo-plugin.md` format `packages/utils/src/plugin-pack.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0397 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `utils`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0397.
- **WHY:** PRD §5 (a module is a page with blocks; export/import before the marketplace exists is listed under PRD §11 ideas); TRD §4 (markdown + `json tempo` fences are the storage format); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A plugin is a single markdown file (`.tempo-plugin.md`) whose front-matter block is the manifest and whose body is the plugin's template/code content, with `packPlugin`/`parsePlugin` as the exact inverse pair.
- **SCOPE:** `packages/utils/src/plugin-pack.ts` · test `packages/utils/src/plugin-pack.test.ts`.
- **MUTATES:** none (pure pack/unpack).
- **STEPS:** 1) Graphify code-map of `packages/utils/src/` (MISSING); 2) reuse the existing `parseTempoBlocks`/`serializeTempoBlocks` (repo `packages/utils/src/blocks.ts`) so a plugin body is just markdown + `json tempo` blocks; 3) implement `packPlugin(manifest, body) => string` (a leading `json tempo` fence with `type: "plugin-meta"` holding the manifest, then the body) and `parsePlugin(text) => { manifest, body }`; 4) round-trip must be byte-exact for valid input; 5) write the test file.
- **DONE:** `bun test packages/utils/src/plugin-pack.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not invent a new block envelope (reuse `type/id/v/data`); do not embed or read any key; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `packPlugin` emits the `plugin-meta` block as the first `json tempo` fence, then the body verbatim. `parsePlugin` reads only the first fence as `plugin-meta`; a file whose first fence is not `plugin-meta` fails with `not_a_plugin`. The manifest block's `data` is the raw manifest object. `parsePlugin` returns `{ manifest, body }` and does not validate beyond parse (validation is TFV2-0398's job). Maximum file size is enforced by the caller's byte budget.
- **TESTS:** Given a manifest and body / When packed then parsed / Then `body` and `manifest` round-trip exactly. Given a file whose first fence is `task` / When parsed / Then `not_a_plugin`. Given a file with no fence / Then `not_a_plugin`. Given `packPlugin` output / When re-packed from the parsed parts / Then byte-identical to the first pack.
- **NUMBERS:** pack/unpack byte-exactness = exact (no range) · `.tempo-plugin.md` extension is a proposal → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the distribution file extension/name — Amit.

### TFV2-0400 — `plugins` table (installed plugins) in `convex/schema.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0397 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (convex-arch), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0397.
- **WHY:** PRD §4.4 F-45 (marketplace, authors keep 100%); PRD §5 module RULES (off switch, fallback); TRD §4a (`enabled: false` hides one module; a module that fails at render falls back to the built-in layout); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A per-user `plugins` table records each installed plugin — its manifest, install source, version and `enabled` flag — so the plugin list, off-switch and fallback all read one row.
- **SCOPE:** `convex/schema.ts` · `convex/MIGRATIONS.md` (log entry) · test `convex/schema.gen2.test.ts`.
- **MUTATES:** `plugins` table (new); `USER_OWNED_TABLES` in `convex/lib/accountDeletion.ts` gains `"plugins"`.
- **STEPS:** 1) Graphify code-map of `convex/schema.ts` (no `plugins` table — MISSING); 2) add the `plugins` table with the fields/indexes in SPEC, following the `notes`/`templates` convention (`v.id("users")` owner, `createdAt`/`updatedAt`/`deletedAt`); 3) add `"plugins"` to `USER_OWNED_TABLES` so account deletion soft-deletes installed plugins; 4) log the additive change in `convex/MIGRATIONS.md`; 5) write the schema test asserting the validator accepts a minimal row and rejects a bad `enabled` type.
- **DONE:** `bun test convex/schema.gen2.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not add any other table in this ticket; do not write the install mutation here (TFV2-0401); do not touch `convex/auth*`, `.github/**`, `.env` or workflows; do not record a key value.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `plugins` table: `userId: v.id("users")`, `pluginId` (the manifest `id` string), `manifest` (object: the validated manifest, stored whole), `version` (semver string), `source` (`"marketplace"` / `"file"`), `listingId?` (`v.id("marketplaceListings")`, optional until TFV2-0406 exists), `enabled: v.boolean()` (default true), `createdAt`, `updatedAt`, `deletedAt?`. Indexes: `by_userId`, `by_userId_pluginId` (unique per user per plugin), `by_userId_deletedAt`. One install per `pluginId` per user (re-install is an update, not a second row).
- **TESTS:** Given a valid row / When the validator runs / Then it accepts. Given `enabled: "yes"` / Then rejected. Given a second row for the same `userId`+`pluginId` / Then the unique index forbids it.
- **NUMBERS:** manifest object size cap 8 KiB (repo convention) · unique install per user/plugin = exact invariant (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether installed plugins mirror modules (stored as `notes` rows with `pageType: "plugin"`) instead of a dedicated table — Amit (leaning dedicated table; §4 conflict 7 block-model authority is the same question).

### TFV2-0401 — `convex/plugins.ts` install + resolve catalog extensions
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0400, TFV2-0398 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0400 and TFV2-0398.
- **WHY:** PRD §5 module model (approve → live at once); TRD §4a (validation before install, fallback on failure); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** `plugins.install` validates a manifest, upserts the `plugins` row, and returns the resolved catalog extensions (components + actions) the plugin adds, all owner-scoped.
- **SCOPE:** `convex/plugins.ts` · test `convex/plugins.test.ts`.
- **MUTATES:** `plugins` rows (upsert); reads the catalog allowlist.
- **STEPS:** 1) Graphify code-map of `convex/plugins.ts` (MISSING); 2) implement `install({ manifestText })` — parse (TFV2-0399), validate (TFV2-0398 against the catalog), then upsert the row keyed by `userId`+`pluginId`; 3) implement `list()` and `get({ pluginId })`; 4) implement the catalog-extension resolver that returns only `components`/`actions` names already known to the catalog (reject unknown names before install); 5) write the test file for every error case below.
- **DONE:** `bun test convex/plugins.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not touch `convex/schema.ts` (table added in TFV2-0400); do not run plugin code in this ticket; do not read any secret; do not allow an unvalidated manifest to install.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `install({ manifestText }) => { pluginId }`; auth `requireUser`, owner only. Re-install of an existing `pluginId` updates `manifest` and `version`, keeps `enabled`. `list() => Plugin[]` returns only the caller's non-deleted rows, `enabled` first. `get({ pluginId }) => Plugin | null`. Errors: `not_a_plugin`, `invalid_manifest` (with issues), `unknown_component`, `unknown_action`, `plugin_too_large`. Limits: manifest ≤ 8 KiB; ≤ 24 components and ≤ 24 actions. No model call, no network.
- **TESTS:** Given a valid manifest / When installed / Then a row exists and `list()` returns it. Given an unknown component name / Then `unknown_component` and no row. Given a re-install with a newer version / Then the same row updates `version` (no duplicate). Given a second user / When they `list()` / Then they see only their own rows. Given a non-owner `get` for another user's row / Then `null` (isolation). Given an oversized manifest / Then `plugin_too_large`.
- **NUMBERS:** manifest ≤ 8 KiB, ≤ 24 components, ≤ 24 actions (repo convention) · install latency budget p95 ≤ 500 ms (web.dev; no external range applies to a pure DB mutation).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** catalog allowlist source (same as TFV2-0398) — Amit.

### TFV2-0402 — `convex/plugins.ts` enable/disable/uninstall lifecycle
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0401 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0401.
- **WHY:** PRD §5 module RULES (off switch, one bad module never breaks a page); TRD §4a (`enabled: false` hides one module); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** `setEnabled` and `uninstall` mutate the `plugins` row (soft-delete for uninstall), with an idempotent fallback guarantee so a disabled or removed plugin never leaves a page broken.
- **SCOPE:** `convex/plugins.ts` · test `convex/plugins.test.ts` (extend).
- **MUTATES:** `plugins.enabled`, `plugins.deletedAt`.
- **STEPS:** 1) Graphify code-map of `convex/plugins.ts` (from TFV2-0401); 2) add `setEnabled({ pluginId, enabled })` and `uninstall({ pluginId })` (soft-delete, `deletedAt`); 3) ensure `list()` excludes `deletedAt` rows and `get` returns the enabled state truthfully; 4) add a `plainMode` guard hook (if the user's `plainMode` is on, user-origin plugins are ignored by the resolver, matching TRD §4a); 5) write tests.
- **DONE:** `bun test convex/plugins.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not hard-delete; do not disable the built-in fallback; do not touch `convex/schema.ts`, `convex/auth*`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `setEnabled({ pluginId, enabled })` owner-scoped; errors `plugin_not_found`, `forbidden`. `uninstall({ pluginId })` sets `deletedAt` (soft), returns `{ pluginId }`; a second uninstall is a no-op. The render fallback: when a plugin is `enabled: false`, `deletedAt` set, or `plainMode` on, the page renders the built-in layout (the resolver returns an empty extension set) — never a broken page. No model call, no network.
- **TESTS:** Given an installed plugin / When `setEnabled(false)` / Then `list()` shows it disabled and the resolver returns no extensions. Given `uninstall` / Then the row has `deletedAt` and `list()` omits it. Given `plainMode` on / Then `list()` still lists the row but the resolver treats it as disabled. Given uninstall twice / Then idempotent (no error). Given a non-owner / Then `forbidden`.
- **NUMBERS:** off/on and uninstall are O(1) row updates (deterministic) · plain-mode semantics mirror TRD §4a (exact).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none (plain-mode semantics are fixed by TRD §4a).

### TFV2-0403 — Plugin catalog extension → module renderer registry (web)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0401 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0401.
- **WHY:** PRD §5 (data modules use only catalog components/actions; view modules change how a page type lays out its blocks); TRD §4a (validation against the catalog); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** An installed, enabled plugin's declared `components`/`actions` register into the same json-render catalog the built-in blocks use, so a plugin extends the renderer without any fork of the core registry.
- **SCOPE:** `apps/web/components/blocks/registry.tsx` · test `apps/web/components/blocks/__tests__/registry.test.tsx`.
- **MUTATES:** `apps/web` render registry only (no Convex, no schema).
- **STEPS:** 1) Graphify code-map of the block registry (`apps/web/components/blocks/registry.tsx`, which maps `data-component` → React components); 2) add `registerPluginExtensions({ components, actions })` that merges the plugin's names into a derived map, refusing any name not already known to the catalog; 3) render pages through the merged map; 4) keep the built-in map immutable and always the fallback; 5) write the render test.
- **DONE:** `bun test apps/web/components/blocks/__tests__/registry.test.tsx` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not run plugin code in the app process (a code module stays in a sandbox — TFV2-0404); do not edit the catalog's core component map; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The registry exports `getComponent(name)` and `getAction(name)` that consult built-ins first, then the plugin overlay. A plugin's `components` may only re-skin or add block renderers that already exist in the catalog; it may not introduce a new primitive. Unknown names are ignored (never rendered). Copy (EN/HE) for the fallback banner when a plugin fails to render: `EN: "This plugin couldn't load, so we're showing the standard view." / HE: "התוסף לא נטען, אז אנחנו מציגים את התצוגה הרגילה."` with an Undo-free dismiss.
- **TESTS:** Given a plugin declaring component `X` known to the catalog / When registered / Then `getComponent("X")` returns the plugin renderer. Given an unknown component `Y` / Then it is ignored and `getComponent("Y")` returns the built-in or null. Given a plugin disabled / Then the overlay is empty and the built-in renders. Given the built-in map / Then it is never mutated by a plugin.
- **NUMBERS:** render must not exceed 250 ms per block pass and 60 fps scrolling (DESIGN.md §7) · overlay lookup O(1) (deterministic).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether a plugin may introduce a genuinely new block component or only re-skin existing ones — Amit.

### TFV2-0404 — Plugin sandbox enforcement (code modules run only in an isolated frame)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0403 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0403.
- **WHY:** PRD §4.4 F-46 (code in a page runs only in a sandbox, never the app process, never with keys, only after approval); TRD §1 (browser widgets in `<iframe sandbox="allow-scripts">` via `postMessage`); TRD §7 rule 8; REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** Any plugin-supplied code block renders in a same-origin-less sandboxed iframe that can only reach the page through a strict `postMessage` protocol of catalog actions, with no access to Convex, cookies or keys.
- **SCOPE:** `apps/web/components/blocks/PluginSandbox.tsx` · test `apps/web/components/blocks/__tests__/plugin-sandbox.test.tsx`.
- **MUTATES:** `apps/web` UI only (no Convex, no schema, no env).
- **STEPS:** 1) Graphify code-map of the existing code-module path (MISSING); 2) create `PluginSandbox.tsx` rendering `<iframe sandbox="allow-scripts" srcDoc=…>` with no `allow-same-origin`; 3) implement the `postMessage` allowlist — the frame may only emit the catalog actions declared in the manifest, and the parent echoes back an approved `{ok}` or `{denied}`; 4) block `fetch`, navigation and top-frame access inside the frame via the sandbox flags and a `Content-Security-Policy` meta; 5) write the render + message test.
- **DONE:** `bun test apps/web/components/blocks/__tests__/plugin-sandbox.test.tsx` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not add `allow-same-origin` or `allow-top-navigation`; do not pass a key, token or cookie into the frame; do not run untrusted code outside the frame; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The frame gets only `allow-scripts`; it is sandboxed with an origin-null context and a restrictive CSP meta (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`). The message protocol is `{ kind: "action", action, payload, requestId }` → parent replies `{ kind: "action-result", requestId, ok, result }`. Any action outside the manifest's `actions` list is answered `{ ok: false, error: "denied" }`. A code module that never received approval renders the fallback card instead of the frame. Visible copy EN/HE: `EN: "This plugin runs in an isolated box. It can't see your other data." / HE: "התוסף הזה רץ בארגז חול מבודד. הוא לא יכול לראות את שאר הנתונים שלך."`
- **TESTS:** Given an approved code module / When rendered / Then an iframe with `sandbox` containing `allow-scripts` and NOT `allow-same-origin` is present. Given an action outside the allowlist / When the frame posts it / Then the parent replies `denied`. Given an unapproved module / Then no iframe is mounted (fallback card). Given a disallowed `fetch` inside the frame / Then the CSP blocks it (asserted via the CSP meta string).
- **NUMBERS:** no same-origin / no key access = absolute invariant (TRD §7 rule 8) · message round-trip ≤ 50 ms (target; deterministic within a page).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether server-side scripts use Vercel Sandbox for plugins too (PRD F-46 mentions it for page code) — Amit.

### TFV2-0405 — Plugin permissions model + user grant `convex/lib/plugin-permissions.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0400 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0400.
- **WHY:** TRD §7 rule 8 (never runs before the user approves it; never gets keys); PRD §5 RULES (accept/reject is law; confirmation before any external write); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** Every permission a plugin declares is granted or denied by the user at install time and stored per plugin, and no plugin action can exceed its grant.
- **SCOPE:** `convex/lib/plugin-permissions.ts` · test `convex/lib/plugin-permissions.test.ts`.
- **MUTATES:** reads `plugins` (the stored grant); no new table (the grant rides on the `plugins.manifest`/`permissions` field).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `grantPermissions({ pluginId, grants })` and `assertPermission({ pluginId, permission })`; 3) store granted permissions on the `plugins` row (a `grantedPermissions` field added to the manifest object, additive — do NOT touch `convex/schema.ts`); 4) make every plugin action path call `assertPermission` before executing; 5) write the test file for every error case below.
- **DONE:** `bun test convex/lib/plugin-permissions.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not add a new table; do not grant a permission the user denied; do not touch `convex/schema.ts`, `convex/auth*`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `grantPermissions({ pluginId, grants: PluginPermission[] })` upserts the granted set (subset of the manifest's declared permissions only). `assertPermission({ pluginId, permission })` throws `permission_denied` if the permission is not in the granted set, `plugin_not_found` if no row. External-write permissions (`write_today`, `schedule_job`, `web_request`) always re-ask at use time (confirmation before any external write, PRD F-131), never silently granted. No permission grants access to another user's data or to any secret.
- **TESTS:** Given a plugin declaring `read_pages` / When granted `read_pages` / Then `assertPermission` passes. Given a plugin granted nothing / When an action asserts `write_today` / Then `permission_denied`. Given a grant outside the declared set / Then rejected. Given a non-owner / When granting / Then `forbidden`. Given `web_request` / Then use-time confirmation is still required even when granted.
- **NUMBERS:** grant set is a subset of the manifest (exact invariant) · permission enum content → `UNKNOWN` (Amit, same as TFV2-0397).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the permission enum and whether external-write re-ask is per-action or per-session — Amit.

### TFV2-0406 — `marketplaceListings` table in `convex/schema.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0400 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (convex-arch), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0400.
- **WHY:** PRD §4.4 F-45 (marketplace, authors keep 100%); PRD §5 (share through a marketplace); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A global `marketplaceListings` table holds one published row per plugin — author, slug, manifest, current version, install count and moderation state — so search, detail and install all read one listing.
- **SCOPE:** `convex/schema.ts` · `convex/MIGRATIONS.md` (log entry) · test `convex/schema.gen2.test.ts` (extend).
- **MUTATES:** `marketplaceListings` table (new, global — not user-owned); moderation state field.
- **STEPS:** 1) Graphify code-map of `convex/schema.ts` (no `marketplaceListings` — MISSING); 2) add the table per SPEC (owner is the author, but the table is world-readable, so no per-user `userId` isolation index — use `by_slug` and `by_authorId`); 3) log the additive change; 4) extend the schema test.
- **DONE:** `bun test convex/schema.gen2.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not add other tables here; do not write search/publish functions (TFV2-0407/TFV2-0408); do not record a key; do not touch `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `marketplaceListings` table: `slug` (unique, `^[a-z0-9][a-z0-9-]*$`), `authorId: v.id("users")`, `manifest` (object), `currentVersion` (semver), `status` (`"draft"` / `"published"` / `"under_review"` / `"rejected"`), `category` (`v.union(v.literal("planning","coach","learning","habits","wellbeing","other"))`), `installCount` (number, default 0), `createdAt`, `updatedAt`, `deletedAt?`. Indexes: `by_slug` (unique), `by_authorId`, `by_category`, `by_status`. The listing is public data (no `userId` owner column beyond `authorId`), but only the author and admins may mutate it.
- **TESTS:** Given a valid listing / When the validator runs / Then it accepts. Given a duplicate `slug` / Then the unique index forbids it. Given a bad `status` value / Then rejected.
- **NUMBERS:** install count is monotonic and increment-only (exact) · category list → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the category taxonomy and the moderation workflow (who reviews, what gates) — Amit.

### TFV2-0407 — `convex/marketplace.ts` publish + validate listing
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0406, TFV2-0398 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0406 and TFV2-0398.
- **WHY:** PRD §4.4 F-45 (authors publish to the marketplace); PRD §5 (preview + validate before anything goes live); TRD §4a (a module that fails validation never goes live); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** `marketplace.publish` validates a manifest, upserts a `marketplaceListings` row for the author, and sets it to `under_review` (never live by default), returning the listing slug.
- **SCOPE:** `convex/marketplace.ts` · test `convex/marketplace.test.ts`.
- **MUTATES:** `marketplaceListings` rows (upsert); no new tables.
- **STEPS:** 1) Graphify code-map of `convex/marketplace.ts` (MISSING); 2) implement `publish({ manifestText, category, slug? })` — parse + validate (TFV2-0398/TFV2-0399), resolve the slug (author-supplied or derived from `id`), upsert the listing with `status: "under_review"`; 3) implement `unpublish({ slug })` (soft-delete, author only) and `getBySlug({ slug })`; 4) enforce one listing per `id` per author; 5) write the test file for every error case below.
- **DONE:** `bun test convex/marketplace.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not set a listing `published` automatically (moderation is a person's step); do not touch `convex/schema.ts`; do not record a key; do not let a non-author edit a listing.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `publish({ manifestText, category, slug? }) => { slug }`; auth `requireUser`. Errors: `invalid_manifest`, `slug_taken` (unless it is the author's own listing), `invalid_category`, `not_a_plugin`. A re-publish updates `manifest`/`currentVersion` and resets `status` to `under_review`. `unpublish` soft-deletes and returns `{ slug }`. Only the author may mutate their own listing (and admins — the admin path is OPEN below). No model call, no network.
- **TESTS:** Given a valid manifest / When published / Then a listing exists with `status: "under_review"`. Given an invalid manifest / Then `invalid_manifest` and no row. Given a duplicate slug by another author / Then `slug_taken`. Given a re-publish by the same author / Then the row updates and returns to `under_review`. Given a non-author `unpublish` / Then `forbidden`. Given an unknown category / Then `invalid_category`.
- **NUMBERS:** listing count per author cap 100 (deterministic bound) · moderation workflow → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** who moderates a listing and what moves `under_review` → `published` (Amit); the admin mutation surface.

### TFV2-0408 — `convex/marketplace.ts` search/list/categories
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0406 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0406.
- **WHY:** PRD §4.4 F-45 (browsable marketplace); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** `marketplace.list` returns published listings with search, category filter, sort and bounded pagination, so the marketplace screen renders without an unbounded query.
- **SCOPE:** `convex/marketplace.ts` · test `convex/marketplace.test.ts` (extend).
- **MUTATES:** reads `marketplaceListings` only.
- **STEPS:** 1) Graphify code-map of `convex/marketplace.ts` (from TFV2-0407); 2) implement `list({ query?, category?, sort?, cursor?, limit? })` returning only `published` listings; 3) search matches `name` + `summary` (case-insensitive substring); 4) sort by `installCount` or `updatedAt`; 5) use the repo's bounded/paginated helper for cursor + limit; 6) write tests.
- **DONE:** `bun test convex/marketplace.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not return draft/under_review/rejected listings; do not run a model for search (substring only); do not touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `list({ query?, category?, sort?, cursor?, limit? }) => { items: ListingSummary[]; hasMore: boolean; nextCursor: string | null }`. `ListingSummary` = `{ slug, name, summary, authorName, category, currentVersion, installCount, updatedAt }` (no raw manifest). `limit` defaults 24, max 100. Search is exact substring, never model-ranked. Sort `"popular"` (installCount desc) or `"recent"` (updatedAt desc), default popular. Non-`published` rows are excluded. Anyone (even signed-out) may read published listings.
- **TESTS:** Given three published and one `under_review` listing / When `list()` / Then only the three published return. Given `query: "focus"` / Then only listings whose name or summary contain "focus" return. Given `category: "learning"` / Then only learning listings. Given `limit: 2` / Then 2 items and `hasMore` true, and the next cursor continues without repeats. Given `sort: "recent"` / Then newest `updatedAt` first.
- **NUMBERS:** page size 24 default / 100 max (repo convention) · search latency p95 ≤ 200 ms (web.dev; substring over an indexed column).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether signed-out users may browse the marketplace (leaning yes) — Amit.

### TFV2-0409 — Marketplace screen (web) `(tempo)/marketplace`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0408 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0408.
- **WHY:** PRD §4.4 F-45; screen-map §5 (screens add layout only); DESIGN.md §8 (1280 rail + paper; under 768 full-bleed + tab bar); components.md §2.1/§2.4/§2.9.
- **GOAL:** A signed-in marketplace screen lists published plugins with search, category filter and sort, each row linking to the plugin detail, in EN and HE with RTL.
- **SCOPE:** `apps/web/app/(tempo)/marketplace/page.tsx` · `apps/web/components/marketplace/MarketplaceList.tsx` · test `apps/web/components/marketplace/__tests__/marketplace-list.test.tsx`.
- **MUTATES:** `apps/web` UI only (no Convex, no schema).
- **STEPS:** 1) Graphify code-map of `apps/web/app/(tempo)/` (no `marketplace` route — MISSING); 2) build the page inside `TempoShell` with a `PageHeader`, `SearchInput`, `Segmented` category filter and `SortMenu`; 3) wire `marketplace.list` with `usePaginatedQuery`; 4) render `MarketplaceList` rows (`ListRow` + `Badge` category + install count); 5) implement all five states (`?state=`); 6) write the render test and a Playwright click-through at 390 and 1280 in EN and HE.
- **DONE:** `bun test apps/web/components/marketplace/__tests__/marketplace-list.test.tsx` → all pass; `CI=1 bunx playwright test` (the added spec) → green.
- **EVIDENCE:** paste the test output and the Playwright result.
- **DO NOT:** do not call `marketplace.publish` from this screen (publish lives on the detail screen); do not render raw manifests or JSON; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Layout at 1280: rail + centred paper (max `--tp-measure`), `PageHeader` title. Under 768: full-bleed paper, sticky `TabBar`. Tokens: paper `--tp-paper`, ink `--tp-ink`, muted `--tp-ink-muted`, rows `--tp-hover`, badges `--tp-accent-wash`. States: default (list), loading (`StateLoading` skeleton rows, sr text `EN: "Loading plugins" / HE: "טוען תוספים"`), empty (no published plugins — `StateEmpty` `EN: "No plugins yet." / HE: "עדיין אין תוספים."` with a next step), error (`StateError` `EN: "Couldn't load plugins. Your data is safe." / HE: "לא הצלחנו לטעון תוספים. הנתונים שלך בטוחים."` + Retry), offline (`StateOffline` `EN: "You're offline. Changes save when you're back." / HE: "אין חיבור. השינויים נשמרים כשתחזור."`). Copy EN/HE for every visible string: search label `EN: "Search plugins" / HE: "חיפוש תוספים"`, categories `EN: All / Planning / Coach / Learning / Habits / Wellbeing / Other / HE: הכול / תכנון / מאמן / לימוד / הרגלים / רווחה / אחר`, sort `EN: Popular / Recent / HE: פופולרי / עדכני`, install count `EN: "{n} installs" / HE: "{n} התקנות"`. RTL: filter segmented swaps arrow keys, `SortMenu` chevron flips `.tp-icon--flip`, counts `.tp-num`. Keyboard: every row is a link reachable by Tab with a visible focus ring; search input labelled. Screen-reader: list is a navigation list, each row announces name + install count. Breakpoints 390/768/1024/1280. Motion ≤ 250 ms (rows drop in 240 ms `--tp-ease-out`).
- **TESTS:** Given published listings / When the screen mounts / Then each row shows name, summary, category badge and install count. Given `?state=loading` / Then only skeletons render. Given `?state=empty` / Then the empty copy shows. Given `?state=error` / Then the error copy and Retry show. Given `?state=offline` / Then the offline banner shows over content. Playwright: at 390 and 1280, EN and HE, assert the list, the empty state and the error state.
- **NUMBERS:** text contrast 4.5:1 and touch target ≥ 24×24 CSS px (WCAG 2.2 AA, 2.5.8) · rows drop in ≤ 250 ms (DESIGN.md §7) · no sideways scroll at 390 (DESIGN.md §8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether the marketplace is also reachable signed-out — Amit (same as TFV2-0408).

### TFV2-0410 — Marketplace plugin detail screen (web) `(tempo)/marketplace/[slug]`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0408 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0408.
- **WHY:** PRD §4.4 F-45; PRD §5 (preview + "what this module does" before approval); TRD §4a (validation before install); screen-map §5.
- **GOAL:** A detail screen shows one plugin — name, author, version, a plain-language "what it does" list, declared permissions, and the Install button — so the user consents before any install.
- **SCOPE:** `apps/web/app/(tempo)/marketplace/[slug]/page.tsx` · `apps/web/components/marketplace/PluginDetail.tsx` · test `apps/web/components/marketplace/__tests__/plugin-detail.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map (MISSING); 2) build the page with `PageHeader`, `ModuleSummary` (the "what this module does" card), a `PermissionList` (name + plain-language per permission) and an `Install`/`Installed`/`Update` primary button; 3) wire `marketplace.getBySlug` and `plugins.get` (to show Installed state); 4) implement states: default, loading, not-found, error, offline, disabled (already installed); 5) write the render test and Playwright at 390/1280 EN+HE.
- **DONE:** `bun test apps/web/components/marketplace/__tests__/plugin-detail.test.tsx` → all pass; the added Playwright spec → green.
- **EVIDENCE:** paste the test output and the Playwright result.
- **DO NOT:** do not install on page load (install is an explicit tap + confirm, TFV2-0411); do not show raw manifest JSON; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title = plugin `name`; author `EN: "by {name}" / HE: "מאת {name}"`; version `EN: "Version {v}" / HE: "גרסה {v}"`; what-it-does header `EN: "What this plugin does" / HE: "מה התוסף הזה עושה"`; permissions header `EN: "Permissions" / HE: "הרשאות"`; Install `EN: "Install" / HE: "התקן"`; Installed `EN: "Installed" / HE: "מותקן"`; Update `EN: "Update to {v}" / HE: "עדכן ל-{v}"`; not-found `EN: "This plugin isn't available." / HE: "התוסף הזה לא זמין."`; error `EN: "Couldn't load this plugin." / HE: "לא הצלחנו לטעון את התוסף הזה."` + Retry; offline banner as TFV2-0409. Each permission renders a plain-language line (e.g. `read_pages` → `EN: "Read your pages" / HE: "לקרוא את הדפים שלך"`; `write_today` → `EN: "Add to your Today" / HE: "להוסיף להיום שלך"`; `schedule_job` → `EN: "Schedule a repeating job" / HE: "לתזמן משימה חוזרת"`; `web_request` → `EN: "Make a network request" / HE: "לבצע בקשת רשת"`). The Install button is the one `.tp-btn--primary`. States per `?state=` + `not-found`. RTL: permission list inline-start, version `.tp-num`. Keyboard: Install focusable, Enter/Space activates; not-found/error have focus management. Screen-reader: permissions announced as a list. Motion ≤ 250 ms.
- **TESTS:** Given a published listing / When opened / Then name, author, version, what-it-does and permissions render. Given already installed / Then the button reads `Installed` and is disabled. Given `?state=loading` / Then skeleton. Given a missing slug / Then not-found copy. Given `?state=error` / Then error + Retry. Playwright: 390/1280 EN+HE, assert detail fields and the not-found state.
- **NUMBERS:** contrast 4.5:1, target ≥ 24×24 CSS px (WCAG 2.2 AA) · motion ≤ 250 ms (DESIGN.md §7) · permission plain-language mapping = exact 1:1 (deterministic).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the permission plain-language copy list (which permissions exist and their EN/HE wording) — Amit (inherits TFV2-0397).

### TFV2-0411 — Plugin install flow (confirm + sandbox/permission notice) (web)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0407, TFV2-0405 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0407 and TFV2-0405.
- **WHY:** PRD §5 (preview + Approve/Discard before a module goes live; accept/reject is law); TRD §4a (approval on the user's tap); TRD §7 rule 8 (never runs before the user approves); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** Tapping Install opens a confirm sheet that lists the plugin's permissions and the sandbox notice, and only the user's Approve calls `plugins.install` and grants the chosen permissions.
- **SCOPE:** `apps/web/components/marketplace/InstallConfirm.tsx` · test `apps/web/components/marketplace/__tests__/install-confirm.test.tsx`.
- **MUTATES:** `apps/web` UI only (calls `plugins.install` / `grantPermissions`).
- **STEPS:** 1) Graphify code-map (MISSING); 2) build `InstallConfirm` as a `MobileSheet` (bottom sheet < 768, centred dialog ≥ 768) with the permission list and the sandbox notice; 3) Approve calls `plugins.install` then `grantPermissions` with the checked set; Discard closes with no call; 4) show an `UndoToast` ("Plugin installed · Undo") after install; 5) write the render test and Playwright.
- **DONE:** `bun test apps/web/components/marketplace/__tests__/install-confirm.test.tsx` → all pass; the added Playwright spec → green.
- **EVIDENCE:** paste the test output and the Playwright result.
- **DO NOT:** do not install without an explicit Approve; do not pre-check external-write permissions (`web_request` starts unchecked); do not run plugin code here; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title `EN: "Install this plugin?" / HE: "להתקין את התוסף הזה?"`; body sandbox notice `EN: "Code plugins run in an isolated box and can't see your other data." / HE: "תוספי קוד רצים בארגז חול מבודד ולא יכולים לראות את שאר הנתונים שלך."`; Approve `EN: "Approve and install" / HE: "אשר והתקן"`; Discard `EN: "Cancel" / HE: "ביטול"`; toast `EN: "Plugin installed" / HE: "התוסף הותקן"` + `EN: "Undo" / HE: "בטל"`. `web_request` and `schedule_job` permissions are unchecked by default (re-ask at use time per TFV2-0405). Approve is the one accent action. States: default (list), confirm (sheet open), installing (button disabled + spinner), error (install failed inline), offline. Keyboard: sheet opens with focus on Discard, Esc closes, Tab trapped. Screen-reader: `role="dialog" aria-modal="true" aria-labelledby`. Motion ≤ 250 ms sheet rise.
- **TESTS:** Given Install tapped / Then the confirm sheet shows permissions and the sandbox notice, with `web_request` unchecked. Given Approve / Then `plugins.install` and `grantPermissions` are called and the Undo toast shows. Given Discard / Then no install call. Given install fails / Then an inline error shows and the button re-enables. Playwright: 390 (bottom sheet) and 1280 (dialog), EN and HE, assert the consent gate.
- **NUMBERS:** target ≥ 24×24 CSS px (WCAG 2.2 2.5.8) · sheet motion ≤ 250 ms (DESIGN.md §7) · external-write permissions unchecked by default = exact invariant (TRD §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none (consent flow is fixed by PRD §5 / TRD §4a).

### TFV2-0412 — Marketplace reviews: `marketplaceReviews` table + rating mutation
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0406 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (convex-arch), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0406.
- **WHY:** PRD §4.4 F-45 (a usable marketplace needs trust signals); REWRITE-PLAN-v2 §6 chunk 6; TRD §1 (no raw DB clients).
- **GOAL:** A `marketplaceReviews` table and `marketplace.rate` mutation let installers leave one star rating (1–5) and an optional short review per listing, owner-scoped and one-per-user-per-listing.
- **SCOPE:** `convex/schema.ts` · `convex/marketplace.ts` (the `rate`/`listReviews` functions) · test `convex/marketplaceReviews.test.ts`.
- **MUTATES:** `marketplaceReviews` table (new); `marketplaceListings` aggregate rating (denormalized count/average, recomputed).
- **STEPS:** 1) Graphify code-map (MISSING); 2) add the table per SPEC with a unique `by_listing_user` index; 3) implement `rate({ slug, stars, text? })` (upsert one row per user per listing) and `listReviews({ slug, cursor?, limit? })`; 4) recompute the listing's `ratingAverage`/`ratingCount` after each rate; 5) log the migration; 6) write tests for every error case below.
- **DONE:** `bun test convex/marketplaceReviews.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not let a user rate the same listing twice (upsert, not append); do not allow text > 1,000 chars or stars outside 1–5; do not return another user's review with their email; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `marketplaceReviews`: `listingId: v.id("marketplaceListings")`, `userId: v.id("users")`, `stars` (1–5), `text?` (≤ 1,000 chars), `createdAt`, `updatedAt`, `deletedAt?`. Unique `by_listing_user`. `rate` errors: `listing_not_found`, `invalid_stars`, `text_too_long`. `listReviews` returns `{ items: { stars, text?, authorName, createdAt }[], hasMore, nextCursor }`, newest first, limit 50 max. Reviews are soft-deletable by their author.
- **TESTS:** Given a rate of 4 / When saved / Then the listing's `ratingCount` is 1 and `ratingAverage` is 4. Given a second rate of 2 by the same user / Then the row is updated (not appended) and the average reflects 2. Given stars 6 / Then `invalid_stars`. Given text 1,100 chars / Then `text_too_long`. Given a non-owner list / Then only names, never emails.
- **NUMBERS:** stars 1–5, text ≤ 1,000 chars, page ≤ 50 (deterministic) · review spam controls (rate limiting) → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether reviews require the reviewer to have installed the plugin, and moderation of review text — Amit.

### TFV2-0413 — Author profile + 100% revenue-split metadata (`convex/marketplace.ts`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0407 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0407.
- **WHY:** PRD §4.4 F-45 (authors keep 100%); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** Each listing records its author's public profile and the payout-split record (100% to the author), so the marketplace shows authorship and the payout metadata exists without wiring a payment rail.
- **SCOPE:** `convex/marketplace.ts` · test `convex/marketplace.test.ts` (extend).
- **MUTATES:** reads `users` (public name) and `marketplaceListings` (author + split metadata); no new table (split rides on the listing).
- **STEPS:** 1) Graphify code-map (MISSING); 2) add `getAuthorProfile({ userId })` returning `{ displayName, listingCount }` (public name only, never email); 3) record `revenueSplit: { author: 100, tempo: 0 }` on each published listing (constant, not negotiable); 4) expose the split in the listing summary so the detail screen can state "The author keeps 100%"; 5) write tests.
- **DONE:** `bun test convex/marketplace.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not integrate Stripe, Polar or any payment rail (payout is out of scope); do not expose an email or payment account; do not store a key; do not invent a payout schedule.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `getAuthorProfile({ userId }) => { displayName: string | null; listingCount: number }` (name falls back to null, never "User"). `revenueSplit` is a constant `{ author: 100, tempo: 0 }` stored on the listing at publish (PRD F-45). Visible split copy EN/HE: `EN: "The author keeps 100%." / HE: "היוצרים מקבלים 100%."`. No payment account, tax or payout schedule is stored or wired.
- **TESTS:** Given a published listing / Then its `revenueSplit` equals `{ author: 100, tempo: 0 }`. Given `getAuthorProfile` / Then it returns only the display name and listing count, never an email. Given a user with no name / Then `displayName` is null.
- **NUMBERS:** split is a constant (exact) · payout rail / schedule / tax handling → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the payout rail (how authors actually receive their 100%) and whether it is Polar/RevenueCat or manual — Amit (PRD §4.4 F-45 names no rail; §4.2 prices are also open).

### TFV2-0414 — Plugin update/version check + apply (`convex/plugins.ts`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0401, TFV2-0407 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0401 and TFV2-0407.
- **WHY:** PRD §5 (hot reload / edits apply in place); REWRITE-PLAN-v2 §6 chunk 6 (marketplace must deliver updates).
- **GOAL:** `plugins.checkUpdates` compares each installed plugin's version to its marketplace listing's `currentVersion`, and `update` applies a newer manifest to the existing row (no re-approval needed when permissions are unchanged).
- **SCOPE:** `convex/plugins.ts` · test `convex/plugins.test.ts` (extend).
- **MUTATES:** `plugins.manifest`/`version` (update); reads `marketplaceListings.currentVersion`.
- **STEPS:** 1) Graphify code-map (from TFV2-0401); 2) implement `checkUpdates() => { pluginId, installedVersion, latestVersion }[]` for the caller's plugins that have a listing with a newer semver; 3) implement `update({ pluginId })` — re-fetch the listing manifest, validate, and if the new permission set is a subset of the already-granted set, apply; otherwise require re-grant; 4) write tests for every error case below.
- **DONE:** `bun test convex/plugins.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not auto-update (updates are user-initiated); do not apply an update that adds a permission without re-grant; do not touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `checkUpdates()` uses semver comparison on the listing's `currentVersion`. `update({ pluginId })` errors: `plugin_not_found`, `no_update`, `permission_change` (when the new permission set is not a subset of granted), `invalid_manifest`. On success it updates `version`/`manifest` and keeps `enabled`. A downgrade is not offered. No model call, no network beyond the listing read.
- **TESTS:** Given installed v1.0 and listing v1.1 / When `checkUpdates` / Then the pair returns. Given installed v1.1 / Then empty. Given an update that adds `write_today` not yet granted / Then `permission_change`. Given an update with unchanged permissions / Then applied. Given no listing / Then omitted from `checkUpdates`. Given a non-owner / Then `forbidden`.
- **NUMBERS:** version compare = semver exact · update is one row write (deterministic) · auto-update policy → `UNKNOWN` (Amit, leaning user-initiated only).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** auto-update vs manual update, and the re-grant UX for permission changes — Amit.

### TFV2-0415 — Tauri 2 desktop shell scaffold `apps/desktop`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §3.3 V2 "Tempo Max" (Rust desktop, Tauri 2); PRD §4.11 F-123; TRD §9 (Electron is forbidden — Tauri is the chosen route); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A new `apps/desktop` workspace runs a minimal Tauri 2 app that opens one window, so every later desktop ticket has a compiling, launching shell to build on.
- **SCOPE:** `apps/desktop/package.json` · `apps/desktop/src-tauri/tauri.conf.json` · `apps/desktop/src-tauri/Cargo.toml` · test `apps/desktop/src/lib.test.ts`.
- **MUTATES:** adds the `apps/desktop` workspace and its Rust/Tauri dependencies (no Convex, no schema, no env).
- **STEPS:** 1) Graphify code-map of the workspaces (no `apps/desktop` — MISSING; `factory/SLOTS.md` confirms "Desktop shell: UNKNOWN"); 2) register `apps/desktop` as a Turborepo workspace; 3) scaffold Tauri 2 with a single `main` window (`width 1200`, `height 800`, min `800×600`); 4) keep the Rust entry minimal (no remote shell yet — that is TFV2-0418); 5) write a unit test for the window-config type.
- **DONE:** `bun run build --filter tempo-rhythm-desktop` → exit 0 (or `cargo check` in `src-tauri` if no bundling step); `bun test apps/desktop/src/lib.test.ts` → all pass.
- **EVIDENCE:** paste the build/`cargo check` output and the test output.
- **DO NOT:** do not add Electron or any other runtime; do not add a remote webview URL yet (TFV2-0418); do not add platform sign-in; do not touch `convex/`, `.github/**`, `.env` or workflows; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tauri 2 (`tauri = "2"`), window config: `title "Tempo Flow"`, `width 1200`, `height 800`, `minWidth 800`, `minHeight 600`, `resizable true`. The window shows a placeholder paper surface (`--tp-paper`) with the wordmark and one sentence. No network calls, no sign-in. Dark/light follows the system preference. Copy EN/HE: `EN: "Tempo Flow desktop" / HE: "טמפו פלו למחשב"` and `EN: "Coming soon" / HE: "בקרוב"`. The desktop bundle target (macOS `.dmg`, Windows `.msi`, Linux `.AppImage`) is OPEN below.
- **TESTS:** Given the window config / When parsed / Then title, size and min size match the spec. Given the placeholder view / Then the wordmark and one sentence render.
- **NUMBERS:** window min 800×600 (Tauri default convention) · bundle targets and code-signing → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** desktop bundle targets (macOS/Windows/Linux) and code-signing identity — Amit.

### TFV2-0416 — Desktop window, tray + native menu (`apps/desktop`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0415 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0415.
- **WHY:** PRD §4.11 F-123; REWRITE-PLAN-v2 §6 chunk 6; UI-BRIEF §3 (rail/topbar shells are for the web; the desktop adds native chrome).
- **GOAL:** The desktop app has a system tray and a native application menu (File/Edit/View/Window/Help) with keyboard accelerators, and closing the window minimizes to tray rather than quitting.
- **SCOPE:** `apps/desktop/src-tauri/src/lib.rs` · `apps/desktop/src-tauri/src/menu.rs` · test `apps/desktop/src-tauri/tests/menu.test.rs`.
- **MUTATES:** desktop native chrome only.
- **STEPS:** 1) Graphify code-map (from TFV2-0415); 2) build a `Menu` with File (Quit), Edit (Undo/Redo/Cut/Copy/Paste), View (Toggle fullscreen, Reload), Window (Minimize, Close), Help (About); 3) add a `TrayIcon` whose menu has Open and Quit; 4) intercept the window close event to hide-to-tray instead of quit; 5) write the menu-config test.
- **DONE:** `cargo test -p tempo-rhythm-desktop` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the `cargo test` and `typecheck` output.
- **DO NOT:** do not add a global hotkey that could conflict with the OS; do not quit without confirmation while a voice call is active (defer to TFV2-0418); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Menu items carry native accelerators (`CmdOrCtrl+Q` quit, `CmdOrCtrl+W` close, standard edit shortcuts). The tray icon uses the repo mark asset path if present, else a monochrome letter glyph. Copy EN/HE (menu labels follow the OS locale; the app does not translate native menus itself — the OS does): About `EN: "About Tempo Flow" / HE: "אודות טמפו פלו"`. Close-to-tray is the default; Quit exits fully.
- **TESTS:** Given the menu definition / Then File, Edit, View, Window and Help exist with the expected accelerators. Given a close event / Then the window hides and the tray remains (unless Quit). Given the tray menu / Then Open and Quit are present.
- **NUMBERS:** native accelerator standards follow platform HIG (Apple HIG / Windows) · close-to-tray behaviour → `UNKNOWN` (Amit: hide vs quit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** close-to-tray default (hide vs quit) — Amit.

### TFV2-0417 — Desktop sign-in (magic link deep-link + session) (`apps/desktop`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0415 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0415.
- **WHY:** PRD §4.1 F-01 (magic link only, no password); PRD §4.11 F-123; TRD §2 (Convex Auth); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** The desktop app signs the user in with the existing magic-link flow — an email deep link opens the desktop app, which completes Convex Auth and stores the session — with no password anywhere.
- **SCOPE:** `apps/desktop/src/lib/auth.ts` · `apps/desktop/src-tauri/src/deeplink.rs` · test `apps/desktop/src/lib/auth.test.ts`.
- **MUTATES:** desktop auth/session storage (secure store); no Convex changes.
- **STEPS:** 1) Graphify code-map (from TFV2-0415); 2) register a Tauri deep-link handler for `tempo-desktop://auth/callback`; 3) render the same email field + magic-link request the web uses (`convex/auth.ts` `signInEmail`); 4) on deep link, complete the Convex Auth callback and persist the session in the OS keychain/credential store (never a plaintext file); 5) write the auth test.
- **DONE:** `bun test apps/desktop/src/lib/auth.test.ts` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not add a password field or passkeys; do not store the session outside the OS secure store; do not read/log a key; do not touch `convex/auth*`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Sign-in reuses the web magic-link semantics (30-minute link, 30-day session). The desktop shows the same copy as the web sign-in screen: email label `EN: "Email" / HE: "אימייל"`, submit `EN: "Send magic link" / HE: "שלח קישור כניסה"`, sent state `EN: "Check your email." / HE: "בדקו את האימייל."`. The deep-link scheme is `tempo-desktop://`. Session tokens live in the OS credential store. Sign-out clears it.
- **TESTS:** Given an email entered / When submitted / Then `signInEmail` is called and the sent state shows. Given a deep link with a valid token / When handled / Then the session persists in the secure store. Given sign-out / Then the store is cleared.
- **NUMBERS:** magic-link TTL 30 min, session 30 days (PRD/TRD, fixed) · deep-link scheme → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** deep-link scheme name — Amit.

### TFV2-0418 — Desktop webview loads the web UI (Tauri webview + CSP)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0417 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0417.
- **WHY:** PRD §4.11 F-123 (one product, desktop shell differs only in OS-access features); TRD §1 (shells differ only in OS-access features); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** The desktop window hosts the existing Next.js web UI in a Tauri webview pointed at the same Convex backend, gated by a Content-Security-Policy that allows only Tempo's own origins, so the desktop is the same product with native chrome.
- **SCOPE:** `apps/desktop/src-tauri/src/webview.rs` · `apps/desktop/src-tauri/tauri.conf.json` (CSP + remote URL) · test `apps/desktop/src-tauri/tests/webview.test.rs`.
- **MUTATES:** desktop webview configuration only.
- **STEPS:** 1) Graphify code-map (from TFV2-0415); 2) point the webview at the preview/live web origin (config, not hard-coded — the URL is a config value, not a secret); 3) set a CSP that allows the web origin and the Convex websocket origin only; 4) block `file://` and any navigation outside the allowlist; 5) write the webview-config test.
- **DONE:** `cargo test -p tempo-rhythm-desktop` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the test and typecheck output.
- **DO NOT:** do not hard-code a secret or key in the URL; do not allow arbitrary navigation (no `navigate` off-origin); do not load a local copy that diverges from the web build; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The webview loads the web app over HTTPS. CSP: `default-src 'self' https://*.tempoflow.dev; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:`. Navigation is restricted to the configured web origin; any other `navigate` is rejected. No remote debugging is enabled in a production build.
- **TESTS:** Given the config / Then the remote URL and CSP are present and the CSP `connect-src` includes the Convex websocket origin. Given an off-origin navigation request / Then it is rejected. Given a debug build flag / Then remote devtools are off in release.
- **NUMBERS:** CSP is an allowlist of two origin families (deterministic) · the exact preview vs live URL routing → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** which origin the desktop loads (preview vs live) and how the user switches — Amit.

### TFV2-0419 — VPS `claude` spawner backend `convex/lib/claude-spawn.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §3.3 V2 (a minimal VPS that spawns the real `claude` binary on the user's own OAuth); PRD §4.11 F-123; TRD §7 (secrets by name only, no long-lived key reaches a shell); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A server-side module defines the spawn contract — request a one-shot `claude` process, run it to a bounded result, and return its output — without ever returning the user's OAuth token to a client.
- **SCOPE:** `convex/lib/claude-spawn.ts` · test `convex/lib/claude-spawn.test.ts`.
- **MUTATES:** none (defines the spawn contract and a mockable runner; no table, no real process in tests).
- **STEPS:** 1) Graphify code-map (MISSING); 2) define `spawnClaude({ prompt, opts }) => { output, truncated }` over an injected runner interface (so tests never fork a real process); 3) enforce a hard byte/output and time budget; 4) route all auth/entitlement/quota checks before any spawn (per TRD §7 rule 3); 5) write the test file for every error case below.
- **DONE:** `bun test convex/lib/claude-spawn.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not fork a real process in tests; do not read or log the user's OAuth token (names only); do not spawn without auth → entitlement → quota ordering; do not touch `convex/schema.ts`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `spawnClaude({ prompt, opts: { maxBytes, timeoutMs } }, runner)` returns `{ output: string; truncated: boolean; exitCode: number }`. The runner interface is `{ run(args: string[]): Promise<{ stdout: string; exitCode: number }> }`. Budgets: `maxBytes` default 32 KiB, `timeoutMs` default 60_000. Errors: `spawn_timeout`, `spawn_failed`, `output_too_large`. The prompt is trimmed to a token cap. No key value is ever returned or logged. The VPS host and the real `claude` OAuth source are OPEN below.
- **TESTS:** Given a runner that returns under budget / Then `output` matches and `truncated` false. Given a runner exceeding `maxBytes` / Then `truncated` true and `output` is cut. Given a runner exceeding `timeoutMs` / Then `spawn_timeout`. Given a non-zero exit / Then `spawn_failed` with `exitCode`. Given an empty prompt / Then rejected before any spawn.
- **NUMBERS:** output ≤ 32 KiB, timeout ≤ 60 s (deterministic defaults) · VPS host, image and the `claude` OAuth grant → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** VPS provider, the `claude` binary version, and how the user's own OAuth is stored/refreshed — Amit.

### TFV2-0420 — `claude` binary bridge (OAuth + session + command allowlist) `convex/lib/claude-bridge.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0419 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0419.
- **WHY:** PRD §4.11 F-123 (VPS spawning the real `claude` binary on the user's own OAuth); TRD §7 rules 1/3/6 (secrets by name, auth→entitlement→quota, BYOK keys never returned); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A bridge turns an approved coach request into a bounded `claude` spawn using the user's own OAuth session, with a strict command allowlist so `claude` can only perform Tempo's catalog actions, never arbitrary shell work.
- **SCOPE:** `convex/lib/claude-bridge.ts` · test `convex/lib/claude-bridge.test.ts`.
- **MUTATES:** none (orchestrates TFV2-0419's spawner + the connector allowlist; no table).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `runClaudeForUser({ userId, prompt })` that checks entitlement/quota (reuse `convex/lib/entitlements.ts` / `subscriptionGuards.ts`), then calls `spawnClaude`; 3) pass a command allowlist (Tempo catalog actions only) as the `claude` tool surface; 4) stream the result back through the coach thread (the same text-delta path as chunk C); 5) write tests for every error case below.
- **DONE:** `bun test convex/lib/claude-bridge.test.ts` → all tests pass.
- **EVIDENCE:** paste the test output (pass count).
- **DO NOT:** do not return the OAuth token; do not allow `claude` a raw shell or file-system access beyond the sandbox; do not skip the entitlement/quota gate; do not touch `convex/schema.ts`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `runClaudeForUser({ userId, prompt }) => { text }`. Order: `requireUser` → entitlement (`max`/`god` only, or the tier Amit rules) → quota (per-user daily spawn cap) → spawn with the allowlist. The allowlist is the same catalog-action names the coach tools use (createNote, addTaskToToday, fillTemplate, scheduleJob), plus read-only page/memory reads. Errors: `entitlement_denied`, `quota_exceeded`, `spawn_failed`, `spawn_timeout`, `output_too_large`. The output is appended to the coach thread, never shown raw.
- **TESTS:** Given a `max`-tier user under quota / When run / Then the spawner is called with the allowlist and the text returns. Given a `basic`-tier user / Then `entitlement_denied` (unless Amit rules otherwise — mark in OPEN). Given over quota / Then `quota_exceeded` and no spawn. Given a failed spawn / Then `spawn_failed`. Given a non-owner / Then `forbidden`.
- **NUMBERS:** daily spawn cap → `UNKNOWN` (Amit) · output ≤ 32 KiB / timeout ≤ 60 s (from TFV2-0419).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** which tier gets `claude`-on-VPS and the daily spawn cap — Amit.

### TFV2-0421 — Desktop local cache + offline pages (`apps/desktop`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0418 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0418.
- **WHY:** PRD §4.12 (local-first sync, offline inference); REWRITE-PLAN-v2 §6 chunk 6; TRD §1 (shells differ only in OS-access features).
- **GOAL:** The desktop app caches the most recent pages locally and serves them read-only when the network is down, showing an offline banner, so a user can still read their notes without a connection.
- **SCOPE:** `apps/desktop/src/lib/local-cache.ts` · test `apps/desktop/src/lib/local-cache.test.ts`.
- **MUTATES:** desktop local cache (read-only offline surface); no Convex.
- **STEPS:** 1) Graphify code-map (from TFV2-0418); 2) implement a keyed cache (pageId → body + updatedAt) persisted to the desktop app data dir; 3) populate on each successful page read; 4) on network failure, serve the cached page and show the offline banner (copy in SPEC); 5) write the cache test.
- **DONE:** `bun test apps/desktop/src/lib/local-cache.test.ts` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not write edits offline (read-only cache — edits queue for sync later, TFV2-0449); do not cache another user's data or secrets; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Cache keys are `pageId`, values `{ body, updatedAt }`, capped at the 200 most-recent pages (LRU). Offline serves the cached page read-only with `StateOffline` `EN: "You're offline. Changes save when you're back." / HE: "אין חיבור. השינויים נשמרים כשתחזור."`. No offline writes. Cache is cleared on sign-out.
- **TESTS:** Given a cached page / When the network fails / Then the cached body renders and the offline banner shows. Given a page not cached / When offline / Then the error state shows (no stale data invented). Given cache over 200 pages / Then the oldest is evicted. Given sign-out / Then the cache is cleared.
- **NUMBERS:** LRU cap 200 pages (deterministic) · offline-write semantics → `UNKNOWN` (Amit, defers to TFV2-0449 local-first sync).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** offline-edit behaviour (read-only here vs full local-first in TFV2-0449) — Amit.

### TFV2-0422 — Desktop auto-update (Tauri updater) (`apps/desktop`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0415 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0415.
- **WHY:** PRD §4.11 F-123; REWRITE-PLAN-v2 §6 chunk 6 (a desktop app needs a safe update path).
- **GOAL:** The desktop app checks for updates on launch, downloads a signed update in the background, and applies it on next restart — never mid-session.
- **SCOPE:** `apps/desktop/src-tauri/src/updater.rs` · `apps/desktop/src-tauri/tauri.conf.json` (updater config) · test `apps/desktop/src-tauri/tests/updater.test.rs`.
- **MUTATES:** desktop update configuration only (no Convex).
- **STEPS:** 1) Graphify code-map (from TFV2-0415); 2) enable the Tauri updater with a public/private signing key pair (names only — the private key is a secret, never committed); 3) implement check-on-launch and background download; 4) apply on restart, with a user-visible "Update ready" notice; 5) write the config test.
- **DONE:** `cargo test -p tempo-rhythm-desktop` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the test and typecheck output.
- **DO NOT:** do not commit the private update-signing key or its value; do not force-install without a restart; do not download over plain HTTP; do not touch `convex/`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The updater uses Tauri's built-in updater with a signature key. Updates are downloaded over HTTPS only, verified against the public key, and applied on restart. Copy EN/HE: `EN: "Update ready. It will install next time you restart." / HE: "עדכון מוכן. הוא יותקן בפעם הבאה שתפעילו מחדש."`. The update endpoint/static host is OPEN below.
- **TESTS:** Given a signed update manifest / Then the updater reports a newer version. Given a tampered package / Then verification fails and nothing installs. Given no update / Then no notice.
- **NUMBERS:** HTTPS-only download (exact) · update feed host → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** update feed host and signing key custody — Amit.

### TFV2-0423 — Desktop settings screen (`apps/desktop`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0418 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0418.
- **WHY:** PRD §4.11 F-123; UI-BRIEF §4 (theme/dyslexia prefs are device-local); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A desktop settings screen lets the user pick launch-at-login, theme, and update preference, persisted locally, in EN and HE with RTL.
- **SCOPE:** `apps/desktop/src/lib/settings.ts` · `apps/desktop/src/ui/Settings.tsx` · test `apps/desktop/src/ui/settings.test.tsx`.
- **MUTATES:** desktop local preferences only (no Convex).
- **STEPS:** 1) Graphify code-map (from TFV2-0418); 2) build the `Settings` component with `Switch` rows for launch-at-login and auto-update, and a `Segmented` for theme (light/dark/system); 3) persist to the desktop app-data dir and apply immediately; 4) implement states; 5) write the render test.
- **DONE:** `bun test apps/desktop/src/ui/settings.test.tsx` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not touch the web settings or Convex prefs (these are desktop-local); do not persist anything but the three prefs; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title `EN: "Desktop settings" / HE: "הגדרות מחשב"`; launch-at-login `EN: "Start at login" / HE: "הפעל בכניסה"`; auto-update `EN: "Update automatically" / HE: "עדכן אוטומטית"`; theme `EN: "Theme" / HE: "ערכת נושא"` with `EN: Light / Dark / System / HE: בהיר / כהה / מערכת`; On/Off `EN: On/Off / HE: פועל/כבוי`. States: default, loading (prefs read), error (prefs failed to load + Retry). RTL: rows inline-start, switches logical. Keyboard: switches toggle with Space; segmented with arrows. Screen-reader: switch announces On/Off. Motion ≤ 250 ms.
- **TESTS:** Given prefs / When loaded / Then the three rows reflect them. Given theme toggled / Then it applies and persists. Given launch-at-login toggled / Then the OS registration updates. Given `?state=error` / Then error + Retry. Given `dir=rtl` / Then rows flip inline-start.
- **NUMBERS:** target ≥ 24×24 CSS px (WCAG 2.2 2.5.8) · motion ≤ 250 ms (DESIGN.md §7) · launch-at-login OS API per platform (HIG).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0424 — Desktop first-run onboarding (`apps/desktop`)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0417 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `desktop`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0417.
- **WHY:** PRD §4.11 F-123; screen-map §5 (onboarding); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** On first launch after sign-in, the desktop app shows a short onboarding (language pick, theme, one welcome step) before dropping the user on Today, in EN and HE with RTL.
- **SCOPE:** `apps/desktop/src/ui/Onboarding.tsx` · test `apps/desktop/src/ui/onboarding.test.tsx`.
- **MUTATES:** desktop local prefs (language/theme); no Convex.
- **STEPS:** 1) Graphify code-map (from TFV2-0417); 2) build a three-step onboarding (Welcome → Language → Theme); 3) persist language/theme locally and set `dir` from the language; 4) a Skip link jumps to the app; 5) write the render test.
- **DONE:** `bun test apps/desktop/src/ui/onboarding.test.tsx` → all pass; `bun run typecheck --filter tempo-rhythm-desktop` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not re-run onboarding for returning users; do not block sign-in on onboarding (Skip available); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Steps: Welcome `EN: "Welcome to Tempo Flow" / HE: "ברוכים הבאים לטמפו פלו"` + `EN: "Your brain's operating system." / HE: "מערכת ההפעלה של המוח שלך."`; Language `EN: "Choose your language" / HE: "בחרו שפה"` (English / עברית); Theme (as TFV2-0423). Buttons: Next `EN: "Next" / HE: "הבא"`, Skip `EN: "Skip" / HE: "דלג"`, Done `EN: "Start" / HE: "התחל"`. States: default, loading (saving), error (save failed + Retry). RTL flips on language pick immediately. Motion ≤ 250 ms between steps.
- **TESTS:** Given a first launch / When onboarding shows / Then the three steps render in order. Given Hebrew chosen / Then `dir=rtl` applies and copy is Hebrew. Given Skip / Then the app opens without saving. Given Done / Then prefs persist and the app opens.
- **NUMBERS:** motion ≤ 250 ms (DESIGN.md §7) · onboarding steps = 3 (deterministic) · exact step count/content → `UNKNOWN` (Amit, may mirror the web onboarding).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** onboarding steps/copy parity with the web onboarding — Amit.

### TFV2-0425 — Expo push foundation (`expo-notifications` + native config)
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-122 (store-grade native: push notifications); ROADMAP §5 P8–P9 (V1.5: push, camera, store assets); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** `apps/mobile` installs and configures `expo-notifications` so the app can request permission, receive a push token and display a notification on Android and iOS.
- **SCOPE:** `apps/mobile/package.json` · `apps/mobile/app.json` (plugin + channels) · `apps/mobile/lib/push.ts` · test `apps/mobile/lib/__tests__/push.test.ts`.
- **MUTATES:** `apps/mobile` dependencies + notification config (no Convex, no schema, no env).
- **STEPS:** 1) Graphify code-map of `apps/mobile/package.json` and `app.json` (no `expo-notifications` — MISSING); 2) add `expo-notifications` matching the locked Expo 54 SDK pair; 3) add the `expo-notifications` plugin to `app.json` (icon/color, default channel); 4) write `apps/mobile/lib/push.ts` exporting `configurePush()`, `requestPermission()`, `registerForPush() => token | null`; 5) write the test for the config/channel shape.
- **DONE:** `bun --filter tempo-rhythm-mobile run typecheck` → exit 0; `bun test apps/mobile/lib/__tests__/push.test.ts` → all pass.
- **EVIDENCE:** paste the `typecheck` exit code and the test output.
- **DO NOT:** do not send a real push or call a push API in tests; do not record a token value in the repo; do not touch `convex/`, `.env`, workflows; do not add Firebase (Expo push service only).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** One default notification channel `"default"` (importance default, no sound on the first install is config). `requestPermission()` returns the OS grant result; `registerForPush()` asks for the Expo push token and returns `string | null`. No token is persisted client-side (the backend stores it — TFV2-0426). Permission copy is shown by the app (see TFV2-0428). No FCM/APNs keys are added (names only; set by the configurator).
- **TESTS:** Given the app.json / Then the `expo-notifications` plugin and a `default` channel are present. Given a mocked notification module / When `registerForPush` / Then it returns the token or null (never throws). Given a denied permission / Then `requestPermission` reflects denied and `registerForPush` returns null.
- **NUMBERS:** token is an opaque string (no range) · Expo push service (Expo documentation) · Android channel / iOS `.p8` key provisioning → `UNKNOWN` (Amit: the APNs auth key name and Firebase-free FCM setup).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the APNs authentication-key approach (Expo push token vs native APNs) and the iOS/Android key custody — Amit.

### TFV2-0426 — `deviceTokens` table + register mutation `convex/push.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0425 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (convex-arch), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0425.
- **WHY:** PRD §4.11 F-122; TRD §7 (auth → entitlement → quota ordering, per-user isolation); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A `deviceTokens` table and `push.register` mutation store each user's device token (one row per device) so scheduled reminders can target them, with tokens never readable by another user.
- **SCOPE:** `convex/schema.ts` · `convex/push.ts` · test `convex/push.test.ts`.
- **MUTATES:** `deviceTokens` table (new); `USER_OWNED_TABLES` gains `"deviceTokens"`.
- **STEPS:** 1) Graphify code-map of `convex/push.ts` (MISSING); 2) add the table per SPEC; 3) implement `register({ token, platform })` (upsert by user + token), `unregister({ token })` (soft-delete), and `listMine()`; 4) add `"deviceTokens"` to `USER_OWNED_TABLES`; 5) log the migration; 6) write tests for every error case below.
- **DONE:** `bun test convex/push.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not store a token in plaintext logs; do not return another user's tokens; do not send a push here (delivery is TFV2-0427); do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `deviceTokens`: `userId: v.id("users")`, `token` (string, unique), `platform` (`"ios"` / `"android"`), `createdAt`, `updatedAt`, `deletedAt?`. Indexes: `by_userId`, `by_userId_deletedAt`, unique `by_token`. `register({ token, platform })` upserts; errors `invalid_token` (empty/oversized > 512 chars), `invalid_platform`. `unregister` soft-deletes. `listMine()` returns only the caller's live tokens. No token is ever returned across users.
- **TESTS:** Given a valid register / Then a row exists and `listMine` returns it. Given a duplicate token for the same user / Then upsert (no second row). Given a second user / Then they cannot see the first user's token. Given an empty token / Then `invalid_token`. Given a bad platform / Then `invalid_platform`. Given unregister / Then soft-deleted and omitted from `listMine`.
- **NUMBERS:** token ≤ 512 chars (deterministic) · token encryption at rest → `UNKNOWN` (Amit: whether to encrypt tokens or treat as opaque).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** token encryption at rest — Amit.

### TFV2-0427 — Push delivery: reminders + nag push (`convex/push.ts` send + cron)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0426 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0426.
- **WHY:** PRD §4.6 F-61 (nag delivery beyond in-app — channel was UNKNOWN; push is the natural Gen 2 answer); PRD §4.11 F-122; REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4 conflict 11.
- **GOAL:** A cron/HTTP path sends a nag or reminder as a push to the user's registered devices, with every message in the user's own words (no stock copy), and delivery logged per token.
- **SCOPE:** `convex/push.ts` · `convex/crons.ts` (register the sweep) · test `convex/push.test.ts` (extend).
- **MUTATES:** sends Expo push messages (side effect) and logs delivery; no new table.
- **STEPS:** 1) Graphify code-map of `convex/push.ts` (from TFV2-0426) and `convex/crons.ts`; 2) implement `sendToUser({ userId, title, body, data? })` that fans out to the user's live tokens via the Expo push HTTP API; 3) add a cron sweep that finds due nags and calls `sendToUser` with the nag's accepted phrase; 4) re-check auth/entitlement before each send; 5) write tests with a mocked push transport for every error case below.
- **DONE:** `bun test convex/push.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not call the real Expo API in tests (mock the transport); do not invent nag copy (only the user's accepted phrase); do not record a key; do not push before a nag's due time.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `sendToUser({ userId, title, body, data? })` resolves live tokens and POSTs to the Expo push endpoint per token (mockable `pushTransport`). Errors: `no_tokens`, `push_transport_failed`, `quota_exceeded` (per-user daily push cap). The cron sweep reads due nags (from chunk B's `nags`) and sends the user's accepted phrase; a nag with no accepted phrase is never sent (PRD F-60). Delivery failures per token are recorded and stale tokens are soft-deleted on a permanent-reject response.
- **TESTS:** Given a due nag with an accepted phrase / When the sweep runs / Then `sendToUser` posts that phrase to each live token. Given a nag with no accepted phrase / Then no send. Given a transport failure / Then `push_transport_failed` and no crash. Given a permanent-reject token / Then the token is soft-deleted. Given over quota / Then `quota_exceeded` and no send.
- **NUMBERS:** daily push cap → `UNKNOWN` (Amit) · push latency p95 ≤ 5 s (Expo push convention; delivery is async) · the nag channel assumption (push) carries §4 conflict 11 → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** nag delivery channel is push (assumed) — Amit (REWRITE-PLAN-v2 §4.11); daily push cap — Amit.

### TFV2-0428 — Push permission request UI + copy (mobile)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0425 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0425.
- **WHY:** PRD §4.11 F-122; UI-BRIEF §6 (every control reachable, plain words); DESIGN.md §10 (RTL); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A native prompt screen explains why push is useful and asks once, with a clear Allow/Not now and a later Settings link, in EN and HE.
- **SCOPE:** `apps/mobile/app/(tempo)/enable-push.tsx` · test `apps/mobile/components/v3/__tests__/enable-push.test.tsx`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map (MISSING); 2) build the `enable-push` screen with a `MobileSheet`/`StatusPanel`-style card; 3) Allow calls `requestPermission()` then `registerForPush()`; 4) Not now defers (no nagging loop — one prompt); 5) write the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/enable-push.test.tsx` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not re-prompt after a denial (the OS + Settings handle re-enable); do not invent a reward or streak for enabling; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title `EN: "Turn on reminders" / HE: "הפעל תזכורות"`; body `EN: "Tempo can remind you in your own words, when it matters." / HE: "טמפו יכול להזכיר לך במילים שלך, כשזה חשוב."`; Allow `EN: "Allow reminders" / HE: "אפשר תזכורות"`; Not now `EN: "Not now" / HE: "לא עכשיו"`; settings link `EN: "Turn on later in Settings" / HE: "הפעל מאוחר יותר בהגדרות"`. States: default, requesting (button spinner), granted (confirmation), denied (settings link). Keyboard: Allow/Not now focusable. Screen-reader: button labels announced. RTL: text inline-start. Motion ≤ 250 ms.
- **TESTS:** Given first run / When shown / Then the explainer + Allow/Not now render. Given Allow / Then `requestPermission` then `registerForPush` are called. Given a denial / Then the settings-link state shows and no re-prompt. Given `dir=rtl` / Then copy flips inline-start.
- **NUMBERS:** target ≥ 24×24 CSS px (WCAG 2.2 2.5.8) · one prompt only (deterministic) · motion ≤ 250 ms (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** when the prompt appears (first sign-in vs first nag) — Amit.

### TFV2-0429 — Notification preferences screen (mobile)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0426 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0426.
- **WHY:** PRD §4.11 F-122; UI-BRIEF §4/§6; REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A mobile settings screen lets the user toggle reminder types (nags, calendar, coach) and see their push status, persisted to the backend `preferences`, in EN and HE.
- **SCOPE:** `apps/mobile/app/(tempo)/notifications.tsx` · test `apps/mobile/components/v3/__tests__/notification-prefs.test.tsx`.
- **MUTATES:** reads/writes `preferences` (notification toggles) via existing `convex/preferences.ts`; no schema change.
- **STEPS:** 1) Graphify code-map of `convex/preferences.ts` (EXISTS — extend the prefs object with notification toggles additively, no schema change if prefs is a loose object; verify first); 2) build the screen with `Switch` rows for nags/calendar/coach; 3) wire the toggles to `preferences.updatePrefs`; 4) show push status (granted/denied) with a Settings link; 5) write the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/notification-prefs.test.tsx` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not add a new table for toggles; do not invent copy; do not touch `convex/schema.ts` (extend the existing prefs object only if it is loose — otherwise report `blocked: missing prefs field`); do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title `EN: "Notifications" / HE: "התראות"`; nags `EN: "Reminders" / HE: "תזכורות"`; calendar `EN: "Calendar reminders" / HE: "תזכורות יומן"`; coach `EN: "Coach messages" / HE: "הודעות המאמן"`; push status `EN: "Push notifications" / HE: "התראות דחיפה"` with `EN: On/Off / HE: פועל/כבוי`. States: default, loading, error (+ Retry), offline banner. RTL logical switches. Screen-reader announces On/Off.
- **TESTS:** Given prefs / When loaded / Then the three toggles reflect them. Given a toggle changed / Then `updatePrefs` is called. Given push denied / Then the status shows denied + a Settings link. Given `?state=error` / Then error + Retry.
- **NUMBERS:** target ≥ 24×24 CSS px (WCAG 2.2 2.5.8) · motion ≤ 250 ms (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether notification prefs are a loose object or typed columns in `preferences` — Amit (ties to §4.13 time-zone storage too).

### TFV2-0430 — Camera capture (`expo-camera`) `apps/mobile/components/camera`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-122 (store-grade native: camera); ROADMAP §5 P8–P9; REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A mobile camera component captures a photo with `expo-camera` and returns a local image reference, with the permission request handled inline.
- **SCOPE:** `apps/mobile/package.json` · `apps/mobile/components/camera/CameraCapture.tsx` · test `apps/mobile/components/camera/__tests__/camera-capture.test.tsx`.
- **MUTATES:** `apps/mobile` dependency + camera component (no Convex).
- **STEPS:** 1) Graphify code-map (no `expo-camera` — MISSING); 2) add `expo-camera` matching Expo 54; 3) build `CameraCapture` with a shutter button (≥ 44×44), a capture-cancel affordance and a permission-request state; 4) return `{ uri, width, height }` to the caller (no upload here — TFV2-0431); 5) write the render test.
- **DONE:** `bun test apps/mobile/components/camera/__tests__/camera-capture.test.tsx` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not upload or persist the photo (TFV2-0431); do not access the camera without permission; do not record a key; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: permission `EN: "Tempo needs the camera to scan a note." / HE: "טמפו צריך את המצלמה כדי לסרוק פתק."`; grant `EN: "Allow camera" / HE: "אפשר מצלמה"`; shutter aria-label `EN: "Take photo" / HE: "צלם תמונה"`; cancel `EN: "Cancel" / HE: "ביטול"`. States: requesting, denied (settings link), ready (live preview), captured (review with Retake/Use). Shutter target ≥ 44×44 native px. Motion ≤ 250 ms. No photo leaves the device in this ticket.
- **TESTS:** Given no permission / When shown / Then the permission state renders. Given ready / Then the shutter renders. Given shutter tap / Then `{ uri, width, height }` is returned. Given denied / Then the settings-link state shows.
- **NUMBERS:** shutter target ≥ 44×44 native px (Apple HIG / Android 48dp) · motion ≤ 250 ms (DESIGN.md §7) · camera permission copy is fixed.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether capture also offers video/QR later — Amit (out of scope here).

### TFV2-0431 — Photo attach to a note (upload + image block)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0430 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile` + `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0430.
- **WHY:** PRD §4.11 F-122 (camera → the photo must land somewhere useful); TRD §4 (pages are markdown + blocks); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A captured photo uploads to Convex file storage and inserts an image reference into the note's markdown body, so a photo becomes part of the page like any other block.
- **SCOPE:** `apps/mobile/components/camera/attach-photo.ts` · `convex/notes.ts` (image insert path) · test `convex/notes-image.test.ts`.
- **MUTATES:** Convex file storage (upload) + `notes.body` (image markdown insert); no new table.
- **STEPS:** 1) Graphify code-map of `convex/notes.ts` (EXISTS — add an image-insert helper); 2) upload the photo to Convex file storage (via a signed upload URL, owner-scoped); 3) insert `![alt](<url>)` at the cursor in `notes.body`; 4) enforce a size/dimension cap and an owner check; 5) write tests for every error case below.
- **DONE:** `bun test convex/notes-image.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not insert another user's image; do not store a raw blob in the DB (use file storage); do not allow an unbounded upload; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `notes.attachImage({ noteId, alt, imageId })` (the upload happens first via a signed URL, then this mutation inserts the markdown). Errors: `note_not_found`, `forbidden`, `image_too_large` (> 8 MiB), `invalid_alt` (empty). Alt text is required for accessibility; the inserted markdown is `![alt](url)`. Image size cap 8 MiB, dimension cap 4096 px longest side (resized client-side).
- **TESTS:** Given a valid upload / When attached / Then `notes.body` contains the image markdown with the alt. Given an owner mismatch / Then `forbidden`. Given an image > 8 MiB / Then `image_too_large`. Given empty alt / Then `invalid_alt`. Given a missing note / Then `note_not_found`.
- **NUMBERS:** image ≤ 8 MiB, longest side ≤ 4096 px (repo convention) · alt text required (WCAG 1.1.1) · upload latency p95 → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** image retention/billing (file-storage quota per tier) — Amit.

### TFV2-0432 — Camera scan → brain dump / task (OCR)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0430 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile` + `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0430.
- **WHY:** PRD §4.11 F-122 (camera as capture); PRD §4.1 F-09 (brain dump → plan); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A photo of handwriting or a document runs through an OCR action and drops its text into a brain-dump draft, so a paper note becomes captured text the coach can act on.
- **SCOPE:** `convex/lib/ocr.ts` · `apps/mobile/components/camera/scan.ts` · test `convex/lib/ocr.test.ts`.
- **MUTATES:** OCR action (no table; writes a brain-dump draft via the existing `brain_dump` path).
- **STEPS:** 1) Graphify code-map of `convex/brain_dump.ts` (EXISTS) and `convex/lib/ai_router.ts`; 2) implement `ocr({ imageId })` as a Convex action that calls an OCR provider and returns recognized text; 3) feed the text into the existing brain-dump draft; 4) enforce auth/entitlement/quota before the OCR call; 5) write tests with a mocked OCR transport.
- **DONE:** `bun test convex/lib/ocr.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not call a real OCR provider in tests (mock); do not store the image text anywhere but the brain-dump draft; do not return a key; do not invent an OCR provider (name it OPEN).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `ocr({ imageId }) => { text }`. Errors: `image_not_found`, `entitlement_denied`, `ocr_failed`, `text_too_large` (> 8,000 chars trimmed). The recognized text is inserted into the brain-dump draft verbatim; the coach may later propose a plan. No OCR output is persisted anywhere else. The OCR provider and model are OPEN below.
- **TESTS:** Given a mocked OCR returning text / Then `text` returns and a brain-dump draft receives it. Given a failed OCR / Then `ocr_failed`. Given a non-owner / Then `forbidden`. Given over quota / Then `entitlement_denied`/`quota_exceeded`. Given text > 8,000 chars / Then trimmed.
- **NUMBERS:** OCR text cap 8,000 chars (deterministic) · OCR provider/model/cost → `UNKNOWN` (Amit — costs money, so it stays off until Amit approves).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** OCR provider/model and its cost — Amit (PRD rule: ask Amit before anything that costs money).

### TFV2-0433 — Deep linking (universal / app links) `apps/mobile`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-122 (store-grade native needs deep links for magic-link sign-in and push taps); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** The mobile app handles universal/app links and its custom scheme so a magic link or a push tap opens the right screen (Today, a note, the coach).
- **SCOPE:** `apps/mobile/app.json` (associated domains) · `apps/mobile/app/_layout.tsx` (linking config) · test `apps/mobile/lib/__tests__/deep-link.test.ts`.
- **MUTATES:** `apps/mobile` linking config only.
- **STEPS:** 1) Graphify code-map of `apps/mobile/app/_layout.tsx` and `app.json` (`scheme` is `tempo-rhythm`, `expo-linking` installed); 2) add `associatedDomains` (iOS) and intent filters (Android) for the Tempo domain; 3) define routes `tempo-rhythm://today`, `…/note/[id]`, `…/coach`, and the `https` equivalents; 4) write the linking test.
- **DONE:** `bun test apps/mobile/lib/__tests__/deep-link.test.ts` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not hard-code a secret in the link config; do not open a link that bypasses sign-in (unauthenticated deep links still require a session); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Scheme `tempo-rhythm://` and `https://` for the configured domain. Route map: `/today`, `/note/[id]`, `/coach`. An unauthenticated deep link routes through sign-in first, then resumes the target. A push tap opens the `data` route if present, else Today.
- **TESTS:** Given a `tempo-rhythm://today` link / When handled / Then the Today route resolves. Given `…/note/abc` / Then the note route with id `abc`. Given an unauthenticated link / Then sign-in is required first. Given a push `data` route / Then it opens that route.
- **NUMBERS:** one scheme + one domain (deterministic) · the production domain for app links → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the production domain and whether push taps deep-link to a note or just Today — Amit.

### TFV2-0434 — App Store submission assets + privacy labels (iOS)
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile` (config/meta), lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-122 (App Store); ROADMAP §5 P8–P9 (store assets); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** The iOS build carries the store-required assets — icon, launch screen, privacy nutrition labels and age rating — so a TestFlight/App Store submission has no missing metadata.
- **SCOPE:** `apps/mobile/app.json` (iOS block) · `apps/mobile/assets/` (icon/splash) · test `apps/mobile/scripts/__tests__/store-meta.test.ts`.
- **MUTATES:** `apps/mobile` config + assets only (no Convex).
- **STEPS:** 1) Graphify code-map of `apps/mobile/app.json` and `assets/`; 2) add the iOS privacy manifest and `privacy` nutrition-label fields; 3) set `ageRating` and content-advisory fields; 4) ensure icon/splash assets are the right sizes; 5) write the meta-validation test.
- **DONE:** `bun test apps/mobile/scripts/__tests__/store-meta.test.ts` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not invent an age rating or a privacy answer (mark any undecided label UNKNOWN and name Amit); do not commit a signing key or provisioning profile; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Privacy nutrition labels reflect reality: data collected = email (account), usage (crash/analytics if PostHog is on — verify), and no health data. Age rating and content advisory are set conservatively. Icon/splash sizes per Apple's current requirements. The exact privacy answers and age rating are OPEN below (Amit must confirm against actual data collection).
- **TESTS:** Given the app.json / Then the iOS block has `privacy` and `ageRating` present. Given assets / Then icon and splash files exist at the required sizes. Given a missing privacy field / Then the test fails.
- **NUMBERS:** icon/splash sizes per Apple HIG (exact matrix) · age rating and privacy-label answers → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** age rating, content advisory and the exact privacy-label answers — Amit.

### TFV2-0435 — Google Play submission assets + data safety (Android)
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile` (config/meta), lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-122 (Google Play); ROADMAP §5 P8–P9; REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** The Android build carries the Play-required data-safety form, content rating and app icon/adaptive icon, so a Play submission has no missing metadata.
- **SCOPE:** `apps/mobile/app.json` (android block) · `apps/mobile/assets/` (icon/adaptive) · test `apps/mobile/scripts/__tests__/play-meta.test.ts`.
- **MUTATES:** `apps/mobile` config + assets only.
- **STEPS:** 1) Graphify code-map (from TFV2-0434); 2) add the Android data-safety and content-rating fields; 3) ensure the adaptive icon (foreground/background) and app icon exist; 4) write the meta-validation test.
- **DONE:** `bun test apps/mobile/scripts/__tests__/play-meta.test.ts` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not invent data-safety answers (mark UNKNOWN and name Amit); do not commit a keystore or signing key; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Data-safety form lists collected data (email, usage) and states whether it is shared/encrypted — answers OPEN below. Adaptive icon: foreground + background layers per Play's current requirements. Content rating set conservatively (Everyone/PEGI 3 unless Amit rules otherwise).
- **TESTS:** Given the app.json / Then the android block has data-safety and rating fields. Given assets / Then icon and adaptive-icon layers exist. Given a missing adaptive layer / Then the test fails.
- **NUMBERS:** icon sizes per Android/Play spec (exact matrix) · data-safety + content-rating answers → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** data-safety answers and content rating — Amit.

### TFV2-0436 — Store entitlement: RevenueCat product → tier (`convex/lib/entitlements.ts`)
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-110/F-122 (RevenueCat on mobile); TRD §1 (RevenueCat); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.2 (prices).
- **GOAL:** A store purchase on mobile maps its RevenueCat product/entitlement to the existing entitlement tier, so a store subscription unlocks the right tier exactly like web billing.
- **SCOPE:** `convex/lib/entitlements.ts` · `convex/lib/revenuecat_events.ts` (verify path) · test `convex/lib/entitlements.test.ts` (extend).
- **MUTATES:** entitlement mapping (read); no schema.
- **STEPS:** 1) Graphify code-map of `convex/lib/entitlements.ts` and `convex/lib/revenuecat_events.ts` (EXISTS — extend); 2) map RevenueCat product/entitlement identifiers to `EntitlementTier` values; 3) keep web (Polar) and mobile (RevenueCat) in agreement for the same tier; 4) do NOT change the premium-for-all grant (PRD F-01a); 5) write tests.
- **DONE:** `bun test convex/lib/entitlements.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not change the premium-for-all grant or `GRANTED_*` values; do not invent a price or product id (name it UNKNOWN); do not touch `convex/schema.ts`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `entitlementFromRevenueCat({ productId, entitlementId })` returns an `EntitlementTier` (basic/pro/max) or `none`. Unknown product ids return `none` (fail closed). The mapping table is data, not code, so product ids can be added without redeploying logic. Store prices and exact product ids are OPEN below (PRD §4.2 conflict).
- **TESTS:** Given a `pro` entitlement id / Then the tier is `pro`. Given a `max` id / Then `max`. Given an unknown id / Then `none` (fail closed). Given a `basic` id / Then `basic`. Given no entitlement / Then `none`.
- **NUMBERS:** fail-closed on unknown ids (exact) · product ids and prices → `UNKNOWN` (Amit, PRD §4.2: $1 trial / Basic $10 / Pro $20 / Max $40 are the repo's open numbers).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** exact RevenueCat product/entitlement ids and store prices — Amit (PRD §4.2).

### TFV2-0437 — Two-way calendar sync: Google Calendar connection (read + light write)
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (two-way calendar sync); PRD §4.10 F-100 (connectors through Executor, reads + light writes, heavy writes hard-refused, every external write confirmed); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.13 (time-zone storage).
- **GOAL:** A Google Calendar connection imports the user's external events into Tempo and pushes Tempo events back, using the existing `connections`/Executor OAuth layer, with every external write confirmed first.
- **SCOPE:** `convex/calendarSync.ts` · `convex/lib/connections/config.ts` (calendar provider entry) · test `convex/calendarSync.test.ts`.
- **MUTATES:** `calendarEvents` rows (import) + external Google Calendar (light write, confirmed); reuses the `connections` table (no new table).
- **STEPS:** 1) Graphify code-map of `convex/connections.ts` and `convex/lib/connections/*` (EXISTS — reuse the OAuth/Executor path, add a `google_calendar` provider); 2) implement `import({ connectionId, since })` (read events into `calendarEvents` with a `source` mark); 3) implement `export({ eventId })` (push one Tempo event back — always after the confirm step TFV2-0440); 4) refuse heavy/bulk writes (max N events per call); 5) write tests with a mocked Executor transport.
- **DONE:** `bun test convex/calendarSync.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not call Google directly (go through Executor per F-100); do not write externally without the confirm flag; do not store a calendar OAuth token in plaintext (reuse `connectionSecrets`); do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `import({ connectionId, since })` reads events via the Executor adapter and upserts into `calendarEvents` with `source: "google"` and an `externalId` field (additive on the row, do NOT touch `convex/schema.ts` unless the field is absent — then report `blocked: missing calendarEvents.externalId`). `export({ eventId, connectionId })` pushes exactly one event after the caller passes a `confirmed` flag. Errors: `connection_not_found`, `sync_failed`, `write_not_confirmed`, `too_many_writes`. Bulk cap: 100 events per import, 1 event per export call. Times convert using the user's stored IANA time zone (OPEN below).
- **TESTS:** Given a mocked Executor returning events / When imported / Then `calendarEvents` rows with `source: "google"` appear. Given an export without `confirmed` / Then `write_not_confirmed`. Given a confirmed export / Then exactly one event is written. Given > 100 events / Then truncated to 100 (or `too_many`). Given a non-owner / Then `forbidden`.
- **NUMBERS:** import cap 100 events, export 1 event/call (deterministic) · sync interval and the user's time-zone field → `UNKNOWN` (Amit, §4.13).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the user's IANA time-zone storage (`users` vs `preferences`) — Amit (§4.13); sync interval and conflict policy (defer to TFV2-0439).

### TFV2-0438 — iCal (`.ics`) import/export `convex/lib/ics.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (calendar sync includes file-based interchange); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A pure module parses an `.ics` file into `calendarEvents`-shaped records and serializes Tempo events back to `.ics`, so users can move calendars without a live connection.
- **SCOPE:** `convex/lib/ics.ts` · test `convex/lib/ics.test.ts`.
- **MUTATES:** none (pure parse/serialize; the caller writes rows).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `parseIcs(text) => { events: IcsEvent[]; error?: string }` and `serializeIcs(events) => string`; 3) handle `VEVENT` with `DTSTART`/`DTEND`, `SUMMARY`, `UID`, recurrence (`RRULE`) is parsed but stored as a plain string (no recurrence engine here); 4) validate ISO datetimes; 5) write tests.
- **DONE:** `bun test convex/lib/ics.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not build a recurrence expansion engine; do not write rows directly (the caller does); do not call the network; do not touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `parseIcs` returns events `{ uid, title, startAt, endAt?, description? }` with ISO 8601 datetimes; a malformed `DTSTART` yields `error` on that event, not a throw. `serializeIcs` emits a valid `VCALENDAR` with `VEVENT` blocks. Limits: 5,000 events per file, 64 KiB total.
- **TESTS:** Given a valid single-event `.ics` / Then one event parses with the right title/start/end. Given an all-day event / Then `endAt` is null. Given a malformed date / Then that event carries an `error`. Given events / When serialized / Then re-parsing returns the same set. Given > 5,000 events / Then truncated.
- **NUMBERS:** 5,000 events / 64 KiB per file (deterministic) · recurrence expansion → `UNKNOWN` (Amit: out of scope here).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether recurrence (`RRULE`) needs a full expansion engine later — Amit.

### TFV2-0439 — Calendar sync merge/conflict resolver `convex/lib/calendar-merge.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0437 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0437.
- **WHY:** PRD §4.12 (two-way sync must not duplicate or drop); PRD §4.11 F-131 (no silent data loss); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A pure merge function takes existing and incoming events and returns `{ toUpsert, toDelete, conflicts }`, matching on `externalId` then on start+title, so two-way sync never silently duplicates or deletes.
- **SCOPE:** `convex/lib/calendar-merge.ts` · test `convex/lib/calendar-merge.test.ts`.
- **MUTATES:** none (pure; the caller applies the result).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `mergeEvents(existing, incoming) => { toUpsert, toDelete, conflicts }`; 3) match precedence: `externalId` first, then start+title+day; 4) an incoming event that matches an existing Tempo-created event (no `externalId`) is a `conflict`, never an auto-overwrite; 5) write tests.
- **DONE:** `bun test convex/lib/calendar-merge.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not auto-resolve conflicts (surface them to the user); do not delete on a mismatch without a conflict record; do not touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `mergeEvents(existing, incoming)` is deterministic and side-effect-free. Deletions are represented as incoming events with a `deleted: true` flag (from the source's tombstone), never as silent absence. Output ordering is stable. Conflicts carry `{ existing, incoming, reason }`.
- **TESTS:** Given a matching `externalId` / Then it maps to `toUpsert` (update). Given an incoming event with no existing match / Then `toUpsert` (insert). Given an incoming `deleted` tombstone / Then the existing is in `toDelete`. Given an incoming event matching a Tempo-created event by time but no `externalId` / Then it is a `conflict`, not an overwrite. Given identical inputs / Then empty result (idempotent).
- **NUMBERS:** merge is deterministic and idempotent (exact) · conflict auto-resolution policy → `UNKNOWN` (Amit: always manual).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** conflict-resolution UI and the "winner" default — Amit (defer to TFV2-0440).

### TFV2-0440 — External-write confirmation UI (calendar sync)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0437 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0437.
- **WHY:** PRD §4.10 F-100 (every external write confirmed); PRD §4.11 F-131 (confirmation before any external write); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** Before Tempo writes any event back to an external calendar, a confirm dialog states exactly what will change and waits for an explicit Approve, in EN and HE.
- **SCOPE:** `apps/web/components/settings/ExternalWriteConfirm.tsx` · test `apps/web/components/settings/__tests__/external-write-confirm.test.tsx`.
- **MUTATES:** `apps/web` UI only (calls `calendarSync.export` with `confirmed`).
- **STEPS:** 1) Graphify code-map (MISSING); 2) build `ExternalWriteConfirm` (a `ConfirmDialog`/`MobileSheet`) listing `{ action, eventTitle, target }`; 3) Approve calls the export with `confirmed: true`, Cancel does nothing; 4) show a one-shot confirmation (no batch skip); 5) write the render test and Playwright.
- **DONE:** `bun test apps/web/components/settings/__tests__/external-write-confirm.test.tsx` → all pass; the added Playwright spec → green.
- **EVIDENCE:** paste the test output and the Playwright result.
- **DO NOT:** do not batch-confirm ("always allow" is out of scope); do not write without the explicit Approve; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title `EN: "Write to your calendar?" / HE: "לכתוב ליומן שלך?"`; body `EN: "Tempo will {action} \"{title}\" in {calendar}." / HE: "טמפו י{action} את \"{title}\" ב-{calendar}."`; Approve `EN: "Write" / HE: "כתוב"`; Cancel `EN: "Cancel" / HE: "ביטול"`. The Approve is not the accent when the action is destructive. States: default (dialog closed), open, confirming (spinner), error (write failed). Keyboard: Esc closes, Tab trapped, focus returns. Screen-reader `role="dialog" aria-modal`. Motion ≤ 250 ms.
- **TESTS:** Given an export request / When shown / Then the action, title and target render. Given Approve / Then `calendarSync.export` is called with `confirmed: true`. Given Cancel / Then no call. Given write fails / Then error shows. Playwright: 390 (sheet) + 1280 (dialog), EN and HE.
- **NUMBERS:** every external write confirmed individually (exact invariant) · motion ≤ 250 ms (DESIGN.md §7) · target ≥ 24×24 CSS px (WCAG 2.2 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none (confirmation-before-external-write is fixed by PRD F-131).

### TFV2-0441 — WhatsApp bridge (RAM-only scan + reply) `convex/lib/whatsapp-bridge.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (WhatsApp bridge); HARD_RULES / `.cursorrules` (RAM-only scanner rule: raw messages never persist to disk or Convex); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A WhatsApp bridge ingests a chat export in memory only, extracts candidate tasks/commitments, and shows them for review — with raw messages never persisted anywhere.
- **SCOPE:** `convex/lib/whatsapp-bridge.ts` · test `convex/lib/whatsapp-bridge.test.ts`.
- **MUTATES:** none (in-memory parse; the review commit goes through the shared import path TFV2-0443).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `parseWhatsAppExport(text) => { items: ParsedMessage[] }` operating on a string in memory; 3) extract candidate commitments (dates, "I'll", "need to") without persisting raw text; 4) return only candidate summaries for the review UI; 5) write tests proving no raw message is written to any table.
- **DONE:** `bun test convex/lib/whatsapp-bridge.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not persist raw messages to disk or Convex (RAM-only rule); do not call the real WhatsApp API (the bridge ingests an export, not a live bot here); do not record a key; do not run a model on raw message content beyond a candidate extractor (and name any model OPEN).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `parseWhatsAppExport(text)` returns `{ items: { timestamp, sender, candidate: string }[] }` (candidate = a short extracted commitment, not the raw message). The full raw text is dropped after parsing. No table, no file, no embedding. Errors: `empty_export`, `parse_failed`. Limit: 5,000 messages per export.
- **TESTS:** Given an export with "I'll call the bank tomorrow" / Then a candidate item names that commitment without the raw text. Given a non-commitment message / Then no candidate. Given an empty export / Then `empty_export`. Given parsing succeeds / Then no table write occurs (assert via the injected DB double). Given > 5,000 messages / Then truncated.
- **NUMBERS:** 5,000 messages per export (deterministic) · RAM-only = zero persistence of raw text (exact invariant, `.cursorrules`) · candidate extractor model → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the candidate-extractor model and whether a live WhatsApp bot (not just export) is in scope — Amit.

### TFV2-0442 — Telegram bridge (bot) `convex/lib/telegram-bridge.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (Telegram bridge); `.cursorrules` RAM-only rule; REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A Telegram bridge receives a bot message, scans it in memory for a candidate commitment, and replies with a one-tap "add to Today" confirmation — raw messages never persisted.
- **SCOPE:** `convex/lib/telegram-bridge.ts` · test `convex/lib/telegram-bridge.test.ts`.
- **MUTATES:** none (in-memory; the confirmed action reuses `tasks.create` via the coach path).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `handleTelegramMessage({ text, chatId })` in memory; 3) extract a candidate task and echo a confirmation (the reply is fixed copy + the candidate, never the raw message); 4) on confirm, call the existing add-to-today path; 5) write tests with a mocked bot transport and no persistence of raw text.
- **DONE:** `bun test convex/lib/telegram-bridge.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not persist raw messages (RAM-only); do not call the real Telegram API in tests (mock); do not record the bot token (name only); do not auto-add without the confirm tap.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `handleTelegramMessage` returns `{ reply }` where `reply` is a confirm line (e.g. `EN: "Add \"{candidate}\" to Today? /yes" / HE: "להוסיף את \"{candidate}\" להיום? /כן"`). On `/yes` it calls the add-to-today mutation and replies `EN: "Added." / HE: "נוסף."`. Bot token is read by name only. Limit 500 messages/min per user. No raw message is stored or logged.
- **TESTS:** Given a message with a candidate / Then the reply offers the confirm and no raw text persists. Given `/yes` / Then the add-to-today path is called. Given a non-candidate message / Then a neutral reply. Given a mocked transport failure / Then `bridge_failed`. Given > 500/min / Then rate-limited.
- **NUMBERS:** 500 messages/min rate limit (deterministic) · RAM-only zero persistence (exact) · bot token name → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the Telegram bot token name and whether the bot is first-party or user-supplied — Amit.

### TFV2-0443 — Message bridge import review (shared RAM-only scanner) `convex/messageImport.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0441 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0441.
- **WHY:** `.cursorrules` RAM-only rule (raw messages never persist to disk or Convex); PRD §4.5 F-51 (review before save); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** The candidate items from a WhatsApp/Telegram scan are reviewed and committed to Tempo tasks/notes only on the user's Save, mirroring the memory-import review flow, with raw messages never stored.
- **SCOPE:** `convex/messageImport.ts` · test `convex/messageImport.test.ts`.
- **MUTATES:** `tasks`/`notes` rows (on Save only); no raw-message persistence.
- **STEPS:** 1) Graphify code-map of `convex/memoryImport.ts` (EXISTS — mirror its review/commit shape); 2) implement `commitImport({ items })` that creates the kept tasks/notes; 3) keep only the candidate summaries (never the raw message) in the commit; 4) write tests proving raw text is never written.
- **DONE:** `bun test convex/messageImport.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not persist raw messages anywhere; do not save before the user's explicit Save; do not touch `convex/schema.ts`; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `commitImport({ items: { candidate, source }[] })` creates a `task` (or note) per kept item and returns `{ created: number }`. Nothing is saved until Save. The commit stores only the candidate sentence + `source` (`whatsapp`/`telegram`), never the raw chat. Errors: `empty_items`, `too_many_items` (> 200).
- **TESTS:** Given kept items / When committed / Then tasks/notes are created with the candidate text only. Given no Save / Then nothing is written. Given an item whose candidate equals the raw message (a message that is all commitment) / Then still only the candidate is stored. Given > 200 items / Then `too_many_items`. Given a non-owner / Then `forbidden`.
- **NUMBERS:** 200 items per commit (deterministic) · RAM-only zero raw persistence (exact invariant).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none (RAM-only rule is fixed by `.cursorrules`).

### TFV2-0444 — Course platforms connector (LMS read) `convex/lib/course-connector.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (course platforms); PRD §4.10 F-100 (connectors through Executor, reads first); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A course-platform connector imports a user's courses and deadlines (read-only) into Tempo so study work can be planned, using the existing Executor adapter and never writing back.
- **SCOPE:** `convex/lib/course-connector.ts` · `convex/lib/connections/config.ts` (course provider entry) · test `convex/lib/course-connector.test.ts`.
- **MUTATES:** creates `tasks`/`calendarEvents` rows for imported deadlines (read-only import); no new table.
- **STEPS:** 1) Graphify code-map of `convex/connections.ts` (EXISTS — reuse Executor); 2) implement `importCourses({ connectionId })` reading courses + deadlines and creating due tasks/events; 3) keep a `source: "course"` mark; 4) no write-back path at all; 5) write tests with a mocked Executor.
- **DONE:** `bun test convex/lib/course-connector.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not write back to the LMS; do not call a platform directly (Executor only); do not store a platform credential in plaintext; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `importCourses({ connectionId })` reads courses + deadlines via Executor and upserts due tasks/events with `source: "course"`. Errors: `connection_not_found`, `import_failed`, `too_many` (> 500 items). No export/mutation to the platform exists. The concrete LMS (Canvas/Moodle/Coursera) and Executor's tool names are OPEN below.
- **TESTS:** Given a mocked Executor returning 2 courses + 3 deadlines / Then 3 due tasks/events are created with `source: "course"`. Given an import failure / Then `import_failed`. Given > 500 items / Then `too_many`. Given a non-owner / Then `forbidden`.
- **NUMBERS:** 500 items per import (deterministic) · LMS list and Executor tool names → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** which LMS platforms and the Executor tool surface — Amit.

### TFV2-0445 — Dispatch B (Agentwright) adapter `convex/lib/dispatch-b.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 ("Dispatch B, dispatched to Agentwright instead of rebuilt"); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A seam module defines the Dispatch B contract and an Agentwright adapter stub, so a second dispatch lane can be swapped in without touching the coach path.
- **SCOPE:** `convex/lib/dispatch-b.ts` · test `convex/lib/dispatch-b.test.ts`.
- **MUTATES:** none (a seam + mockable adapter; no table).
- **STEPS:** 1) Graphify code-map (MISSING); 2) define `dispatchB({ payload }) => { result }` over an injected adapter interface `{ run(payload): Promise<{ result: string }> }`; 3) implement a deterministic in-memory stub (no network); 4) leave the Agentwright integration as an OPEN wiring point; 5) write tests.
- **DONE:** `bun test convex/lib/dispatch-b.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not call Agentwright or any external service in tests; do not invent an Agentwright API shape (mark it UNKNOWN); do not touch `convex/schema.ts`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `dispatchB({ payload })` returns `{ result }` via the injected adapter. The adapter interface is `{ run(payload: string): Promise<{ result: string }> }`. The stub returns `{ result: "" }` for an empty payload and echoes otherwise. Errors: `dispatch_failed`, `empty_payload`. The real Agentwright endpoint/auth are OPEN below.
- **TESTS:** Given an empty payload / Then `empty_payload`. Given a payload / Then the stub echoes. Given an adapter that rejects / Then `dispatch_failed`. Given a successful run / Then `{ result }` returns.
- **NUMBERS:** deterministic stub (no external range) · Agentwright endpoint/API/auth → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the Agentwright endpoint, API shape and auth — Amit.

### TFV2-0446 — Offline inference: local runtime foundation `packages/utils/src/local-model.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `utils`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (offline inference, local-first sync); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.3 (interim text model is a runtime concern).
- **GOAL:** A pure interface `LocalModelRunner` defines how the app talks to an on-device model — load, infer, unload — with a deterministic in-memory stub, so later tickets build on one contract.
- **SCOPE:** `packages/utils/src/local-model.ts` · test `packages/utils/src/local-model.test.ts`.
- **MUTATES:** none (interface + stub).
- **STEPS:** 1) Graphify code-map (MISSING); 2) define `LocalModelRunner` (`load(modelId)`, `infer(prompt, opts)`, `unload()`) and a `StubRunner`; 3) enforce a token/time budget on `infer`; 4) leave the real engine (ONNX/llama.cpp/MLC) as an OPEN wiring point; 5) write tests.
- **DONE:** `bun test packages/utils/src/local-model.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not bundle or download a real model in this ticket; do not invent a runtime engine (mark UNKNOWN); do not call the network; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `infer(prompt, { maxTokens, timeoutMs })` returns `{ text: string; truncated: boolean }`. `StubRunner.infer` echoes a bounded echo and always terminates within budget. Errors: `model_not_loaded`, `infer_timeout`, `prompt_too_large` (> 4,096 tokens). The engine choice, model file and quantization are OPEN below.
- **TESTS:** Given no load / When `infer` / Then `model_not_loaded`. Given a stub / When `infer` / Then bounded text returns. Given an oversized prompt / Then `prompt_too_large`. Given a timeout / Then `infer_timeout`.
- **NUMBERS:** prompt ≤ 4,096 tokens, timeout deterministic (repo convention) · engine/model/quantization → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the on-device runtime engine, model file and quantization — Amit.

### TFV2-0447 — Offline inference: model download + cache `convex/lib/local-model-store.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0446 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0446.
- **WHY:** PRD §4.12 (offline inference); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A model-store module tracks which local model version each user has downloaded and their download status, so the app can fetch/cache a model once and re-use it offline.
- **SCOPE:** `convex/lib/local-model-store.ts` · test `convex/lib/local-model-store.test.ts`.
- **MUTATES:** reads/writes model download state (no table — reuse `userPreferences` or a loose field; verify first).
- **STEPS:** 1) Graphify code-map of `convex/preferences.ts` (EXISTS); 2) implement `getLocalModelState({ userId })` and `setLocalModelState({ userId, modelId, version, status })` stored in the user's prefs; 3) enforce a model registry allowlist (only approved model ids); 4) write tests.
- **DONE:** `bun test convex/lib/local-model-store.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not download or serve a model binary in this ticket; do not add a table unless prefs cannot hold it (then report `blocked`); do not record a key; do not allow an unapproved model id.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `setLocalModelState` stores `{ modelId, version, status: "none" | "downloading" | "ready" | "failed" }`. Only model ids in the approved registry (a small allowlist) are accepted; others error `unknown_model`. `getLocalModelState` returns the stored state or `{ status: "none" }`.
- **TESTS:** Given an approved model id / When set to `ready` / Then state returns `ready`. Given an unapproved id / Then `unknown_model`. Given no state / Then `{ status: "none" }`. Given a failed download / Then status `failed`.
- **NUMBERS:** approved model registry size → `UNKNOWN` (Amit) · model id allowlist = exact match (deterministic).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the approved local-model registry and where the binaries are hosted — Amit.

### TFV2-0448 — Offline inference: coach fallback to local model `convex/lib/ai_router.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0447 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0447.
- **WHY:** PRD §4.12 (offline inference); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.3 (the interim text model is the source of truth for the seam).
- **GOAL:** When the network is down, the coach's text path falls back to the local model runner instead of erroring, with a clear "offline, local answer" marker on the reply.
- **SCOPE:** `convex/lib/ai_router.ts` (fallback branch) · test `convex/lib/ai_router.test.ts` (extend).
- **MUTATES:** coach reply routing (fallback only); no schema.
- **STEPS:** 1) Graphify code-map of `convex/lib/ai_router.ts` (EXISTS — add a fallback); 2) wrap the remote model call so a network failure routes to `LocalModelRunner` (TFV2-0446) when the user has a `ready` model; 3) tag the reply with `offline: true`; 4) never fall back for crisis detection (crisis stays fixed copy, no model); 5) write tests.
- **DONE:** `bun test convex/lib/ai_router.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not use the local model for crisis detection; do not remove the remote path; do not call a real model in tests (stub); do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The fallback fires only on a remote-call failure, and only when the user's local model state is `ready`. The reply carries `offline: true`, surfaced as copy `EN: "Offline answer (on your device)." / HE: "תשובה לא מקוונת (במכשיר שלך)."`. Crisis words always return the fixed card and never touch any model.
- **TESTS:** Given a remote failure and a ready local model / Then the local runner is used and the reply is tagged offline. Given no ready local model / Then the existing error path (no fallback). Given crisis words / Then the fixed card returns and no model (remote or local) is called. Given a remote success / Then the remote path is used.
- **NUMBERS:** fallback is an either/or (deterministic) · offline reply latency → `UNKNOWN` (Amit: depends on the device).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** offline answer quality bar and whether offline coaching is read-only — Amit.

### TFV2-0449 — Local-first sync (offline queue + reconciliation) `packages/utils/src/sync-queue.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `utils`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (local-first sync); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A pure sync queue records offline mutations as a durable, ordered list and replays them on reconnect, so offline edits are never lost and never double-applied.
- **SCOPE:** `packages/utils/src/sync-queue.ts` · test `packages/utils/src/sync-queue.test.ts`.
- **MUTATES:** none (pure queue; the persistence/replay wiring is a later ticket).
- **STEPS:** 1) Graphify code-map (MISSING); 2) implement `SyncQueue` with `enqueue(op)`, `drain()` and `replay(apply)`; 3) assign each op a monotonic id and keep order; 4) `replay` is idempotent (re-running the same op does not double-apply); 5) write tests.
- **DONE:** `bun test packages/utils/src/sync-queue.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not wire Convex here (the caller wires it); do not drop an op on failure (replay retries); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `SyncQueue` ops are `{ id, kind, payload }` with monotonically increasing ids. `replay(apply)` applies each op in order and only removes it after `apply` succeeds; a failed `apply` leaves the op in the queue. Replaying an already-applied op id is a no-op (idempotence). Cap 5,000 queued ops.
- **TESTS:** Given three enqueued ops / When replayed / Then they apply in order. Given an `apply` that throws on op 2 / Then ops 1 is removed, op 2 and 3 remain. Given a replay of an already-applied id / Then no double-apply. Given > 5,000 ops / Then the oldest is evicted with a `truncated` flag.
- **NUMBERS:** queue cap 5,000 ops (deterministic) · conflict policy for concurrent edits → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the conflict policy for concurrent offline/online edits — Amit.

### TFV2-0450 — Inkling distillation (small model) `convex/lib/distill.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0446 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0446.
- **WHY:** PRD §4.12 (Inkling distillation); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A seam module defines the distillation contract — take a set of (prompt, completion) pairs and produce a small-model checkpoint — as a mockable action, so the pipeline exists without running a real distill job.
- **SCOPE:** `convex/lib/distill.ts` · test `convex/lib/distill.test.ts`.
- **MUTATES:** none (contract + stub; no table).
- **STEPS:** 1) Graphify code-map (MISSING); 2) define `distill({ dataset, opts }) => { jobId }` and `getDistillStatus({ jobId })`; 3) implement a deterministic stub that returns `queued` → `running` → `done`; 4) leave the real training/runtime engine OPEN; 5) write tests.
- **DONE:** `bun test convex/lib/distill.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not run a real distillation job or spend money (Amit's approval is required); do not invent the engine (UNKNOWN); do not record a key; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `distill({ dataset, opts: { maxPairs, maxBytes } })` returns `{ jobId }`; `getDistillStatus` returns `queued`/`running`/`done`/`failed`. Dataset caps: 10,000 pairs, 32 MiB. The stub never performs real training. Errors: `dataset_too_large`, `empty_dataset`.
- **TESTS:** Given a dataset / When distilled / Then a `jobId` returns and status progresses `queued` → `done`. Given an empty dataset / Then `empty_dataset`. Given > 10,000 pairs / Then `dataset_too_large`. Given a failed stub / Then `failed`.
- **NUMBERS:** 10,000 pairs / 32 MiB (deterministic) · engine, base model and where checkpoints live → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** distillation engine, base model and checkpoint hosting — Amit (and spend approval per PRD).

### TFV2-0451 — Regional inference routing `convex/lib/ai_router.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (regional inference); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.13 (time zone / region knowledge is a user-data question).
- **GOAL:** The AI router can pick a regional endpoint from a region hint without changing the model, so a user can be served from the nearest region when one exists.
- **SCOPE:** `convex/lib/ai_router.ts` (region branch) · test `convex/lib/ai_router.test.ts` (extend).
- **MUTATES:** model-routing config only (no schema).
- **STEPS:** 1) Graphify code-map of `convex/lib/ai_router.ts` (EXISTS — add a region resolver); 2) implement `regionEndpointFor(region)` returning an endpoint from a small config map or `null`; 3) when `null`, fall back to the default endpoint; 4) never change the model name; 5) write tests.
- **DONE:** `bun test convex/lib/ai_router.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not change the model; do not store a key; do not route to an unapproved endpoint; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `regionEndpointFor(region)` returns a string endpoint or `null`. The region map is data (an approved allowlist). Unknown regions → `null` → default endpoint. Regions are coarse (`eu`, `us`, `il`). The user's region is derived from a stored hint (OPEN below), never from a guess.
- **TESTS:** Given a region in the map / Then its endpoint returns. Given an unknown region / Then `null`. Given a `null` region / Then the default endpoint is used. Given a region change / Then the model name is unchanged.
- **NUMBERS:** region map is an allowlist (deterministic) · the regional endpoint list and how the region is known → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the regional endpoint list and where the user's region is stored — Amit (ties to §4.13).

### TFV2-0452 — Family plans: tables + entitlements `convex/familyPlans.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (convex-arch), lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (family plans); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.2 (prices).
- **GOAL:** A family plan groups an owner and up to a fixed number of members under one shared entitlement, with every member still fully isolated by `userId` for data.
- **SCOPE:** `convex/schema.ts` · `convex/familyPlans.ts` · test `convex/familyPlans.test.ts`.
- **MUTATES:** `familyGroups` + `familyMembers` tables (new); entitlement is shared, data stays per-user.
- **STEPS:** 1) Graphify code-map (MISSING); 2) add `familyGroups` (`ownerId`, `name`, `memberLimit`, `createdAt/updatedAt/deletedAt`) and `familyMembers` (`groupId`, `userId`, `role` owner/member, `joinedAt`, `deletedAt`); 3) implement `createFamily`, `invite`, `acceptInvite`, `removeMember`, `leaveFamily`; 4) membership never merges data — every query still filters by `userId`; 5) log the migration and write tests.
- **DONE:** `bun test convex/familyPlans.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not share rows between members (data isolation is absolute); do not let a member see another member's pages; do not invent a price or member limit (mark UNKNOWN); do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `memberLimit` default 5 (OPEN). `invite({ email })` creates a pending membership (reuse the sign-up approval pattern if present). Errors: `family_not_found`, `member_limit_reached`, `already_member`, `forbidden`, `invite_exists`. Entitlement: members inherit the family owner's tier for quota only, never for data scope.
- **TESTS:** Given an owner / When `createFamily` / Then a group exists. Given an invite + accept / Then the member joins. Given the limit reached / Then `member_limit_reached`. Given a duplicate invite / Then `already_member`/`invite_exists`. Given a member query / Then only their own rows return (no cross-member data). Given a non-owner `removeMember` / Then `forbidden`.
- **NUMBERS:** member limit → `UNKNOWN` (Amit, default 5) · data isolation = absolute (exact invariant) · family price → `UNKNOWN` (Amit, PRD §4.2).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** member limit, family price and whether children get full or limited features — Amit.

### TFV2-0453 — Family plan management screen (web)
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0452 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0452.
- **WHY:** PRD §4.12 (family plans); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** A settings screen lists family members, invites a new member by email, and removes or leaves, with no member able to see another's data.
- **SCOPE:** `apps/web/app/(tempo)/settings/family/page.tsx` · `apps/web/components/settings/FamilyMembers.tsx` · test `apps/web/components/settings/__tests__/family-members.test.tsx`.
- **MUTATES:** `apps/web` UI only (calls `familyPlans` mutations).
- **STEPS:** 1) Graphify code-map (MISSING); 2) build the screen with a `SettingsSection` + `SettingRow` list of members, an invite `TextInput` + `Button`, and per-member remove/leave actions; 3) wire `familyPlans` mutations; 4) implement states (default, loading, empty, error, offline); 5) write the render test and Playwright.
- **DONE:** `bun test apps/web/components/settings/__tests__/family-members.test.tsx` → all pass; the added Playwright spec → green.
- **EVIDENCE:** paste the test output and the Playwright result.
- **DO NOT:** do not render another member's pages or data; do not allow a member to see the owner's billing; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: title `EN: "Family" / HE: "משפחה"`; empty `EN: "No members yet. Invite someone." / HE: "עדיין אין חברים. הזמינו מישהו."`; invite label `EN: "Invite by email" / HE: "הזמינו לפי אימייל"`; invite button `EN: "Invite" / HE: "הזמנה"`; remove `EN: "Remove" / HE: "הסר"`; leave `EN: "Leave family" / HE: "עזוב משפחה"`; error `EN: "Couldn't load your family." / HE: "לא הצלחנו לטעון את המשפחה."` + Retry. States per `?state=` + empty. RTL logical. Keyboard: invite input labelled, remove/leave reachable. Screen-reader announces member roles. Motion ≤ 250 ms.
- **TESTS:** Given a family with members / When shown / Then the member list renders (names only). Given an invite email / When submitted / Then `invite` is called. Given Remove / Then `removeMember` is called. Given Leave / Then `leaveFamily` is called. Given `?state=empty` / Then the empty copy. Playwright: 390/1280 EN+HE.
- **NUMBERS:** contrast 4.5:1, target ≥ 24×24 CSS px (WCAG 2.2 AA) · motion ≤ 250 ms (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether the screen lives under settings/family or billing — Amit.

### TFV2-0454 — SOC 2: audit event log `convex/audit.ts` + `auditEvents` table
- **Stage:** F · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (convex-arch), lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.12 (SOC 2 Type II); REWRITE-PLAN-v2 §6 chunk 6.
- **GOAL:** An append-only `auditEvents` table records security-relevant events (sign-in, permission change, export, deletion, connector connect) with actor, target and time, so SOC 2 evidence is queryable.
- **SCOPE:** `convex/schema.ts` · `convex/audit.ts` · test `convex/audit.test.ts`.
- **MUTATES:** `auditEvents` table (new, append-only).
- **STEPS:** 1) Graphify code-map (MISSING); 2) add the `auditEvents` table (actor `userId`, `event`, `target`, `metadata`, `createdAt`); 3) implement `audit.record` (internal) and `audit.listMine` (a user may read their own events); 4) make records append-only (no update/delete mutations); 5) log the migration and write tests.
- **DONE:** `bun test convex/audit.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not allow a user to edit or delete audit events; do not log secret values (names only); do not expose another user's audit events; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `auditEvents`: `userId`, `event` (`v.union(v.literal("sign_in","export","delete_account","permission_change","connection_connect","data_export" ...))`), `target?`, `metadata` (object, no secret values), `createdAt`. `record` is internal-only. `listMine({ cursor?, limit? })` returns only the caller's events, newest first. Append-only: no `update`/`delete` exported.
- **TESTS:** Given a recorded sign-in / Then the event is present and append-only. Given `listMine` / Then only the caller's events return. Given a second user / Then they cannot see the first's events. Given an event with a secret value / Then it is rejected (redact rule).
- **NUMBERS:** page ≤ 100 (deterministic) · retention window → `UNKNOWN` (Amit: SOC 2 typically 1 year).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the exact event enum and retention window — Amit (SOC 2 scope is a compliance decision).

### TFV2-0455 — SOC 2: retention + export + deletion compliance `convex/lib/compliance.ts`
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0454 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0454.
- **WHY:** PRD §4.12 (SOC 2 Type II); PRD §4.11 F-131 (soft delete 30-day grace); REWRITE-PLAN-v2 §6 chunk 6; REWRITE-PLAN-v2 §4.8 (forget semantics).
- **GOAL:** A compliance module centralizes the user's right to export all their data and to hard-delete on request, with retention windows applied consistently.
- **SCOPE:** `convex/lib/compliance.ts` · test `convex/lib/compliance.test.ts`.
- **MUTATES:** reads all user-owned tables (export) and hard-deletes on explicit request (reuses `accountDeletion.ts`); no schema.
- **STEPS:** 1) Graphify code-map of `convex/lib/accountDeletion.ts` (EXISTS — reuse its `USER_OWNED_TABLES`); 2) implement `exportAll({ userId }) => markdown` covering pages, tasks, events, habits, memories; 3) implement `requestDeletion({ userId })` that hard-deletes after the grace confirmation (reusing the existing deletion path); 4) write tests.
- **DONE:** `bun test convex/lib/compliance.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** paste the test output and the `typecheck` exit code.
- **DO NOT:** do not export another user's data; do not hard-delete before the explicit confirmation; do not weaken the 30-day grace; do not record a key.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `exportAll({ userId })` returns one markdown document per category (pages, tasks, events, habits, memories) with no JSON blocks surfaced. `requestDeletion({ userId })` requires an explicit `confirm: true` and returns a scheduled deletion id. Export/deletion are audited (TFV2-0454). Retention: soft-delete 30-day grace is preserved; hard-delete-on-request is complete (ties to §4.8 — mark OPEN).
- **TESTS:** Given a user with data / When exported / Then all categories return and no other user's data appears. Given `requestDeletion` without confirm / Then refused. Given with confirm / Then a deletion id returns. Given a non-owner / Then `forbidden`.
- **NUMBERS:** export categories = 5 (deterministic) · hard vs soft forget → `UNKNOWN` (Amit, §4.8) · SOC 2 retention schedule → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** `forget` hard vs soft semantics (§4.8) and the SOC 2 retention schedule — Amit.

### TFV2-0456 — Gen 2 cross-feature RTL + a11y + perf hardening pass
- **Stage:** F · **Pass:** 1 · **Depends:** TFV2-0409, TFV2-0433, TFV2-0453 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web` + `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0409, TFV2-0433 and TFV2-0453.
- **WHY:** PRD §4.7 F-70/F-71/F-72 (EN+HE, RTL); UI-BRIEF §6 (accessibility needs); DESIGN.md §8/§10 (breakpoints, RTL); TICKET-STANDARD NUMBERS rule.
- **GOAL:** Every new Gen 2 screen and component is swept for RTL, keyboard, screen-reader, contrast and 60 fps behaviour, with any gap fixed in place, so the later features match the v3 baseline.
- **SCOPE:** `apps/web/components/marketplace/` · `apps/web/components/settings/FamilyMembers.tsx` · test `apps/web/e2e/gen2-hardening.spec.ts`.
- **MUTATES:** `apps/web` UI only (no Convex, no schema).
- **STEPS:** 1) Graphify code-map of the chunk's new web surfaces; 2) run the repo's `scan:design-tokens` and an axe/Playwright a11y pass over marketplace, detail, install-confirm and family screens; 3) fix any logical-property, contrast, focus-ring or missing `aria` issues found in those files only; 4) verify RTL at `lang=he` and no sideways scroll at 390; 5) write the hardening e2e spec.
- **DONE:** `bun run scan:design-tokens` → exit 0; `CI=1 bunx playwright test apps/web/e2e/gen2-hardening.spec.ts` → green.
- **EVIDENCE:** paste the scan output and the Playwright result.
- **DO NOT:** do not fix screens outside the named SCOPE files; do not weaken a check or lower a threshold; do not touch `convex/`, `.env`, workflows; do not remove a test to make it pass.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Apply DESIGN.md §8/§10 and components.md §2.1–§2.18 rules to the four named surfaces only: logical properties everywhere, `.tp-num` on counts/versions, `.tp-icon--flip` on forward chevrons, `dir="auto"` on any user text, one `.tp-btn--primary` per screen, motion ≤ 250 ms. Copy is unchanged from each ticket's SPEC (this ticket fixes layout/a11y, not copy).
- **TESTS:** Given `lang=he` / Then marketplace, detail, install-confirm and family screens lay out RTL with no sideways scroll at 390. Given a keyboard / Then every control is reachable and has a visible focus ring. Given a screen-reader / Then landmark and label structure is intact. Given reduced motion / Then animations collapse to instant.
- **NUMBERS:** text contrast 4.5:1 and target ≥ 24×24 CSS px (WCAG 2.2 AA, 2.5.8) · motion ≤ 250 ms (DESIGN.md §7) · no sideways scroll at 390 (DESIGN.md §8) · scrolling 60 fps (web.dev).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.
