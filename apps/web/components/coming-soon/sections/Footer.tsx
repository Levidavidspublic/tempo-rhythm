// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
export function Footer() {
  return (
    <footer
      className="tf-reveal"
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 24px 48px",
        display: "flex",
        flexWrap: "wrap",
        gap: "16px 32px",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "15px",
        color: "var(--tp-ink-muted)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
        <span>Tempo Flow · Find your rhythm.</span>
      </div>
      <p style={{ margin: "0", maxWidth: "52ch" }}>
        Tempo is a coach, not a therapist. If you're in crisis, contact your local emergency line.
      </p>
    </footer>
  );
}
