// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties } from "react";

export function Compare() {
  return (
    <section
      style={{ position: "relative", maxWidth: "1200px", margin: "0 auto", padding: "88px 24px" }}
    >
      <div
        className="tf-wc-layer tf-depth "
        aria-hidden="true"
        style={{ "--dx": "8px", inset: "0" } as CSSProperties}
      >
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <path
            d="M359.3 420.0 L348.4 436.0 L327.0 449.0 L303.0 458.6 L285.7 467.1 L280.0 478.4 L283.9 495.0 L289.9 516.0 L290.0 537.0 L279.7 552.8 L260.4 560.6 L237.0 561.6 L214.5 560.3 L194.9 561.2 L177.2 565.9 L159.2 572.4 L140.0 576.8 L120.3 576.2 L101.4 571.2 L83.5 565.2 L64.6 562.0 L41.9 563.2 L14.7 566.3 L-14.0 566.3 L-38.2 559.0 L-52.0 542.9 L-52.7 520.4 L-42.9 496.3 L-28.8 474.5 L-16.8 457.1 L-10.6 443.4 L-10.1 431.5 L-13.2 420.0 L-18.0 407.9 L-24.4 394.5 L-33.2 379.0 L-44.2 360.5 L-53.9 339.2 L-56.8 317.4 L-48.1 299.6 L-27.0 289.7 L2.0 288.8 L31.6 293.5 L55.6 296.8 L72.2 292.3 L84.7 277.9 L98.7 257.9 L117.4 241.3 L140.0 236.5 L161.9 246.8 L178.8 268.0 L190.2 291.0 L200.2 306.7 L214.9 310.8 L237.6 306.0 L266.6 299.7 L295.1 299.1 L315.9 307.4 L326.1 323.0 L328.5 341.4 L330.0 358.6 L336.1 373.6 L347.1 387.9 L357.4 403.3 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.3"
            filter="url(#tf-wc)"
          />
          <path
            d="M359.3 420.0 L348.4 436.0 L327.0 449.0 L303.0 458.6 L285.7 467.1 L280.0 478.4 L283.9 495.0 L289.9 516.0 L290.0 537.0 L279.7 552.8 L260.4 560.6 L237.0 561.6 L214.5 560.3 L194.9 561.2 L177.2 565.9 L159.2 572.4 L140.0 576.8 L120.3 576.2 L101.4 571.2 L83.5 565.2 L64.6 562.0 L41.9 563.2 L14.7 566.3 L-14.0 566.3 L-38.2 559.0 L-52.0 542.9 L-52.7 520.4 L-42.9 496.3 L-28.8 474.5 L-16.8 457.1 L-10.6 443.4 L-10.1 431.5 L-13.2 420.0 L-18.0 407.9 L-24.4 394.5 L-33.2 379.0 L-44.2 360.5 L-53.9 339.2 L-56.8 317.4 L-48.1 299.6 L-27.0 289.7 L2.0 288.8 L31.6 293.5 L55.6 296.8 L72.2 292.3 L84.7 277.9 L98.7 257.9 L117.4 241.3 L140.0 236.5 L161.9 246.8 L178.8 268.0 L190.2 291.0 L200.2 306.7 L214.9 310.8 L237.6 306.0 L266.6 299.7 L295.1 299.1 L315.9 307.4 L326.1 323.0 L328.5 341.4 L330.0 358.6 L336.1 373.6 L347.1 387.9 L357.4 403.3 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.24"
            filter="url(#tf-wce)"
          />
          <path
            d="M289.8 400.0 L299.0 409.5 L299.7 419.2 L292.6 427.6 L281.7 434.1 L271.3 439.8 L263.8 445.8 L258.0 452.5 L251.4 458.8 L242.0 462.7 L230.2 463.3 L218.5 462.0 L209.0 462.2 L202.2 467.4 L196.0 478.6 L187.8 493.2 L176.0 505.8 L162.0 511.1 L148.7 507.0 L138.8 495.7 L132.3 482.4 L126.5 472.2 L118.3 467.4 L106.2 466.3 L92.4 465.2 L81.6 460.4 L77.8 451.2 L81.7 439.3 L89.4 428.0 L94.7 419.2 L92.7 412.9 L82.7 407.2 L68.8 400.0 L57.4 390.9 L53.9 381.1 L59.4 372.4 L70.7 366.0 L83.2 361.3 L92.9 356.7 L99.1 350.8 L103.5 343.4 L108.5 335.8 L115.5 329.3 L124.3 324.5 L133.9 320.6 L143.5 316.3 L153.3 311.1 L164.2 306.2 L176.0 303.8 L187.9 305.8 L198.4 312.1 L207.0 320.2 L214.9 326.8 L224.2 329.7 L236.7 329.2 L251.5 328.2 L265.4 330.3 L273.8 337.4 L274.3 348.8 L268.3 361.5 L260.9 372.6 L258.2 380.6 L263.6 386.4 L275.9 392.3 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.21"
            filter="url(#tf-wc)"
          />
          <path
            d="M1135.9 200.0 L1123.3 217.2 L1100.3 231.1 L1078.7 242.3 L1067.4 254.1 L1068.0 270.1 L1074.3 290.8 L1076.8 313.2 L1068.9 331.7 L1049.9 342.5 L1024.9 345.8 L1000.2 346.2 L979.2 349.2 L961.3 357.6 L943.3 369.9 L922.9 381.0 L900.0 386.3 L876.7 384.5 L854.4 379.0 L832.2 374.3 L808.1 373.1 L781.0 373.6 L753.9 370.5 L733.0 358.7 L724.2 337.1 L728.5 309.8 L739.7 283.5 L746.8 263.9 L740.2 251.6 L718.0 243.1 L688.2 232.9 L664.3 218.1 L658.3 200.0 L672.9 182.6 L700.4 169.0 L726.9 159.0 L740.7 148.5 L738.9 132.8 L728.4 110.6 L721.0 85.4 L726.2 64.5 L746.4 54.0 L775.8 55.1 L805.9 62.7 L830.2 68.5 L847.7 65.4 L862.2 51.7 L878.7 31.2 L900.0 10.9 L925.7 -3.4 L953.4 -9.2 L980.8 -7.7 L1006.7 -0.9 L1030.0 10.3 L1048.5 26.6 L1059.2 48.7 L1060.0 75.2 L1052.8 102.2 L1043.9 125.0 L1042.2 140.7 L1054.0 150.2 L1078.9 157.7 L1108.4 167.7 L1130.5 182.3 Z"
            fill="var(--tp-wave-light)"
            opacity="0.3"
            filter="url(#tf-wc)"
          />
          <path
            d="M1135.9 200.0 L1123.3 217.2 L1100.3 231.1 L1078.7 242.3 L1067.4 254.1 L1068.0 270.1 L1074.3 290.8 L1076.8 313.2 L1068.9 331.7 L1049.9 342.5 L1024.9 345.8 L1000.2 346.2 L979.2 349.2 L961.3 357.6 L943.3 369.9 L922.9 381.0 L900.0 386.3 L876.7 384.5 L854.4 379.0 L832.2 374.3 L808.1 373.1 L781.0 373.6 L753.9 370.5 L733.0 358.7 L724.2 337.1 L728.5 309.8 L739.7 283.5 L746.8 263.9 L740.2 251.6 L718.0 243.1 L688.2 232.9 L664.3 218.1 L658.3 200.0 L672.9 182.6 L700.4 169.0 L726.9 159.0 L740.7 148.5 L738.9 132.8 L728.4 110.6 L721.0 85.4 L726.2 64.5 L746.4 54.0 L775.8 55.1 L805.9 62.7 L830.2 68.5 L847.7 65.4 L862.2 51.7 L878.7 31.2 L900.0 10.9 L925.7 -3.4 L953.4 -9.2 L980.8 -7.7 L1006.7 -0.9 L1030.0 10.3 L1048.5 26.6 L1059.2 48.7 L1060.0 75.2 L1052.8 102.2 L1043.9 125.0 L1042.2 140.7 L1054.0 150.2 L1078.9 157.7 L1108.4 167.7 L1130.5 182.3 Z"
            fill="none"
            stroke="var(--tp-wave-light)"
            strokeWidth="2"
            opacity="0.24"
            filter="url(#tf-wce)"
          />
          <path
            d="M1051.5 178.0 L1051.6 186.6 L1044.3 194.2 L1031.5 199.7 L1019.4 203.8 L1014.3 209.1 L1018.4 219.1 L1028.4 234.9 L1036.9 253.9 L1037.0 270.6 L1026.2 279.1 L1007.6 277.2 L987.3 267.9 L970.7 258.1 L959.2 255.0 L950.2 261.7 L939.6 275.5 L925.5 289.3 L909.5 296.0 L895.3 291.8 L886.1 278.7 L881.7 262.4 L878.8 249.0 L872.6 241.6 L861.0 239.3 L845.4 238.3 L830.6 234.8 L821.3 227.3 L819.8 216.7 L824.5 205.2 L831.4 194.8 L836.4 185.9 L837.7 178.0 L836.2 170.1 L834.0 161.6 L832.9 152.7 L833.2 143.6 L834.6 134.2 L837.0 124.5 L841.3 115.1 L848.8 107.2 L860.0 102.3 L873.8 101.2 L887.8 102.4 L899.7 102.9 L909.0 99.4 L917.3 90.7 L927.1 78.8 L939.6 68.2 L954.1 63.6 L967.9 67.2 L978.8 77.3 L986.7 89.3 L994.2 98.3 L1004.5 102.2 L1019.1 102.5 L1035.9 102.9 L1050.3 107.2 L1057.6 116.5 L1056.6 129.2 L1050.4 142.2 L1044.4 153.2 L1043.1 161.9 L1046.8 169.8 Z"
            fill="var(--tp-wave-light)"
            opacity="0.21"
            filter="url(#tf-wc)"
          />
        </svg>
      </div>
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
          Compare
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
          Why not just use ChatGPT, Notion or Todoist?
        </h2>
        <p
          style={{
            fontFamily: "'Source Sans 3',sans-serif",
            fontSize: "17px",
            lineHeight: "1.6",
            color: "var(--tp-ink-muted)",
            margin: "8px 0 0",
            maxWidth: "62ch",
          }}
        >
          They're great tools. They're just not built around a brain that knows what to do and still
          can't start.
        </p>
      </div>
      <div
        className="tf-glass tf-reveal"
        style={{
          background: "rgba(251,249,244,.58)",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
          backdropFilter: "blur(18px) saturate(150%)",
          border: "1px solid rgba(255,255,255,.75)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
          marginTop: "28px",
          borderRadius: "20px",
          padding: "12px",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "860px",
            borderCollapse: "collapse",
            fontFamily: "'Source Sans 3',sans-serif",
          }}
        >
          <caption
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            How Tempo compares with ChatGPT, Notion, Todoist and NotePlan
          </caption>
          <thead>
            <tr>
              <td></td>
              <th
                scope="col"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontFamily: "'Newsreader Opsz',Newsreader,serif",
                  fontWeight: "500",
                  fontSize: "19px",
                  background: "var(--tp-accent)",
                  color: "var(--tp-on-accent)",
                  borderRadius: "12px 12px 0 0",
                }}
              >
                Tempo
              </th>
              <th
                scope="col"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontFamily: "'Newsreader Opsz',Newsreader,serif",
                  fontWeight: "500",
                  fontSize: "19px",
                  color: "var(--tp-ink)",
                }}
              >
                ChatGPT
              </th>
              <th
                scope="col"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontFamily: "'Newsreader Opsz',Newsreader,serif",
                  fontWeight: "500",
                  fontSize: "19px",
                  color: "var(--tp-ink)",
                }}
              >
                Notion
              </th>
              <th
                scope="col"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontFamily: "'Newsreader Opsz',Newsreader,serif",
                  fontWeight: "500",
                  fontSize: "19px",
                  color: "var(--tp-ink)",
                }}
              >
                Todoist
              </th>
              <th
                scope="col"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontFamily: "'Newsreader Opsz',Newsreader,serif",
                  fontWeight: "500",
                  fontSize: "19px",
                  color: "var(--tp-ink)",
                }}
              >
                NotePlan
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="tf-stag" style={{ "--i": "0" } as CSSProperties}>
              <th
                scope="row"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--tp-ink)",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  minWidth: "200px",
                }}
              >
                Made for ADHD, autistic and dyslexic brains
              </th>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  background: "rgba(31,58,95,.08)",
                  fontWeight: "600",
                  color: "var(--tp-accent)",
                }}
              >
                ✓ Built for it
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                General assistant
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                General workspace
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                General task app
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                General planner
              </td>
            </tr>
            <tr className="tf-stag" style={{ "--i": "1" } as CSSProperties}>
              <th
                scope="row"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--tp-ink)",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  minWidth: "200px",
                }}
              >
                Brain dump → a plan for today
              </th>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  background: "rgba(31,58,95,.08)",
                  fontWeight: "600",
                  color: "var(--tp-accent)",
                }}
              >
                ✓ One flow, onto your day
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Writes a list you copy over
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Agents can, once you build the workspace
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Breaks a task into subtasks
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Turns voice notes into notes
              </td>
            </tr>
            <tr className="tf-stag" style={{ "--i": "2" } as CSSProperties}>
              <th
                scope="row"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--tp-ink)",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  minWidth: "200px",
                }}
              >
                Nudges you first, in your own words
              </th>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  background: "rgba(31,58,95,.08)",
                  fontWeight: "600",
                  color: "var(--tp-accent)",
                }}
              >
                ✓ Your words, at the right time
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Mostly waits for you to ask
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Reminders you set
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Reminders you set
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Reminders you set
              </td>
            </tr>
            <tr className="tf-stag" style={{ "--i": "3" } as CSSProperties}>
              <th
                scope="row"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--tp-ink)",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  minWidth: "200px",
                }}
              >
                Remembers your life
              </th>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  background: "rgba(31,58,95,.08)",
                  fontWeight: "600",
                  color: "var(--tp-accent)",
                }}
              >
                ✓ Notes, people, patterns
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                ✓ Memory
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Your pages and databases
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Your tasks
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Your notes
              </td>
            </tr>
            <tr className="tf-stag" style={{ "--i": "4" } as CSSProperties}>
              <th
                scope="row"
                style={{
                  padding: "14px 12px",
                  textAlign: "start",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--tp-ink)",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  minWidth: "200px",
                }}
              >
                Notes, tasks, calendar and coach in one place
              </th>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  background: "rgba(31,58,95,.08)",
                  fontWeight: "600",
                  color: "var(--tp-accent)",
                }}
              >
                ✓ All four
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Chat first
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                ✓ Notes, tasks, calendar
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                Tasks first
              </td>
              <td
                style={{
                  padding: "14px 12px",
                  fontSize: "15px",
                  lineHeight: "1.4",
                  borderTop: "1px solid rgba(28,27,25,.08)",
                  color: "var(--tp-ink-muted)",
                }}
              >
                ✓ Notes, tasks, calendar
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "13px", color: "var(--tp-ink-subtle)", margin: "12px 0 0" }}>
        Based on each product's public pages and help docs, checked 8 Nov 2026. Products change;
        tell us if we got one wrong.
      </p>
    </section>
  );
}
