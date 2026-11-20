// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
export function Keynote() {
  return (
    <section
      style={{
        position: "relative",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "110px 24px 40px",
        isolation: "isolate",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: "-60px",
          top: "110px",
          width: "min(760px,96%)",
          height: "150px",
          zIndex: "-1",
        }}
      >
        <path
          d="M10.0 54.2 L34.5 34.0 L59.0 26.1 L83.5 18.7 L108.0 25.2 L132.5 25.5 L157.0 27.1 L181.5 27.0 L206.0 22.5 L230.5 29.2 L255.0 25.7 L279.5 29.4 L304.0 29.0 L328.5 28.1 L353.0 24.5 L377.5 27.0 L402.0 32.9 L426.5 30.6 L451.0 32.0 L475.5 25.4 L500.0 26.1 L524.5 26.1 L549.0 26.0 L573.5 26.7 L598.0 24.9 L622.5 26.2 L647.0 30.6 L671.5 25.5 L696.0 28.4 L720.5 26.1 L745.0 27.5 L769.5 28.4 L794.0 28.8 L818.5 28.3 L843.0 29.1 L867.5 30.6 L892.0 26.4 L916.5 27.2 L941.0 27.3 L965.5 30.8 L990.0 44.5 L990.0 47.9 L965.5 63.0 L941.0 68.0 L916.5 69.6 L892.0 72.0 L867.5 69.4 L843.0 72.3 L818.5 74.7 L794.0 75.7 L769.5 77.6 L745.0 80.0 L720.5 82.8 L696.0 81.9 L671.5 86.0 L647.0 82.2 L622.5 87.8 L598.0 90.1 L573.5 89.3 L549.0 90.9 L524.5 91.5 L500.0 92.3 L475.5 93.5 L451.0 87.4 L426.5 89.0 L402.0 87.0 L377.5 93.0 L353.0 95.5 L328.5 91.8 L304.0 90.6 L279.5 89.8 L255.0 93.0 L230.5 88.9 L206.0 94.9 L181.5 89.6 L157.0 88.5 L132.5 89.1 L108.0 88.3 L83.5 93.7 L59.0 85.0 L34.5 75.8 L10.0 54.2 Z"
          fill="var(--tp-sakura-wash)"
          opacity="0.22"
          filter="url(#tf-wb)"
        />
      </svg>
      <p
        className="tf-kp"
        style={{
          fontFamily: "'Newsreader Opsz',Newsreader,serif",
          fontWeight: "500",
          fontSize: "clamp(28px,3.6vw,44px)",
          lineHeight: "1.3",
          letterSpacing: "-.01em",
          color: "var(--tp-ink)",
          maxWidth: "24ch",
          margin: "0",
          filter: "url(#tf-text-a)",
        }}
      >
        <span className="tf-word" style={{ animationRange: "cover 8.0% cover 16.1%" }}>
          You
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 10.1% cover 18.2%" }}>
          already
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 12.2% cover 20.2%" }}>
          know
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 14.2% cover 22.3%" }}>
          what
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 16.3% cover 24.4%" }}>
          to
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 18.4% cover 26.5%" }}>
          do.
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 20.5% cover 28.6%" }}>
          Your
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 22.6% cover 30.6%" }}>
          brain
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 24.6% cover 32.7%" }}>
          just
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 26.7% cover 34.8%" }}>
          needs
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 28.8% cover 36.9%" }}>
          a
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 30.9% cover 39.0%" }}>
          starting
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 33.0% cover 41.0%" }}>
          beat.
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 35.0% cover 43.1%" }}>
          Tempo
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 37.1% cover 45.2%" }}>
          gives
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 39.2% cover 47.3%" }}>
          you
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 41.3% cover 49.4%" }}>
          one
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 43.4% cover 51.4%" }}>
          small
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 45.4% cover 53.5%" }}>
          step,
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 47.5% cover 55.6%" }}>
          then
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 49.6% cover 57.7%" }}>
          the
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 51.7% cover 59.8%" }}>
          next,
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 53.8% cover 61.8%" }}>
          then
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 55.8% cover 63.9%" }}>
          a
        </span>{" "}
        <span className="tf-word" style={{ animationRange: "cover 57.9% cover 66.0%" }}>
          pause.
        </span>
      </p>
    </section>
  );
}
