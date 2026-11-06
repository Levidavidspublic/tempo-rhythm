# Comparator research — checked 19 Oct 2026

Research used public source reads, not product logins. No comparator code, assets or styles were copied into Tempo. This plan is a gap map, not a tested feature-parity claim.

## Vane (formerly Perplexica)

Pinned repository snapshot: [`348feca3e378fb4157b217724ed508dc707f853f`](https://github.com/ItzCrazyKns/Vane/tree/348feca3e378fb4157b217724ed508dc707f853f). The [README](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/README.md) and [MIT licence](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/LICENSE) were read live. The licence says **Copyright (c) 2026 ItzCrazyKns**.

| Verified source | What it actually says/shows | KB consequence |
|---|---|---|
| README feature list | Speed, Balanced, Quality; web, discussions, academic; SearXNG; images/videos; file uploads; domains; suggestions; Discover; history; cited answers | The requested categories are real documented features. KB-16–27 extend KA-24/43, with different bounded implementation choices below. |
| [Optimization.tsx](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/src/components/MessageInputActions/Optimization.tsx) | Three modes live in a composer popover and have separate descriptions | KB-17 gives a keyboard radiogroup and plain descriptions; no copied styles, colours or dependencies. |
| [Sources.tsx](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/src/components/MessageInputActions/Sources.tsx) | UI label “Social” maps to `discussions`; source choices are multiple selection | Tempo says “Discussions” consistently, supports multi-select, and refuses an empty selection. Do not claim the UI literally says “Discussions” in this snapshot. |
| [MessageSources.tsx](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/src/components/MessageSources.tsx) | Source display includes an expanded dialog; supports document and web source presentations | Extend KA-43 with overflow, safe icons and touch/keyboard citation previews; do not replace its parser. |
| [How Vane works](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/docs/architecture/WORKING.md) | Classify, run research/widgets in parallel, then answer with citations; widgets are not citation sources. `/api/search` supports streaming. Images/videos have separate endpoints and use model-generated queries. | Keep factual progress. KB media uses an explicit query and no extra model call. A calculator is deterministic; weather/stock fallback cards are labelled source results, not verified live values. |
| [Calculation.tsx](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/src/components/Widgets/Calculation.tsx) | Calculation view takes an expression and numeric result | KB-23 shows both, with its own bounded arithmetic parser and no eval. |

The inspected [SearXNG adapter](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/src/lib/searxng.ts) uses a 10-second AbortController timeout and exposes categories/engines. Its [search tool descriptions](https://github.com/ItzCrazyKns/Vane/blob/348feca3e378fb4157b217724ed508dc707f853f/src/lib/agents/search/researcher/actions/search/webSearch.ts) permit up to three queries per call and describe more research calls in the higher modes. Tempo deliberately does not reproduce that extra model/research budget. The video adapter names the YouTube engine; availability in Tempo’s separate SearXNG deployment remains UNKNOWN. The attempted image-agent source read returned HTTP 502; image support is confirmed from the README, not from that failed fetch.

The README documents file upload questions, but KA/#1081 already owns ingest/study surfaces. KB-49 is a later integration/audit title, not a duplicate uploader. Vane's supported providers and infrastructure are not a recommendation to add them to Tempo.

The three Tempo modes are **a proposed product mapping**, not Vane's exact algorithm: Speed uses fewer sources; Balanced keeps the existing baseline; Quality adds at most two safe page reads within the same model-call/tier/token budget. Model-generated typeahead, multi-round research, live quote feeds and broader runtime budgets are not authorized. KB uses loaded-history suggestions and deterministic related questions. Differences remain visible in the product descriptions and cannot be reported as exact Vane parity.

MIT permits reuse when notices are preserved. If a future approved ticket copies code, preserve the full MIT text and copyright notice, record every copied file in `THIRD-PARTY-NOTICES.md`, and run `bun run check:notices`. These ticket scopes do not include that notices file, so their concrete instruction is patterns only.

## Open WebUI

The public [features URL](https://docs.openwebui.com/features/) returned a tunnel HTTP 403 in this environment. The same site's [source feature document](https://github.com/open-webui/docs/blob/main/docs/features/index.mdx) was fetched successfully, as was the [Open WebUI licence](https://github.com/open-webui/open-webui/blob/main/LICENSE). These source URLs were read on 19 Oct; unlike Vane they are not commit-pinned in this pass.

The feature table explicitly lists message queue, folders/tags/pins, web answers with cited sources and two-model side-by-side chats. The Notes section describes attaching notes to chats for full-content context. Its licence includes a branding-preservation clause. **UX patterns only; never copy Open WebUI code.**

KB implements tags/archive/Library/export and memory-only queues. KA owns pins/folders and its note canvas. Two-model comparisons need a runtime/model/cost decision, so no executable ticket enables them in these batches. Notes-context attachment can be audited later against KA-28 before adding anything.

## Unknowns and limits

- No comparator app was run: runtime quality, latency, accessibility and claims of privacy were not independently tested.
- SearXNG deployed engine availability, media fields and academic/discussion coverage are UNKNOWN. KB-16 must advertise only validated adapters; unsupported families stay unavailable instead of silently widening to web.
- Live KA-24 service configuration and keyed-provider availability were not inspected. No secret values were read.
- Current full Agent-backed transcript access is UNKNOWN/not exposed in this checkout. The active legacy coach path is inspectable; KB explicitly marks partial Agent coverage rather than hiding it.
- There is no reusable React gallery route/harness in the inspected component tree. Tickets therefore define an isolated hydrated fixture in their one scoped test file, reusing installed Playwright, Bun and v3 styles. No wiring-route allowlist is changed.
