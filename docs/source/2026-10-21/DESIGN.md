# Tempo Flow design reference

Updated 2026-10-21. Documentation draft for review; implementation and live acceptance are separate.

## Verdict

Preserve the existing v3 look: warm paper, readable typography, a centered Markdown page and quiet contextual assistance. This file summarizes the existing design; the detailed v3 files retain their current names and remain the visual reference.

## Visual system

| Element | Contract |
|---|---|
| Surfaces | Parchment ground and solid paper content; independently chosen dark colors |
| Accent | One primary action per screen plus visible focus; no large accent-filled areas |
| Floating chrome | Restrained glass on menus/panels/toasts with solid fallbacks |
| Typography | Newsreader headings, Source Sans 3 body, Hebrew Frank Ruhl Libre/Assistant, IBM Plex Mono for numbers/code |
| Reading controls | Text-size options, OpenDyslexic preference with fallback and separate heading choice |
| Motion | Short transform/opacity transitions; reduced-motion mode removes animation |
| Meaning | Pair semantic colors with labels/icons; never color alone |

The design's recorded typeface and glass overrides remain explicit. Do not silently replace the v3 direction with older generic styling text.

## Layout and direction

Large screens use a rail and centered paper, with a docked or overlaid assistant depending on width. Tablets use a rail drawer. Narrow screens use full-width content, bottom navigation and bottom sheets. Reserve space for fixed controls so the composer and last content row remain reachable.

English and Hebrew use logical layout properties. User text uses automatic paragraph direction. Numeric times/code remain isolated left-to-right. Mirror directional navigation and keyboard behavior where appropriate; do not reverse the data itself.

## Interaction requirements

- Every interactive control has an accessible name and visible focus.
- Dialogs retain focus while pending, restore focus on close and prevent duplicate submission.
- Proposal cards show the exact change and offer Accept, Edit and Reject.
- Undo exposes the remaining window and handles failure without discarding a newer operation.
- Loading, empty, error and offline states explain the actual behavior without a false queued-save promise.
- User-facing content hides internal structured envelopes but preserves ordinary literal text.
- Keyboard and assistive access are required on real surfaces; isolated component dimensions are insufficient.
- Lists retain reading position and focus during loading, filtering and mutation feedback.

## Design coverage and validation

The v3 inventory names 58 web and 13 mobile HTML screens. These are design artifacts, not a count of running product screens. The initial exported delivery gate explicitly said no browser click-through had run. Later render reports are dated and bounded; complete current browser/native acceptance remains UNKNOWN.

The October 21 open issue refresh includes focus during pending actions, actual-screen target sizing, reading-position preservation and stale asynchronous feedback. Those issues retain ownership; this packet does not create a parallel redesign.

Detailed references: [docs/design/v3/DESIGN.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/design/v3/DESIGN.md), [docs/design/v3/screen-map.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/design/v3/screen-map.md), [docs/design/v3/components.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/design/v3/components.md).
