// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties } from "react";

export function Pledge() {
  return (
    <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 24px 0" }}>
      <div
        className="tf-glass tf-reveal"
        style={{
          background: "rgba(251,249,244,.66)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          backdropFilter: "blur(14px) saturate(140%)",
          border: "1px solid rgba(255,255,255,.7)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
          borderRadius: "20px",
          padding: "28px 32px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 32px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className="tf-stag tf-tex"
          style={
            {
              "--i": "0",
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontSize: "clamp(22px,3vw,30px)",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          No streaks.
        </span>
        <span
          className="tf-stag tf-tex"
          style={
            {
              "--i": "1",
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontSize: "clamp(22px,3vw,30px)",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          No red badges.
        </span>
        <span
          className="tf-stag tf-tex"
          style={
            {
              "--i": "2",
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontSize: "clamp(22px,3vw,30px)",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          No 47-step setup.
        </span>
        <span
          className="tf-stag tf-tex"
          style={
            {
              "--i": "3",
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontSize: "clamp(22px,3vw,30px)",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          No guilt.
        </span>
      </div>
      <p
        style={{
          textAlign: "center",
          fontSize: "15px",
          color: "var(--tp-ink-muted)",
          margin: "12px 0 0",
        }}
      >
        We tried the scoreboard apps. Our brains hated them.
      </p>
    </section>
  );
}
