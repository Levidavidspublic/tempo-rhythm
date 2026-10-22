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
| KB-01 #1212 | Add optional conversations.tags, archivedAt, libraryRevision and bounded libraryReceipts. Preserve existing owner indexes and KA fields; no parallel chat store | None in this continuation yet; record exact final schema and PR before merge |
| KB-16 #1213 | Pending code-map verification of current written contract and prerequisite schema | None; do not infer a schema change |
| KB-31 #1214 | Pending code-map verification of current written contract and prerequisite schema | None; do not infer a schema change |

Each architecture PR must list every added/changed table, field, validator and index, compatibility/default behavior, owner isolation and rollout/rollback limits here. An unchanged schema must say so explicitly. Fixtures never authorize a live migration.
