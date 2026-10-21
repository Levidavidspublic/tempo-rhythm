# Bugbot rules — tempo-rhythm

This repo is built by a ticket factory (factory/LOOP.md). Bugbot reviews ONE pull request per loop: the batch PR
`batch/<loop-id>` -> `integration`. It combines several component tickets (each listed as "Closes #N" in the PR body)
that already passed CI on their own.

- Review the whole batch diff. Each finding should name the ticket folder it belongs to.
- `convex/` is owned by the loop's architecture ticket (ticket 0), which lands on integration before the batch.
  A batch PR that changes `convex/` is a bug unless the PR is labelled `convex-arch`.
- Component code must call Convex functions that exist in `convex/_generated/api.d.ts`. Flag calls to missing ones.
- Queries that use `requireUser` throw while auth is not ready; flag `useQuery` subscriptions that are not gated on a
  resolved user (`getProfile` non-null).
- Never suggest changes under `.github/`, `scripts/factory/`, `.cursor/`, `docs/tickets/` in a batch PR.
