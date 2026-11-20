/**
 * v3 primitives for React Native, mirroring docs/design/v3/tempo.css (DESIGN.md §9 component table).
 * Layout uses NativeWind classes; colours come from the v3 palette (usePrefs), never from literals.
 * Touch targets are at least 44 pt.
 */
import { Check, ChevronLeft, ChevronRight, type LucideIcon, Search } from "lucide-react-native";
import type { ReactNode, RefObject } from "react";
import {
  type AccessibilityRole,
  type AccessibilityState,
  I18nManager,
  Platform,
  Pressable,
  type StyleProp,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { startAlign, textDirection } from "@/lib/v3/i18n";
import { type Palette, usePrefs } from "./prefs";

export const RADIUS = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
export const TOUCH = 44;

/** Newsreader / IBM Plex Mono are not bundled in the app yet; these are the closest system faces. */
export const FONT = {
  serif: Platform.select({ ios: "Georgia", android: "serif", default: undefined }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }),
};

const SIZE = { xs: 13, sm: 15, md: 17, lg: 20, xl: 24, "2xl": 30, "3xl": 38 } as const;
export type TextSizeName = keyof typeof SIZE;
export type Tone = "ink" | "muted" | "subtle" | "accent" | "onAccent" | "done" | "info" | "caution" | "danger" | "paper";

function toneColor(c: Palette, tone: Tone): string {
  switch (tone) {
    case "muted":
      return c.inkMuted;
    case "subtle":
      return c.inkSubtle;
    case "accent":
      return c.accent;
    case "onAccent":
      return c.onAccent;
    case "done":
      return c.done;
    case "info":
      return c.info;
    case "caution":
      return c.caution;
    case "danger":
      return c.danger;
    case "paper":
      return c.paper;
    default:
      return c.ink;
  }
}

/** A token colour at `alpha` opacity (tokens are 6-digit hex; anything else is returned as is). */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${byte}`;
}

function plainText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(plainText).join("");
  return "";
}

export type TProps = {
  children?: ReactNode;
  size?: TextSizeName;
  weight?: "400" | "500" | "600" | "700";
  tone?: Tone;
  serif?: boolean;
  mono?: boolean;
  /** Numbers, times and codes: always left to right (DESIGN.md §10). */
  ltr?: boolean;
  /** Text the person wrote: direction comes from its first strong letter, like dir="auto". */
  user?: boolean;
  /** The plain text to read the direction from, when the children are nested spans. */
  dirText?: string;
  center?: boolean;
  lines?: number;
  strike?: boolean;
  underline?: boolean;
  /** Snug line height for headings and labels. */
  snug?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessible?: boolean;
  accessibilityLiveRegion?: "none" | "polite" | "assertive";
  importantForAccessibility?: "auto" | "yes" | "no" | "no-hide-descendants";
  selectable?: boolean;
  testID?: string;
  nativeID?: string;
};

/** Text on the v3 scale (13 px floor), in the person's text size, language direction and theme. */
export function T({
  children,
  size = "md",
  weight = "400",
  tone = "ink",
  serif,
  mono,
  ltr,
  user,
  dirText,
  center,
  lines,
  strike,
  underline,
  snug,
  style,
  ...rest
}: TProps) {
  const p = usePrefs();
  const fontSize = Math.max(13, Math.round(SIZE[size] * p.textScale));
  const heading = serif && SIZE[size] >= 20;
  const lineHeight = Math.round(fontSize * (heading ? 1.18 : snug ? 1.35 : p.readingFont ? 1.8 : 1.6));
  let writingDirection: "ltr" | "rtl" = p.rtl ? "rtl" : "ltr";
  let textAlign: TextStyle["textAlign"] = center ? "center" : p.align;
  if (ltr) writingDirection = "ltr";
  if (user && !center) {
    const dir = textDirection(dirText ?? plainText(children), p.rtl ? "rtl" : "ltr");
    writingDirection = dir;
    textAlign = startAlign(dir === "rtl", I18nManager.isRTL);
  }
  const spacing = p.readingFont && !mono ? fontSize * 0.035 : undefined;
  return (
    <Text
      numberOfLines={lines}
      style={[
        {
          color: toneColor(p.colors, tone),
          fontSize,
          lineHeight,
          fontWeight: weight,
          fontFamily: mono ? FONT.mono : serif && !p.readingFont ? FONT.serif : undefined,
          writingDirection,
          textAlign,
          letterSpacing: spacing,
          textDecorationLine: strike ? "line-through" : underline ? "underline" : "none",
          textDecorationColor: strike ? p.colors.inkSubtle : p.colors.lineStrong,
          fontVariant: mono || ltr ? ["tabular-nums"] : undefined,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/** Uppercase small label; Hebrew drops the case and tracking (DESIGN.md §10). */
export function Eyebrow({ children, nativeID }: { children: ReactNode; nativeID?: string }) {
  const { rtl } = usePrefs();
  return (
    <T
      size="xs"
      weight="600"
      tone="muted"
      nativeID={nativeID}
      style={rtl ? undefined : { textTransform: "uppercase", letterSpacing: 0.8 }}
    >
      {children}
    </T>
  );
}

/** A row that reads in the language's order on any native layout direction. */
export function Row({
  children,
  className,
  style,
  wrap,
  ...rest
}: {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessible?: boolean;
}) {
  const { row } = usePrefs();
  return (
    <View className={className} style={[{ flexDirection: row, flexWrap: wrap ? "wrap" : "nowrap" }, style]} {...rest}>
      {children}
    </View>
  );
}

/** A forward chevron (flips for Hebrew) or a back chevron. */
export function Chevron({ back, size = 16, color }: { back?: boolean; size?: number; color?: string }) {
  const { rtl, colors } = usePrefs();
  const forwardIsRight = !rtl;
  const right = back ? !forwardIsRight : forwardIsRight;
  const Icon = right ? ChevronRight : ChevronLeft;
  return <Icon size={size} color={color ?? colors.inkSubtle} />;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost" | "ink";

export type ButtonProps = {
  label?: string;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  /** Icon-only square button; needs accessibilityLabel. */
  iconOnly?: boolean;
  /** Pressed look for toggles (aria-pressed). */
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  icon: Icon,
  iconEnd: IconEnd,
  variant = "secondary",
  small,
  block,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
  accessibilityState,
  iconOnly,
  pressed: on,
  style,
  testID,
}: ButtonProps) {
  const p = usePrefs();
  const c = p.colors;
  const bg: Record<ButtonVariant, string> = {
    primary: c.accent,
    secondary: c.paper,
    ghost: "transparent",
    danger: c.dangerWash,
    dangerGhost: "transparent",
    ink: c.ink,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: c.onAccent,
    secondary: c.ink,
    ghost: c.ink,
    danger: c.danger,
    dangerGhost: c.danger,
    ink: c.paper,
  };
  const border: Record<ButtonVariant, string> = {
    primary: "transparent",
    secondary: c.lineControl,
    ghost: "transparent",
    danger: c.danger,
    dangerGhost: "transparent",
    ink: "transparent",
  };
  const height = small ? 36 : TOUCH;
  const slop = small ? (TOUCH - height) / 2 : 0;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={slop ? { top: slop, bottom: slop, left: 0, right: 0 } : undefined}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, ...(on !== undefined ? { selected: on } : {}), ...accessibilityState }}
      style={({ pressed }) => [
        {
          flexDirection: p.row,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: height,
          minWidth: iconOnly ? height : undefined,
          paddingHorizontal: iconOnly ? 0 : small ? 12 : 16,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: on ? c.done : border[variant],
          backgroundColor: on
            ? c.doneWash
            : pressed && (variant === "secondary" || variant === "ghost")
              ? c.hover
              : pressed && variant === "dangerGhost"
                ? c.dangerWash
                : bg[variant],
          opacity: disabled ? 0.55 : 1,
          alignSelf: block ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {Icon ? <Icon size={small ? 16 : 18} color={on ? c.done : fg[variant]} /> : null}
      {label && !iconOnly ? (
        <Text
          style={{
            color: on ? c.done : fg[variant],
            fontSize: Math.max(13, Math.round(15 * p.textScale)),
            fontWeight: "600",
            writingDirection: p.rtl ? "rtl" : "ltr",
          }}
        >
          {label}
        </Text>
      ) : null}
      {IconEnd ? <IconEnd size={16} color={fg[variant]} /> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Chips, badges, tags                                                 */
/* ------------------------------------------------------------------ */

export function Chip({
  label,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  icon?: LucideIcon;
  tone?: "neutral" | "fixed" | "flex" | "done";
}) {
  const { colors: c, row } = usePrefs();
  const map = {
    neutral: [c.sunken, c.inkMuted],
    fixed: [c.infoWash, c.info],
    flex: [c.cautionWash, c.caution],
    done: [c.doneWash, c.done],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: row, alignItems: "center", gap: 4, minHeight: 28, paddingHorizontal: 8, borderRadius: RADIUS.sm, backgroundColor: bg }}>
      {Icon ? <Icon size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function Badge({
  label,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  icon?: LucideIcon;
  tone?: "neutral" | "done" | "info" | "caution";
}) {
  const { colors: c, row } = usePrefs();
  const map = {
    neutral: [c.sunken, c.inkMuted],
    done: [c.doneWash, c.done],
    info: [c.infoWash, c.info],
    caution: [c.cautionWash, c.caution],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: row, alignItems: "center", gap: 4, minHeight: 24, paddingHorizontal: 8, borderRadius: RADIUS.pill, backgroundColor: bg, alignSelf: "flex-start" }}>
      {Icon ? <Icon size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/** "#tag", from the page-meta block or a project name. */
export function Tag({ label }: { label: string }) {
  const { colors: c } = usePrefs();
  return (
    <View style={{ minHeight: 28, justifyContent: "center", paddingHorizontal: 8, borderRadius: RADIUS.pill, backgroundColor: c.sunken }}>
      <T size="sm" tone="muted" user>
        {`#${label}`}
      </T>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  strong,
  className,
  style,
  padded = true,
}: {
  children?: ReactNode;
  strong?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { colors: c } = usePrefs();
  return (
    <View
      className={className}
      style={[
        {
          backgroundColor: c.paper,
          borderWidth: 1,
          borderColor: strong ? c.lineStrong : c.line,
          borderRadius: RADIUS.lg,
          padding: padded ? 16 : 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type NoticeTone = "neutral" | "info" | "caution" | "done" | "danger";

export function Notice({
  tone = "neutral",
  icon: Icon,
  title,
  body,
  action,
  live,
}: {
  tone?: NoticeTone;
  icon?: LucideIcon;
  title?: string;
  body?: string;
  action?: ReactNode;
  live?: "polite" | "assertive";
}) {
  const p = usePrefs();
  const c = p.colors;
  const map = {
    neutral: [c.sunken, c.line, c.inkMuted],
    info: [c.infoWash, c.info, c.info],
    caution: [c.cautionWash, c.caution, c.caution],
    done: [c.doneWash, c.done, c.done],
    danger: [c.dangerWash, c.danger, c.danger],
  } as const;
  const [bg, edge, iconColor] = map[tone];
  return (
    <View
      accessible
      accessibilityRole={live === "assertive" ? "alert" : "summary"}
      accessibilityLiveRegion={live}
      accessibilityLabel={[title, body].filter(Boolean).join(" ")}
      style={{
        flexDirection: p.row,
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: RADIUS.lg,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: tone === "neutral" ? edge : withAlpha(edge, 0.35),
      }}
    >
      {Icon ? (
        <View style={{ paddingTop: 2 }}>
          <Icon size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <T size="sm" weight="600" snug>
            {title}
          </T>
        ) : null}
        {body ? (
          <T size="sm" snug>
            {body}
          </T>
        ) : null}
      </View>
      {action ? <View style={{ alignSelf: "center" }}>{action}</View> : null}
    </View>
  );
}

export function Avatar({ initials }: { initials: string }) {
  const { colors: c } = usePrefs();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: c.ground, fontSize: 13, fontWeight: "700" }}>{initials || "·"}</Text>
    </View>
  );
}

export function Divider() {
  const { colors: c } = usePrefs();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

/* ------------------------------------------------------------------ */
/* Headings                                                            */
/* ------------------------------------------------------------------ */

export function PageHeader({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <T size="2xl" weight="500" serif accessibilityRole="header">
        {title}
      </T>
      {typeof sub === "string" ? <T tone="muted">{sub}</T> : sub}
    </View>
  );
}

export function SectionHead({ title, count }: { title: string; count?: string }) {
  return (
    <Row className="items-baseline gap-3" wrap>
      <View style={{ flex: 1 }}>
        <T size="xl" weight="500" serif accessibilityRole="header">
          {title}
        </T>
      </View>
      {count ? (
        <T size="sm" tone="muted">
          {count}
        </T>
      ) : null}
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

/** The task checkbox (tp-check): a 44 pt target around a 22 pt box. */
export function Checkbox({
  checked,
  onPress,
  label,
  disabled,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  const { colors: c } = usePrefs();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      style={{ width: TOUCH, height: TOUCH, margin: -6, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? c.done : c.lineControl,
          backgroundColor: checked ? c.done : c.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Check size={14} strokeWidth={2.5} color={c.paper} /> : null}
      </View>
    </Pressable>
  );
}

export type SegOption<V extends string> = { value: V; label: string; hint?: string; icon?: LucideIcon };

/** Single choice (toggle-group): a dot and the word mark the choice, never colour alone. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
  block,
  tall,
}: {
  options: readonly SegOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  label: string;
  block?: boolean;
  tall?: boolean;
}) {
  const p = usePrefs();
  const c = p.colors;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: p.row,
        gap: 4,
        padding: 4,
        backgroundColor: c.sunken,
        borderRadius: RADIUS.md,
        alignSelf: block ? "stretch" : "flex-start",
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
            accessibilityState={{ checked: on, selected: on }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{
              flex: block ? 1 : undefined,
              minHeight: tall ? TOUCH + 8 : TOUCH - 8,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: RADIUS.sm,
              borderWidth: 1,
              borderColor: on ? c.lineControl : "transparent",
              backgroundColor: on ? c.paper : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ flexDirection: tall ? "column" : p.row, alignItems: "center", gap: tall ? 2 : 6 }}>
              {on ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.ink }} /> : null}
              {Icon ? <Icon size={16} color={on ? c.ink : c.inkMuted} /> : null}
              <Text style={{ color: on ? c.ink : c.inkMuted, fontSize: Math.max(13, Math.round(15 * p.textScale)), fontWeight: "600" }}>
                {o.label}
              </Text>
              {o.hint ? <Text style={{ color: on ? c.ink : c.inkMuted, fontSize: 13 }}>{o.hint}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The On / Off switch with its word (colour is never the only signal). */
export function SwitchControl({
  value,
  onChange,
  label,
  onWord,
  offWord,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  onWord: string;
  offWord: string;
  disabled?: boolean;
}) {
  const p = usePrefs();
  const c = p.colors;
  return (
    <View style={{ flexDirection: p.row, alignItems: "center", gap: 8, minHeight: TOUCH }}>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        trackColor={{ false: c.sunken, true: c.done }}
        thumbColor={c.paper}
        ios_backgroundColor={c.sunken}
      />
      <T size="sm" weight="600" tone="muted" importantForAccessibility="no">
        {value ? onWord : offWord}
      </T>
    </View>
  );
}

type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hideLabel?: boolean;
  help?: string;
  error?: string | null;
  optionalWord?: string;
  inputRef?: RefObject<TextInput | null>;
  /** User text: the box takes the direction of what is typed. */
  user?: boolean;
  /** Emails and codes stay left to right. */
  ltr?: boolean;
  minHeight?: number;
};

export function TextField({
  label,
  hideLabel,
  help,
  error,
  optionalWord,
  inputRef,
  user,
  ltr,
  multiline,
  minHeight,
  value,
  ...rest
}: FieldProps) {
  const p = usePrefs();
  const c = p.colors;
  const dir = ltr ? "ltr" : user ? textDirection(value ?? "", p.rtl ? "rtl" : "ltr") : p.rtl ? "rtl" : "ltr";
  return (
    <View style={{ gap: 4 }}>
      {hideLabel ? null : (
        <T size="sm" weight="600">
          {label}
          {optionalWord ? <T size="sm" tone="muted">{` ${optionalWord}`}</T> : null}
        </T>
      )}
      <TextInput
        ref={inputRef}
        value={value}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={error ?? help}
        placeholderTextColor={c.inkSubtle}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: minHeight ?? (multiline ? 96 : TOUCH),
          paddingHorizontal: 12,
          paddingVertical: multiline ? 12 : 8,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: error ? c.danger : c.lineControl,
          backgroundColor: rest.editable === false ? c.sunken : c.paper,
          color: c.ink,
          fontSize: Math.round(17 * p.textScale),
          lineHeight: multiline ? Math.round(17 * p.textScale * 1.5) : undefined,
          writingDirection: dir,
          textAlign: startAlign(dir === "rtl", I18nManager.isRTL),
        }}
        {...rest}
      />
      {error ? (
        <T size="sm" tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      {help ? (
        <T size="sm" tone="muted">
          {help}
        </T>
      ) : null}
    </View>
  );
}

/** Search box with a visible magnifier and a label for screen readers (tp-search). */
export function SearchField({
  label,
  value,
  onChangeText,
  placeholder,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  inputRef?: RefObject<TextInput | null>;
}) {
  const p = usePrefs();
  const c = p.colors;
  const dir = textDirection(value, p.rtl ? "rtl" : "ltr");
  return (
    <View style={{ justifyContent: "center" }}>
      <View
        pointerEvents="none"
        style={[{ position: "absolute", zIndex: 1 }, p.rtl === I18nManager.isRTL ? { start: 12 } : { end: 12 }]}
      >
        <Search size={16} color={c.inkMuted} />
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.inkSubtle}
        accessibilityLabel={label}
        returnKeyType="search"
        autoCorrect={false}
        style={{
          minHeight: TOUCH,
          paddingStart: p.rtl === I18nManager.isRTL ? 40 : 12,
          paddingEnd: p.rtl === I18nManager.isRTL ? 12 : 40,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: c.lineControl,
          backgroundColor: c.paper,
          color: c.ink,
          fontSize: Math.round(17 * p.textScale),
          writingDirection: dir,
          textAlign: startAlign(dir === "rtl", I18nManager.isRTL),
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

/** At least 56 pt, chevron flips for Hebrew (tp-touch-row). */
export function TouchRow({
  icon: Icon,
  label,
  value,
  onPress,
  last,
  role = "button",
  tone = "ink",
}: {
  icon?: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  role?: AccessibilityRole;
  tone?: "ink" | "danger";
}) {
  const p = usePrefs();
  const c = p.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? role : "text"}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => ({
        flexDirection: p.row,
        alignItems: "center",
        gap: 12,
        minHeight: TOUCH + 12,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
        backgroundColor: pressed ? c.hover : "transparent",
      })}
    >
      {Icon ? <Icon size={20} color={tone === "danger" ? c.danger : c.inkMuted} /> : null}
      <View style={{ flex: 1 }}>
        <T tone={tone === "danger" ? "danger" : "ink"}>{label}</T>
      </View>
      {value ? (
        <T size="sm" tone="muted">
          {value}
        </T>
      ) : null}
      {onPress ? <Chevron /> : null}
    </Pressable>
  );
}

/** List row (tp-list-row): icon, one-line title, meta line, chevron. */
export function ListRow({
  icon: Icon,
  title,
  meta,
  onPress,
  last,
  accessibilityLabel,
}: {
  icon?: LucideIcon;
  title: string;
  meta?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const p = usePrefs();
  const c = p.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "link" : "text"}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({
        flexDirection: p.row,
        alignItems: "center",
        gap: 12,
        minHeight: TOUCH + 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
        backgroundColor: pressed ? c.hover : "transparent",
      })}
    >
      {Icon ? (
        <View style={{ minWidth: 24, alignItems: "center" }}>
          <Icon size={20} color={c.inkMuted} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="500" lines={1} user>
          {title}
        </T>
        {meta ? (
          <Row className="gap-2" wrap style={{ alignItems: "center" }}>
            {meta}
          </Row>
        ) : null}
      </View>
      {onPress ? <Chevron /> : null}
    </Pressable>
  );
}

/** A setting: label and help at the start, the control at the end, or stacked under it. */
export function SettingRow({
  label,
  help,
  children,
  stack,
  first,
}: {
  label: string;
  help?: string;
  children: ReactNode;
  stack?: boolean;
  first?: boolean;
}) {
  const p = usePrefs();
  const c = p.colors;
  return (
    <View
      style={{
        flexDirection: stack ? "column" : p.row,
        alignItems: stack ? "stretch" : "center",
        gap: 12,
        minHeight: TOUCH + 16,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
      }}
    >
      <View style={{ flex: stack ? undefined : 1, gap: 2 }}>
        <T weight="600">{label}</T>
        {help ? (
          <T size="sm" tone="muted">
            {help}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Skeleton rows (tp-skel-row); static so reduced motion never sees a shimmer. */
export function SkeletonRows({ rows = 3, block }: { rows?: number; block?: boolean }) {
  const { colors: c, row } = usePrefs();
  const widths = ["80%", "60%", "100%", "60%", "40%"] as const;
  return (
    <View style={{ gap: 16 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {block ? <View style={{ height: 120, borderRadius: RADIUS.lg, backgroundColor: c.sunken }} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: row, gap: 12, alignItems: "center" }}>
          <View style={{ width: 22, height: 22, borderRadius: RADIUS.sm, backgroundColor: c.sunken }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 16, width: widths[i % widths.length], borderRadius: RADIUS.sm, backgroundColor: c.sunken }} />
            <View style={{ height: 12, width: "40%", borderRadius: RADIUS.sm, backgroundColor: c.sunken }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Small dot used for step progress (tp-dot): done, current, still to come. */
export function Dot({ state }: { state: "done" | "current" | "todo" }) {
  const { colors: c } = usePrefs();
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: state === "done" ? c.done : state === "current" ? c.info : "transparent",
        borderWidth: state === "todo" ? 1.5 : 0,
        borderColor: c.inkMuted,
      }}
    />
  );
}
