# Convex call sites (Tempo Flow)

Measured 2026-11-20 on integration d77f1d1 by a script (every file outside `convex/` that imports Convex or calls `api.*`). 119 files (97 web, 22 mobile), tests left out. This is the checklist for the port tickets in `docs/backlog/FIREBASE-MIGRATION-PLAN.md`: a file leaves this list when its Convex calls sit behind a `lib/data/` hook that works on both backends.

Format: file, then the Convex functions it calls.

### mobile - Auth and providers (4 files)

- `apps/mobile/app/(auth)/sign-in.tsx`: (provider / auth / types only)
- `apps/mobile/app/(auth)/sign-up.tsx`: (provider / auth / types only)
- `apps/mobile/app/(authenticated)/_layout.tsx`: (provider / auth / types only)
- `apps/mobile/app/_layout.tsx`: (provider / auth / types only)

### mobile - Coach (1 files)

- `apps/mobile/app/(tempo)/(tabs)/coach.tsx`: coach.createProposal, coach.currentProposal, coach.decideProposal, coach.reply, coach.sendMessage, conversations.create, conversations.list, messages.list, tasks.list, tasks.update

### mobile - Day (4 files)

- `apps/mobile/app/(tempo)/(tabs)/today.tsx`: calendar_events.listInRange, dayPlans.getForDate, dayPlans.upsert, focusBlocks.create, habitCheckIns.check, habitCheckIns.listForDate, habitCheckIns.undo, habits.list, tasks.listToday, tasks.toggleCompletion, tasks.update, timeBlocks.listForDate
- `apps/mobile/app/(tempo)/calendar.tsx`: calendar_events.create, calendar_events.listInRange, calendar_events.remove
- `apps/mobile/app/(tempo)/habits.tsx`: habitCheckIns.check, habitCheckIns.listForDate, habitCheckIns.listForHabit, habitCheckIns.undo, habits.create, habits.list, habits.remove
- `apps/mobile/app/(tempo)/tracking.tsx`: streaks.getCurrent, users.getProfile

### mobile - Notes and pages (5 files)

- `apps/mobile/app/(auth)/onboarding.tsx`: coach.setDial, notes.create, notes.update, users.completeOnboarding, users.updateMyProfile
- `apps/mobile/app/(tempo)/(tabs)/notes.tsx`: notes.list
- `apps/mobile/app/(tempo)/journal.tsx`: notes.ensurePeriodPage, notes.getPeriodPage, notes.getSafe, notes.listPeriodPages, notes.update, templates.get
- `apps/mobile/app/(tempo)/page/[id].tsx`: notes.create, notes.getSafe, notes.update
- `apps/mobile/app/(tempo)/templates.tsx`: notes.remove, templates.applyToNote, templates.list

### mobile - Profile and account (6 files)

- `apps/mobile/app/(auth)/_layout.tsx`: users.getProfile
- `apps/mobile/app/(authenticated)/index.tsx`: users.getCurrentUser
- `apps/mobile/app/(tempo)/_layout.tsx`: users.getProfile
- `apps/mobile/app/(tempo)/settings.tsx`: coach.getSettings, coach.setDial, users.deleteMyAccount, users.getMyPlan, users.updateMyProfile
- `apps/mobile/components/v3/prefs.tsx`: preferences.get, preferences.update, users.getProfile
- `apps/mobile/components/v3/session.ts`: users.getProfile

### mobile - Tasks (2 files)

- `apps/mobile/app/(tempo)/(tabs)/tasks.tsx`: tasks.list, tasks.toggleCompletion, tasks.update
- `apps/mobile/app/(tempo)/capture.tsx`: tasks.createQuick, tasks.remove

### web - Auth and providers (9 files)

- `apps/web/app/(auth)/layout.tsx`: (provider / auth / types only)
- `apps/web/app/layout.tsx`: (provider / auth / types only)
- `apps/web/app/settings/passkeys/page.tsx`: (provider / auth / types only)
- `apps/web/app/sign-in/page.tsx`: (provider / auth / types only)
- `apps/web/app/sign-up/page.tsx`: (provider / auth / types only)
- `apps/web/components/auth/SignInForm.tsx`: (provider / auth / types only)
- `apps/web/components/providers/providers.tsx`: (provider / auth / types only)
- `apps/web/components/settings/SettingsScreen.tsx`: (provider / auth / types only)
- `apps/web/proxy.ts`: (provider / auth / types only)

### web - Coach (21 files)

- `apps/web/app/(tempo)/settings/nags/NagsScreen.tsx`: nags.addPhrase, nags.create, nags.decidePhrase, nags.list, nags.proposePhrases, nags.remove, nags.setEnabled, users.getProfile
- `apps/web/components/brain-dump/BrainDumpScreen.tsx`: brain_dump.acceptPlan, brain_dump.prioritize, crisis.check, crisis.resourcesCard, notes.create, notes.remove, tasks.update
- `apps/web/components/coach-controls/CoachControls.tsx`: coach.clearPanic, coach.getSettings, coach.pressPanic, coach.setDial
- `apps/web/components/coach-crisis/CrisisResourcesCard.tsx`: crisis.resourcesCard
- `apps/web/components/coach-crisis/crisisCopy.ts`: crisis.resourcesCard
- `apps/web/components/coach-crisis/useCrisisGuard.ts`: crisis.check
- `apps/web/components/coach-proposal/CoachProposalCard.tsx`: coach.badDay, coach.createProposal, coach.currentProposal, coach.decideProposal, coach.getSettings, tasks.list
- `apps/web/components/coach/ChatProposal.tsx`: coach.acceptProposal, coach.rejectProposal, coach.undoProposal
- `apps/web/components/coach/CoachChat.tsx`: coach.reply, coach.sendMessage, coach.webSearchStatus, conversations.create, conversations.list, conversations.remove, messages.list, users.getProfile, voice.availability
- `apps/web/components/coach/CoachThreads.tsx`: messages.searchMine
- `apps/web/components/coach/ExecutorLookup.tsx`: coach.lookUpInExecutor, connections.status
- `apps/web/components/coach/openui/OpenUiProposal.tsx`: coach.acceptProposal, coach.rejectProposal, coach.undoProposal
- `apps/web/components/global-search/SearchScreen.tsx`: search.all
- `apps/web/components/history/HistoryScreen.tsx`: conversations.get, conversations.list, messages.list, messages.searchMine, users.getProfile
- `apps/web/components/memory-export/MemoryExport.tsx`: memories.getMemoryStats, memory.exportAll, users.getProfile
- `apps/web/components/memory/MemoryImportScreen.tsx`: memory.forgetAll, memory.list, memoryImport.saveReviewed, users.getProfile
- `apps/web/components/memory/MemoryManager.tsx`: memory.exportAll, memory.forget, memory.forgetAll, memory.list, memory.remember, memory.restore, memory.restoreAll, users.getProfile
- `apps/web/components/nag-phrases/NagPhraseEditor.tsx`: nags.addPhrase, nags.decidePhrase, nags.list, nags.proposePhrases
- `apps/web/components/nags/NagList.tsx`: nags.create, nags.list, nags.remove, nags.setEnabled
- `apps/web/components/notifications-preferences/PreferencesForm.tsx`: coach.getSettings, coach.setDial, preferences.get, preferences.update
- `apps/web/components/today/TodayBrainDumpPanel.tsx`: brain_dump.acceptPlan, brain_dump.prioritize, crisis.check, crisis.resourcesCard, tasks.update

### web - Connections and MCP (2 files)

- `apps/web/components/mcp/McpTokensCard.tsx`: mcp.createToken, mcp.listTokens, mcp.revokeToken
- `apps/web/components/settings/ExecutorConnection.tsx`: connections.confirmExecutorConnect, connections.disconnect, connections.startExecutorConnect, connections.status, users.getProfile

### web - Day (17 files)

- `apps/web/components/calendar/CalendarViews.tsx`: calendar_events.create, calendar_events.listInRange, calendar_events.remove, calendar_events.restore, calendar_events.update, tasks.listDueInRange, users.getProfile
- `apps/web/components/carry-over-strip/CarryOverStrip.tsx`: dayPlans.listCarryOver, dayPlans.moveTaskToDay, tasks.toggleCompletion, users.getProfile
- `apps/web/components/day-plan-panel/DayPlanPanel.tsx`: dayPlans.commit, dayPlans.getForDate, dayPlans.listCarryOver, dayPlans.upsert, tasks.listToday, users.getProfile
- `apps/web/components/day-plan-summary/DayPlanSummary.tsx`: dayPlans.getForDate, tasks.listToday, tasks.toggleCompletion, timeBlocks.listForDate, timeBlocks.setStatus, users.getProfile
- `apps/web/components/day-timeline/DayTimeline.tsx`: calendar_events.listInRange, timeBlocks.listForDate, timeBlocks.setStatus, users.getProfile
- `apps/web/components/goals/GoalDetailScreen.tsx`: goals.list, goals.update
- `apps/web/components/goals/GoalsProgressScreen.tsx`: goals.list, tasks.list
- `apps/web/components/goals/GoalsScreen.tsx`: goals.create, goals.list, goals.remove
- `apps/web/components/habit-checkin-strip/HabitCheckInStrip.tsx`: habitCheckIns.check, habitCheckIns.listForDate, habitCheckIns.undo, habits.list, users.getProfile
- `apps/web/components/habit-detail/HabitDetail.tsx`: habitCheckIns.check, habitCheckIns.listForHabit, habitCheckIns.undo, habits.get, habits.update
- `apps/web/components/habits/HabitEnergySuggestions.tsx`: habitCheckIns.check
- `apps/web/components/habits/HabitsScreen.tsx`: habitCheckIns.check, habitCheckIns.listForDate, habitCheckIns.undo, habits.create, habits.list, habits.remove
- `apps/web/components/insights/InsightsScreen.tsx`: focusBlocks.listInRange, tasks.list, users.getProfile
- `apps/web/components/notes/WeekGlance.tsx`: focusBlocks.listInRange, tasks.listDoneInRange
- `apps/web/components/time-block-dialog/TimeBlockDialog.tsx`: habits.list, tasks.listToday, timeBlocks.create, timeBlocks.remove, timeBlocks.update, users.getProfile
- `apps/web/components/today/TodayScreen.tsx`: calendar_events.listInRange, habits.list, tasks.listToday, users.getProfile
- `apps/web/components/tracking/TrackingDashboard.tsx`: focusBlocks.create, focusBlocks.listInRange, focusBlocks.remove, focusBlocks.restore, streaks.getCurrent, users.getProfile

### web - Notes and pages (16 files)

- `apps/web/components/journal/JournalScreen.tsx`: notes.listPeriodPages, users.getProfile
- `apps/web/components/notes-pages/NotesList.tsx`: notes.create, notes.list, notes.remove, notes.restore, notes.togglePin, users.getProfile
- `apps/web/components/notes/NotesScreen.tsx`: notes.create, notes.getSafe, notes.list, notes.remove, notes.restore, notes.togglePin, notes.update, users.getProfile
- `apps/web/components/notes/PageEditorView.tsx`: notes.backlinks, notes.create, notes.searchTitles
- `apps/web/components/routines/RoutineGuide.tsx`: notes.getSafe
- `apps/web/components/routines/RoutinesScreen.tsx`: notes.create, notes.listRoutines
- `apps/web/components/template-builder/TemplateBuilder.tsx`: templates.create, templates.get, templates.update
- `apps/web/components/template-builder/TemplateEditor.tsx`: templates.get, templates.update
- `apps/web/components/template-builder/TemplateSketch.tsx`: templates.create, templates.remove
- `apps/web/components/template-run/ProposalBanner.tsx`: templates.proposeForPage
- `apps/web/components/template-run/TemplateRun.tsx`: notes.create, templates.get
- `apps/web/components/templates-library/TemplatesLibrary.tsx`: templates.list, templates.remove
- `apps/web/components/tempo/CommandPalette.tsx`: notes.create, notes.listForRail, notes.searchTitles, users.getProfile
- `apps/web/components/tempo/Sidebar.tsx`: notes.listForRail, users.getProfile
- `apps/web/components/tempo/Topbar.tsx`: notes.getSafe, users.getProfile
- `apps/web/components/today/usePeriodPage.ts`: notes.ensurePeriodPage, notes.getPeriodPage, templates.get, users.getProfile

### web - Profile and account (22 files)

- `apps/web/components/Navbar.tsx`: users.deleteMyAccount, users.getCurrentUser, users.updateUserType
- `apps/web/components/account/DeleteAccountCard.tsx`: users.deleteMyAccount
- `apps/web/components/account/GreetingName.tsx`: users.getProfile
- `apps/web/components/account/ProfileForm.tsx`: preferences.update, users.getProfile, users.updateMyProfile
- `apps/web/components/activity/ActivityScreen.tsx`: activity.list, users.getProfile
- `apps/web/components/approval/AdminApprovals.tsx`: approval.listForAdmin, approval.myStatus, approval.setStatus
- `apps/web/components/approval/ApprovalGate.tsx`: approval.myStatus
- `apps/web/components/approval/WaitingForApproval.tsx`: users.getProfile, users.updateMyProfile
- `apps/web/components/billing-plan/BillingPlan.tsx`: users.getMyPlan
- `apps/web/components/billing-plan/PlanCard.tsx`: users.getMyPlan
- `apps/web/components/billing-plan/TrialEnd.tsx`: users.getMyPlan
- `apps/web/components/coach/CoachWebSearchSetting.tsx`: coach.webSearchStatus, preferences.get, preferences.update
- `apps/web/components/goals/shared.tsx`: users.getProfile
- `apps/web/components/habits/ScreenStates.tsx`: users.getProfile
- `apps/web/components/notifications-preferences/NotificationsList.tsx`: notifications.list, notifications.markAllRead, notifications.markRead
- `apps/web/components/notifications/NotificationsScreen.tsx`: notifications.list, notifications.markAllRead, notifications.markRead, users.getProfile
- `apps/web/components/onboarding/OnboardingFlow.tsx`: coach.getSettings, coach.setDial, notes.create, notes.update, preferences.update, users.completeOnboarding, users.getProfile
- `apps/web/components/payments/PremiumGate.tsx`: users.getCurrentUser, users.updateUserType
- `apps/web/components/providers/useAccountLanguage.ts`: preferences.get, users.getProfile
- `apps/web/components/settings-profile/ProfileForm.tsx`: users.getProfile, users.updateProfile
- `apps/web/components/today/ProfileReady.tsx`: users.getProfile
- `apps/web/lib/settings/billing.ts`: users.getMyPlan

### web - Tasks (9 files)

- `apps/web/components/projects/ProjectDetailScreen.tsx`: tasks.create, tasks.list, tasks.remove, tasks.renameProject, tasks.toggleCompletion, tasks.update
- `apps/web/components/projects/ProjectsScreen.tsx`: tasks.list
- `apps/web/components/tasks-checklists/ChecklistBoard.tsx`: tasks.list, tasks.remove, tasks.restore, tasks.update, users.getProfile
- `apps/web/components/tasks-priority/PriorityBoard.tsx`: tasks.list, tasks.remove, tasks.restore, tasks.update, users.getProfile
- `apps/web/components/tasks/TaskKanbanBoard.tsx`: tasks.create, tasks.list, tasks.remove, tasks.update
- `apps/web/components/tasks/TaskViewsScreen.tsx`: tasks.create, tasks.createRepeatCfg, tasks.list, tasks.remove, tasks.restore, tasks.setTaskRepeatCfg, tasks.toggleCompletion, tasks.update
- `apps/web/components/today/TodayEnergyRecommendations.tsx`: tasks.list, tasks.update
- `apps/web/components/today/TodayQuickAdd.tsx`: tasks.createQuick
- `apps/web/components/today/TodayTaskList.tsx`: tasks.toggleCompletion

### web - Voice (1 files)

- `apps/web/components/coach/voice/useVoiceCall.ts`: voice.grant, voice.renew, voice.speak, voice.start, voice.stop
