# Tempo v3 — Component catalogue

Stage 1 (locked) + Stage 2 (Build Package P0-foundation, 12 Oct 2026).

Every component lives in `tempo.css`. Behaviour lives in `tempo.js`, exposed as `window.TP.*` or triggered by a `data-action`. Screens add **layout only**. A screen never sets its own colours, type, spacing or radius. If it needs one, add a component here first.

**How to read the table**
- **Class:** the CSS hook.
- **`data-component`:** the React component name the class becomes.
- **shadcn:** the primitive it is built on (Tailwind v4, tokens mapped 1:1 per DESIGN.md §9).
- **Events / actions:** the `data-action` value that `tempo.js` handles, and the real backend call it stands for.

Rules that apply to every row:
- Use only `var(--tp-*)` tokens.
- Use logical properties.
- Glass goes only on floating chrome.
- Accent goes on one primary action per screen, plus the focus ring.
- Motion is 250 ms or less, using transform or opacity only.
- Text is at least 13 px.
- Never use colour alone.

---

## 1. Stage 1 components (locked)

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| TempoShell | `.tp-app` | TempoShell | sidebar (SidebarProvider) | `coach: open?`, `rail: open?` | `toggle-rail`, `scrim` | Grid areas rail / top / main / coach |
| Sidebar / PageTree | `.tp-rail`, `.tp-tree`, `.tp-tree-item` | Sidebar, PageTree | sidebar + collapsible | `pages[]`, `current` | link | `aria-current="page"` |
| CommandTrigger | `.tp-rail__search` | CommandTrigger | command in dialog | — | Ctrl K | |
| Topbar | `.tp-topbar.tp-glass` | Topbar | breadcrumb | `crumbs[]` | `toggle-theme`, `toggle-rail` | Glass |
| Avatar | `.tp-avatar` | Avatar | avatar | `initials`, `name` | — | Never "User" |
| TabBar | `.tp-tabbar.tp-glass`, `.tp-tab` | TabBar | tabs (nav) | `tabs[]`, `current` | link | Under 768 only; `data-count="4"` variant (Stage 2) |
| Page / PageEditor | `.tp-paper`, `.tp-page__body`, `.tp-page-content` | Page | — | `page` | — | The Markdown document |
| PageCover / PageIcon / PageMeta | `.tp-page-cover`, `.tp-page-icon`, `.tp-page-meta` | PageCover, PageIcon, PageMeta | — | `icon`, `tags`, `template` | — | |
| PageTitle | `.tp-page-title` | PageTitle | — | `title` | — | Serif 38 px |
| Headings | `.tp-h2`, `.tp-h3` | — | — | — | — | |
| Tag | `.tp-tag` | Tag | badge | `name` | link | Inline `#tag` |
| Wikilink | `.tp-wikilink` | Wikilink | command in popover | `page` | link | `[[page]]` |
| Chip | `.tp-chip`, `--fixed`, `--flex`, `--done` | Chip | badge | `tone`, `label` | — | Word always present |
| Button | `.tp-btn--primary / --secondary / --ghost / --danger-ghost / --icon / --sm` | Button | button | `variant`, `size` | — | Primary once per screen |
| Kbd | `.tp-kbd` | Kbd | — | `keys` | — | |
| Card | `.tp-card`, `__head`, `__title` | Card | card | — | — | Quiet inline block card |
| BlockHandle | `.tp-block`, `.tp-block__handle` | BlockHandle | dropdown-menu | — | add / options | Buttons, never drag-only |
| SlashMenu / SlashCommand | `.tp-slash-menu.tp-glass`, `.tp-slash-item` | SlashMenu | command in popover | `items[]` | arrows, Enter, Esc | listbox |
| NextUpCard | `.tp-nextup` | NextUpCard | card | `task`, `why` | Start / Not now / Make it smaller | The one primary |
| TaskBlock / TaskRow | `.tp-block-task`, `.tp-task-row`, `.tp-check` | TaskBlock, TaskRow | checkbox + collapsible | `task {id,title,minutes,done}` | `check` → `tasks.complete({id})` | Optimistic |
| EnergyBlock / Dial | `.tp-block-energy`, `.tp-seg`, `.tp-seg__opt` | EnergyBlock, Dial | toggle-group (single) | `value: quiet/steady/push` | role=radio + arrows | RTL swaps arrows |
| TimeBlock / TimeBlockRow | `.tp-block-time`, `.tp-time-row[data-kind]` | TimeBlock | custom | `kind: fixed/flex` | — | Solid + "Fixed" / dashed + "Flexible" |
| Backlinks | `.tp-backlinks`, `.tp-backlink` | Backlinks | card list | `links[]` | link | "Linked here" |
| CoachButton | `.tp-coach-fab.tp-glass` | CoachButton | button + sheet trigger | — | `open-coach` (Ctrl J) | |
| CoachPanel | `.tp-coach-panel.tp-glass` | CoachPanel | sheet | — | `close-coach`, Esc | Docked ≥1280 |
| CoachMessage / UserMessage | `.tp-msg`, `.tp-msg--user` | CoachMessage | scroll-area | `who`, `text` | — | ReadAloud per message (Stage 2) |
| ProposalCard | `.tp-proposal` | ProposalCard | card + button ×3 | `changes[]` | `accept` / `edit` / `reject` | Exact preview |
| ChangePreview | `.tp-change[data-op]` | ChangePreview | — | `op: add/move/remove` | — | Word + icon |
| Composer | `.tp-composer` | Composer | textarea + button | — | send | Send is ink, not accent |
| UndoToast | `.tp-toast.tp-glass` | UndoToast | sonner | `title`, countdown | `undo`, `dismiss-toast` | 5:00 |
| Skeleton | `.tp-skeleton` | Skeleton | skeleton | — | — | Shimmer stops with reduced motion |
| Empty | `.tp-empty` | Empty | — | — | — | Kind copy + next step |
| Glass | `.tp-glass` | — | — | — | — | Floating chrome only |
| Helpers | `.tp-num`, `.tp-mono`, `.tp-muted`, `.tp-small`, `.tp-eyebrow`, `.tp-sr-only`, `.tp-skip`, `.tp-icon--flip` | — | — | — | — | |

## 2. Stage 2 components

### 2.1 Layout helpers

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| PageLayout | `.tp-page`, `--wide`, `--narrow` | PageLayout | — | `width` | — | Inside `.tp-app__main` for non-document screens |
| Surface | `.tp-surface` | Surface | card | — | — | Solid paper panel |
| PageHeader | `.tp-pagehead`, `__text`, `__title`, `__sub`, `__actions` | PageHeader | — | `title`, `subtitle`, `actions[]` | — | One H1 per screen |
| Toolbar | `.tp-toolbar`, `__grow`, `__end` | Toolbar | — | children | — | Search + filter + sort |
| Split | `.tp-split`, `--even`, `--list` | Split | resizable (optional) | `variant` | — | One column under 1024 |
| Section | `.tp-section`, `__head`, `__title`, `__count` | Section | — | `title`, `count` | — | |
| CardGrid | `.tp-cards`, `--sm` | CardGrid | — | `size` | — | auto-fill |
| Notice | `.tp-notice[data-tone]`, `__icon`, `__text`, `__title`, `__action` | Notice | alert | `tone`, `title`, `body` | — | Icon + words, never colour alone |
| Badge | `.tp-badge[data-tone]` | Badge | badge | `label`, `icon`, `tone` | — | "Built-in", "Your plan" |
| Button variants | `.tp-btn--danger`, `--block`, `--link` | Button | button | — | — | End call, guest, inline link |
| Icon sizes | `svg.tp-icon--lg` (24), `--xl` (32), `.tp-icon--back` | — | — | — | — | `--back` = back chevron, RTL-aware |
| Utilities | `.tp-ltr`, `.tp-subtle`, `.tp-xs`, `.tp-strong` | — | — | — | — | `.tp-ltr` for schedules and emails in RTL |

### 2.2 Blocks rendered in pages

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| EventBlock | `.tp-block-event`, `.tp-event[data-kind]`, `__time`, `__body`, `__title`, `__meta`, `__place` | EventBlock | card | `event {id,title,start,end,place?,kind}` | — | Fixed = solid edge + "Fixed"; flexible = dashed + "Flexible" |
| HabitBlock | `.tp-block-habit`, `.tp-habit[data-logged]`, `__log`, `.tp-habit-days`, `.tp-habit-day[data-done][data-today]`, `__dot`, `__label` | HabitBlock | card + toggle | `habit {id,name,when,last7[],loggedToday}` | `habit-log` → `habits.log({habitId,date})` | **No streak counter.** Missed day = empty ring. Each day has sr text "logged" / "not logged" |
| NagBlock | `.tp-block-nag`, `.tp-nag[data-status]`, `__label`, `__phrase`, `__meta`, `__actions`, `__note` | NagBlock | card (+ alert-dialog) | `nag {id,phrase,about,at}` | `nag` + `data-choice="now / snooze / nottoday"` → `nags.respond` | The user's own words only. No icon, no emoji, no stock copy |
| TemplateBlock | `.tp-block-template`, `.tp-template-offer[data-status]`, `__icon`, `__title`, `__desc`, `__adds`, `__actions`, `__note` | TemplateBlock | card + button | `template {id,name,adds[]}` | `template-use` → `templates.apply`; `template-dismiss` | One primary; Undo toast on use |
| PageMetaBlock | `.tp-block-meta` | PageMetaBlock | — | `meta {template,tags,pageType}` | — | **Renders nothing.** `display:none !important` plus `aria-hidden="true"` |
| BrokenBlock | `.tp-block-broken`, `__text`, `__action` | BrokenBlock | alert | `blockId`, `canUndo` | `broken-undo` → `pages.revertBlock` | "This part has a problem." Never shows JSON |
| CoachArtifact | `.tp-artifact`, `__head`, `__kind`, `__title`, `__by`, `__body`, `__foot` | CoachArtifact | card | `kind`, `title` | — | Wrapper for the four artifacts below; saved as a block |
| Flashcard | `.tp-flashcard[data-side]`, `__face[data-face]`, `__side`, `__text`, `__count` | Flashcard | card + button | `cards[{front,back}]`, `index` | `card-flip`, `card-step` + `data-dir` | Flip by **button**, never hover. Optional `<script type="application/json" data-deck>` for demo cards |
| Quiz | `.tp-quiz[data-checked]` (fieldset), `__q` (legend), `.tp-choice[data-correct]`, `.tp-quiz__mark`, `.tp-quiz__feedback[data-result]` | Quiz | radio-group + button | `question`, `options[{id,text,correct}]` | `quiz-check` → `quizzes.answer` | Feedback = icon + "Right." / "Not quite. The answer is: …" |
| Checklist | `.tp-checklist`, `__item[data-done]`, `__text`, `__count` + `.tp-checkbox` | Checklist | checkbox | `items[]` | change → `pages.updateBlock` | "2 of 5 done" |
| Tracker | `.tp-tracker`, `__label`, `__name`, `__goal`, `__controls`, `__value` | Tracker | button | `label`, `value`, `goal`, `unit` | `tracker` + `data-dir="inc / dec"` → `trackers.log` | Announces the new value |

### 2.3 Page types

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| PageHead | `.tp-page-head[data-variant="daily / weekly / project / note"]`, `__row`, `__actions` | PageHead | — | `variant`, `title`, `meta` | — | Wraps `.tp-page-title` + `.tp-page-meta` |
| WeekStrip | `.tp-week-strip`, `__day[aria-pressed][aria-current="date"]`, `__dow`, `__n`, `__count` | WeekStrip | toggle-group | `days[]` | `select-day` → `pages.getDaily({date})` | Weekly page head |
| ProjectStatus | `.tp-status[data-status="idea / active / paused / done"]` | ProjectStatus | badge | `status`, `label` | — | Icon + word |
| TemplatePicker | `.tp-template-picker`, `.tp-template-option[role=radio][aria-checked]`, `__icon`, `__name`, `__desc`, `__check` | TemplatePicker | radio-group (cards) | `templates[]` | role=radio (Stage 1 handler) → `pages.create({templateId})` | On a new empty page; includes "Blank page" |

### 2.4 Lists

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| ListRow | `.tp-list`, `.tp-list-row`, `__icon`, `__body`, `__title`, `__meta`, `__end` | ListRow | — | `icon`, `title`, `meta`, `href` | link / button | At least 56 px tall |
| Segmented / Filter | `.tp-segmented`, `--block` + `.tp-seg__opt[role=radio]` | Segmented | toggle-group / tabs | `options[]`, `value` | role=radio (Stage 1) | Dot + word mark the choice |
| SearchInput | `.tp-search`, `__box`, `__icon` + `.tp-label` + `.tp-input` | SearchInput | input (+ command) | `label`, `placeholder` | input | Label always present (visible or `.tp-sr-only`) |
| SortMenu | `.tp-menu`, `__list.tp-glass[role=menu]`, `__label`, `__item[role=menuitemradio]`, `__check`, `[data-menu-value]` | SortMenu | dropdown-menu (radio) | `options[]`, `value` | `menu` (button), choose item → `TP.onSort(value)` | Arrows, Esc, focus return |
| LoadMore | `.tp-load-more`, `__status`; rows `[data-row]`, hidden rows `[data-more][hidden]` | LoadMore | button | `shown`, `total` | `load-more` (`data-step`, `data-total`) → `usePaginatedQuery().loadMore` | "Showing 20 of 48" |

### 2.5 Calendar

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| MonthGrid | `.tp-month`, `__head`, `__title`, `__grid`, `__dow`, `__day[data-outside][aria-current][aria-pressed]`, `__n`, `__dots`, `__count` | MonthGrid | calendar (base) | `days[]` | `select-day` | Dots + number + "3 items" text; the count text is sr-only under 768 |
| Dot | `.tp-dot`, `--fixed`, `--flex`, `--done`, `--habit` | Dot | — | `kind` | — | Decorative; shapes differ (filled vs ring) |
| WeekColumns | `.tp-week`, `__col[aria-current]`, `__head`, `__item[data-kind]`, `__time`, `__title`, `__kind` | WeekColumns | — | `days[]` | — | Scrolls sideways inside itself only |
| DayTimeline | `.tp-timeline`, `__hours`, `__hour`, `__items` (`--cols`), `__item[data-kind]` (`--row`, `--span`, `--col`), `__time`, `__title`, `__now` | DayTimeline | custom | `items[]`, `now` | — | Solid + "Fixed" / dashed + "Flexible". Rows are half-hour slots |

### 2.6 Kanban

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| Kanban | `.tp-kanban`, `__col`, `__head`, `__name`, `__count`, `__list`, `__empty` | Kanban | card | `columns[]` | — | Snap-scrolls on phone |
| KanbanCard | `.tp-kanban-card`, `__title`, `__meta`, `__move` | KanbanCard | card + button | `card` | `kanban-move` + `data-dir="prev / next"` → `tasks.moveColumn` | **Move buttons on every card**; drag is optional; edge buttons disabled; icons `.tp-icon--flip` |

### 2.7 Charts

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| BarChart | `.tp-chart` (figure), `__title`, `__bars`, `__bar[data-highlight]` (`--pct`), `__value`, `__track`, `__fill`, `__label` | BarChart | chart | `bars[{label,value,pct}]` | — | Every bar has a number and a label |
| LineChart | `svg.tp-chart__svg` with `.tp-chart__axis`, `__grid`, `__line`, `__point`, `<text>` | LineChart | chart | `points[]` | — | Points labelled in the SVG; give the svg `role="img"` + `aria-labelledby` the summary |
| ChartSummary | `.tp-chart__summary` (figcaption) | ChartSummary | — | `text` | — | **Required.** The chart in one sentence |

### 2.8 Forms

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| Form | `.tp-form`, `__actions` | Form | form | — | submit | Width up to 68ch |
| Field | `.tp-field` (+ `.od-field`), `.tp-label`, `.tp-label__opt`, `.tp-help`, `.tp-error-text` | Field | form item | `id`, `label`, `help`, `error` | — | `aria-describedby="x-help x-error"`, `aria-invalid="true"` |
| TextInput | `.tp-input` | TextInput | input | `type`, `value` | — | Emails: `dir="ltr"` |
| Textarea | `.tp-textarea` | Textarea | textarea | `rows` | — | `dir="auto"` |
| Select | `.tp-select` > `select.tp-select__input` + `.tp-select__icon` | Select | select | `options[]` | change | |
| Switch | `button.tp-switch[role=switch][aria-checked]`, `__track`, `__thumb`, `__state` | Switch | switch | `checked` | click → `TP.onSwitch(el,on)` | Visible "On" / "Off" word |
| Checkbox | `input.tp-checkbox` inside `label.tp-choice` (`__text`, `__hint`) | Checkbox | checkbox | `checked`, `label` | change | |
| Radio | `input.tp-radio` inside `label.tp-choice` | Radio | radio-group | `name`, `value` | change | |
| Dial 0–10 | `.tp-dial`, `__head`, `__value`, `__num [data-dial-num]`, `__of`, `__word [data-dial-word]`, `__scale` + `input.tp-slider` | Dial | slider | `value`, `label` | input → `profiles.setCoachDial` | Number **and** word: quiet 0–3, steady 4–7, push 8–10 |
| FormErrorSummary | `.tp-error-summary[role=alert][tabindex=-1]`, `__title` | FormErrorSummary | alert | `errors[]` | — | Links jump to fields |

### 2.9 Settings

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| SettingsSection | `.tp-settings-section`, `__head`, `__title`, `__desc` | SettingsSection | card | `title`, `rows[]` | — | |
| SettingRow | `.tp-setting-row` (+ `.od-row`), `__text`, `__label`, `__control`, `--stack`, `[data-tone=danger]` | SettingRow | — + control | `label`, `help`, `control` | — | Label + helper at the start, control at the end |

### 2.10 Coach

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| ChatHistoryList | `.tp-chat-list`, `.tp-chat-group`, `.tp-chat-row[aria-current]`, `__title`, `__time`, `__last` | ChatHistoryList | sidebar menu / scroll-area | `threads[]` | link → `coach.listThreads` / open | Last line clamps to 2 lines; time `.tp-num` |
| ChatSearch | `.tp-search` above `.tp-chat-list` | ChatSearch | input + command | `query` | input → `coach.searchThreads` | |
| CoachDial | `.tp-dial` in `.tp-card` | CoachDial | slider | `value 0–10` | → `profiles.setCoachDial` | |
| PanicButton | `.tp-panic` | PanicButton | button | `label` | `panic` (+ `aria-controls`) | No model call |
| GroundingCard | `.tp-grounding`, `__title`, `__body`, `.tp-breath[data-phase]`, `__track`, `__line`, `__label`, `.tp-grounding__action`, `[data-grounding-done]` | GroundingCard | card | `action {text,seconds:10}` | `grounding-done` | Steps every 4 s, each transition at most 240 ms; the **word** carries meaning |
| CrisisCard | `.tp-crisis`, `__title`, `__body`, `__list`, `__item`, `__item-text`, `__name`, `__detail`, `__note` | CrisisCard | card | `resources[]` | `tel:` links | **Fixed text written by people**; coaching stops; no animation |
| ProposalCard variants | `.tp-proposal[data-kind="template / module / job"]`, `.tp-proposal__kind`, `.tp-proposal__what` (`dl` of `.tp-what-row`) | ProposalCard | card + button ×3 | `kind`, `what[]` | Stage 1 `accept` / `edit` / `reject` | Kind = icon + word |
| TypingIndicator | `.tp-typing[role=status]`, `__dots` | TypingIndicator | — | `label` | — | Text carries meaning; dots pulse only without reduced motion |
| ReadAloudButton | `.tp-btn.tp-btn--ghost.tp-btn--sm.tp-readaloud[aria-pressed]` + `[data-label]` | ReadAloudButton | toggle | `text` | `read-aloud` → `voice.speak` | Volume / pause icon swap |

### 2.11 Live voice call (feature #1)

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| VoiceCall | `.tp-call[data-state][data-ended]` (+ `.tp-glass` allowed), `__top`, `__title`, `__stage`, `__state`, `__hint`, `__dock` | VoiceCall | dialog (full screen) | `state`, `lang`, `minutesLeft` | `open-call` → `voice.startSession`; Esc pauses | `role="dialog" aria-modal="true"`; `.tp-call__state` is `aria-live` |
| AudioLevel | `.tp-level` > `.tp-level__bar` (`--level`) | AudioLevel | — | `levels[]` | — | `aria-hidden`; static under reduced motion |
| LiveTranscript | `ol.tp-call__transcript[aria-live=polite]`, `.tp-call-line[data-who][data-live]`, `__who`, `__text` | LiveTranscript | scroll-area | `lines[]` | ReadAloud per line | Solid paper (content) |
| MicToggle | `.tp-call__micwrap`, `button.tp-call__mic[aria-pressed]`, `.tp-call__mic-label` | MicToggle | toggle | `pressed` | `call-mic` | **The one accent** on the call screen |
| Interrupt | `.tp-btn--secondary[data-action=call-interrupt]` (hand icon) | Interrupt | button | — | `call-interrupt` → `session.interrupt()` | Enabled only while the coach speaks |
| EndCall | `.tp-btn--danger[data-action=call-end]` (phone-off icon) | EndCall | button | — | `call-end` → `voice.endSession`; then `call-close` | Word "End call" |
| PushToTalk | `button.tp-ptt[data-pressed]` + `[data-label]` | PushToTalk | button | — | pointer hold, or Space / Enter hold | Walkie-talkie, every tier |
| CallMinutes | `.tp-call__minutes[data-low]` | CallMinutes | badge | `minutesLeft` | — | Clock icon + "12 minutes left today" |
| CallActionConfirm | `.tp-call-action[data-undone]`, `__icon`, `__text` | CallActionConfirm | sonner (inline) | `text` | `call-undo` → `tasks.remove` | "Added 'call the bank' to Today · Undo" |
| LanguageChip | `button.tp-lang-chip[data-lang]`, `[data-lang-current]`, `__other` | LanguageChip | toggle / select | `lang` | `call-lang` → `voice.setLanguage` | Each name carries its own `lang` |

### 2.12 Memory

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| MemoryItem | `.tp-memory-list`, `.tp-memory-row`, `__fact`, `__source`, `__action` | MemoryItem | — + button | `memory {id,fact,source,when}` | `memory-forget` → `memory.forget` + Undo toast | Forget = `.tp-btn--danger-ghost` |
| ImportReview | `.tp-import-list`, `.tp-import-row[data-choice]`, `__text`, `__bar`, `__note` + `.tp-segmented` keep / edit / drop, `[data-import-count]` | ImportReview | toggle-group per row | `items[]` | role=radio `data-value` → `memory.importReview` on Save | Nothing is saved until Save |
| ExportArea | `.tp-export`, `__text`, `__title`, `__note` | ExportArea | card + button | `format` | `memory-export` → `memory.exportMarkdown` | |

### 2.13 Modules

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| ModuleCard | `.tp-module-card[data-on][data-builtin]`, `__icon`, `__name`, `__does`, `__meta`, `__switch` | ModuleCard | card + switch + badge | `module` | switch → `modules.setEnabled` | Built-in badge: lock icon + "Built-in" (can turn off, not delete) |
| ModuleSummary | `.tp-module-what`, `__title`, `dl` > `.tp-what-row` | ModuleSummary | card | `shapes`, `adds`, `changes` | — | "What this module does" |
| PlainModeBanner | `.tp-notice[data-tone=info].tp-plain-banner` | PlainModeBanner | alert | `on` | switch `[data-plain-mode]` → `modules.setPlainMode` | Sets `html[data-plain]` |
| ScheduledJobRow | `.tp-job-list`, `.tp-job-row[data-on]`, `__name`, `__schedule`, `__last`, `__switch` | ScheduledJobRow | — + switch | `job` | switch → `jobs.setEnabled` | Schedule in mono and LTR: `Mon–Fri 08:00` |

### 2.14 Billing

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| TierCard | `.tp-tiers`, `.tp-tier[data-current]`, `__head`, `__name`, `__desc`, `__price.od-nowrap`, `__amount`, `__per`, `__features`, `__cta` | TierCard | card | `tier` | choose → `billing.checkout({tier})` (Polar) | **Never hidden or collapsed**; stacks on phone |
| BillingNotice | `.tp-notice` | BillingNotice | alert | `tone`, `text` | — | Trial / conversion dates |

### 2.15 Auth

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| AuthCard | `.tp-auth`, `.tp-auth-card`, `__brand`, `__title`, `__lede`, `__foot` | AuthCard | card + form | — | submit → `auth.sendMagicLink({email})` | Bare layout, no shell |
| EmailField | `.tp-field` + `input.tp-input[type=email][autocomplete=email][dir=ltr]` | EmailField | input | — | — | |
| GuestButton | `.tp-btn.tp-btn--secondary.tp-btn--block` | GuestButton | button | — | → `auth.continueAsGuest` | Secondary, never accent |
| DividerText | `.tp-divider-text` | DividerText | separator | `label` | — | "or" |
| StatusPanel | `.tp-status-panel[data-tone]`, `__icon`, `__title`, `__body`, `__meta`, `__actions` | StatusPanel | card | `tone`, `title`, `body` | resend / back | Link sent / approval pending; no illustration |

### 2.16 Marketing (solid, editorial, no invented metrics)

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| Container | `.tp-container` | Container | — | — | — | 1120 max |
| SiteHeader | `.tp-site-header`, `__inner`, `__brand`, `.tp-site-nav`, `.tp-site-link[aria-current]`, `.tp-site-link--wide` | SiteHeader | navigation-menu | `links[]` | — | Solid, not glass; "Sign in" link |
| Hero | `.tp-hero`, `__title`, `__lede`, `__actions`, `__note` (+ `.tp-eyebrow`) | Hero | — | `title`, `lede` | — | One primary |
| FeatureRow | `.tp-feature`, `--flip`, `__text`, `__title`, `__body`, `__figure` | FeatureRow | — | `figure` | — | Figure uses real Tempo components |
| HowItWorks | `ol.tp-steps`, `.tp-step`, `__num`, `__title`, `__body` | HowItWorks | — | `steps[]` | — | |
| Quote | `figure.tp-quote` > `blockquote` + `figcaption` | Quote | — | `text`, `by` | — | Fictional people only |
| Pricing | `.tp-tiers` | TierCard | card | — | — | Same as billing |
| FAQ | `.tp-faq` > `details` > `summary` + `.tp-faq__icon` + `.tp-faq__answer` | FAQ | accordion | `items[]` | native | No JS |
| SiteFooter | `.tp-site-footer`, `__inner`, `__links`, `__small` | SiteFooter | — | — | — | |
| LanguageSwitch | `.tp-lang-switch` > `a[hreflang][lang][aria-current]` | LanguageSwitch | toggle-group | `current` | link `?lang=` | English / עברית |

### 2.17 Mobile shell

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| MobileTopBar | `.tp-mtopbar.tp-glass`, `__title`, `__spacer` | MobileTopBar | — | `title`, `back` | back link (`.tp-icon--back`) | |
| MobileTabBar | `.tp-tabbar.tp-glass[data-count]` | TabBar | tabs | — | — | Stage 1, reused |
| MobileSheet | `.tp-sheet.tp-glass[role=dialog][aria-labelledby][hidden]`, `__grabber`, `__head`, `__title`, `__body`, `__foot`, `.tp-sheet-scrim[data-for]` | MobileSheet | sheet (bottom) / drawer | `id`, `title` | `open-sheet` (`aria-controls`), `close-sheet`, Esc, Tab trap | Focus returns to the opener; centred dialog at 768 and up |
| TouchRow | `.tp-touch-row`, `__icon`, `__label`, `__value`, `__chev` | TouchRow | — | `label`, `value`, `href` | link | At least 56 px; chevron `.tp-icon--flip` |

### 2.18 States

| Name | Class | data-component | shadcn | Props | Events / actions | Notes |
|---|---|---|---|---|---|---|
| StateEmpty | `.tp-state.tp-state--empty`, `__icon`, `__title`, `__body`, `__actions` | StateEmpty | — | `title`, `body`, `action` | — | Kind copy + a next step |
| StateLoading | `.tp-state--loading[role=status]`, `.tp-skel-list`, `.tp-skel-row`, `__box`, `__lines`, `.tp-skeleton--w40 / w60 / w80 / w100 / sm / block` | StateLoading | skeleton | `rows` | — | Plus a `.tp-sr-only` "Loading your tasks" |
| StateError | `.tp-state.tp-state--error` | StateError | alert | `what` | `retry` → refetch | "Couldn't load your tasks. Your data is safe." + Retry |
| StateOffline | `.tp-notice[data-tone=caution].tp-offline[role=status]` | StateOffline | alert | `text` | — | "You're offline. Changes save when you're back." Content stays |
| StateSwitch | `[data-state-show]`, `[data-state-hide]` | — | — | `html[data-state]` | `TP.setState(s)` | See §4 |

---

## 3. Behaviour reference (`tempo.js`)

**Stage 1 API, unchanged:**
- `TP.icon`, `TP.t`
- `TP.setTheme`, `TP.setDyslexia`
- `TP.openCoach`, `TP.closeCoach`
- `TP.acceptProposal`, `TP.rejectProposal`, `TP.editProposal`
- hooks `TP.onReady`, `TP.onAccept`, `TP.onUndo`

**Stage 2 additions:**

| API / data-action | Component | REAL backend call it stands for | State it changes |
|---|---|---|---|
| `TP.setState(s)` · `?state=` | StateSwitch | from the query result | `html[data-state]`, `aria-busy` |
| `TP.toast({title, sub, undoMs, onUndo})` | UndoToast | sonner + a restore mutation | one toast, 5:00 countdown |
| switch click · `TP.onSwitch(el,on)` | Switch | `profiles.updatePrefs` / `modules.setEnabled` / `jobs.setEnabled` | `aria-checked`, On / Off word, `data-on` |
| `[data-plain-mode]` switch · `?plain=on` | PlainModeBanner | `modules.setPlainMode({on})` | `html[data-plain]`, banner, user switches `aria-disabled` |
| `card-flip`, `card-step` | Flashcard | `studyCards.review` (later) | `data-side`, `aria-pressed`, counter |
| `quiz-check` | Quiz | `quizzes.answer` | `data-checked`, feedback `data-result` |
| change on `.tp-checklist .tp-checkbox` | Checklist | `pages.updateBlock` | `data-done`, count text |
| `tracker` + `data-dir` | Tracker | `trackers.log({delta})` | value text |
| `habit-log` | HabitBlock | `habits.log({habitId,date})` | `data-logged`, today's dot |
| `nag` + `data-choice` | NagBlock | `nags.respond` | `data-status`, note |
| `template-use`, `template-dismiss` | TemplateBlock | `templates.apply` / `templates.dismissOffer` | `data-status`, note, toast |
| `broken-undo` | BrokenBlock | `pages.revertBlock` | replaced with "Restored…" |
| `kanban-move` + `data-dir` | KanbanCard | `tasks.moveColumn` | DOM move, counts, disabled edges, focus |
| `open-sheet` / `close-sheet` · `TP.openSheet(id)` / `TP.closeSheet()` | MobileSheet | — | `hidden`, `aria-expanded`, focus, scroll lock |
| `menu` · menuitemradio · `TP.onSort(v)` | SortMenu | the list query `sort` arg | `aria-expanded`, `aria-checked`, value label |
| `load-more` | LoadMore | `usePaginatedQuery().loadMore(n)` | un-hides `[data-more]`, status |
| `select-day` · `TP.onDaySelect(date)` | WeekStrip / MonthGrid | `pages.getDaily({date})` | `aria-pressed` |
| input on `.tp-dial .tp-slider` | Dial | `profiles.setCoachDial` | number, word, `aria-valuetext` |
| `panic`, `grounding-done` | Panic / Grounding | none (fixed copy) | card shown, `data-phase` cycle |
| `read-aloud` | ReadAloudButton | `voice.speak({text,lang})` | `aria-pressed`, label, icon |
| `memory-forget` | MemoryItem | `memory.forget` / `memory.restore` | row hidden + Undo |
| role=radio in `.tp-import-row` | ImportReview | `memory.importReview` (on Save) | `data-choice`, contenteditable, count |
| `memory-export` | ExportArea | `memory.exportMarkdown` | note text |
| `open-call` · `TP.openCall(id)` | VoiceCall | `voice.startSession({lang})` | overlay shown, connecting → listening |
| `TP.callSetState(state)` | VoiceCall | session events | `data-state`, label, mic, bars |
| `call-mic` | MicToggle | `track.enabled` | listening ↔ paused |
| `call-interrupt` | Interrupt | `session.interrupt()` | speaking → listening |
| `call-end`, `call-close` | EndCall | `voice.endSession` | `data-ended`, focus return |
| `.tp-ptt` hold (pointer / Space / Enter) | PushToTalk | `voice.sendClip` | `data-pressed`, listening → speaking |
| `call-undo` | CallActionConfirm | `tasks.remove` | `data-undone`, text |
| `call-lang` | LanguageChip | `voice.setLanguage` | `data-lang`, names |
| `retry` | StateError | refetch | `html[data-state]="default"` |

A shared polite live region (`#tp-live`) is created on demand for announcements.

---

## 4. State switch contract

Every screen supports `?state=empty|loading|error|offline`; no parameter means `default`. `tempo.js` sets `html[data-state]` before the first paint.

| Markup | default | empty | loading | error | offline |
|---|---|---|---|---|---|
| `data-state-hide` (normal content) | shown | hidden | hidden | hidden | **shown** |
| `data-state-hide="offline"` | shown | hidden | hidden | hidden | hidden |
| `data-state-show="default"` | shown | hidden | hidden | hidden | hidden |
| `data-state-show="empty"` | hidden | shown | hidden | hidden | hidden |
| `data-state-show="loading"` | hidden | hidden | shown | hidden | hidden |
| `data-state-show="error"` | hidden | hidden | hidden | shown | hidden |
| `data-state-show="offline"` (the banner) | hidden | hidden | hidden | hidden | shown |

`data-state-show` accepts a list, for example `data-state-show="empty error"`.

```html
<div class="tp-notice tp-offline" data-tone="caution" role="status" data-state-show="offline">…</div>
<ul class="tp-block-task" data-state-hide>…tasks…</ul>
<div class="tp-state tp-state--empty" data-state-show="empty">…</div>
<div class="tp-state tp-state--loading" role="status" data-state-show="loading">…skeleton rows…</div>
<div class="tp-state tp-state--error" data-state-show="error">… Couldn't load your tasks. Your data is safe. [Retry] …</div>
```

---

## 5. Labelling convention (copy this into README)

Each screen is a spec for the Next.js / Expo build, so each one carries two kinds of comment.

### 5.1 Screen header comment

This must be the **first thing inside `<body>`**. The fields always appear in this order:

```html
<!--
@screen   Today
@route    apps/web/app/(tempo)/today/page.tsx
@layout   TempoShell
@data     dailyPage = pages.getDaily({ date })      // Convex query
@actions  tick task -> tasks.complete({ id })        // optimistic, Undo 5 min
@states   default | empty | loading | error | offline  (?state=)
@flow     1. ... plain-language pseudocode steps
@i18n     en, he
-->
```

| Field | Rule |
|---|---|
| `@screen` | The human name, as in `screen-inventory.md`. |
| `@route` | The real target file (web `apps/web/app/...`, mobile `apps/mobile/app/...`). |
| `@layout` | `TempoShell`, `Bare`, `Auth`, `Marketing` or `MobileTabs`. |
| `@data` | One line per query: `name = module.function({ args })  // Convex query`. Repeat the tag for more than one. |
| `@actions` | One line per user action: `verb object -> module.mutation({ args })  // optimistic? Undo?`. Repeat the tag. |
| `@states` | Always list all five, then mark extras (e.g. `undo`). |
| `@flow` | Numbered, plain-language steps a developer can follow. No JSON. |
| `@i18n` | Languages the screen ships with (`en, he`). |

### 5.2 Component comment

Put this **directly before each component instance**, on one line:

```html
<!-- @component TaskRow | shadcn: checkbox | props: { task: {id,title,minutes,done} } | events: onToggle -> tasks.complete -->
```

- `@component` takes the exact `data-component` name from this file.
- `shadcn` takes the primitive from the tables above.
- `props` uses TypeScript-ish object shapes and only fields the screen actually shows.
- `events` takes `onX -> module.function`, comma-separated for more than one. Use `events: —` when there are none.
- Repeated rows in a list need one comment on the list, not one per row: `<!-- @component TaskRow ×4 | ... -->`.

### 5.3 Other markup rules for screen builders

- Every component root keeps `class="tp-…"` **and** `data-component="Name"`.
- Visible strings get `data-i18n="key"`. Each screen defines `window.TP_STRINGS = { en, he }`.
- Screens contain no `<style>` beyond layout (grid placement, gaps between sections). They contain no colours, fonts or sizes.
- Each screen has one `.tp-btn--primary` at most.

---

## 6. Hebrew / RTL notes

- **Digits, times, dates, prices and counts:** wrap them in `.tp-num` (LTR isolate, tabular). Times also take `.tp-mono`. These components already isolate themselves:
  - `.tp-event__time`
  - `.tp-week__time`
  - `.tp-timeline__time` and `.tp-timeline__hour`
  - `.tp-chat-row__time`
  - `.tp-tier__amount`
  - `.tp-job-row__schedule`
  - `.tp-chart__value`
- **Schedules, emails and codes** inside Hebrew text use `.tp-ltr` (or `dir="ltr"` on inputs).
- **Direction icons:**
  - Chevrons and arrows that mean "forward / next" take `.tp-icon--flip`.
  - A "back" chevron uses `.tp-icon--back`.
  - Kanban Move buttons use `#i-arrow` with `.tp-icon--flip`; prev uses `.tp-icon--back`.
- **Logical everything.** Switch thumbs, breathing lines, the sheet head and the call action row have explicit `[dir="rtl"]` rules where a transform or origin is physical.
- **User text** takes `dir="auto"`: messages, transcript lines, memories, nag phrases and imported items.
- **Language names** carry their own `lang`: `<span lang="he">עברית</span>`.
- **Segmented controls and radiogroups** swap arrow keys in RTL (Stage 1 `segKeys`).

---

## 7. Icons (`TP.icon(name)` or `<svg class="tp-icon"><use href="#i-name"/></svg>`)

**Stage 1:**

> sun, moon, check, plus, search, sidebar, page, today, inbox, folder, template, chevron, down, grip, coach, mic, send, x, undo, clock, hash, link, text, heading, list, checklist, task, timeblock, habit, energy, nag, more, play, edit, arrow, type, settings, leaf, box

**Stage 2:**

> phone, phone-off, volume, pause, waveform, history, memory, module, calendar-grid, kanban, chart, bell, lock, mail, globe, star, flag, refresh, wifi-off, heart, alert, info, minus, pin, mic-off, hand, sort, filter, download, upload, lifebuoy, card, question, shield, logout, user, sparkle

All Stage 2 icons share the 24-unit grid and the 1.5 px round line. Every icon is decorative (`aria-hidden`) and sits next to a word, or inside a button that has an `aria-label`.

---

## 8. Stage 2 additions noted by screen builders

Candidate components that screen builders composed from existing pieces during Stage 2. They are not yet catalogued as their own rows above. Promote each one (class, `data-component`, shadcn, events) before the React build, or keep it as a composition.

| Candidate | Composed from | Seen in | shadcn | Note |
|---|---|---|---|---|
| CommandPalette | SlashMenu list styling (`.tp-slash-menu`, `.tp-slash-item`) inside a glass dialog | `screens/web/command.html` (and the Ctrl K trigger on every TempoShell screen) | `command` in `dialog` | Reuses the slash menu's listbox, arrow keys, Enter and Esc. One shared list component should serve both. |
| ConfirmDialog | Sheet (`.tp-sheet`) with a title, one plain sentence and two buttons | `screens/web/memory.html`, `module-preview.html`, `settings-privacy.html`, `trial-end.html`, `mobile/settings.html` | `alert-dialog` (sheet on phone) | Used for forget, discard, delete account and cancel plan. Intended: the destructive button is not the accent. |
| NagPhraseList | Rows of the user's own phrases, each with origin ("you" / "derived from …"), Accept / Edit / Drop and a quote of the source | `screens/web/nags.html`, `task-sheet.html`, `habit-detail.html` | `card` list + `button` + `textarea` | Enforces F-60: a nag with no accepted phrase cannot be switched on. User text takes `dir="auto"`. |
