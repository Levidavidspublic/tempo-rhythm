# Design

## Verdict

Keep the v3 look recorded on 2026-10-21: warm paper, readable type, a centered markdown page, and a quiet coach. A second direction also exists: the black-and-white Broadsheet look (direction 4 of the Leon pitch, 2026-10-28). Both are recorded. Which one ships is UNKNOWN. Do not mix them in one screen.

## v3 contract (2026-10-21)

| Piece | Rule |
|---|---|
| Surfaces | Parchment ground, solid paper content, dark colours chosen on their own |
| Accent | One primary action per screen. No large accent-filled areas |
| Chrome | A little glass on menus, panels and toasts, with a solid fallback |
| Type | Newsreader for headings. Source Sans 3 for body in this 21 Oct note. Hebrew: Frank Ruhl Libre and Assistant. IBM Plex Mono for numbers and code |
| Reading | Text size. OpenDyslexic, with a fallback. Headings can stay in the serif |
| Motion | Short moves of transform and opacity. Reduced motion turns animation off |
| Meaning | Colour never alone. Add a label or an icon |

`docs/HARD_RULES.md` section 7.2 still says body type is Inter, not Source Sans 3. The 21 Oct design note is the later design record. Inter remains in the hard-rules file until a ticket edits it. This job does not.

## Layout

Large screens: a rail and centered paper. The coach is docked or overlaid by width. Tablets: a rail drawer. Narrow screens: full width, bottom navigation, bottom sheets. Fixed controls must leave the composer and the last row reachable.

Direction uses logical CSS. The person's text sets its own paragraph direction. Times and code stay left-to-right. Navigation mirrors in Hebrew. The data does not reverse.

## Controls

- Every control has an accessible name and a visible focus.
- A dialog keeps focus while it is open, gives focus back on close, and does not submit twice.
- A proposal card shows the exact change and offers Accept, Edit, and Reject.
- Undo shows the time left. If undo fails, a newer edit is not thrown away.
- Loading, empty, error, and offline tell the truth.
- Lists keep the reading position while they reload.

## What was not proven

The 21 Oct note says the v3 inventory named 58 web and 13 mobile HTML screens, and that those counts are design artifacts, not running screens. It also says the first export had no browser click-through. Complete acceptance is UNKNOWN.

## Broadsheet

Keep it as a recorded direction (2026-10-28). Do not treat it as the shipped skin until Amit says so.

## Sources

`Downloads/grokbot-tempo-omniagent-2026-10-29/tempo/project-docs-2026-10-21/DESIGN.md` (2026-10-29). Basic Memory design lines 2026-10-12 and 2026-10-28. `docs/HARD_RULES.md` section 7.
