/**
 * The five screen states (components.md §2.18): loading, error, empty and the offline notice;
 * default is the screen itself. Errors from Convex queries land in QueryBoundary, which offers Retry.
 */
import { type LucideIcon, RefreshCw, WifiOff } from "lucide-react-native";
import { Component, type ErrorInfo, Fragment, type ReactNode } from "react";
import { View } from "react-native";
import { Button, Notice, SkeletonRows, T } from "./primitives";
import { usePrefs } from "./prefs";

export function StateLoading({ label, rows = 3, block }: { label: string; rows?: number; block?: boolean }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <SkeletonRows rows={rows} block={block} />
    </View>
  );
}

function StateIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { colors: c } = usePrefs();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" }}
    >
      <Icon size={24} color={c.ink} />
    </View>
  );
}

export function StateError({
  title,
  safe,
  body,
  retryLabel,
  onRetry,
}: {
  title: string;
  safe: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", gap: 12, paddingVertical: 48, paddingHorizontal: 16 }}>
      <StateIcon icon={RefreshCw} />
      <T size="xl" weight="500" serif center accessibilityRole="header">
        {title}
      </T>
      <T tone="muted" center>{`${safe} ${body}`}</T>
      <Button label={retryLabel} icon={RefreshCw} onPress={onRetry} />
    </View>
  );
}

export function StateEmpty({
  icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 48, paddingHorizontal: 16 }}>
      <StateIcon icon={icon} />
      <T size="xl" weight="500" serif center accessibilityRole="header">
        {title}
      </T>
      <T tone="muted" center>
        {body}
      </T>
      {children ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>{children}</View> : null}
    </View>
  );
}

export function OfflineNotice({ title, body }: { title: string; body: string }) {
  return <Notice tone="caution" icon={WifiOff} title={title} body={body} live="polite" />;
}

type BoundaryProps = { children: ReactNode; fallback: (retry: () => void) => ReactNode };
type BoundaryState = { failed: boolean; attempt: number };

/** Catches a failed query below it and shows the screen's error state; Retry mounts it again. */
export class QueryBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The error text stays out of the interface (no developer words); the state says it kindly.
  }

  retry = (): void => {
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback(this.retry);
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
