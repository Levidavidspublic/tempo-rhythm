/**
 * @screen  Notes
 * @source  docs/design/v3/screens/mobile/notes.html
 * @data    notes.list — pinned first, then recent (newest edit first); tags come from each page's
 *          page-meta block (the only place tags live)
 * @actions open -> /page/[id] · tag filter and search (on the phone) · new note -> /page/new
 * @states  default | empty | loading | error | offline · no match
 */
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { FileText, Hash, Pin, Plus, Search, Sun } from "lucide-react-native";
import { type RefObject, useMemo, useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Card, ListRow, PageHeader, Row, SearchField, SectionHead, T, Tag } from "@/components/v3/primitives";
import { CaptureFab, MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline, useTempoSession } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { api } from "@/convex/_generated/api";
import { clockTime, dayMonth, localIsoDate, weekdayName } from "@/lib/v3/dates";
import { editedWhen, noteKind, topTags } from "@/lib/v3/display";
import { pageTags, splitTempoFences } from "@/lib/v3/markdown";

const PAGE = 20;

export default function NotesScreen() {
  const t = useT("notes");
  const router = useRouter();
  const session = useTempoSession();
  const offline = useOffline();
  const searchRef = useRef<TextInput>(null);
  return (
    <Screen tabs keyboard overlay={<CaptureFab label={t("new")} onPress={() => router.push("/page/new")} />}>
      <MobileTopBar
        title={t("top.title")}
        start={{ kind: "icon", icon: Search, label: t("top.search"), onPress: () => searchRef.current?.focus() }}
      />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <QueryBoundary
        fallback={(retry) => (
          <View style={{ gap: 24 }}>
            <PageHeader title={t("page.title")} />
            <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
          </View>
        )}
      >
        <NotesBody ready={session.ready} searchRef={searchRef} />
      </QueryBoundary>
    </Screen>
  );
}

type NoteRow = {
  _id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
  kind: ReturnType<typeof noteKind>;
  tags: string[];
  text: string;
};

function NotesBody({ ready, searchRef }: { ready: boolean; searchRef: RefObject<TextInput | null> }) {
  const t = useT("notes");
  const p = usePrefs();
  const router = useRouter();
  const notes = useQuery(api.notes.list, ready ? {} : "skip");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo<NoteRow[] | null>(
    () =>
      notes
        ? notes.map((n) => ({
            _id: n._id,
            title: n.title,
            pinned: n.pinned,
            updatedAt: n.updatedAt,
            kind: noteKind(n),
            tags: pageTags(n.body),
            // Searchable text never includes a Tempo block's JSON.
            text: splitTempoFences(n.body)
              .map((s) => (s.kind === "text" ? s.source : ""))
              .join(" ")
              .toLocaleLowerCase(),
          }))
        : null,
    [notes],
  );

  if (!rows) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateLoading label={t("load.label")} rows={3} />
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateEmpty icon={FileText} title={t("empty.title")} body={t("empty.body")}>
          <Button icon={Plus} label={t("empty.capture")} onPress={() => router.push("/page/new")} />
        </StateEmpty>
      </View>
    );
  }

  const q = search.trim().toLocaleLowerCase();
  const match = (r: NoteRow) =>
    (!tag || r.tags.includes(tag)) && (!q || r.title.toLocaleLowerCase().includes(q) || r.text.includes(q));
  const pinned = rows.filter((r) => r.pinned && match(r));
  const recent = rows.filter((r) => !r.pinned && match(r));
  const tags = topTags(rows.map((r) => r.tags));
  const now = Date.now();

  const edited = (r: NoteRow): string => {
    const when = editedWhen(r.updatedAt, now);
    if (when.kind === "time") return t("edited.time", { time: clockTime(r.updatedAt) });
    if (when.kind === "yesterday") return t("edited.yesterday");
    if (when.kind === "day") return t("edited.day", { day: weekdayName(when.iso, p.lang) });
    return t("edited.date", { date: dayMonth(localIsoDate(new Date(r.updatedAt)), p.lang) });
  };

  const row = (r: NoteRow, i: number, all: NoteRow[]) => {
    const title = r.title.trim() || t("untitled");
    const meta = `${t(`kind.${r.kind}`)} · ${edited(r)}`;
    return (
      <ListRow
        key={r._id}
        icon={r.pinned ? Pin : r.kind === "daily" ? Sun : FileText}
        title={title}
        accessibilityLabel={`${title}, ${meta}`}
        meta={
          <>
            <T size="sm" tone="muted">
              {meta}
            </T>
            {r.tags[0] ? <Tag label={r.tags[0]} /> : null}
          </>
        }
        last={i === all.length - 1}
        onPress={() => router.push({ pathname: "/page/[id]", params: { id: r._id } })}
      />
    );
  };

  const recentShown = recent.slice(0, shown);

  return (
    <View style={{ gap: 24 }}>
      <PageHeader
        title={t("page.title")}
        sub={
          <T tone="muted">
            <T tone="muted" ltr>
              {String(rows.length)}
            </T>
            {` ${t("page.count")}`}
          </T>
        }
      />
      <View style={{ gap: 12 }}>
        <SearchField label={t("search.label")} placeholder={t("search.ph")} value={search} onChangeText={setSearch} inputRef={searchRef} />
        {tags.length ? (
          <Row className="gap-2" wrap accessibilityRole="toolbar" accessibilityLabel={t("tags.label")}>
            {tags.map((name) => (
              <Button
                key={name}
                small
                icon={Hash}
                label={name}
                pressed={tag === name}
                onPress={() => setTag((cur) => (cur === name ? null : name))}
              />
            ))}
          </Row>
        ) : null}
      </View>
      {pinned.length ? (
        <View style={{ gap: 12 }}>
          <SectionHead title={t("h.pinned")} />
          <Card padded={false}>{pinned.map((r, i) => row(r, i, pinned))}</Card>
        </View>
      ) : null}
      {recentShown.length ? (
        <View style={{ gap: 12 }}>
          <SectionHead title={t("h.recent")} />
          <Card padded={false}>{recentShown.map((r, i) => row(r, i, recentShown))}</Card>
          {recent.length > shown ? <Button label={t("show.more")} onPress={() => setShown((n) => n + PAGE)} /> : null}
        </View>
      ) : null}
      {!pinned.length && !recent.length ? <T tone="muted">{t("search.none")}</T> : null}
    </View>
  );
}
