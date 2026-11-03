# Mobbin references — patterns only

Gathered 12 Oct 2026 through the Mobbin connector, for the Stage 1 hero screen types. Stage 2 will extend this file to every screen type.

**Rule (anti-slop R-30):** these screens supply layout and interaction patterns only. No logos, wording, illustrations or exact colours are copied. Tempo's palette, type and copy are its own (DESIGN.md).

App collections named in the brief:
- Craft web: https://mobbin.com/apps/craft-web-60382a73-2c26-48e4-b556-c1ba07eb1695/173b47ff-c36e-4b41-a4e6-a2b72a4ddd24/screens
- Claude web: https://mobbin.com/apps/claude-web-6478dfda-4043-439e-8a86-d83354176b49/055a5688-a21e-4f31-ab1f-373a1cffcf30/screens

## Today (daily page) — `screens/web/today.html`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Left page tree with favourites, folders and tags; the current page highlighted as a raised row | [Craft · document with page info](https://mobbin.com/screens/fa4ca26d-e52a-40d9-adfb-12604deaf2ed) | Craft's blue share button, its purple heading colour, its photo cover, Japanese sample content |
| Centred "paper" page floating on a tinted ground, with a title and a meta line under it | [Craft · document with page info](https://mobbin.com/screens/fa4ca26d-e52a-40d9-adfb-12604deaf2ed) | The full-bleed photo backdrop behind the page |
| A "Next up" block that leads the day, then a short list under it | [Tana · daily home](https://mobbin.com/screens/4297e674-95c8-4646-afe9-96cc77cd4635) | Tana's lilac wash, glass on content cards, its capture bar |
| An "Up next" item marked by a solid leading edge in a time list | [Calendly · calendar list](https://mobbin.com/screens/0fcf29aa-9656-4acc-a2e1-0f324b64dd84) | Calendly's colours, meeting-host copy, "Join meeting" style |

## Page editor with slash menu — `screens/web/page-editor.html`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Hover block with an action cluster at its edge; a block menu with Add above / below, Turn into card, Copy link, Delete | [Craft · block actions menu](https://mobbin.com/screens/e38590cb-d496-4a37-84dc-4ff75cf3f77b) | Craft's right-hand Insert / Format / Style inspector (Tempo keeps the page uncluttered) |
| Checklist blocks inline in a document; done items struck through quietly | [Craft · checklist in document](https://mobbin.com/screens/ef3d952b-1c03-40a8-b83b-e79e7166b1df) | The green highlighted section band |
| Table of contents / outline in the rail, text-only rows | [Craft · formatted document](https://mobbin.com/screens/f79ab430-58fa-46a3-82ec-08339a7e5564) | Its emoji-free but colour-coded headings |
| Slash menu: typed "/" on its own line, a grouped list with an icon tile, name and hint, plus a preview of the selected item | [Mintlify · slash insert menu](https://mobbin.com/screens/2ec16753-9c1a-4622-ac4b-f2f656e32f8a) | Mintlify's green brand, docs-specific items, the preview tile (Tempo shows a hint line instead) |
| Editor with an assistant panel beside it | [Microsoft Copilot · page + conversation](https://mobbin.com/screens/e359db96-9980-4d1a-9a75-1ccd8037c328) | Emoji headings, Copilot's disclaimer wording |

## Coach panel with proposal + Undo — `screens/web/coach.html`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Calm serif greeting and a single rounded composer: an attach button on one side, a small send button on the other | [Claude · new chat home](https://mobbin.com/screens/e8c0af18-6e3a-4273-93c1-935e958ff8b3) | The starburst mark, the exact orange send button, the greeting wording, model picker |
| Composer with suggestion chips under it and a voice control | [Claude · home with chips](https://mobbin.com/screens/d72b17b4-df91-4813-8e5d-a04d20041570) | Chip labels and the Claude palette |
| Conversation list rail: plain text rows, "Starred" and "Recents" groups | [Claude · chats list](https://mobbin.com/screens/ef4dc71f-9d6e-4b35-89d7-26c2393c58c0) | Its sidebar items and plan badge |
| An agent's proposed task list in a side panel, with "Requires approval" on items that need a yes | [Cofounder · tasks panel](https://mobbin.com/screens/b4d7cc47-3326-4b98-9ed4-e8963f1a7e8c) | Coloured status pills; Tempo shows the exact change and an explicit Accept / Edit / Reject instead |
| Side panel over a dimmed list, with a single composer at the bottom | [Unify · detail panel](https://mobbin.com/screens/d67b0b3f-4f27-483a-a570-4c9a7c1962de) | Gradient avatar, CRM fields |

## Notes for Stage 2

- Still to search: Craft search / command palette, Craft templates gallery, Craft calendar / daily notes, and Claude projects, artifacts and settings.
- The Craft collection link opened to the editor screens above. Its daily-notes screens weren't returned by search, so the Today page leans on Tana and Calendly for the "Next up" pattern.


---

# Stage 2 — every screen type

Gathered 12 Oct 2026 through the Mobbin connector (`search_screens`, standard mode, limit 4 per query; web unless marked iOS). The same rule applies: **patterns only.** No logos, wording, illustrations or exact colours are copied. Every Tempo screen uses its own tokens, type and copy.

## Chat history list — `ChatHistoryList`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Sessions grouped by time ("Today", "Previous 30 days"); each row is a title plus a one-line preview of the last message | [Dropbox Dash · chat sessions](https://mobbin.com/screens/247852b7-0a20-4293-a9e4-6a65ba8aa828) | The modal-only list. Tempo keeps history in the coach rail and a full page, with a 2-line clamp |
| Search field directly above the history, results filtered in place, with "New chat" as the last row | [Klaviyo · composer chat history search](https://mobbin.com/screens/be790ff7-482b-4ab8-8a3c-f47e2b7321f3) | The dimmed full-screen overlay and the sparkle mark |
| Time at the trailing edge of the title line, last line under it | [Telegram web · chat list](https://mobbin.com/screens/a90e7b59-3143-45fc-bb7c-dfccce452e62) | Avatars, read ticks, blue selection, unread badges |
| Rejected: a data table of chats with credits, model and status columns | [Gumloop · chats table](https://mobbin.com/screens/fe6aa641-eabe-43bf-92fd-3fa5f8803a58) | Too dense for the ADHD brief. No status pills or model names |

## Live voice call — `VoiceCall`

| Pattern taken | Source | Do not copy |
|---|---|---|
| One centred waveform disc, a plain state line ("… is speaking"), and the spoken text written out under it, the current word in ink and the rest muted | [Mindtrip iOS · voice interview](https://mobbin.com/screens/50ce7f51-fcec-4a35-aae3-dc56af5d25d1) | The black disc. Tempo uses level bars plus a large **text** state label, and the transcript is a solid card |
| After the call, the conversation stays in the chat as a "Voice call · 0:45" item with the full text | [Shopify iOS · voice call in chat](https://mobbin.com/screens/120567fb-6ff2-48d7-b809-ae02594c2000) | Thumbs up / down, the sidekick avatar |
| Paired end (×) and mic controls in one pill at the bottom edge | [Tolan iOS · voice call](https://mobbin.com/screens/e3d06f86-9c1d-466e-aeb0-342a2e6ed946) | The 3D character, the rainbow waveform, colour-only End. Tempo's End says "End call" |
| Rejected: a "thinking" line with no state label, and a stop button identified only by colour | [Swiggy iOS · assistant](https://mobbin.com/screens/ab62dd85-0423-460d-9adf-18e6974cbe41) | Dark gradient, pink stop button |

## Settings — `SettingsSection`, `SettingRow`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Sections with a hairline under the heading; each row has the label plus helper on the start side and a switch with an "On" / "Off" word on the end side | [Dropbox Dash · settings](https://mobbin.com/screens/6807d3f6-17b9-4e50-afcc-c3dcf654bf63) | Blue switches. Tempo switches are ink, and the word stays |
| Label + one-line helper, switch aligned to the label's first line | [Square · item settings](https://mobbin.com/screens/0c987573-ae84-4a62-88d3-d5226a46a691) | The black Save pill and the info banner wording |
| Settings card with a title, a description and radio options inside | [Klaviyo · hub extensions](https://mobbin.com/screens/45fe4eb0-3157-443a-90eb-db8baee8ba05) | Per-card Save buttons. Tempo saves each control as it changes, with Undo |
| Rejected: a single Save at the very bottom of a long list | [GetYourGuide · notification prefs](https://mobbin.com/screens/2e8f2084-d2ee-4ac5-9bbe-80af2d9e9e65) | Easy to lose changes, so Tempo does not use a single Save |

## Billing / pricing — `TierCard`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Three tier cards side by side, the current plan marked with a word badge, a feature list with check marks, and the CTA pinned to the bottom of each card | [Replit · compare plans](https://mobbin.com/screens/52c111db-f725-46c6-acaf-b43660e2e0aa) | The blue "recommended" outline, the "Enterprise / Custom" row, and the discount pill wording |
| A trial notice banner above the tiers that names the exact end date | [Calendly · billing](https://mobbin.com/screens/f41143d9-96a6-47a1-b760-8035e1758d86) | "MOST POPULAR" ribbon (Tempo invents no popularity claims), navy buttons |
| Price large, period small beside it, never wrapping | [Recraft · plans](https://mobbin.com/screens/1a768d57-9ccb-49fa-969c-a6e8f53dbdff) | Purple highlight, red ✕ "not included" rows |
| Rejected: tiers inside a dark modal over other content | [Variant · upgrade](https://mobbin.com/screens/3a4a9a85-9888-45d7-a803-aaaa2b316d24) | Billing is a full page and is never hidden |

## Marketing landing — `SiteHeader`, `Hero`, `FeatureRow`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Large editorial headline on the start side, short lede, one primary and one secondary action, "Sign in" as a plain link at the end of the header | [Mintlify · home](https://mobbin.com/screens/b57adf85-2368-4479-9449-a41ae8ccacbe) | The green line art and the traffic-metric chip |
| Feature cards that show the real product UI, not illustrations | [AirOps · intro](https://mobbin.com/screens/747f0c5e-315e-417e-b505-cd6f7ca776cf) | The damask background, the green accent |
| Header with a small link set, a "Log in" link and one filled button | [Klaviyo · home](https://mobbin.com/screens/fa74ead1-ec55-458d-bda4-a79bc3ac49fd) | The logo wall and its claim strip. Tempo shows no customer logos or invented numbers |
| Rejected: "Join 20 million…" social-proof claims and a logo wall | [Calendly · home](https://mobbin.com/screens/5c90bdb0-4b1c-4c4c-adb3-1a63581d6ed1) | Invented metrics are banned |

## Sign-in / magic link — `AuthCard`, `StatusPanel`

| Pattern taken | Source | Do not copy |
|---|---|---|
| A small centred card on a tinted ground: brand, title, one email field, one Continue button, "Go back" under it | [Descript · email sign-in](https://mobbin.com/screens/8c480ea3-da6b-4dae-abd8-33caba4aef56) | The maroon button and the wording |
| "Check your email" panel: an icon in a circle, the address in bold, a two-item checklist ("click the link", "check spam"), and "Didn't get it? Resend in 29s" | [MagicPath · magic link sent](https://mobbin.com/screens/3c996257-c47d-4179-a89c-3ccb06f4bbdf) | The green brand and the spinner. Tempo states "Waiting…" as text |
| "Update email" link right next to the shown address | [Klaviyo · check your email](https://mobbin.com/screens/b46d1b54-cc15-4d9c-96e9-5875a059b78d) | The envelope illustration (Tempo is illustration-free) and "Open in Gmail" |
| A language picker even on the bare verify page | [Calendly · verify email](https://mobbin.com/screens/18ad2c07-c927-45ab-abb9-9647ad1dc688) | The co-branded logos and the dense one-line copy |

## Kanban — `Kanban`, `KanbanCard`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Neutral columns with a count next to each name, plain cards, and a "No tasks" line in empty columns | [Replit · task board](https://mobbin.com/screens/a963ed7f-3009-4a76-b719-61240866563a) | The grey-on-grey low contrast |
| "View as Board / List" switch and a sort control above the board | [Square · projects board](https://mobbin.com/screens/8d75c04b-1d38-4fd8-8340-de79ce82ef47) | Chat-bubble icons on cards, the black Create button |
| "+ New" at the foot of each column | [Buffer · ideas board](https://mobbin.com/screens/ce57e680-83b0-4808-9a98-10bf5fc89490) | Photo thumbnails, coloured tag pills, emoji |
| A "Not now" column that sits apart from the work, without shame | [Basecamp · card table](https://mobbin.com/screens/b18256ff-3f6b-4868-b30b-1c89d522c3d7) | Purple/orange column tops. Drag-only movement: Tempo adds Move buttons on every card |

## Calendar month — `MonthGrid`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Hairline grid, the day number at the top-start of each cell, and the outside-month days on a quieter ground | [Sweatpals · schedule](https://mobbin.com/screens/f2ecf33a-f83c-408d-82a7-a8f6fb07a039) | The pink header wash |
| "Today" button and a month / week view switch beside the title | [Buffer · calendar](https://mobbin.com/screens/928fae6d-fd96-41ec-a99f-fe9968427faa) | Full event chips in month cells. Tempo shows dots + a count + "3 items" |
| Times inside a day cell set in a tabular face | [Calendly · availability](https://mobbin.com/screens/260f2a45-9d33-4b9b-a17e-dcdadaf6fca3) | The blue current-day bar |
| Rejected: the today column flooded with colour and events in colour-only chips | [Basecamp · calendar](https://mobbin.com/screens/deeda743-486b-4122-8bec-d7fd4063f37a) | Colour as the only signal |

## Habits — `HabitBlock`

| Pattern taken | Source | Do not copy |
|---|---|---|
| A 7-day strip of day letters + dates above the list; one round control per habit | [Insight Timer iOS · daily habits](https://mobbin.com/screens/2a0e04e5-eca9-40de-9d32-619539174579) | The "0 / 3 complete" score headline and the teal brand |
| A plain list with a single tick per row and a "Create your own" dashed row | [Jomo iOS · all habits](https://mobbin.com/screens/5b761cc8-74ee-45d1-97a9-9955538343dc) | Emoji per habit |
| Rejected: "6 day streak" hero, a lightning bolt, and "I'm committed" | [Noom iOS · streak](https://mobbin.com/screens/233c6ea9-6339-4b3e-9fb4-faaaa2451adb) | **Streak counters are banned** (F-10; HARD_RULES "streak broken"). Tempo shows only the last 7 days as dots with labels |
| Rejected: a "Score! / You did it!" celebration card | [Lifesum iOS · trackers](https://mobbin.com/screens/0d8ee219-4985-4bfd-85c2-dab08d6809f9) | Gamification and pressure |

## Onboarding — bare layout, 5 steps

| Pattern taken | Source | Do not copy |
|---|---|---|
| One question per screen, a segmented progress bar at the top, big tappable option rows each with an icon, and "Not sure" as an equal option | [Insight Timer iOS · practice time](https://mobbin.com/screens/07e9dfdd-a34a-4618-b8e4-e45b9f651936) | The teal bar, the chat-bubble question style |
| Back and Next pinned at the bottom; Next stays quiet until an answer is chosen | [Blue Apron iOS · frequency](https://mobbin.com/screens/abae8f67-deed-43a5-b14b-12094e2fdac1) | The blue option text |
| A "Skip" link always visible in the header | [Pool iOS · onboarding](https://mobbin.com/screens/f433b006-ec7a-4191-a71c-f187b056cf23) | The big glossy blue button |
| Rejected: multi-select checkboxes with product illustrations | [Lemonade iOS · onboarding](https://mobbin.com/screens/753f9758-1ef9-4885-8117-7087bdf293e0) | Illustrations; insurance copy |

## Mobile tab-bar app home — `MobileTopBar`, `TabBar`

| Pattern taken | Source | Do not copy |
|---|---|---|
| Greeting at the top, one dismissible notice, then the day's single most important card, all above a floating tab bar | [Future iOS · home](https://mobbin.com/screens/2b5839c4-0519-4df7-9341-bd7fd3a0f60b) | The photo card, the friends tab and unread badge counts |
| Composer ("Tell me your plans…") with mic sitting just above the tab bar | [Structured iOS · AI home](https://mobbin.com/screens/80ba4e62-5243-40b6-b54f-77bbd662f898) | The pink brand and the floating "+" accent |
| A coach plan summary paragraph followed by "Ask Coach" as a floating button | [Google Health iOS · coach plan](https://mobbin.com/screens/429ca403-6d7e-4764-bf82-9dfdf5e3b254) | The light-blue wash and the "Premium" badge in the header |
| Rejected: a calorie bar, points and a coin counter in the header | [Noom iOS · today](https://mobbin.com/screens/726a894d-7bbb-4269-9e97-3007507cd4e4) | Gamification counters |

## Connector notes (Stage 2)

- All 11 searches returned results. No connector failures.
- Platform choice: web for chat history, settings, billing, landing, sign-in, kanban and calendar; iOS for voice call, habits, onboarding and mobile home.
- Screens marked "Rejected" are kept on purpose as **anti-patterns** that Tempo's rules forbid: streaks, colour-only status, invented metrics, a single Save, and drag-only movement.
