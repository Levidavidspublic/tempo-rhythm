# KB-06 goal detail evidence

Source commit: `8897308` (`t/1143-kb-06`). The [contact sheet](kb-06-goal-details-show-milestones-without-crowding.jpg) compares the checked-in `GoalDetailScreen` before and after this change at 390 and 1280 px, English and Hebrew, light and dark. Every screenshot mounts the actual component in an isolated hydrated browser fixture with fictional Maya, Dana and Yoni data. The pure goal status mapping, `StatusBadge`, `TpIcon` and `TpIconSprite` are production modules; Convex reads and writes, locale context, and the Next link are fixture stubs. The standalone CSS fixture uses local font fallback. No real account or backend is exercised. Labels appear only on this evidence sheet.

The original screen showed title, status and the editable “why”, then an empty state for steps. The changed screen keeps those controls and adds the stored progress value with a labelled bar and a plain milestone-empty message. At 390 px the status control fills the available width and tested title/select targets reach 44 px. Long goal text and large text mode have no horizontal overflow. Hebrew follows RTL page direction while user text keeps `dir="auto"`. Light and dark views share the v3 tokens. Both states contain one `main` and one `h1` in the isolated mounted fixture.

The interactive `Kb06Gallery` renders the same production state and progress views with fictional controlled data. In the browser fixture, its Goal, Empty, Loading, Error, Disabled and Long text controls all respond to clicks; English/Hebrew switches direction. Keyboard focus returns to the retry button and Enter invokes its callback once. Retry is disabled in the Disabled state. Focus outline is visible, all gallery buttons measure at least 44 px at 390 px, and the page fits the viewport at both tested widths. Reduced motion was emulated; dark gallery views were captured at both widths and languages. These individual gallery screenshots are temporary fixture output under `/workspace/work/kb-06-capture/after` and are not a product route.

New regression cases in `tests/unit/kb-06.test.tsx`:

1. missing goal shows unavailable and never invents a goal
2. loading has a distinct live status
3. offline explains that a save may need another try
4. long goal text wraps without horizontal overflow
5. keyboard title save keeps the existing update payload
6. why blur keeps the existing description payload
7. status selection maps the real `done` display state to the existing `completed` status payload
8. Hebrew layout is RTL and user text keeps auto direction
9. large text remains readable at phone width
10. real progress is labelled and empty milestones are honest
11. gallery states, language, retry, disabled action and focus work
12. English and Hebrew keys match
13. desktop English and Hebrew remain within viewport
14. dark mode and reduced motion preserve readable gallery controls

Real milestone rows and movement controls remain blocked: the existing goals record has no milestone field or goal-to-task/project relation. This presentation-only ticket cannot add that contract. The Hebrew strings are machine-drafted for Amit’s native review. Device screen-reader results and signed-in backend behavior remain UNKNOWN.
