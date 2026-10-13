/**
 * @screen  Page (read view + plain Markdown editor) — opened from Notes, Journal and Templates
 * @source  OVERNIGHT-RUN.md decision 1 (notes.body Markdown is the only truth), decision 4
 *          (`- [ ]` is a plain checkbox), docs/design/v3/screens/mobile/notes.html ("open note")
 * @data    notes.getSafe
 * @actions tick a `- [ ]` box -> notes.update (that one character changes) ·
 *          edit -> notes.update({ title, body }) · new page -> notes.create
 * Tempo blocks show as quiet cards and as one ⟦…⟧ line in the editor; their JSON is never shown and
 * is put back byte for byte. An untouched page is not written at all.
 */
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, FileText, Pencil, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Card, Checkbox, RADIUS, Row, T, TextField } from "@/components/v3/primitives";
import { MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline, useTempoSession } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type Inline,
  isBlankBody,
  keepPageMeta,
  maskTempoBlocks,
  parseMarkdownView,
  type TempoInfo,
  toggleCheckbox,
  unmaskTempoBlocks,
  type ViewBlock,
} from "@/lib/v3/markdown";

export default function PageScreen() {
  const t = useT("page");
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useTempoSession();
  const offline = useOffline();
  return (
    <Screen keyboard>
      <MobileTopBar title={t("top.title")} start={{ kind: "back" }} />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <QueryBoundary
        fallback={(retry) => (
          <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
        )}
      >
        {id === "new" ? <PageEditor initialTitle="" initialBody="" /> : <PageView ready={session.ready} id={id ?? ""} />}
      </QueryBoundary>
    </Screen>
  );
}

function PageView({ ready, id }: { ready: boolean; id: string }) {
  const t = useT("page");
  const tn = useT("notes");
  const toast = useToast();
  const note = useQuery(api.notes.getSafe, ready && id ? { noteId: id } : "skip");
  const update = useMutation(api.notes.update);
  const [editing, setEditing] = useState(false);
  // The body as of the last tick sent, until the query catches up: a quick second tick builds on
  // the first instead of on the older body (so neither edit is lost).
  const sentBody = useRef<string | null>(null);
  useEffect(() => {
    if (note && sentBody.current === note.body) sentBody.current = null;
  }, [note]);

  if (note === undefined) return <StateLoading label={t("load.label")} rows={4} />;
  if (note === null) return <StateEmpty icon={FileText} title={t("missing.title")} body={t("missing.body")} />;
  if (editing) {
    return <PageEditor noteId={note._id} initialTitle={note.title} initialBody={note.body} onDone={() => setEditing(false)} />;
  }

  const blocks = parseMarkdownView(note.body);
  const tick = (line: number) => {
    const base = sentBody.current ?? note.body;
    const body = toggleCheckbox(base, line);
    if (body === base) return;
    sentBody.current = body;
    update({ noteId: note._id, body }).catch(() => {
      sentBody.current = null;
      toast({ title: t("save.error") });
    });
  };

  return (
    <View style={{ gap: 16 }}>
      <T size="2xl" serif weight="500" user accessibilityRole="header">
        {note.title.trim() || tn("untitled")}
      </T>
      <Button icon={Pencil} label={t("edit")} onPress={() => setEditing(true)} />
      {isBlankBody(note.body) ? <T tone="muted">{t("empty.body")}</T> : <ReadView blocks={blocks} onTick={tick} />}
    </View>
  );
}

function Inlines({ inlines, size = "md", weight }: { inlines: Inline[]; size?: "md" | "lg" | "xl" | "2xl"; weight?: "500" | "600" }) {
  return (
    <T size={size} weight={weight} serif={size !== "md"} user dirText={plain(inlines)}>
      {inlines.map((i, n) => (
        <T
          key={n}
          size={size}
          weight={i.bold ? "700" : weight}
          mono={i.code}
          underline={i.link}
          style={i.italic ? { fontStyle: "italic" } : undefined}
        >
          {i.text}
        </T>
      ))}
    </T>
  );
}

function plain(inlines: Inline[]): string {
  return inlines.map((i) => i.text).join("");
}

/** The simple read view: headings, paragraphs, lists, plain checkboxes, quotes, code, Tempo cards. */
function ReadView({ blocks, onTick }: { blocks: ViewBlock[]; onTick: (line: number) => void }) {
  const t = useT("page");
  const p = usePrefs();
  const c = p.colors;
  return (
    <View style={{ gap: 12 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return (
              <View key={i} accessibilityRole="header" style={{ marginTop: 8 }}>
                <Inlines inlines={b.inlines} size={b.level === 1 ? "2xl" : b.level === 2 ? "xl" : "lg"} weight="500" />
              </View>
            );
          case "paragraph":
            return <Inlines key={i} inlines={b.inlines} />;
          case "bullet":
            return (
              <Row key={i} className="gap-2" style={{ paddingStart: b.depth * 16 }}>
                <T tone="muted" ltr={b.marker !== "•"}>
                  {b.marker}
                </T>
                <View style={{ flex: 1 }}>
                  <Inlines inlines={b.inlines} />
                </View>
              </Row>
            );
          case "check":
            return (
              <Row key={i} className="gap-3" style={{ alignItems: "center", paddingStart: b.depth * 16 + 6 }}>
                <Checkbox checked={b.checked} label={plain(b.inlines)} onPress={() => onTick(b.line)} />
                <View style={{ flex: 1 }}>
                  <T user strike={b.checked} tone={b.checked ? "muted" : "ink"}>
                    {plain(b.inlines)}
                  </T>
                </View>
              </Row>
            );
          case "quote":
            return (
              <View key={i} style={{ borderStartWidth: 3, borderStartColor: c.lineStrong, paddingStart: 12 }}>
                <Inlines inlines={b.inlines} />
              </View>
            );
          case "code":
            return (
              <View key={i} style={{ backgroundColor: c.sunken, borderRadius: RADIUS.md, padding: 12 }}>
                <T size="sm" mono ltr>
                  {b.text}
                </T>
              </View>
            );
          case "rule":
            return <View key={i} style={{ height: 1, backgroundColor: c.line, marginVertical: 8 }} />;
          case "tempo":
            return <TempoCard key={i} info={b.info} />;
          default:
            return null;
        }
      })}
      {blocks.length === 0 ? <T tone="muted">{t("empty.body")}</T> : null}
    </View>
  );
}

/** A Tempo block as a quiet card. Blocks are edited on the web; the JSON is never shown. */
function TempoCard({ info }: { info: TempoInfo }) {
  const t = useT("page");
  const { colors: c } = usePrefs();
  if (info.type === "task") {
    return (
      <Card>
        <Row className="gap-3" style={{ alignItems: "center" }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: info.done ? c.done : c.lineControl,
              backgroundColor: info.done ? c.done : c.paper,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {info.done ? <Check size={14} color={c.paper} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <T user strike={info.done} tone={info.done ? "muted" : "ink"} accessibilityLabel={`${t("block.task")}: ${info.title}`}>
              {info.title}
            </T>
          </View>
        </Row>
      </Card>
    );
  }
  if (info.type === "template") {
    return (
      <Card>
        <T size="sm" tone="muted">{`${t("block.template")}: `}</T>
        <T user>{info.name}</T>
      </Card>
    );
  }
  return (
    <Card>
      <T size="sm" tone="muted">
        {t("block.broken")}
      </T>
    </Card>
  );
}

/** Plain Markdown editor over the whole body; Tempo blocks stay as one ⟦…⟧ line each. */
function PageEditor({
  noteId,
  initialTitle,
  initialBody,
  onDone,
}: {
  noteId?: Id<"notes">;
  initialTitle: string;
  initialBody: string;
  onDone?: () => void;
}) {
  const t = useT("page");
  const router = useRouter();
  const toast = useToast();
  const update = useMutation(api.notes.update);
  const create = useMutation(api.notes.create);
  const masked = useMemo(
    () =>
      maskTempoBlocks(initialBody, (info) =>
        info.type === "task"
          ? `${t("block.task")}: ${info.title}`
          : info.type === "template"
            ? `${t("block.template")}: ${info.name}`
            : info.type === "page-meta"
              ? t("block.page")
              : "",
      ),
    [initialBody, t],
  );
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(masked.text);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const cancel = () => (onDone ? onDone() : router.canGoBack() ? router.back() : router.replace("/notes"));

  const save = async () => {
    if (busy) return;
    const body = keepPageMeta(unmaskTempoBlocks(text, masked.fences), initialBody);
    if (noteId && title === initialTitle && body === initialBody) {
      onDone?.();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      if (noteId) {
        await update({ noteId, title, body });
        toast({ title: t("saved") });
        onDone?.();
      } else {
        const id = await create({ title, body });
        router.replace({ pathname: "/page/[id]", params: { id } });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <TextField label={t("title.label")} value={title} onChangeText={setTitle} user autoFocus={!noteId} />
      <TextField
        label={t("body.label")}
        help={t("body.help")}
        value={text}
        onChangeText={setText}
        multiline
        minHeight={240}
        user
        autoCapitalize="sentences"
      />
      {failed ? (
        <T size="sm" tone="danger" accessibilityRole="alert">
          {t("save.error")}
        </T>
      ) : null}
      <View style={{ gap: 8 }}>
        <Button variant="primary" block icon={Check} label={t("save")} onPress={save} disabled={busy} />
        <Button variant="ghost" block icon={X} label={t("cancel")} onPress={cancel} />
      </View>
    </View>
  );
}
