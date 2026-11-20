/**
 * Tempo v3 icons: one 1.5 px line family on a 24 grid, as an SVG sprite.
 * Copied from docs/design/v3/tempo.js (ICONS). <TpIconSprite /> renders once in TempoShell;
 * <TpIcon name="today" /> references a symbol, exactly like the HTML screens do.
 */

const ICONS = {
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/>",
  "moon": "<path d=\"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z\"/>",
  "check": "<path d=\"M5 12.5l4.5 4.5L19 7.5\"/>",
  "plus": "<path d=\"M12 5v14M5 12h14\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"M16 16l4.5 4.5\"/>",
  "sidebar": "<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"2.5\"/><path d=\"M9.5 4.5v15\"/>",
  "page": "<path d=\"M7 3.5h7l4.5 4.5v12.5H7z\"/><path d=\"M14 3.5V8h4.5M9.5 12.5h6M9.5 16h4\"/>",
  "today": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2.5\"/><path d=\"M8 3v4M16 3v4M4 10h16\"/><circle cx=\"12\" cy=\"15\" r=\"1.5\"/>",
  "inbox": "<path d=\"M4 13.5l2.5-8h11l2.5 8v5H4z\"/><path d=\"M4 13.5h5l1 2h4l1-2h5\"/>",
  "folder": "<path d=\"M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z\"/>",
  "template": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2.5\"/><path d=\"M4 9.5h16M9.5 9.5V20\"/>",
  "chevron": "<path d=\"M9.5 6l6 6-6 6\"/>",
  "down": "<path d=\"M6 9.5l6 6 6-6\"/>",
  "grip": "<circle cx=\"9\" cy=\"6.5\" r=\"1\"/><circle cx=\"15\" cy=\"6.5\" r=\"1\"/><circle cx=\"9\" cy=\"12\" r=\"1\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><circle cx=\"9\" cy=\"17.5\" r=\"1\"/><circle cx=\"15\" cy=\"17.5\" r=\"1\"/>",
  "coach": "<path d=\"M4.5 12a7.5 7.5 0 1 1 3.4 6.3L4.5 19.5l1.2-3.4A7.5 7.5 0 0 1 4.5 12z\"/><path d=\"M9 11h6M9 14h3.5\"/>",
  "mic": "<rect x=\"9\" y=\"3.5\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3\"/>",
  "send": "<path d=\"M12 19V5M6 11l6-6 6 6\"/>",
  "x": "<path d=\"M6 6l12 12M18 6L6 18\"/>",
  "undo": "<path d=\"M9 14L4.5 9.5 9 5\"/><path d=\"M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4.5l3 2\"/>",
  "hash": "<path d=\"M9 4L7.5 20M16.5 4L15 20M4.5 9h15M4 15h15\"/>",
  "link": "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
  "text": "<path d=\"M5 6.5h14M12 6.5v12\"/>",
  "heading": "<path d=\"M6 5v14M16 5v14M6 12h10M19 19v-6l-2 1\"/>",
  "list": "<path d=\"M9 7h11M9 12h11M9 17h11\"/><circle cx=\"4.75\" cy=\"7\" r=\".75\"/><circle cx=\"4.75\" cy=\"12\" r=\".75\"/><circle cx=\"4.75\" cy=\"17\" r=\".75\"/>",
  "checklist": "<path d=\"M4 7l1.5 1.5L8.5 5.5M4 15l1.5 1.5 3-3M11.5 7.5h8.5M11.5 15.5h8.5\"/>",
  "task": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"4\"/><path d=\"M8.5 12l2.5 2.5 4.5-5\"/>",
  "timeblock": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2.5\"/><path d=\"M4 10h16M8 14h5\"/>",
  "habit": "<path d=\"M20 12a8 8 0 1 1-2.3-5.6\"/><path d=\"M20 4.5V9h-4.5\"/>",
  "energy": "<path d=\"M4 16a8 8 0 0 1 16 0\"/><path d=\"M12 16l3.5-4.5\"/><circle cx=\"12\" cy=\"16\" r=\"1\"/>",
  "nag": "<path d=\"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z\"/><path d=\"M10 20.5a2 2 0 0 0 4 0\"/>",
  "more": "<circle cx=\"6\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"18\" cy=\"12\" r=\"1\"/>",
  "play": "<path d=\"M8 5.5v13l10.5-6.5z\"/>",
  "edit": "<path d=\"M14.5 5.5l4 4L9 19H5v-4z\"/><path d=\"M12.5 7.5l4 4\"/>",
  "arrow": "<path d=\"M5 12h14M13 6l6 6-6 6\"/>",
  "type": "<path d=\"M4 18L9 6l5 12M5.8 14h6.4M15.5 18v-5.5a2.5 2.5 0 0 1 5 0V18M15.5 15h5\"/>",
  "settings": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6\"/>",
  "leaf": "<path d=\"M5 19c0-8 5-13 14-14 0 9-5 14-13 14z\"/><path d=\"M5 19l7-7\"/>",
  "box": "<path d=\"M4 8l8-4 8 4v8l-8 4-8-4z\"/><path d=\"M4 8l8 4 8-4M12 12v8\"/>",
  "phone": "<path d=\"M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z\"/>",
  "phone-off": "<path d=\"M6.5 4h3l1.5 4-2 1.5c.5 1.2 1.2 2.3 2 3.2M14.5 15l1-1.5 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 8 15.5\"/><path d=\"M4 4l16 16\"/>",
  "volume": "<path d=\"M4.5 9.5h3l4.5-4v13l-4.5-4h-3z\"/><path d=\"M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11\"/>",
  "pause": "<path d=\"M9 6v12M15 6v12\"/>",
  "waveform": "<path d=\"M4 12h1.5M7.5 9v6M11 6v12M14.5 8.5v7M18 10.5v3M20 12h.5\"/>",
  "history": "<path d=\"M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9\"/><path d=\"M4.5 4.5V9H9M12 8v4.5l3 1.5\"/>",
  "memory": "<path d=\"M12 5.5a3 3 0 0 0-5.5 1.2A3 3 0 0 0 5 12a3 3 0 0 0 2 4.8A3 3 0 0 0 12 18.5z\"/><path d=\"M12 5.5a3 3 0 0 1 5.5 1.2A3 3 0 0 1 19 12a3 3 0 0 1-2 4.8 3 3 0 0 1-5 1.7M12 5.5v13\"/>",
  "module": "<path d=\"M9.5 4.5h5v2a1.5 1.5 0 0 0 3 0v-2h2v5h-2a1.5 1.5 0 0 0 0 3h2v7h-5v-2a1.5 1.5 0 0 0-3 0v2h-5v-5h2a1.5 1.5 0 0 0 0-3h-2v-7z\"/>",
  "calendar-grid": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2.5\"/><path d=\"M8 3v4M16 3v4M4 10h16M9.3 10v10M14.7 10v10M4 15h16\"/>",
  "kanban": "<rect x=\"3.5\" y=\"4.5\" width=\"5\" height=\"15\" rx=\"1.5\"/><rect x=\"9.5\" y=\"4.5\" width=\"5\" height=\"10\" rx=\"1.5\"/><rect x=\"15.5\" y=\"4.5\" width=\"5\" height=\"12.5\" rx=\"1.5\"/>",
  "chart": "<path d=\"M4 4v16h16\"/><path d=\"M8 16v-4M12 16V8M16 16v-6\"/>",
  "bell": "<path d=\"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z\"/><path d=\"M10 20.5a2 2 0 0 0 4 0\"/>",
  "lock": "<rect x=\"5\" y=\"10.5\" width=\"14\" height=\"9.5\" rx=\"2\"/><path d=\"M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2\"/>",
  "mail": "<rect x=\"3.5\" y=\"5.5\" width=\"17\" height=\"13\" rx=\"2\"/><path d=\"M4 7l8 6 8-6\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16\"/>",
  "star": "<path d=\"M12 4l2.5 5.2 5.5.7-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.7z\"/>",
  "flag": "<path d=\"M6 20.5V4.5M6 5h11l-2 4 2 4H6\"/>",
  "refresh": "<path d=\"M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9\"/><path d=\"M18 3.5v4h-4M6 20.5v-4h4\"/>",
  "wifi-off": "<path d=\"M4 4l16 16\"/><path d=\"M2.5 9a14 14 0 0 1 4.3-2.6M10.5 5.6A14 14 0 0 1 21.5 9M5.5 12.5a9 9 0 0 1 3.8-2.1M14.8 10.6a9 9 0 0 1 3.7 1.9M9 16a4.5 4.5 0 0 1 6 0\"/><circle cx=\"12\" cy=\"19\" r=\".75\"/>",
  "heart": "<path d=\"M12 19.5s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z\"/>",
  "alert": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 7.5v5.5\"/><circle cx=\"12\" cy=\"16\" r=\".75\"/>",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 11v5.5\"/><circle cx=\"12\" cy=\"8\" r=\".75\"/>",
  "minus": "<path d=\"M5 12h14\"/>",
  "pin": "<path d=\"M12 20.5s6-5.5 6-10.5a6 6 0 0 0-12 0c0 5 6 10.5 6 10.5z\"/><circle cx=\"12\" cy=\"10\" r=\"2.25\"/>",
  "mic-off": "<path d=\"M15 10V6.5a3 3 0 0 0-5.8-1M9 9v2.5a3 3 0 0 0 4.6 2.5M5.5 11.5a6.5 6.5 0 0 0 10.6 5M18.5 11.5c0 .8-.1 1.5-.4 2.2M12 18v3M4 4l16 16\"/>",
  "hand": "<path d=\"M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7.5a7 7 0 0 1-7 7 6 6 0 0 1-5-2.7L3.5 15a1.5 1.5 0 0 1 2.4-1.8L8 15\"/>",
  "sort": "<path d=\"M7 4.5v15M4 16.5l3 3 3-3M17 19.5v-15M14 7.5l3-3 3 3\"/>",
  "filter": "<path d=\"M4 6h16M7 12h10M10 18h4\"/>",
  "download": "<path d=\"M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14\"/>",
  "upload": "<path d=\"M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14\"/>",
  "lifebuoy": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"3.5\"/><path d=\"M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2\"/>",
  "card": "<rect x=\"3.5\" y=\"6\" width=\"14\" height=\"11\" rx=\"2\"/><path d=\"M7 3.5h11.5a2 2 0 0 1 2 2V14\"/>",
  "question": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.7-2.2 2-2.2 3.5\"/><circle cx=\"12\" cy=\"16.5\" r=\".75\"/>",
  "shield": "<path d=\"M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z\"/>",
  "logout": "<path d=\"M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14\"/><path d=\"M10.5 12H20M16.5 8.5L20 12l-3.5 3.5\"/>",
  "user": "<circle cx=\"12\" cy=\"8.5\" r=\"3.5\"/><path d=\"M5 19.5a7 7 0 0 1 14 0\"/>",
  "sparkle": "<path d=\"M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2\"/>",
} as const;

export type TpIconName = keyof typeof ICONS;

const SPRITE = Object.entries(ICONS)
  .map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`)
  .join("");

/** The hidden sprite. Static markup from the design system, no user input. */
export function TpIconSprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "none" }}
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static icon sprite from docs/design/v3/tempo.js, no user input
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}

type TpIconProps = {
  name: TpIconName;
  size?: "sm" | "md" | "lg";
  /** Mirror in RTL (chevrons, arrows). */
  flip?: boolean;
  className?: string;
};

export function TpIcon({ name, size = "md", flip = false, className }: TpIconProps) {
  const classes = ["tp-icon", size === "sm" ? "tp-icon--sm" : size === "lg" ? "tp-icon--lg" : "", flip ? "tp-icon--flip" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <svg className={classes} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
