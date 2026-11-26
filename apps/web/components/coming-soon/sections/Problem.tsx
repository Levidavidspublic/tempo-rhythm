// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties } from "react";

export function Problem() {
  return (
    <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 24px" }}>
      <div className="tf-reveal" style={{ position: "relative", isolation: "isolate" }}>
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            pointerEvents: "none",
            left: "-40px",
            top: "22px",
            width: "min(700px,96%)",
            height: "110px",
            zIndex: "-1",
          }}
        >
          <path
            d="M10.0 56.6 L34.5 39.4 L59.0 28.5 L83.5 28.6 L108.0 23.4 L132.5 25.7 L157.0 29.5 L181.5 25.3 L206.0 30.6 L230.5 26.9 L255.0 30.9 L279.5 31.0 L304.0 27.9 L328.5 24.2 L353.0 31.1 L377.5 30.2 L402.0 26.4 L426.5 23.4 L451.0 26.9 L475.5 28.5 L500.0 23.1 L524.5 31.3 L549.0 23.9 L573.5 28.7 L598.0 29.7 L622.5 29.6 L647.0 27.7 L671.5 23.3 L696.0 28.2 L720.5 24.8 L745.0 24.2 L769.5 26.1 L794.0 24.7 L818.5 28.1 L843.0 28.1 L867.5 27.2 L892.0 24.5 L916.5 26.6 L941.0 28.2 L965.5 28.8 L990.0 42.1 L990.0 45.4 L965.5 60.0 L941.0 61.8 L916.5 64.8 L892.0 68.4 L867.5 67.1 L843.0 67.8 L818.5 69.3 L794.0 74.2 L769.5 74.4 L745.0 77.8 L720.5 78.7 L696.0 76.8 L671.5 83.2 L647.0 80.2 L622.5 79.7 L598.0 81.0 L573.5 83.3 L549.0 89.3 L524.5 83.0 L500.0 92.3 L475.5 87.8 L451.0 90.3 L426.5 94.5 L402.0 92.1 L377.5 88.8 L353.0 88.3 L328.5 95.6 L304.0 92.0 L279.5 89.0 L255.0 89.0 L230.5 92.8 L206.0 88.9 L181.5 93.7 L157.0 89.0 L132.5 92.1 L108.0 93.7 L83.5 87.7 L59.0 86.8 L34.5 74.9 L10.0 56.6 Z"
            fill="var(--tp-wave-light)"
            opacity="0.24"
            filter="url(#tf-wb)"
          />
        </svg>
        <p
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: "13px",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--tp-accent)",
            margin: "0",
          }}
        >
          The problem
        </p>
        <h2
          className="tf-tex"
          style={{
            fontFamily: "'Newsreader Opsz',Newsreader,serif",
            fontWeight: "500",
            fontSize: "clamp(30px,4vw,44px)",
            lineHeight: "1.15",
            letterSpacing: "-.01em",
            color: "var(--tp-ink)",
            margin: "12px 0 0",
          }}
        >
          Planning was never the problem.
          <br />
          Starting is.
        </h2>
      </div>
      <div
        className="tf-persp"
        style={{
          marginTop: "32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: "16px",
        }}
      >
        <div
          className="tf-glass tf-tilt tf-stag"
          style={
            {
              "--i": "0",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "16px",
              padding: "24px",
            } as CSSProperties
          }
        >
          <h3
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontWeight: "500",
              fontSize: "22px",
              lineHeight: "1.25",
              color: "var(--tp-ink)",
              margin: "0",
            }}
          >
            Twelve tabs open. Nothing started.
          </h3>
          <p
            style={{
              fontFamily: "'Source Sans 3',sans-serif",
              fontSize: "17px",
              lineHeight: "1.6",
              color: "var(--tp-ink-muted)",
              margin: "8px 0 0",
            }}
          >
            You know what needs doing. Your brain just won't pick the first thing.
          </p>
        </div>
        <div
          className="tf-glass tf-tilt tf-stag"
          style={
            {
              "--i": "1",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "16px",
              padding: "24px",
            } as CSSProperties
          }
        >
          <h3
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontWeight: "500",
              fontSize: "22px",
              lineHeight: "1.25",
              color: "var(--tp-ink)",
              margin: "0",
            }}
          >
            The list that keeps score.
          </h3>
          <p
            style={{
              fontFamily: "'Source Sans 3',sans-serif",
              fontSize: "17px",
              lineHeight: "1.6",
              color: "var(--tp-ink-muted)",
              margin: "8px 0 0",
            }}
          >
            Red badges. A clock that counts what you missed. Another app that makes you feel behind.
          </p>
        </div>
        <div
          className="tf-glass tf-tilt tf-stag"
          style={
            {
              "--i": "2",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "16px",
              padding: "24px",
            } as CSSProperties
          }
        >
          <h3
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontWeight: "500",
              fontSize: "22px",
              lineHeight: "1.25",
              color: "var(--tp-ink)",
              margin: "0",
            }}
          >
            Reminders you stopped seeing.
          </h3>
          <p
            style={{
              fontFamily: "'Source Sans 3',sans-serif",
              fontSize: "17px",
              lineHeight: "1.6",
              color: "var(--tp-ink-muted)",
              margin: "8px 0 0",
            }}
          >
            “Drink water” worked for two days. Then it became wallpaper.
          </p>
        </div>
        <div
          className="tf-glass tf-tilt tf-stag"
          style={
            {
              "--i": "3",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "16px",
              padding: "24px",
            } as CSSProperties
          }
        >
          <h3
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontWeight: "500",
              fontSize: "22px",
              lineHeight: "1.25",
              color: "var(--tp-ink)",
              margin: "0",
            }}
          >
            It's 4pm. Where did the day go?
          </h3>
          <p
            style={{
              fontFamily: "'Source Sans 3',sans-serif",
              fontSize: "17px",
              lineHeight: "1.6",
              color: "var(--tp-ink-muted)",
              margin: "8px 0 0",
            }}
          >
            Time slips. That isn't laziness. It's how your brain keeps time.
          </p>
        </div>
      </div>
    </section>
  );
}
