/**
 * @screen  Journal
 * @source  docs/design/v3/screens/mobile/journal.html; OVERNIGHT-RUN.md decision 6 (the Journal is
 *          the run of daily pages, which are Markdown)
 * @data    notes.getPeriodPage + notes.getSafe (today's daily page) · notes.listPeriodPages (earlier days)
 *          · templates.get("starter:daily-page") when today's page does not exist yet
 * @actions write -> a draft kept on the phone while typing
 *          save -> today's page gets a "## Journal" Markdown section (notes.update), or the page is
 *          made first from the daily template (notes.ensurePeriodPage), the way the web makes it
 *          open an earlier day -> /page/[id]
 * @states  default | empty (no earlier days) | loading | error | offline
 * Earlier days show their title and date; mood and first line are inside each page, not listed.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Check, FileText, Sun } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Card, ListRow, PageHeader, SectionHead, Segmented, T, TextField } from "@/components/v3/primitives";
import { MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { api } from "@/convex/_generated/api";
import { dailyPageDraft } from "@/lib/v3/daily-page";
import { clockTime, longDay, shortDay } from "@/lib/v3/dates";
import type { Lang } from "@/lib/v3/i18n";
import {
  buildJournalSection,
  type JournalEntry,
  type JournalLabels,
  type Mood,
  readJournal,
  upsertJournalSection,
} from "@/lib/v3/journal";
import { STRINGS } from "@/lib/v3/strings";

const J = STRINGS.journal;
/** Both languages, so a page written in one reads back in the other. */
const LABELS: JournalLabels = {
  heading: J["page.title"],
  moodQ: J["mood.q"],
  q1: J["q1.label"],
  q2: J["q2.label"],
  mood: { low: J["mood.low"], okay: J["mood.okay"], good: J["mood.good"] },
};

function copyFor(lang: Lang) {
  const i = lang === "he" ? 1 : 0;
  return {
    heading: J["page.title"][i],
    moodQ: J["mood.q"][i],
    q1: J["q1.label"][i],
    q2: J["q2.label"][i],
    mood: { low: J["mood.low"][i], okay: J["mood.okay"][i], good: J["mood.good"][i] },
  };
}

/** Journal drafts are kept per account and day, so they never show up for another person. */
const draftKeyFor = (userId: string, iso: string) => `tempo.v3.journal.${userId}.${iso}`;

export default function JournalScreen() {
  const t = useT("journal");
  const { lang } = usePrefs();
  const session = useTempoSession();
  const offline = useOffline();
  const today = useToday();
  return (
    <Screen keyboard>
      <MobileTopBar title={t("top.title")} start={{ kind: "back" }} />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <PageHeader eyebrow={longDay(today.iso, lang)} title={t("page.title")} sub={t("page.sub")} />
      <QueryBoundary
        fallback={(retry) => (
          <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
        )}
      >
        <JournalBody ready={session.ready} userId={session.profile?._id ?? null} iso={today.iso} offline={offline} />
      </QueryBoundary>
    </Screen>
  );
}

function JournalBody({
  ready,
  userId,
  iso,
  offline,
}: {
  ready: boolean;
  userId: string | null;
  iso: string;
  offline: boolean;
}) {
  const storeKey = userId ? draftKeyFor(userId, iso) : null;
  const t = useT("journal");
  const { lang } = usePrefs();
  const router = useRouter();
  const convex = useConvex();
  const daily = useQuery(api.notes.getPeriodPage, ready ? { pageType: "daily", date: iso } : "skip");
  const note = useQuery(api.notes.getSafe, ready && daily ? { noteId: daily._id } : "skip");
  const template = useQuery(api.templates.get, ready && daily === null ? { templateId: "starter:daily-page" } : "skip");
  const past = useQuery(api.notes.listPeriodPages, ready ? { pageType: "daily", before: iso, limit: 10 } : "skip");
  const update = useMutation(api.notes.update);
  const ensure = useMutation(api.notes.ensurePeriodPage);

  const [entry, setEntry] = useState<JournalEntry>({ mood: null, q1: "", q2: "" });
  const [status, setStatus] = useState<{ kind: "draft" | "saved" | "saved.local"; at: number } | null>(null);
  // Bumped on every edit, so a save that lands after newer typing never drops that newer draft.
  const version = useRef(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef<string | null>(null);

  const pageReady = daily === null ? template !== undefined : daily !== undefined && note !== undefined;

  // Start from the phone's draft for today, else from the page's journal section.
  useEffect(() => {
    if (!pageReady || started.current === iso) return;
    started.current = iso;
    // Typing that starts before the stored draft arrives wins over that draft.
    const before = version.current;
    const hydrate = (next: JournalEntry) => {
      if (version.current === before) setEntry(next);
    };
    (storeKey ? AsyncStorage.getItem(storeKey) : Promise.resolve(null))
      .then((raw) => {
        if (version.current !== before) return;
        if (raw) {
          const d = JSON.parse(raw) as JournalEntry & { at?: number };
          hydrate({ mood: d.mood ?? null, q1: d.q1 ?? "", q2: d.q2 ?? "" });
          if (d.at) setStatus({ kind: "draft", at: d.at });
          return;
        }
        const saved = note ? readJournal(note.body, LABELS) : null;
        if (saved) hydrate(saved);
      })
      .catch(() => {
        const saved = note ? readJournal(note.body, LABELS) : null;
        if (saved) hydrate(saved);
      });
  }, [pageReady, iso, note, storeKey]);

  if (!pageReady || past === undefined) return <StateLoading label={t("load.label")} rows={3} block />;

  const change = (next: JournalEntry) => {
    version.current += 1;
    setEntry(next);
    const at = Date.now();
    setStatus({ kind: "draft", at });
    if (storeKey) AsyncStorage.setItem(storeKey, JSON.stringify({ ...next, at })).catch(() => undefined);
  };

  const hasText = !!entry.mood || !!entry.q1.trim() || !!entry.q2.trim();

  const save = async () => {
    if (busy || !hasText) return;
    setBusy(true);
    setFailed(false);
    if (offline) setStatus({ kind: "saved.local", at: Date.now() });
    const savedVersion = version.current;
    const section = buildJournalSection(entry, copyFor(lang));
    try {
      if (note) {
        await update({ noteId: note._id, body: upsertJournalSection(note.body, section, LABELS.heading) });
      } else {
        const draft = dailyPageDraft(iso, template?.body ?? "", lang);
        const id = await ensure({
          pageType: "daily",
          date: iso,
          title: draft.title,
          body: upsertJournalSection(draft.body, section, LABELS.heading),
        });
        // ensurePeriodPage returns an existing page without writing; then add the section to it.
        const fresh = await convex.query(api.notes.getSafe, { noteId: id });
        if (fresh && !readJournal(fresh.body, LABELS)) {
          await update({ noteId: id, body: upsertJournalSection(fresh.body, section, LABELS.heading) });
        }
      }
      if (version.current === savedVersion) {
        if (storeKey) AsyncStorage.removeItem(storeKey).catch(() => undefined);
        setStatus({ kind: "saved", at: Date.now() });
      } else {
        // Edited while saving: the newer words stay in the draft until the next save.
        setStatus({ kind: "draft", at: Date.now() });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <Card style={{ gap: 20 }}>
        <T size="xl" serif weight="500" accessibilityRole="header">
          {t("h.today")}
        </T>
        <View style={{ gap: 8 }}>
          <T size="sm" weight="600">
            {t("mood.q")}
          </T>
          <Segmented<Mood>
            block
            label={t("mood.q")}
            value={entry.mood}
            onChange={(mood) => change({ ...entry, mood })}
            options={[
              { value: "low", label: t("mood.low") },
              { value: "okay", label: t("mood.okay") },
              { value: "good", label: t("mood.good") },
            ]}
          />
        </View>
        <TextField label={t("q1.label")} value={entry.q1} onChangeText={(q1) => change({ ...entry, q1 })} multiline user />
        <TextField
          label={t("q2.label")}
          value={entry.q2}
          onChangeText={(q2) => change({ ...entry, q2 })}
          placeholder={t("q2.ph")}
          help={t("opt")}
          multiline
          user
        />
        <View style={{ gap: 8 }}>
          <Button variant="primary" block icon={Check} label={t("save")} onPress={save} disabled={busy || !hasText} />
          {failed ? (
            <T size="sm" tone="danger" accessibilityRole="alert">
              {t("save.error")}
            </T>
          ) : status ? (
            <T size="sm" tone="muted" accessibilityLiveRegion="polite">
              {`${t(status.kind)} `}
              <T size="sm" tone="muted" mono ltr>
                {clockTime(status.at)}
              </T>
            </T>
          ) : null}
        </View>
      </Card>

      {past.length ? (
        <View style={{ gap: 12 }}>
          <SectionHead title={t("h.past")} />
          <Card padded={false}>
            {past.map((row, i) => (
              <ListRow
                key={row._id}
                icon={Sun}
                title={row.title || longDay(row.date, lang)}
                meta={
                  <T size="sm" tone="muted">
                    {shortDay(row.date, lang)}
                  </T>
                }
                last={i === past.length - 1}
                onPress={() => router.push({ pathname: "/page/[id]", params: { id: row._id } })}
              />
            ))}
          </Card>
        </View>
      ) : (
        <StateEmpty icon={FileText} title={t("empty.title")} body={t("empty.body")} />
      )}
    </View>
  );
}
