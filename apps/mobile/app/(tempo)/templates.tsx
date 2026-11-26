/**
 * @screen  Templates
 * @source  docs/design/v3/screens/mobile/templates.html
 * @data    templates.list — built-in (starter) templates and the person's own
 * @actions use -> templates.applyToNote({ templateId }) makes a new page (Undo 5 min -> notes.remove)
 *          ask the coach -> /coach?ask=template · filter and search (on the phone)
 * @states  default | empty (no templates of your own; built-ins still show) | loading | error | offline
 * Names and descriptions come from the backend as written (English for built-ins). The design's
 * "Made with the coach / Made by you" badge is left out: templates do not record who made them.
 */
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { CalendarDays, FileText, LayoutTemplate, Lock, MessageCircle, Play, Sparkles, Sun } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Badge, Button, Card, PageHeader, Row, SearchField, SectionHead, Segmented, T } from "@/components/v3/primitives";
import { MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline, useTempoSession } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import { localIsoDate, shortDay } from "@/lib/v3/dates";

type Filter = "all" | "builtin" | "mine";

export default function TemplatesScreen() {
  const t = useT("templates");
  const router = useRouter();
  const session = useTempoSession();
  const offline = useOffline();
  const { colors } = usePrefs();
  return (
    <Screen keyboard>
      <MobileTopBar title={t("top.title")} start={{ kind: "back" }} />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <PageHeader title={t("page.title")} sub={t("page.sub")} />
      <Card style={{ gap: 12 }}>
        <Row className="gap-2" style={{ alignItems: "center" }}>
          <Sparkles size={16} color={colors.inkMuted} />
          <View style={{ flex: 1 }}>
            <T size="sm" weight="600" tone="muted" accessibilityRole="header">
              {t("ask.title")}
            </T>
          </View>
        </Row>
        <T size="sm">{t("ask.body")}</T>
        <Button
          variant="primary"
          block
          icon={MessageCircle}
          label={t("ask.btn")}
          onPress={() => router.push({ pathname: "/coach", params: { ask: "template" } })}
        />
      </Card>
      <QueryBoundary
        fallback={(retry) => (
          <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
        )}
      >
        <TemplateList ready={session.ready} />
      </QueryBoundary>
    </Screen>
  );
}

type Template = {
  templateId: string;
  source: "starter" | "user";
  name: string;
  description?: string;
  periodType: "daily" | "weekly" | "monthly" | "none";
  sections: string[];
  updatedAt?: number;
};

function TemplateList({ ready }: { ready: boolean }) {
  const t = useT("templates");
  const templates = useQuery(api.templates.list, ready ? {} : "skip");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return (x: Template) =>
      !q || [x.name, x.description ?? "", ...x.sections].some((s) => s.toLocaleLowerCase().includes(q));
  }, [search]);

  if (!templates) return <StateLoading label={t("load.label")} rows={4} />;

  const builtin = templates.filter((x) => x.source === "starter" && matches(x));
  const mine = templates.filter((x) => x.source === "user" && matches(x));
  const hasOwn = templates.some((x) => x.source === "user");
  const showBuiltin = filter !== "mine" && builtin.length > 0;
  const showMine = filter !== "builtin" && mine.length > 0;
  const nothing = !showBuiltin && !showMine;

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 12 }}>
        <SearchField label={t("search.label")} placeholder={t("search.ph")} value={search} onChangeText={setSearch} />
        <Segmented
          block
          label={t("filter.label")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("filter.all") },
            { value: "builtin", label: t("filter.builtin") },
            { value: "mine", label: t("filter.mine") },
          ]}
        />
      </View>
      {!hasOwn && filter !== "builtin" && !search.trim() ? (
        <StateEmpty icon={LayoutTemplate} title={t("empty.title")} body={t("empty.body")}>
          {filter === "mine" ? <Button icon={LayoutTemplate} label={t("empty.builtin")} onPress={() => setFilter("builtin")} /> : null}
        </StateEmpty>
      ) : null}
      {showBuiltin ? <Group title={t("g.builtin")} rows={builtin} /> : null}
      {showMine ? <Group title={t("g.mine")} rows={mine} /> : null}
      {nothing && (hasOwn || filter === "builtin" || search.trim()) ? <T tone="muted">{t("search.none")}</T> : null}
    </View>
  );
}

function Group({ title, rows }: { title: string; rows: Template[] }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionHead title={title} count={String(rows.length)} />
      {rows.map((row) => (
        <TemplateCard key={row.templateId} template={row} />
      ))}
    </View>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const t = useT("templates");
  const p = usePrefs();
  const toast = useToast();
  const apply = useMutation(api.templates.applyToNote);
  const remove = useMutation(api.notes.remove);
  const [busy, setBusy] = useState(false);
  const Icon = template.periodType === "daily" ? Sun : template.periodType === "none" ? FileText : CalendarDays;
  const builtIn = template.source === "starter";

  const use = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const noteId = await apply({ templateId: template.templateId });
      toast({ title: t("made", { name: template.name }), onUndo: () => remove({ noteId }) });
    } catch {
      toast({ title: t("made.error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 8 }}>
      <Row className="gap-2" style={{ alignItems: "center" }}>
        <Icon size={16} color={p.colors.inkMuted} />
        <View style={{ flex: 1 }}>
          <T weight="600" user accessibilityRole="header">
            {template.name}
          </T>
        </View>
      </Row>
      <Row className="gap-2" wrap style={{ alignItems: "center" }}>
        {builtIn ? <Badge icon={Lock} label={t("badge.builtin")} /> : null}
        {!builtIn && template.updatedAt ? (
          <T size="sm" tone="muted">
            {shortDay(localIsoDate(new Date(template.updatedAt)), p.lang)}
          </T>
        ) : null}
      </Row>
      {template.description ? (
        <T size="sm" user>
          {template.description}
        </T>
      ) : null}
      {template.sections.length ? (
        <View accessibilityLabel={t("adds")} style={{ gap: 2, paddingStart: 8 }}>
          {template.sections.slice(0, 4).map((s) => (
            <T key={s} size="sm" tone="muted" user>
              {`• ${s}`}
            </T>
          ))}
        </View>
      ) : null}
      <Row className="gap-2" wrap>
        <Button icon={Play} label={t("use")} accessibilityLabel={`${t("use")}: ${template.name}`} onPress={use} disabled={busy} />
      </Row>
    </Card>
  );
}
