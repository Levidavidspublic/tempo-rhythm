/**
 * @screen  Settings
 * @source  docs/design/v3/screens/mobile/settings.html
 * @data    users.getProfile (name, email) · preferences.get (language, theme) · coach.getSettings (dial)
 *          · users.getMyPlan · text size and reading font are kept on this phone (DESIGN.md §11)
 * @actions what the coach calls you -> users.updateMyProfile({ fullName }) on blur
 *          language / theme -> preferences.update (apply at once) · text size / reading font -> phone
 *          coach dial -> coach.setDial · delete my account -> users.deleteMyAccount (30 days to come back)
 *          sign out -> Convex Auth signOut
 * @states  default | loading | error | offline
 * Left out, with no backend yet: usage analytics opt-in and "Download my data". Plan shows the
 * plan's name; billing is not on the phone yet.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Link, useRouter } from "expo-router";
import { Accessibility, Clock, CreditCard, LogOut, Moon, Sun, X } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import { Dial } from "@/components/v3/Dial";
import { type TextSize, type ThemePref, usePrefs, useT } from "@/components/v3/prefs";
import {
  Avatar,
  Button,
  RADIUS,
  Row,
  Segmented,
  SettingRow,
  SwitchControl,
  T,
  TextField,
  TouchRow,
} from "@/components/v3/primitives";
import { MobileTopBar, Screen, Sheet } from "@/components/v3/Shell";
import { useOffline, useTempoSession } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateError, StateLoading } from "@/components/v3/states";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import { clampDial } from "@/lib/v3/display";
import type { Lang } from "@/lib/v3/i18n";

export default function SettingsScreen() {
  const t = useT("settings");
  const session = useTempoSession();
  const offline = useOffline();
  return (
    <Screen keyboard>
      <MobileTopBar title={t("top.title")} start={{ kind: "back" }} end="none" />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <View style={{ gap: 4 }}>
        <T size="2xl" serif weight="500" accessibilityRole="header">
          {t("page.title")}
        </T>
        <T tone="muted">{t("page.sub")}</T>
      </View>
      <QueryBoundary
        fallback={(retry) => (
          <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
        )}
      >
        <SettingsBody ready={session.ready} />
      </QueryBoundary>
    </Screen>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  const { colors: c } = usePrefs();
  return (
    <View style={{ backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: RADIUS.lg, overflow: "hidden" }}>
      <View style={{ gap: 2, paddingVertical: 16, paddingHorizontal: 20 }}>
        <T size="lg" serif weight="500" accessibilityRole="header">
          {title}
        </T>
        {desc ? (
          <T size="sm" tone="muted">
            {desc}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SettingsBody({ ready }: { ready: boolean }) {
  const t = useT("settings");
  const p = usePrefs();
  const router = useRouter();
  const toast = useToast();
  const session = useTempoSession();
  const coach = useQuery(api.coach.getSettings, ready ? {} : "skip");
  const plan = useQuery(api.users.getMyPlan, ready ? {} : "skip");
  const updateProfile = useMutation(api.users.updateMyProfile);
  const setDial = useMutation(api.coach.setDial);
  const deleteAccount = useMutation(api.users.deleteMyAccount);
  const { signOut } = useAuthActions();
  const [name, setName] = useState("");
  const [dial, setDialLocal] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"out" | "delete" | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (session.profile) setName(session.profile.fullName ?? "");
  }, [session.profile]);

  const doSignOut = async () => {
    setSheet(null);
    await signOut().catch(() => undefined);
    router.replace("/(auth)/sign-in");
  };

  const doDelete = async () => {
    setDeleteError(false);
    try {
      await deleteAccount({});
      setDeleted(true);
    } catch {
      setDeleteError(true);
    }
  };

  // A deleted account has no profile any more, so the screen would wait forever: show the
  // confirmation and Sign out straight away instead.
  if (deleted) {
    return (
      <View style={{ gap: 16 }}>
        <T accessibilityLiveRegion="polite">{t("del.done")}</T>
        <Button block icon={LogOut} label={t("out.go")} onPress={doSignOut} />
      </View>
    );
  }

  if (!session.profile || coach === undefined || plan === undefined) return <StateLoading label={t("load.label")} rows={5} />;

  const dialValue = dial ?? coach.dial;
  const changeDial = (next: number) => {
    const value = clampDial(next);
    setDialLocal(value);
    setDial({ dial: value }).catch(() => {
      setDialLocal(null);
      toast({ title: t("save.error") });
    });
  };

  const saveName = () => {
    const value = name.trim();
    if (!value || value === (session.profile?.fullName ?? "")) return;
    updateProfile({ fullName: value })
      .then(() => toast({ title: t("saved.name", { name: value }) }))
      .catch(() => toast({ title: t("save.error") }));
  };

  const planLabel = plan?.label === "Free" ? t("plan.value") : (plan?.label ?? t("plan.value"));

  return (
    <View style={{ gap: 24 }}>
      <Section title={t("you.title")}>
        <View style={{ gap: 16, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Row className="gap-3" style={{ alignItems: "center" }}>
            <Avatar initials={session.initials} />
            <View style={{ flex: 1, gap: 4 }}>
              {session.fullName ? (
                <T weight="600" user>
                  {session.fullName}
                </T>
              ) : null}
              {session.profile.email ? (
                <T size="sm" tone="muted" ltr>
                  {session.profile.email}
                </T>
              ) : null}
            </View>
          </Row>
          <TextField
            label={t("you.call")}
            help={t("you.callHelp")}
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            maxLength={40}
            autoComplete="given-name"
            returnKeyType="done"
            user
          />
        </View>
      </Section>

      <Section title={t("look.title")}>
        <SettingRow label={t("lang.label")} help={t("lang.help")} stack first>
          <Segmented<Lang>
            block
            label={t("lang.label")}
            value={p.lang}
            onChange={p.setLang}
            options={[
              { value: "en", label: "English" },
              { value: "he", label: "עברית" },
            ]}
          />
        </SettingRow>
        <SettingRow label={t("dys.label")} help={t("dys.help")}>
          <SwitchControl
            value={p.readingFont}
            onChange={p.setReadingFont}
            label={t("dys.label")}
            onWord={t("switch.on")}
            offWord={t("switch.off")}
          />
        </SettingRow>
        <SettingRow label={t("size.label")} help={t("size.help")} stack>
          <Segmented<TextSize>
            block
            label={t("size.label")}
            value={p.textSize}
            onChange={p.setTextSize}
            options={[
              { value: "s", label: t("size.s") },
              { value: "m", label: t("size.m") },
              { value: "l", label: t("size.l") },
            ]}
          />
        </SettingRow>
        <SettingRow label={t("theme.label")} stack>
          <Segmented<ThemePref>
            block
            label={t("theme.label")}
            value={p.themePref}
            onChange={p.setThemePref}
            options={[
              { value: "light", label: t("theme.light"), icon: Sun },
              { value: "dark", label: t("theme.dark"), icon: Moon },
              { value: "system", label: t("theme.system") },
            ]}
          />
        </SettingRow>
        <View style={{ borderTopWidth: 1, borderTopColor: p.colors.line }}>
          <Link href="/accessibility" asChild>
            <TouchRow icon={Accessibility} label={t("comfort.label")} role="link" />
          </Link>
          <Link href="/tracking" asChild>
            <TouchRow icon={Clock} label={t("tracking.label")} role="link" last />
          </Link>
        </View>
      </Section>

      <Section title={t("coach.title")}>
        <View style={{ gap: 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Dial
            value={dialValue}
            onChange={changeDial}
            label={t("dial.label")}
            ofWord={t("dial.of")}
            words={{ quiet: t("dial.quiet"), steady: t("dial.steady"), push: t("dial.push") }}
          />
          <T size="sm" tone="muted">
            {t("dial.help")}
          </T>
        </View>
      </Section>

      <Section title={t("priv.title")} desc={t("priv.desc")}>
        <View style={{ borderTopWidth: 1, borderTopColor: p.colors.line }}>
          <TouchRow icon={X} label={t("delete.label")} last onPress={() => setSheet("delete")} />
        </View>
      </Section>

      <Section title={t("plan.title")}>
        <View style={{ borderTopWidth: 1, borderTopColor: p.colors.line }}>
          <TouchRow icon={CreditCard} label={t("plan.label")} value={planLabel} last />
        </View>
      </Section>

      <Button block icon={LogOut} label={t("out.btn")} onPress={() => setSheet("out")} />

      <Sheet visible={sheet === "out"} title={t("out.title")} onClose={() => setSheet(null)} closeLabel={t("more.close")} alert>
        <T>{t("out.body")}</T>
        <View style={{ gap: 8 }}>
          <Button block icon={LogOut} label={t("out.go")} onPress={doSignOut} />
          <Button block variant="ghost" label={t("out.stay")} onPress={() => setSheet(null)} />
        </View>
      </Sheet>

      <Sheet
        visible={sheet === "delete"}
        title={t("del.title")}
        onClose={() => (deleted ? doSignOut() : setSheet(null))}
        closeLabel={t("more.close")}
        alert
      >
        {deleted ? (
          <>
            <T accessibilityLiveRegion="polite">{t("del.done")}</T>
            <Button block icon={LogOut} label={t("out.go")} onPress={doSignOut} />
          </>
        ) : (
          <>
            <T>{t("del.body")}</T>
            <View style={{ gap: 8 }}>
              <Button block variant="danger" label={t("del.go")} onPress={doDelete} />
              <Button block variant="ghost" label={t("del.keep")} onPress={() => setSheet(null)} />
            </View>
          </>
        )}
        {deleteError ? (
          <T size="sm" tone="danger" accessibilityRole="alert">
            {t("del.error")}
          </T>
        ) : null}
      </Sheet>
    </View>
  );
}
