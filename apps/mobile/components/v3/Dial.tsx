/**
 * Coach dial 0–10 (components.md: Dial). Number AND word: quiet 0–3, steady 4–7, push 8–10.
 * Minus / plus buttons (44 pt) and an adjustable control for screen readers; the bar is decoration.
 */
import { Minus, Plus } from "lucide-react-native";
import { View } from "react-native";
import { dialWord } from "@/lib/v3/display";
import { usePrefs } from "./prefs";
import { Button, RADIUS, Row, T } from "./primitives";

export function Dial({
  value,
  onChange,
  label,
  ofWord,
  words,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  /** "of 10" */
  ofWord: string;
  words: { quiet: string; steady: string; push: string };
}) {
  const { colors: c } = usePrefs();
  const word = words[dialWord(value)];
  const set = (next: number) => onChange(Math.min(10, Math.max(0, next)));
  return (
    <View style={{ gap: 12 }}>
      <Row className="gap-2" wrap style={{ alignItems: "baseline" }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <T size="sm" weight="600">
            {label}
          </T>
        </View>
        <Row className="gap-1" style={{ alignItems: "baseline" }}>
          <T size="2xl" serif ltr>
            {String(value)}
          </T>
          <T size="sm" tone="muted">
            {ofWord}
          </T>
          <View style={{ paddingHorizontal: 8, borderRadius: RADIUS.sm, backgroundColor: c.sunken }}>
            <T size="sm" weight="600">
              {word}
            </T>
          </View>
        </Row>
      </Row>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 10, now: value, text: `${value} ${ofWord}, ${word}` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
      >
        <Row className="gap-3" style={{ alignItems: "center" }}>
          <Button iconOnly icon={Minus} accessibilityLabel={`${label} −1`} disabled={value <= 0} onPress={() => set(value - 1)} />
          <Row style={{ flex: 1, gap: 3 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < value ? c.ink : c.sunken }} />
            ))}
          </Row>
          <Button iconOnly icon={Plus} accessibilityLabel={`${label} +1`} disabled={value >= 10} onPress={() => set(value + 1)} />
        </Row>
      </View>
      <Row style={{ justifyContent: "space-between" }}>
        <T size="xs" tone="muted">{`0 ${words.quiet}`}</T>
        <T size="xs" tone="muted">
          {words.steady}
        </T>
        <T size="xs" tone="muted">{`${words.push} 10`}</T>
      </Row>
    </View>
  );
}
