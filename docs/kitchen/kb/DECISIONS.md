# Kitchen decisions

WALK — Recorded 22 October 2026 from Amit's explicit instructions. This ledger distinguishes approved design from applied schema/deployment changes.

| Decision | Approved behavior | Implementation status |
| --- | --- | --- |
| AT-21/22/27/28/29 | One additional scoped harness, Plan, hero and page-save fix; clean KB-67 replacement, old PR retained | In progress; no extra unlimited retries |
| Text models | Default GLM 5.3 Flash medium reasoning, high when warranted; Think hard GLM 5.3 high with total limit ten minutes; identifiers from Convex settings | Provider identifiers/configuration must be verified; no hard-coded identifier or silent substitution |
| Search | Small Vercel service, hosting cap $10/month; default Together/DeepInfra usage approved | Implementation preparation only; no production or manual deployment |
| Admission | Resend magic link only; approved beta applicants and existing testers receive Max free | Existing sole Resend provider confirmed; remaining policy mapped separately |
| Pricing | No free plan; $1 trial for every plan; checkout OFF until provider/RevenueCat identifiers supplied | Existing pricing draft needs alignment; no live charge |
| Executor | Per-person tool hub via documented MCP; Integrations UI and server connection behind flag | Existing mounted connection path found; extend rather than duplicate; no shared private connection |
| Hebrew voice | Imperfect pronunciation acceptable; researched crisis list remains OFF pending clinical review | Research ticket #1252; native fluency is not a preparation blocker |
| Voice | Deepgram Voice Agent with GLM through Tempo router and existing account/crisis controls | Ticket #1253; protocol/configuration prerequisites recorded |

## Schema register

AT — Amit approves preparation of KB-01, KB-16 and KB-31; he will add convex-arch labels. Approval to prepare is not an applied migration. No deployment or environment mutation is performed.

| Ticket | Proposed change from written contract | Applied change / PR |
| --- | --- | --- |
| KB-01 #1212 | Add optional conversations.tags, archivedAt, libraryRevision and bounded libraryReceipts. Preserve existing owner indexes and KA fields; no parallel chat store | Prepared in #1262; exact field types and defaults below, not deployed |
| KB-16 #1213 | Pending code-map verification of current written contract and prerequisite schema | None; do not infer a schema change |
| KB-31 #1214 | No schema change; reuse KB-01 receipts | Preparation underway; bounded export contract corrected below |

Each architecture PR must list every added/changed table, field, validator and index, compatibility/default behavior, owner isolation and rollout/rollback limits here. An unchanged schema must say so explicitly. Fixtures never authorize a live migration.

WALK — 22 October KB-01 cursor correction: use the existing native index's deterministic updatedAt/_creationTime/_id tie order. The older updatedAt/ID-only promise could require an unbounded equal-timestamp scan and conflicts with the 25-conversation cap. No index is added; page-local resorting must not skip or repeat tied rows. The issue contract is updated before implementation and tests must cover ties across page boundaries.

## WALK — Implementation decisions, 22 October 2026

- KB-01 #1262 adds only optional `conversations.tags: string[]`, `archivedAt: number`, `libraryRevision: number`, and `libraryReceipts: Array<{token:string;requestKey:string;appliedRevision:number;undoUntilMs:number;previous:{tags?:string[];archivedAt?:number;deletedAt?:number};result:{tags?:string[];archivedAt?:number;deletedAt?:number}}>`. Missing tags mean empty, missing archive means active, missing revision means zero. At most 32 unexpired receipts per chat; five-minute server-clock expiry; revision/result preflight before Undo. No table/index/backfill/deploy. KA folder/pin fields are not added. This is committed preparation, not an applied migration.
- KB-31 has no schema change. Bulk selection remains 1–50. Export selection is 1–25 so every selected chat is revalidated inside each invocation's 25-chat bound; larger exports require explicit client batching without omission. Message mutations must monotonically advance the parent version, and future KA writers must preserve that invariant. Native timestamp/_creationTime/_id ordering applies.
- Model router #1260 has no schema change. Convex deployment settings are the existing settings mechanism: `TEMPO_AI_MODEL` and `TEMPO_AI_THINK_HARD_MODEL`; identifiers are never hard-coded. Missing settings produce unavailable/configuration errors. Normal reasoning is medium, high for a deterministic long-prompt rule; think-hard is high with a distinct configured model and ten-minute total ceiling. No values were configured; provider-backed behavior remains unverified.
- Search #1259 uses Node's built-in HTTPS transport for a validated, pinned DNS address with normal TLS hostname verification and no redirects. Native fetch preflight alone cannot prevent DNS rebinding between validation and connection. This scoped transport decision adds no dependency. A gateway does not establish a working upstream or an enforced hosting cap.
- Account #1263 changes no schema: pending ordinary signup is not a marketed free plan. Existing tester grants remain; explicit cancellations and independent purchases must not be overwritten.
