// Kitchen polish gallery: the app's real components with sample data, for before/after evidence of
// states the local dev server can't reach (signed-in data, long text, errors). Convex, next/link and
// next/navigation are swapped for stand-ins by build.ts. Not part of the app. All people and data are
// fictional (DESIGN.md §13).
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { CoachChat } from "@/components/coach/CoachChat";
import { ReadView } from "@/components/editor/ReadView";
import { NotesList } from "@/components/notes-pages/NotesList";
import { NoteNotFound } from "@/components/notes/NoteNotFound";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { ChecklistBoard } from "@/components/tasks-checklists/ChecklistBoard";
import { PriorityBoard } from "@/components/tasks-priority/PriorityBoard";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { CarryOverStrip } from "@/components/carry-over-strip/CarryOverStrip";
import { HabitCheckInStrip } from "@/components/habit-checkin-strip/HabitCheckInStrip";
import { TodayAgenda } from "@/components/today/TodayAgenda";
import { TodayBrainDumpPanel } from "@/components/today/TodayBrainDumpPanel";
import { TodayGreeting } from "@/components/today/TodayGreeting";
import { TodayQuickAdd } from "@/components/today/TodayQuickAdd";
import { TodayTaskList } from "@/components/today/TodayTaskList";
import { StateError } from "@/components/you/ScreenStates";
import { WaitingCard } from "@/components/approval/WaitingForApproval";
import { PageCard } from "@/components/auth/SignInForm";

const params = new URLSearchParams(window.location.search);
const view = params.get("view") ?? "coach";
const theme = params.get("theme") === "dark" ? "dark" : "light";
document.documentElement.setAttribute("data-theme", theme);
document.documentElement.style.colorScheme = theme;

const NOW = Date.now();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const LONG_LINK = "https://example.com/notes/a-very-long-link-with-no-spaces-that-used-to-push-a-phone-screen-sideways";

const profile = { _id: "users:1", name: "Maya Ronen", greetingName: "Maya", email: "maya@example.com" };

const messages = [
  { role: "user", content: "Help me plan this afternoon.\nI have the report, Dana's email and laundry.", at: NOW - 9 * MIN },
  {
    role: "assistant",
    content:
      "Here is a calm order. Nothing changes until you say yes.\n\n1. **Reply to Dana** (10 min). It unblocks her.\n2. Draft the report in one 45-minute block.\n3. Laundry while you take a break.\n\nIf it helps, `Focus` blocks live on Today.",
    at: NOW - 8 * MIN,
  },
  { role: "user", content: `Can you read this first? ${LONG_LINK}`, at: NOW - 3 * MIN },
  { role: "assistant", content: "I can't open links, but tell me the one thing you want from it and we'll start there.", at: NOW - 2 * MIN },
  { role: "user", content: "Make me a packing list for Friday.", at: NOW - MIN },
].map((m, i) => ({
  _id: `messages:${i + 1}`,
  _creationTime: m.at,
  conversationId: "conversations:1",
  role: m.role,
  content: m.content,
  createdAt: m.at,
  modelUsed: m.role === "assistant" ? "coach" : undefined,
}));

const tasks = [
  { title: "Reply to Dana about the venue", priority: "high", flexibility: "fixed", checklist: [{ id: "a", text: "Check the date", completed: true }, { id: "b", text: "Send the yes", completed: false }] },
  { title: "Draft the quarterly report for Yoni, including the appendix with every number from the spring", priority: "medium", flexibility: "elastic", checklist: [] },
  { title: `Read ${LONG_LINK}`, priority: "low", flexibility: "elastic", checklist: [] },
  { title: "Laundry", priority: "low", flexibility: "elastic", checklist: [] },
].map((t, i) => ({
  _id: `tasks:${i + 1}`,
  _creationTime: NOW - i * DAY,
  status: "todo",
  description: undefined,
  dueAt: NOW,
  ...t,
}));

const notes = [
  { title: "Packing list", body: "- [ ] Passport\n- [ ] Charger\n- [ ] Snacks for the train", pinned: true, periodType: "none" },
  { title: "Friday, 16 October", body: "Slept badly, keeping it gentle today.", pinned: false, periodType: "daily" },
  { title: "A note with a very long title that keeps going well past the width of a phone screen", body: `Saved from ${LONG_LINK}`, pinned: false, periodType: "none" },
].map((n, i) => ({ _id: `notes:${i + 1}`, _creationTime: NOW - i * DAY, updatedAt: NOW - i * DAY, ...n }));

const habits = [
  { _id: "habits:1", name: "Water the plants", currentStreak: 4 },
  { _id: "habits:2", name: "Ten minutes outside, even if it's just the balcony and a cup of tea", currentStreak: 0 },
];

const queries: Record<string, unknown> = {
  "users.getProfile": profile,
  "conversations.list": [{ _id: "conversations:1", title: "Help me plan this afternoon", chatMode: "legacy", createdAt: NOW - DAY, updatedAt: NOW - MIN }],
  "messages.list": view === "coach-empty" ? [] : messages,
  "voice.availability": { available: false },
  "crisis.resourcesCard": { title: "Help is available", body: "If you are in danger, contact your local emergency number now.", resources: [] },
  "crisis.check": { isCrisis: false },
  "notes.list": notes,
  "tasks.list": tasks,
  "habits.list": habits,
  "habitCheckIns.listForDate": [{ habitId: "habits:1" }],
  "dayPlans.listCarryOver": [
    { _id: "tasks:9", title: "Renew the passport before the trip in November", dueAt: NOW - DAY, status: "todo" },
    { _id: "tasks:10", title: "Call the bank", dueAt: NOW - 2 * DAY, status: "todo" },
  ],
  "coach.currentProposal": null,
};

const calls: Record<string, unknown> = {
  "tasks.toggleCompletion": new Error("offline"),
};

(window as unknown as { __gallery: unknown }).__gallery = { queries, calls };

const READ_SAMPLE = `## Trip, Friday\n\n- Passport\n- Charger\n  - the long one\n\n1. Pack\n2. Water the plants\n\n> Keep the morning slow.\n\n| What | When |\n| --- | --- |\n| Train | 09:40 |\n| Dinner with Dana | 19:30 |\n\nBooking: ${LONG_LINK}\n\n\`code sample\``;

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="tp-app__main gallery-main">
      <div className="tp-page">{children}</div>
    </main>
  );
}

const VIEWS: Record<string, () => ReactNode> = {
  coach: () => <CoachChat />,
  "coach-empty": () => <CoachChat />,
  today: () => (
    <Page>
      <div className="today-stack">
        <TodayGreeting greetingName="maya.ronen.with.a.very.long.handle@example.com" />
        <TodayTaskList tasks={tasks as never} />
        <TodayAgenda events={[{ id: "e1", title: "Dinner with Dana at the place by the station, bring the book", timeLabel: "19:30" }, { id: "e2", title: "Train", timeLabel: "09:40" }]} />
        <CarryOverStrip />
        <HabitCheckInStrip />
        <TodayQuickAdd dueAt={NOW} />
      </div>
    </Page>
  ),
  "today-braindump": () => (
    <Page>
      <TodayBrainDumpPanel dueAt={NOW} />
    </Page>
  ),
  notes: () => <NotesList />,
  "notes-read": () => (
    <Page>
      <article className="tp-paper">
        <div className="tp-page__body">
          <ReadView body={READ_SAMPLE} labels={{ minutes: "min", brokenBlock: "This block couldn't be read.", template: "Template" }} />
        </div>
      </article>
    </Page>
  ),
  "notes-missing": () => (
    <Page>
      <NoteNotFound />
    </Page>
  ),
  "tasks-checklists": () => <ChecklistBoard />,
  "tasks-priority": () => <PriorityBoard />,
  approval: () => <WaitingCard email="maya.ronen.with.a.very.long.handle@example.com" revoked={false} signingOut={false} signOutFailed={true} onSignOut={() => {}} />,
  "sign-in-error": () => (
    <main className="tp-auth">
      <PageCard flow="sign-in" email="maya@example" setEmail={() => {}} isLoading={false} error="send" sent={false} onSubmit={() => {}} onReset={() => {}} otherHref="/sign-up" />
    </main>
  ),
  "sign-in-sent": () => (
    <main className="tp-auth">
      <PageCard flow="sign-up" email="maya.ronen.with.a.very.long.handle@example.com" setEmail={() => {}} isLoading={false} error="" sent={true} onSubmit={() => {}} onReset={() => {}} otherHref="/sign-in" />
    </main>
  ),
  "screen-error": () => (
    <Page>
      <StateError title="Couldn't open this screen just now." body="Your data is safe." onRetry={() => {}} />
    </Page>
  ),
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <LocaleProvider>
      <TpIconSprite />
      {(VIEWS[view] ?? VIEWS.coach)()}
    </LocaleProvider>,
  );
}
