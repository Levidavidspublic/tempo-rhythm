/**
 * @screen  Onboarding (Bare: no tab bar)
 * @source  docs/design/v3/screens/mobile/onboarding.html (?step=1..5)
 * @actions 1 language -> preferences.update (applies at once) · reading font -> this phone
 *          2 name -> users.updateMyProfile (optional) · 3 coach dial -> coach.setDial (starts at 4)
 *          4 brain dump -> saved as a Markdown page with notes.create (optional)
 *          5 privacy -> finish: users.completeOnboarding, then Today
 * @states  default | loading | error (what you chose stays, Try again) | offline
 * The usage-analytics switch is left out: there is no analytics preference in the backend yet.
 */
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight, CircleAlert, RefreshCw } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Dial } from "@/components/v3/Dial";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Dot, Eyebrow, Notice, Row, T, TextField, TOUCH } from "@/components/v3/primitives";
import { useOffline, useTempoSession } from "@/components/v3/session";
import { OfflineNotice, StateLoading } from "@/components/v3/states";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const STEPS = 5;

function Choice({ label, hint, checked, onPress }: { label: string; hint: string; checked: boolean; onPress: () => void }) {
  const { colors: c, row } = usePrefs();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${label}, ${hint}`}
      accessibilityState={{ checked }}
      style={{ flexDirection: row, alignItems: "flex-start", gap: 12, minHeight: TOUCH, paddingVertical: 8 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 2,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: checked ? c.ink : c.lineControl,
          backgroundColor: c.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.ink }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T>{label}</T>
        <T size="sm" tone="muted">
          {hint}
        </T>
      </View>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const t = useT("onboarding");
  const p = usePrefs();
  const c = p.colors;
  const router = useRouter();
  const session = useTempoSession();
  const offline = useOffline();
  const params = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(() => Math.min(STEPS, Math.max(1, Number.parseInt(params.step ?? "1", 10) || 1)));
  const [name, setName] = useState("");
  const [dial, setDial] = useState(4);
  const [dump, setDump] = useState("");
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const updateProfile = useMutation(api.users.updateMyProfile);
  const saveDial = useMutation(api.coach.setDial);
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  // The page the brain dump made, so Back and Next again update it instead of making another.
  const dumpPage = useRef<{ id: Id<"notes">; text: string } | null>(null);
  const complete = useMutation(api.users.completeOnboarding);

  if (session.isLoading || !session.ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.ground, padding: 20 }}>
        <StateLoading label={t("load.label")} rows={3} />
      </SafeAreaView>
    );
  }

  const go = (n: number) => {
    setFailed(false);
    setStep(Math.min(STEPS, Math.max(1, n)));
  };

  const next = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (step === 2) {
        const value = name.trim();
        if (value) await updateProfile({ fullName: value });
        setNote(value ? `${t("note.name")} ${value}.` : t("note.noname"));
      } else if (step === 3) {
        await saveDial({ dial });
        setNote("");
      } else if (step === 4) {
        const text = dump.trim();
        const made = dumpPage.current;
        if (text && made) {
          if (made.text !== text) {
            await updateNote({ noteId: made.id, body: `${text}\n` });
            dumpPage.current = { id: made.id, text };
          }
        } else if (text) {
          const id = await createNote({ title: t("dump.label"), body: `${text}\n` });
          dumpPage.current = { id, text };
        }
        setNote(text || made ? t("note.saved") : t("note.nodump"));
      } else if (step === 5) {
        await complete({});
        router.replace("/(tempo)/(tabs)/today");
        return;
      } else {
        setNote("");
      }
      go(step + 1);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    setNote("");
    go(step + 1);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style={p.dark ? "light" : "dark"} backgroundColor={c.ground} translucent={false} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 24 }}>
        {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
        <Row style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View accessible accessibilityLiveRegion="polite">
            <Eyebrow>{`${t("step")} ${step} ${t("of")} ${STEPS}`}</Eyebrow>
          </View>
          <Row className="gap-2" style={{ alignItems: "center" }}>
            {Array.from({ length: STEPS }, (_, i) => (
              <Dot key={i} state={i + 1 < step ? "done" : i + 1 === step ? "current" : "todo"} />
            ))}
          </Row>
        </Row>

        {failed ? (
          <Notice
            tone="caution"
            icon={CircleAlert}
            title={t("err.title")}
            body={`${t("err.safe")} ${t("err.body")}`}
            live="assertive"
            action={<Button small icon={RefreshCw} label={t("state.retry")} onPress={next} />}
          />
        ) : null}

        {step === 1 ? (
          <View style={{ gap: 20 }}>
            <Head title={t("s1.title")} lede={t("s1.lede")} />
            <View accessibilityRole="radiogroup" accessibilityLabel={t("lang.legend")} style={{ gap: 4 }}>
              <T size="sm" weight="600">
                {t("lang.legend")}
              </T>
              <Choice label="English" hint={t("lang.en.hint")} checked={p.lang === "en"} onPress={() => p.setLang("en")} />
              <Choice label="עברית" hint={t("lang.he.hint")} checked={p.lang === "he"} onPress={() => p.setLang("he")} />
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel={t("font.legend")} style={{ gap: 4 }}>
              <T size="sm" weight="600">
                {t("font.legend")}
              </T>
              <Choice label={t("font.std")} hint={t("font.std.hint")} checked={!p.readingFont} onPress={() => p.setReadingFont(false)} />
              <Choice label={t("font.dys")} hint={t("font.dys.hint")} checked={p.readingFont} onPress={() => p.setReadingFont(true)} />
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 20 }}>
            <Head title={t("s2.title")} lede={t("s2.lede")} />
            <TextField
              label={t("name.label")}
              optionalWord={t("optional")}
              help={t("name.help")}
              value={name}
              onChangeText={setName}
              placeholder={session.name || undefined}
              maxLength={40}
              autoComplete="given-name"
              user
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 20 }}>
            <Head title={t("s3.title")} lede={t("s3.lede")} />
            <Dial
              value={dial}
              onChange={setDial}
              label={t("dial.label")}
              ofWord={t("dial.of")}
              words={{ quiet: t("dial.quiet"), steady: t("dial.steady"), push: t("dial.push") }}
            />
            <T size="sm" tone="muted">
              {t("dial.help")}
            </T>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: 20 }}>
            <Head title={t("s4.title")} lede={t("s4.lede")} />
            <TextField
              label={t("dump.label")}
              optionalWord={t("optional")}
              help={t("dump.help")}
              value={dump}
              onChangeText={setDump}
              placeholder={t("dump.ph")}
              multiline
              minHeight={160}
              user
            />
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: 20 }}>
            <Head title={t("s5.title")} lede={t("s5.lede")} />
            <View style={{ gap: 8 }}>
              {(["priv.1", "priv.2", "priv.3"] as const).map((key) => (
                <Row key={key} className="gap-2">
                  <T size="sm" tone="muted">
                    •
                  </T>
                  <View style={{ flex: 1 }}>
                    <T size="sm">{t(key)}</T>
                  </View>
                </Row>
              ))}
            </View>
          </View>
        ) : null}

        {note ? (
          <T size="sm" tone="muted" accessibilityLiveRegion="polite">
            {note}
          </T>
        ) : null}

        <View style={{ gap: 8 }}>
          <Button
            variant="primary"
            block
            iconEnd={p.rtl ? ArrowLeft : ArrowRight}
            label={step === STEPS ? t("finish") : t("next")}
            onPress={next}
            disabled={busy}
          />
          {step > 1 ? (
            <Row className="gap-2">
              <View style={{ flex: 1 }}>
                <Button block variant="ghost" label={t("back")} onPress={() => go(step - 1)} />
              </View>
              {step === 2 || step === 4 ? (
                <View style={{ flex: 1 }}>
                  <Button block variant="ghost" label={t("skip.now")} onPress={skip} />
                </View>
              ) : null}
            </Row>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Head({ title, lede }: { title: string; lede: string }) {
  return (
    <View style={{ gap: 8 }}>
      <T size="2xl" serif weight="500" accessibilityRole="header">
        {title}
      </T>
      <T tone="muted">{lede}</T>
    </View>
  );
}
