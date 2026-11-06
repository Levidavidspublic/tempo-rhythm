---
name: spec-writing
description: Write specs so detailed that a mid-tier model can build each piece without guessing — software screens and features, motion-graphics explainer videos, and fiction or nonfiction writing pipelines.
---

# Spec writing — include.md

Version 1 · 2026-10-23 · newest version wins; keep old rules under "Supersedes".

This file is the full method. Other instruction files pull it in:

- CLAUDE.md: add the line `@include.md`
- AGENTS.md: keep the short rules there and link here ("Full method: include.md")
- Reason bots and other agents without includes: put "Before writing or building from a spec, read include.md in the repo root" in their standing instructions

---

## 1. Why this exists

An agent's output is only as detailed as its spec.

A coarse spec makes the model guess. Guesses come out generic: clunky screens, stock-looking motion, flat prose. A mid-tier model does excellent work when every piece is small and fully described. It does bad work when it has to invent the details.

So the job is not "write a better ticket". The job is: **break the work down until each piece is small enough to build without guessing, then describe each piece completely.**

The same method works for apps, videos and books. Only the vocabulary changes.

---

## 2. Rules (never broken unless this file is rewritten)

1. **No guessing.** If a fact is not in the spec or its sources, write `UNKNOWN — <what is missing>` and ask. Never fill the gap with something plausible.
2. **One unit = one run.** Break down until one unit can be finished by one agent in one run:
   - software: one feature, about 3 files + 1 test
   - video: one shot, usually 2–8 seconds
   - writing: one scene, usually 800–2,500 words
3. **Every unit uses the template** in section 4. No free-form specs.
4. **Every unit has an acceptance check** that a machine or a reviewer can verify without asking anyone a question.
5. **Every unit names its sources.** A Mobbin screen, a screenshot path, a reference frame, a timestamp, a bible entry. "Like Todoist" is not a source; "Mobbin, Todoist, Today screen, iOS, screen 3 of 12" is.
6. **Behaviour, not framework.** Describe what the user sees and what happens. Don't tie the spec to React, Convex, Remotion or any tool, so a later rewrite (Electron, Kotlin, Swift, another database or renderer) reuses the same specs and tests.
7. **Two passes.** Pass 1 = clunky: it works and passes the functional checks. Pass 2 = polished: it matches the visual and motion spec exactly. Never mix them in one run.
8. **Clean room.** Describe behaviour and layout from public screens and your own observation. Never copy another product's code, assets, logos, brand names, music or text.
9. **Newest wins.** When a spec changes, update it in place and move the old line under "Supersedes" with its date. Never delete history.
10. **Secrets never go in specs.** Name the variable and where it lives, never the value.

---

## 3. The levels

Every project has the same six levels. Write top-down; build bottom-up.

| Level | Software | Video | Writing |
|---|---|---|---|
| 1 Product | App | Series or channel | Series or universe |
| 2 Area | Section of the app (Tasks, Chat) | Episode | Book |
| 3 Container | Screen | Sequence (act) | Chapter |
| 4 Part | Component | Shot | Scene |
| 5 Atom | Feature or state | Animation or element | Beat |
| 6 Work order | Ticket | Shot ticket | Scene ticket |

Each level has its own spec file. A lower level never repeats what the level above already fixed; it links to it.

Level 1 always has a **style sheet**: the global rules (tokens, palette, voice, tense). Levels below only override it on purpose, and say so.

---

## 4. The unit template (use for every unit at levels 3–6)

Copy this block. Every field is filled, or says `n/a` with a reason, or says `UNKNOWN — <what is missing>`.

```
ID:            <AREA>-<NN>  (e.g. TASKS-S03, EP02-SH014, BK1-CH07-SC2)
Title:         <short, plain>
Level:         screen | component | feature | sequence | shot | chapter | scene | beat
Parent:        <parent ID>
Purpose:       <one sentence: what the user/viewer/reader must get from this>
Sources:       <reference links, Mobbin IDs, file paths, timestamps, bible entries>
Inputs:        <data, assets, prior units this one needs>
Spec:          <the exact description — see the profile sections for what goes here>
States/variants: <every state or variant, each described>
Out of scope:  <what this unit must NOT do>
Depends on:    <IDs that must exist first>
Acceptance:    <numbered checks; each one pass/fail, no judgement words>
Evidence:      <what proves it: test output, screenshot paths, frame grabs, word count>
Pass:          1 (clunky) | 2 (polished)
Open questions: <UNKNOWN items, each with who can answer>
Supersedes:    <old line + date, if any>
```

### Words that are banned in a spec

These words hide missing detail. Replace each one with a measurable fact.

nice, clean, modern, smooth, intuitive, engaging, sleek, simple, appropriate, as needed, etc., some, a few, quickly, slowly, nicely, properly, standard, usual, like X (without a source)

Example: "smooth fade-in" becomes "opacity 0→1 over 12 frames, ease-out cubic-bezier(0.22, 1, 0.36, 1), starting at frame 30".

---

## 5. The "detailed enough" test

A spec is done when a mid-tier model, given only the spec and its sources, can build the unit **without asking a single question**.

Run this test before filing:

1. Give the spec to a second model (a cheap one is fine).
2. Ask it: "List every question you would need answered to build this exactly. List every place you would have to guess."
3. If the list is not empty, fix the spec or mark the items `UNKNOWN`.
4. Repeat until the list is empty, or contains only `UNKNOWN` items that are waiting on Amit.

---

## 6. How an agent writes specs (the procedure)

1. **Read first.** The project's AGENTS.md, README, docs/, the product defaults note, and existing specs. Search memory for the project.
2. **Gather references.** Collect every source into `specs/_refs/` (screens, frames, notes) with a short index file. Note where each came from.
3. **Inventory.** List every container at level 3 (all screens, all sequences, all chapters). Nothing gets specced until the list is complete.
4. **Merge overlaps.** When the same feature appears in several references (search in Todoist, Notion and Craft), write it once and list all sources.
5. **Decompose.** For each container, list its parts (level 4) and atoms (level 5).
6. **Fill templates.** Top-down: style sheet, then containers, then parts, then atoms.
7. **Self-check.** Run the "detailed enough" test (section 5) on every unit.
8. **Review gate.** A second agent or Amit reviews a sample. Fix patterns, not just instances.
9. **File work orders.** One ticket per unit, in dependency order, with the right labels. Pass 1 tickets first; pass 2 tickets are filed separately.
10. **Write the session note** to memory: what was specced, what is UNKNOWN, links.

---

## 7. Profile A — Software

### 7.1 Sources

- **One-to-one parity apps** with many elements (Todoist, Perplexity, Craft, Notion and similar): use Mobbin screens and flows. Record the app, platform, flow name and screen number for every reference.
- **Apps not in Mobbin:** capture your own walkthrough: screenshots or a screen recording, each saved with a path and timestamp, plus a written list of what each control does.
- **Builder-type products** (Base44-type tools for OmniAgent and Agentwright): capture the flows end to end (create → edit → preview → publish) the same way.
- **Product defaults** (sign-in, default models, Hebrew, connections): read the current product-defaults note. Specs follow it unless the spec says why not.

### 7.2 Style sheet (level 1)

- Design tokens: colour (hex + role + light/dark value), type scale (family, size, line height, weight per role), spacing scale, radii, shadows, borders, z-index layers.
- Motion tokens: durations (e.g. fast 120 ms, base 200 ms, slow 320 ms) and easing curves, written as values.
- Breakpoints: at least 390, 768 and 1280 px wide.
- Directions: LTR (English) and RTL (Hebrew), with mirroring rules (icons that flip, icons that don't).
- Accessibility baseline: WCAG AA contrast, visible focus, full keyboard use, screen-reader labels, minimum touch target 44×44 px.
- Copy rules: tone, capitalisation, string keys for every visible text (EN and HE).

### 7.3 Screen spec (level 3)

- Route or entry point; how the user gets here; where they can go next.
- Purpose in one sentence.
- Layout: regions (header, sidebar, main, panel, footer), with sizes per breakpoint.
- Component list, in reading order, each with its ID.
- Data shown: which fields, from where, sorting, grouping, limits, truncation.
- **States, every one described with what is on screen:** empty (first use), empty (filtered), loading, partial, full, error (with exact message), offline, no permission, too much data.
- Light and dark; LTR and RTL; each breakpoint.
- Keyboard order and shortcuts.
- References: Mobbin or capture IDs for each state.

### 7.4 Component spec (level 4)

- Anatomy: every sub-part named (container, icon, label, badge, action).
- Data in, events out, described in plain words (not framework props).
- Variants: size, emphasis, density.
- **States:** default, hover, focus, active/pressed, selected, disabled, loading, error, dragging (if relevant).
- Interactions: what each gesture or key does, with timing (e.g. long-press 500 ms opens the menu).
- Motion: what animates, from → to, duration, easing (use the motion tokens).
- Tokens used for every colour, size and spacing value.
- Accessibility: role, label text, announced changes.

### 7.5 Feature spec (level 5)

- User story: "As <who>, I want <what>, so that <why>."
- Rules: every business rule as a numbered line.
- Edge cases: numbered, each with the expected behaviour.
- Data touched: what is read, what is written, what is deleted, and when.
- External calls: which service, what for, what happens if it fails or is slow.
- Errors: every error with its exact user-facing message (EN and HE string keys).
- Permissions: who can do it, who can't, what the "can't" looks like.
- Acceptance tests in Given / When / Then form, each tagged: unit, web end-to-end (Playwright), mobile (simulator), or manual.

### 7.6 Ticket (level 6) — fits the factory

```
Title:     [<ID>] <plain title>
Spec:      <link to the unit spec>
SCOPE:     <the files or areas it may touch>
MUTATES:   <data or config it changes, or "none">
Budget:    3 files + 1 test (default; say why if more)
DONE:      <the exact command that must pass>
EVIDENCE:  <what to attach: test output, screenshots at 390/1280, EN/HE, light/dark>
Pass:      1 | 2
Labels:    <factory label>, <area>, pass-1 | pass-2
Depends:   <ticket numbers>
```

One ticket = one branch = one pull request. CI runs on every ticket. Review follows the project's review rule (for example, one review per loop when the loop's tickets merge).

### 7.7 The two passes for software

- **Pass 1 — clunky.** Every state exists and works. Every acceptance test passes. Layout is right; visuals may be rough. No pixel polish, no motion work.
- **Pass 2 — polished.** Matches the tokens and the references exactly in every state, both directions, both themes, all breakpoints. Motion added. Visual checks compare screenshots against the references.

### 7.8 Testing

- Web: Playwright end-to-end in the cloud, run at 390 and 1280 wide, EN and HE, light and dark.
- Mobile: a simulated device run for every mobile-facing flow. Which simulator service is used: `UNKNOWN — Amit to choose`.
- Browsers: at least Chromium; add others when the project says so.
- Every test is deterministic: no real payments, no real sends, fixed test data.

---

## 8. Profile B — Motion graphics and explainer videos

Applies to Vox-style explainers and any animated educational video. The look is original: no other channel's logos, footage, music or brand marks.

### 8.1 Levels

Video (episode) → sequence (act) → shot → element/animation → shot ticket.

### 8.2 Style sheet (level 1)

- Canvas: size (1920×1080 or 1080×1920), frame rate (30 fps default), safe areas (title safe and action safe, in pixels).
- Grid: columns and margins (e.g. 12 columns, 96 px margins at 1920 wide). Every position in a shot spec uses this grid.
- Palette: each colour as hex, with a role (background, ink, accent, highlight, warning) and a meaning rule (e.g. "accent = the thing being explained; never decorative").
- Type: families, sizes per role (title, label, annotation, caption), weight, tracking, line height, maximum words on screen at once.
- Texture: paper grain, halftone, shadows, edge style for cut-outs: each with values (opacity, scale, blend mode).
- Line and shape language: stroke widths, corner radius, arrow style, icon style.
- Motion language: default durations and easing (see 8.5), what never moves, what always enters the same way.
- Sound: music bed rules (licence, loudness under narration), sound-effect set, narration voice (engine, voice name, speed).
- Captions: font, size, position, maximum characters per line, sync tolerance.

### 8.3 Sequence spec (level 3)

- Purpose: the one idea the viewer must understand by the end.
- Narration lines covered (paste them in, numbered).
- Shot list in order, each with ID, start and end time, and one-line purpose.
- The visual metaphor that runs through it, and its rules.
- Transitions between shots.

### 8.4 Shot spec (level 4) — the most important file

```
ID:          EP02-SH014
Timecode:    00:01:12:05 → 00:01:17:20  (frames 2165 → 2330 at 30 fps)
Narration:   line 31, words "...and that is why the curve bends here."
             word cues: "curve" at frame 2210, "bends" at frame 2262
Purpose:     viewer sees that growth slows after the peak
Layout:      chart occupies columns 2–8, rows 2–7; label column 9–11
Elements (by layer, back to front):
  L0 background  paper texture, #F4EFE6, grain 6% opacity
  L1 axes        2 px ink #1C1C1C, draw-on
  L2 line        4 px accent #E4572E
  L3 label       "Peak" in label style, 48 px
  L4 highlighter yellow #F6D743 at 60% multiply
Assets:      chart data at specs/_refs/data/growth.csv (source: <citation>)
Animation table:
  | element | property | from | to | start frame | frames | easing | stagger |
  | axes    | draw-on  | 0%   | 100% | 2165 | 18 | ease-out (0.22,1,0.36,1) | — |
  | line    | draw-on  | 0%   | 100% | 2183 | 40 | ease-in-out (0.65,0,0.35,1) | — |
  | label   | opacity+y| 0, +24 px | 1, 0 | 2210 | 12 | ease-out | — |
  | marker  | width    | 0    | 100% | 2262 | 10 | ease-out | — |
Camera:      push-in 100% → 108% scale, frames 2165–2330, linear
Transition in:  hard cut from SH013
Transition out: label and marker hold; cut to SH015 at 2330
On-screen text (exact): "Peak"
Sound:       paper rustle at 2165, soft click at 2262 (sfx set: <name>)
Accessibility: caption shows line 31; contrast ink vs paper ≥ 7:1
Reference frames: specs/_refs/frames/EP02-SH014-a.png (layout), -b.png (end state)
Acceptance:
  1. Frame 2200: axes fully drawn, line under 50% drawn
  2. Frame 2262: label fully visible at final position
  3. Frame 2272: marker fully across the label
  4. Captions within ±2 frames of the narration
  5. Nothing outside title safe
Evidence:    frame grabs at 2165, 2200, 2262, 2272, 2330 saved to out/frames/EP02-SH014/
Pass:        1 (timing and layout) | 2 (texture, easing, sound polish)
```

### 8.5 Motion defaults (guideline starting values; a shot may override them and say so)

- Entrances: ease-out. Exits: ease-in. Moves on screen: ease-in-out.
- Small UI-like pops and labels: 8–12 frames. Medium moves: 15–24 frames. Big reveals and camera moves: 30–60 frames.
- Stagger for lists: 3–5 frames per item.
- Hold every new idea on screen long enough to read: about 4 frames per word of on-screen text, minimum 30 frames.
- Draw-on lines finish before the narrator says the word they illustrate, or exactly on it — never after.
- Never more than two things moving for attention at the same time.

### 8.6 Shot types (each needs its extra fields)

- **Chart or data shot:** chart type, data file and source, axes and units, reveal order, what is highlighted.
- **Map shot:** projection, region, borders shown, labels, zoom path, data layer.
- **Document or paper shot:** the document (own or licensed), what is highlighted, in what order, the highlight colour.
- **Collage or cut-out shot:** each cut-out's source and licence, edge treatment, shadow values.
- **Equation or maths shot:** exact expression, which term appears when, colour per term, how terms move between steps.
- **Diagram shot:** nodes and links, layout, build order.

### 8.7 The two passes for video

- **Pass 1 — animatic.** Every shot exists at its timecode, with layout, timing and narration sync correct. Placeholder textures and sounds are allowed.
- **Pass 2 — polished.** Texture, easing, sound and colour match the style sheet; every acceptance frame passes.

### 8.8 Video acceptance (whole video)

- Every shot's frame checks pass.
- Captions within ±2 frames throughout.
- Loudness near the platform target (guideline: about −14 LUFS integrated for YouTube), narration never masked by music.
- Every fact on screen has a source in the sources list; every asset has a licence line.

---

## 9. Profile C — Writing (novels, serials, fan fiction, nonfiction)

### 9.1 Levels

Series or universe → book → chapter → scene → beat → scene ticket.

### 9.2 Story bible (level 1, the style sheet for fiction)

- World rules: what is possible and what isn't; costs and limits of any magic or system.
- **Game-system rules (LitRPG):** every stat, skill and level rule with its numbers, the exact format of system messages and stat blocks (a copy-ready template), and how numbers change. All maths must stay consistent.
- Places: name, look, sounds and smells, who is there, travel times between places.
- Factions and groups: aims, leaders, relationships.
- Timeline: dated events, in order.
- Shared-universe rules: what belongs to the shared canon, what one book may change, what it may not.

### 9.3 Character sheet

- Name, role, age, fixed physical facts (never contradicted).
- Want (outer goal) and need (inner change).
- Voice markers: vocabulary level, sentence length, verbal habits, what they never say, how they swear (or don't), in which language they think.
- Relationships, each with current state.
- Arc per book: start state → end state, with the turning chapters.
- **Knowledge state:** what the character knows at the start of each chapter. A character never acts on information they don't have yet.

### 9.4 Style sheet

- Tense, point of view (first/third, close/distant), allowed POV characters.
- Spelling (UK or US), dialogue punctuation, how thoughts and system messages are shown.
- Chapter length range, scene length range.
- Content level (violence, language) per book.
- Influences described in words (pace, humour, density): describe the qualities; never copy another author's text.
- Banned phrases and clichés list, kept per series and growing over time.

### 9.5 Chapter spec (level 3)

- Purpose: what changes by the end of the chapter.
- POV character, place, time (timeline position).
- Threads advanced (each by ID) and threads deliberately left alone.
- Scene list in order, each with ID and one-line purpose.
- Ending hook: the exact question the reader carries into the next chapter.
- Word target with range.

### 9.6 Scene card (level 4) — the most important file

```
ID:          BK1-CH07-SC2
POV:         <character>, close third
Place/time:  <bible place ID>, night, day 12 of the timeline
Goal:        what the POV character wants in this scene
Conflict:    what stops them
Turn:        how it ends differently from how it started (value shift: e.g. safe → hunted)
Beats (in order):
  1. <beat>  ~150 words
  2. <beat>  ~300 words
  ...
Reveals:     what the reader learns (fact IDs)
Withholds:   what is deliberately not revealed yet
Continuity:  facts that must match (bible IDs, earlier scene IDs)
Knowledge:   what the POV character knows and doesn't know here
Sensory anchors: 2–3 concrete details (sight, sound, smell)
Dialogue notes: who speaks, the subtext, any line that must appear
System messages: exact text and numbers, using the bible template
Tone:        described in words (tense and quiet, dry humour)
Word target: 1,800 (range 1,600–2,000)
Banned:      the series banned-phrases list plus any scene-specific ones
Acceptance:  see 9.8
```

### 9.7 The two passes for writing

- **Pass 1 — draft.** Every beat present, continuity correct, word count in range. Prose may be plain.
- **Pass 2 — polish.** Voice markers match the character sheets, sentence rhythm varied, banned phrases at zero, sensory anchors used, read-aloud check passed.

### 9.8 Writing acceptance (per scene)

1. Every beat on the card appears, in order.
2. No contradiction with the bible, the character sheets or earlier scenes (a checker lists every fact used and its source ID).
3. POV never slips; no character uses knowledge they don't have.
4. System-message numbers add up.
5. Word count within the range.
6. Zero banned phrases.
7. Read aloud with text-to-speech: no sentence trips the reader (long tangles get split).

### 9.9 Nonfiction variant

- Every claim has a source. For health, science and education, use peer-reviewed or official sources only.
- Each section spec lists its claims and their sources before any prose is written.
- Acceptance adds: every claim traced to its source; no claim stronger than its source.

---

## 10. Where specs live

Software repo:

```
docs/specs/_style.md
docs/specs/_refs/        (references + index.md)
docs/specs/<area>/<screen-id>.md
docs/specs/<area>/components/<component-id>.md
docs/specs/<area>/features/<feature-id>.md
```

Video project:

```
specs/_style.md
specs/_refs/             (frames, data, documents, licences.md)
specs/<episode>/script.md
specs/<episode>/sequences/<seq-id>.md
specs/<episode>/shots/<shot-id>.md
```

Writing project:

```
bible/  (world.md, system.md, places/, factions/, timeline.md)
characters/<name>.md
style.md
books/<book>/chapters/<chapter-id>.md
books/<book>/scenes/<scene-id>.md
```

---

## 11. Review checklist (copy into every review)

- [ ] Every unit uses the section 4 template; no empty fields.
- [ ] No banned vague words (section 4).
- [ ] Every unit names real sources.
- [ ] Every acceptance check is pass/fail.
- [ ] Every state or variant is described, not just listed.
- [ ] Behaviour, not framework.
- [ ] Pass 1 and pass 2 kept apart.
- [ ] UNKNOWN items listed with who answers them.
- [ ] The "detailed enough" test (section 5) returned no questions.

---

## 12. Common mistakes

- Speccing the happy path only. Errors, empty states and edge cases are where the clunkiness lives.
- One giant spec per screen or per chapter. Split it to parts and atoms.
- Describing a look with adjectives instead of values.
- Copying a reference app's text or assets instead of describing behaviour.
- Letting the builder invent copy. Every visible word is in the spec.
- Mixing polish into pass 1 and running out of budget before everything works.
- Specs that drift from the code. When behaviour changes, the spec changes in the same pull request.

## Supersedes

Nothing yet (first version).


## Merge gate (every PR, in this order)

1. **Scope guard.** Any changed file outside the ticket's scope (MUTATES/SCOPE) auto-rejects the PR. Post the reason on the ticket.
2. **CI and programmatic checks** are all green.
3. **Formatting** follows the Google official style guide for each language, using Google's formatter or linter where one exists (TypeScript: `gts`).
4. **Jev judge** (`typesafe/jev-1.13` on OpenRouter) scores clean code, formatting, naming and ticket adherence. Each score must be at least 85%. Any massive violation rejects the PR.
5. **CodeRabbit review.** Fallback, only when CodeRabbit can't keep up: Opus only, through Anthropic's official Claude Code GitHub Action on my Claude subscription token, never an API key. No Sol.
6. **Programmatic merge into `integration`.** Never into `main`/`master`.

Agents push branches to GitHub; a GitHub Action opens the PR as Division6066 so CodeRabbit reviews it on Amit's seat.

The merge gate stays off and not required until CodeRabbit has reviewed a factory PR and Amit has approved the gate PRs.

## Graphify loop

Graphify re-runs every loop or two and partly updates the tickets (MUTATES files and dependents) to match the current code.
