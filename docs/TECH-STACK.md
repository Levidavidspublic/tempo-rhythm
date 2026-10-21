# Tempo Flow technology stack

Updated 2026-10-21. Documentation draft for review; implementation and live acceptance are separate.

## Verified repository baseline

The default branch was rechecked on 2026-10-21 at `c7447ad9ad5a71326b211d1de80d54091a280683`. This table describes the repository, not the deployed environment.

| Layer | Existing choice | Boundary |
|---|---|---|
| Workspace | Bun 1.3.9, Turborepo, apps and packages workspaces | Keep the declared version and lockfile; no upgrade here |
| Web | Next.js PWA, Tailwind v4, shadcn-based primitives | Actual app routes and real states require browser proof |
| Native | Expo, NativeWind, app-local Tailwind v3 | Native shell remains separate; no WebView replacement |
| Backend | Root convex/ with Convex Auth | No parallel packages/backend authority |
| Shared packages | ui, types, utils, config | Current repository does not have packages/core |
| Markdown | CodeMirror live preview and GFM rendering | Canonical notes.body; protected blocks and exact source fidelity |
| Assistant | Existing router and approved Convex Agent/RAG components | Provider/model selection is not changed by this packet |
| Rendering | Existing catalog/renderer contracts | Preserve the current shell and reviewed schema |
| Network | Native fetch and existing scoped endpoints | No new provider SDK or unreviewed fallback |
| Validation | Repository tests, lint/typecheck, Playwright and existing scans | Use the exact commands in factory/SLOTS.md |

## Stack conflicts retained

Older blanket SDK wording and the later specific Agent/RAG allowance need explicit reconciliation. Source reports of branch components do not prove registration or production operation. Backend ownership, generated API changes and package additions require their own scoped ticket. Provider quality, live configuration and exact current runtime remain UNKNOWN.

The historical local deployment playbook and generic automation examples are not a migration request. Their external-service setup, credential handling and release commands are not executed by this task.

## Source anchors

[factory/SLOTS.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/factory/SLOTS.md); [docs/TRD.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/TRD.md); [docs/contracts/CORE-WEB-EDITOR-MODES.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/CORE-WEB-EDITOR-MODES.md); [docs/HARD_RULES.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/HARD_RULES.md).
