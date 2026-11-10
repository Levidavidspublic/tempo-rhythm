// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { ReactNode } from "react";

export function Header({ nav }: { nav: ReactNode }) {
  return (
    <header
      className="tf-navin"
      style={{
        position: "sticky",
        top: "12px",
        zIndex: "20",
        maxWidth: "1200px",
        margin: "12px auto 0",
        padding: "0 24px",
      }}
    >
      <div
        className="tf-glass"
        style={{
          background: "rgba(251,249,244,.58)",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
          backdropFilter: "blur(18px) saturate(150%)",
          border: "1px solid rgba(255,255,255,.75)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
          borderRadius: "999px",
          padding: "8px 10px 8px 18px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <a
          href="#top"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "var(--tp-ink)",
          }}
        >
          <svg
            role="img"
            aria-label="Tempo Flow"
            viewBox="0 0 32 32"
            style={{
              width: "30px",
              height: "30px",
              flex: "none",
              display: "inline-block",
              verticalAlign: "middle",
            }}
          >
            <rect width="32" height="32" rx="7" fill="var(--tp-seal)" />
            <path d="M11.6 6.5h8.8l4.6 19.2H7z" fill="var(--tp-ground)" />
            <rect x="5.8" y="25" width="20.4" height="2.6" rx="1.2" fill="var(--tp-ground)" />
            <path d="M11.1 9.4h9.8v3.3h-3.3v9.2h-3.2v-9.2h-3.3z" fill="var(--tp-seal)" />
            <circle cx="16" cy="22.4" r="1.9" fill="var(--tp-seal)" />
          </svg>
          <span
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontSize: "21px",
              fontWeight: "500",
            }}
          >
            Tempo Flow
          </span>
        </a>
        {nav}
      </div>
    </header>
  );
}
