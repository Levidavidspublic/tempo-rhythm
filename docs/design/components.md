# Approved UI components

- **Primitives:** shadcn/ui on Tailwind v4 (`apps/web/components/ui`). Never invent a new design system.
- **Micro-interactions:** interior.dev (MIT, free, no account), source owned in `apps/web/components/interior/`.
  Pre-installed: loading-button, hold-to-confirm, copy-button, segmented-control, tooltip-group (need `motion`).
  Add more: `cd apps/web && npx shadcn@latest add https://www.interior.dev/r/<name>.json`
- **Generative UI (OpenUI):** only in omniagent and agentwright. Free open-source framework only; no Thesys account, no OpenUI Gateway or Observability.
- **Key fields:** never use copy-button on a secret. A key is shown once at most.
