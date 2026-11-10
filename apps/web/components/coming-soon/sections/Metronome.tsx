// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties } from "react";

export function Metronome() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--tp-sunken)",
        padding: "110px 0",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: "0",
          right: "0",
          width: "100%",
          height: "60px",
          top: "-2px",
          pointerEvents: "none",
          zIndex: "1",
        }}
      >
        <path
          d="M0 0.0 L0 44.1 L25 55.5 L50 43.9 L75 52.3 L100 51.1 L125 22.8 L150 19.6 L175 59.5 L200 33.0 L225 33.8 L250 73.0 L275 50.9 L300 71.8 L325 57.7 L350 68.5 L375 47.5 L400 72.5 L425 84.6 L450 68.0 L475 77.5 L500 72.4 L525 40.8 L550 71.1 L575 59.8 L600 42.6 L625 26.5 L650 64.0 L675 43.1 L700 53.8 L725 61.2 L750 54.0 L775 65.4 L800 42.4 L825 64.8 L850 50.9 L875 77.8 L900 78.2 L925 43.5 L950 47.6 L975 52.9 L1000 89.3 L1000 0.0 Z"
          fill="var(--tp-ground)"
          filter="url(#tf-tear)"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: "0",
          right: "0",
          width: "100%",
          height: "60px",
          bottom: "-2px",
          transform: "scaleY(-1)",
          pointerEvents: "none",
          zIndex: "1",
        }}
      >
        <path
          d="M0 0.0 L0 33.2 L25 25.1 L50 38.2 L75 26.5 L100 23.1 L125 40.9 L150 68.1 L175 65.4 L200 67.0 L225 44.2 L250 62.5 L275 52.7 L300 49.7 L325 47.7 L350 53.3 L375 86.9 L400 80.8 L425 77.5 L450 74.4 L475 42.0 L500 44.3 L525 56.3 L550 58.5 L575 62.2 L600 61.9 L625 23.2 L650 48.4 L675 52.7 L700 46.8 L725 33.7 L750 51.0 L775 35.8 L800 79.7 L825 79.3 L850 66.5 L875 56.4 L900 86.5 L925 70.4 L950 84.3 L975 80.9 L1000 62.1 L1000 0.0 Z"
          fill="var(--tp-ground)"
          filter="url(#tf-tear)"
        />
      </svg>
      <div
        className="tf-wc-layer tf-depth "
        aria-hidden="true"
        style={{ "--dx": "10px", inset: "0" } as CSSProperties}
      >
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <path
            d="M538.6 120.0 L536.0 138.1 L527.4 155.3 L513.0 170.4 L494.7 182.9 L475.4 193.1 L458.1 202.4 L444.8 212.7 L435.5 225.7 L427.8 241.4 L418.7 258.5 L405.8 274.5 L388.6 286.8 L367.8 294.3 L345.2 297.1 L322.3 296.3 L300.0 293.0 L278.8 287.8 L258.9 281.0 L240.4 273.2 L222.8 265.4 L204.5 259.4 L183.5 256.0 L158.7 254.3 L130.7 252.0 L103.2 246.0 L81.4 233.9 L69.3 216.2 L68.0 194.9 L74.1 173.5 L81.5 153.9 L85.0 136.5 L83.4 120.0 L80.2 103.1 L81.7 86.1 L92.9 71.0 L113.9 59.9 L139.7 53.2 L162.2 48.2 L175.1 40.0 L177.3 24.3 L173.8 0.1 L172.5 -28.8 L180.0 -55.1 L198.4 -71.4 L224.5 -74.0 L252.8 -64.9 L278.5 -50.6 L300.0 -38.7 L319.5 -34.1 L340.0 -36.9 L363.4 -43.1 L388.7 -47.1 L412.8 -44.6 L432.5 -34.7 L446.8 -19.5 L457.0 -2.4 L465.8 13.9 L476.0 28.3 L488.5 41.4 L502.5 54.6 L516.2 68.8 L527.7 84.7 L535.5 101.9 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.4"
            filter="url(#tf-wc)"
          />
          <path
            d="M538.6 120.0 L536.0 138.1 L527.4 155.3 L513.0 170.4 L494.7 182.9 L475.4 193.1 L458.1 202.4 L444.8 212.7 L435.5 225.7 L427.8 241.4 L418.7 258.5 L405.8 274.5 L388.6 286.8 L367.8 294.3 L345.2 297.1 L322.3 296.3 L300.0 293.0 L278.8 287.8 L258.9 281.0 L240.4 273.2 L222.8 265.4 L204.5 259.4 L183.5 256.0 L158.7 254.3 L130.7 252.0 L103.2 246.0 L81.4 233.9 L69.3 216.2 L68.0 194.9 L74.1 173.5 L81.5 153.9 L85.0 136.5 L83.4 120.0 L80.2 103.1 L81.7 86.1 L92.9 71.0 L113.9 59.9 L139.7 53.2 L162.2 48.2 L175.1 40.0 L177.3 24.3 L173.8 0.1 L172.5 -28.8 L180.0 -55.1 L198.4 -71.4 L224.5 -74.0 L252.8 -64.9 L278.5 -50.6 L300.0 -38.7 L319.5 -34.1 L340.0 -36.9 L363.4 -43.1 L388.7 -47.1 L412.8 -44.6 L432.5 -34.7 L446.8 -19.5 L457.0 -2.4 L465.8 13.9 L476.0 28.3 L488.5 41.4 L502.5 54.6 L516.2 68.8 L527.7 84.7 L535.5 101.9 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.32"
            filter="url(#tf-wce)"
          />
          <path
            d="M452.5 98.0 L451.8 106.6 L451.6 115.4 L451.6 124.5 L451.5 134.2 L450.5 144.2 L447.2 154.1 L441.0 162.9 L432.0 170.1 L421.0 175.4 L409.5 179.6 L398.4 183.8 L387.8 188.7 L377.0 194.1 L365.4 199.0 L352.7 201.6 L339.6 201.0 L327.1 197.1 L315.9 191.1 L305.9 184.5 L296.9 178.4 L288.3 172.8 L280.4 167.1 L273.7 160.7 L268.3 153.6 L263.7 146.6 L257.9 140.6 L248.9 135.8 L236.0 131.5 L220.5 126.2 L205.7 118.8 L195.5 109.1 L192.4 98.0 L196.3 87.0 L204.6 77.0 L213.9 68.3 L222.1 60.1 L229.3 52.0 L237.0 44.5 L247.2 38.8 L260.1 36.0 L274.0 35.7 L286.3 35.8 L295.1 33.0 L300.7 24.8 L305.8 11.0 L313.2 -5.4 L324.8 -19.1 L339.6 -25.4 L354.7 -21.6 L367.0 -9.4 L375.0 7.0 L379.9 22.1 L384.6 32.3 L392.2 36.6 L403.9 36.9 L418.4 36.5 L433.1 38.1 L445.0 43.1 L452.5 50.9 L455.7 60.5 L456.0 70.5 L454.9 80.1 L453.6 89.2 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.28"
            filter="url(#tf-wc)"
          />
          <path
            d="M1090.3 470.0 L1082.9 487.1 L1076.4 503.6 L1066.3 518.8 L1051.6 531.9 L1036.5 543.6 L1027.1 557.1 L1026.7 576.7 L1032.6 604.6 L1036.1 637.4 L1028.5 666.7 L1005.9 682.9 L972.0 681.0 L935.4 664.0 L903.9 642.3 L880.0 628.1 L860.0 628.3 L838.5 640.3 L813.0 654.3 L786.6 658.8 L765.4 648.2 L753.5 625.4 L748.8 599.8 L742.9 581.3 L726.8 573.9 L697.2 574.2 L659.9 574.3 L626.9 567.2 L609.2 551.0 L609.6 529.2 L620.8 507.1 L629.6 487.7 L625.7 470.0 L608.1 450.7 L586.1 427.5 L573.5 402.2 L580.1 379.6 L606.6 364.4 L644.5 357.7 L681.8 355.9 L710.1 353.1 L728.4 344.9 L741.5 331.6 L755.6 317.7 L774.1 308.3 L796.0 305.4 L818.3 306.3 L839.3 305.7 L860.0 300.0 L882.7 290.0 L908.1 281.2 L933.9 280.1 L955.8 289.6 L971.5 307.4 L982.9 326.6 L996.0 340.8 L1017.0 347.6 L1047.5 350.0 L1082.6 354.0 L1112.8 364.6 L1129.3 383.0 L1129.5 406.2 L1117.7 430.0 L1102.4 451.4 Z"
            fill="var(--tp-wave-light)"
            opacity="0.35"
            filter="url(#tf-wc)"
          />
          <path
            d="M1090.3 470.0 L1082.9 487.1 L1076.4 503.6 L1066.3 518.8 L1051.6 531.9 L1036.5 543.6 L1027.1 557.1 L1026.7 576.7 L1032.6 604.6 L1036.1 637.4 L1028.5 666.7 L1005.9 682.9 L972.0 681.0 L935.4 664.0 L903.9 642.3 L880.0 628.1 L860.0 628.3 L838.5 640.3 L813.0 654.3 L786.6 658.8 L765.4 648.2 L753.5 625.4 L748.8 599.8 L742.9 581.3 L726.8 573.9 L697.2 574.2 L659.9 574.3 L626.9 567.2 L609.2 551.0 L609.6 529.2 L620.8 507.1 L629.6 487.7 L625.7 470.0 L608.1 450.7 L586.1 427.5 L573.5 402.2 L580.1 379.6 L606.6 364.4 L644.5 357.7 L681.8 355.9 L710.1 353.1 L728.4 344.9 L741.5 331.6 L755.6 317.7 L774.1 308.3 L796.0 305.4 L818.3 306.3 L839.3 305.7 L860.0 300.0 L882.7 290.0 L908.1 281.2 L933.9 280.1 L955.8 289.6 L971.5 307.4 L982.9 326.6 L996.0 340.8 L1017.0 347.6 L1047.5 350.0 L1082.6 354.0 L1112.8 364.6 L1129.3 383.0 L1129.5 406.2 L1117.7 430.0 L1102.4 451.4 Z"
            fill="none"
            stroke="var(--tp-wave-light)"
            strokeWidth="2"
            opacity="0.28"
            filter="url(#tf-wce)"
          />
          <path
            d="M1049.7 446.0 L1061.4 458.2 L1065.9 471.2 L1060.5 483.2 L1046.4 492.3 L1027.8 497.9 L1009.9 501.6 L996.6 505.8 L988.3 512.4 L982.5 521.4 L975.9 530.9 L966.0 537.7 L952.9 539.7 L938.5 536.7 L925.0 531.3 L913.4 526.9 L903.2 526.4 L892.5 530.6 L879.7 538.0 L864.5 545.6 L847.7 550.5 L831.2 551.0 L816.6 547.1 L804.8 539.5 L795.8 529.8 L789.6 518.7 L785.9 507.1 L784.6 495.4 L785.3 484.1 L787.0 473.5 L788.4 463.8 L788.7 454.8 L787.5 446.0 L785.4 436.9 L783.3 427.4 L781.8 417.3 L781.3 406.6 L781.7 395.3 L783.2 383.4 L786.5 371.3 L793.1 360.1 L803.9 351.6 L818.7 347.3 L835.9 347.8 L853.3 351.9 L868.6 357.1 L881.4 360.5 L892.4 360.3 L903.2 356.5 L915.2 351.2 L928.4 347.0 L942.0 346.1 L954.8 348.9 L966.0 354.3 L976.0 361.0 L985.5 367.8 L994.6 374.7 L1002.6 382.4 L1008.6 391.1 L1012.0 400.6 L1014.1 410.2 L1017.3 419.0 L1024.3 427.2 L1035.9 435.8 Z"
            fill="var(--tp-wave-light)"
            opacity="0.24"
            filter="url(#tf-wc)"
          />
        </svg>
      </div>
      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", position: "relative" }}
      >
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
            Meet your metronome
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
            This is your day.
          </h2>
          <p
            style={{
              fontFamily: "'Source Sans 3',sans-serif",
              fontSize: "17px",
              lineHeight: "1.6",
              color: "var(--tp-ink-muted)",
              margin: "8px 0 0",
              maxWidth: "60ch",
            }}
          >
            The metronome shows how you're doing. Tempo's job is to keep it steady.
          </p>
        </div>
        <div
          className="tf-persp"
          style={{
            marginTop: "32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
            gap: "16px",
            alignItems: "stretch",
          }}
        >
          <div
            className="tf-glass tf-tilt tf-stag tf-play"
            style={
              {
                "--i": "0",
                background: "rgba(251,249,244,.66)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
                backdropFilter: "blur(14px) saturate(140%)",
                border: "1px solid rgba(255,255,255,.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                borderRadius: "18px",
                padding: "24px 20px",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "8px",
                height: "100%",
                boxSizing: "border-box",
              } as CSSProperties
            }
          >
            <div style={{ width: "150px", position: "relative" }}>
              <svg
                className="tf-char"
                viewBox="0 0 200 240"
                role="img"
                aria-label="Tempo metronome mascot: In flow — arm swings steadily"
                data-state="steady"
              >
                <title>Tempo metronome — In flow — arm swings steadily</title>
                <g className="tf-body tf-body--steady" transform="rotate(0 100 222)">
                  <rect
                    x="52"
                    y="200"
                    width="96"
                    height="22"
                    rx="6"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M62 200 L138 200 L114 38 L86 38 Z"
                    fill="var(--tp-wood)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="88"
                    y="30"
                    width="24"
                    height="10"
                    rx="3"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M90 60 L110 60 L118 150 L82 150 Z"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    opacity=".9"
                  />
                  <g stroke="var(--tp-ink)" strokeWidth="1.5" opacity=".45">
                    <path d="M92 75h4" />
                    <path d="M93 90h4" />
                    <path d="M94 105h4" />
                    <path d="M95 120h4" />
                    <path d="M96 135h4" />
                    <path d="M104 75h4" />
                    <path d="M103 90h4" />
                    <path d="M102 105h4" />
                    <path d="M101 120h4" />
                    <path d="M100 135h4" />
                  </g>
                  <ellipse cx="78" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <ellipse cx="122" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <circle cx="88" cy="178" r="4.5" fill="var(--tp-ink)" />
                  <circle cx="112" cy="178" r="4.5" fill="var(--tp-ink)" />
                  <path
                    d="M92 188 Q100 195 108 188"
                    fill="none"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <g className="tf-arm tf-arm--steady" transform="rotate(0 100 158)">
                    <line
                      x1="100"
                      y1="158"
                      x2="100"
                      y2="52"
                      stroke="var(--tp-ink)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <rect
                      x="91"
                      y="84"
                      width="18"
                      height="14"
                      rx="3"
                      fill="var(--tp-accent)"
                      stroke="var(--tp-ink)"
                      strokeWidth="2.5"
                    />
                  </g>
                  <circle
                    cx="100"
                    cy="158"
                    r="5"
                    fill="var(--tp-seal)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                  />
                </g>
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader Opsz',Newsreader,serif",
                fontWeight: "500",
                fontSize: "22px",
                color: "var(--tp-ink)",
                margin: "8px 0 0",
                position: "relative",
              }}
            >
              This is you, in rhythm.
            </h3>
            <p
              style={{
                fontFamily: "'Source Sans 3',sans-serif",
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--tp-ink-muted)",
                margin: "0",
                position: "relative",
              }}
            >
              Steady beat. One thing, then the next.
            </p>
            <div
              className="tf-ripple"
              aria-hidden="true"
              style={{ marginTop: "auto", width: "72%", paddingTop: "10px", opacity: ".9" }}
            >
              <svg
                viewBox="0 0 300 40"
                aria-hidden="true"
                style={{ display: "block", width: "100%", height: "auto" }}
              >
                <g fill="none" stroke="var(--tp-wave-wash)" strokeLinecap="round">
                  <path
                    d="M10 14 C60 8 110 20 160 14 C210 8 250 18 290 13"
                    strokeWidth="2"
                    opacity=".55"
                  />
                  <path
                    d="M40 24 C90 19 140 29 190 24 C230 20 260 27 280 24"
                    strokeWidth="1.6"
                    opacity=".4"
                  />
                  <path d="M70 33 C110 29 150 36 200 33" strokeWidth="1.3" opacity=".3" />
                </g>
              </svg>
            </div>
          </div>
          <div
            className="tf-glass tf-tilt tf-stag tf-play"
            style={
              {
                "--i": "1",
                background: "linear-gradient(180deg,rgba(224,231,238,.9),rgba(224,231,238,.55))",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
                backdropFilter: "blur(14px) saturate(140%)",
                border: "1px solid rgba(255,255,255,.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                borderRadius: "18px",
                padding: "24px 20px",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "8px",
                height: "100%",
                boxSizing: "border-box",
              } as CSSProperties
            }
          >
            <div style={{ width: "130px", position: "relative" }}>
              <svg
                className="tf-char"
                viewBox="0 0 200 240"
                role="img"
                aria-label="Tempo metronome mascot: Too much — arm swings fast and wobbly"
                data-state="wobbly"
              >
                <title>Tempo metronome — Too much — arm swings fast and wobbly</title>
                <g className="tf-body tf-body--wobbly" transform="rotate(0 100 222)">
                  <rect
                    x="52"
                    y="200"
                    width="96"
                    height="22"
                    rx="6"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M62 200 L138 200 L114 38 L86 38 Z"
                    fill="var(--tp-wood)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="88"
                    y="30"
                    width="24"
                    height="10"
                    rx="3"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M90 60 L110 60 L118 150 L82 150 Z"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    opacity=".9"
                  />
                  <g stroke="var(--tp-ink)" strokeWidth="1.5" opacity=".45">
                    <path d="M92 75h4" />
                    <path d="M93 90h4" />
                    <path d="M94 105h4" />
                    <path d="M95 120h4" />
                    <path d="M96 135h4" />
                    <path d="M104 75h4" />
                    <path d="M103 90h4" />
                    <path d="M102 105h4" />
                    <path d="M101 120h4" />
                    <path d="M100 135h4" />
                  </g>
                  <ellipse cx="78" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <ellipse cx="122" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <circle
                    cx="88"
                    cy="177"
                    r="6"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2.5"
                  />
                  <circle cx="88" cy="178" r="2.6" fill="var(--tp-ink)" />
                  <circle
                    cx="112"
                    cy="177"
                    r="6"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2.5"
                  />
                  <circle cx="112" cy="178" r="2.6" fill="var(--tp-ink)" />
                  <ellipse
                    cx="100"
                    cy="191"
                    rx="4"
                    ry="4.5"
                    fill="none"
                    stroke="var(--tp-ink)"
                    strokeWidth="2.5"
                  />
                  {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a decorative SVG group, never focusable */}
                  <g aria-hidden="true">
                    <path
                      className="tf-sweat s1"
                      d="M142 128 q6 10 0 15 q-6 -5 0 -15z"
                      fill="var(--tp-wave-light)"
                      stroke="var(--tp-ink)"
                      strokeWidth="1.5"
                    />
                    <path
                      className="tf-sweat s2"
                      d="M56 140 q5 8 0 12 q-5 -4 0 -12z"
                      fill="var(--tp-wave-light)"
                      stroke="var(--tp-ink)"
                      strokeWidth="1.5"
                    />
                    <path
                      className="tf-sweat s3"
                      d="M150 160 q4 7 0 10 q-4 -3 0 -10z"
                      fill="var(--tp-wave-light)"
                      stroke="var(--tp-ink)"
                      strokeWidth="1.3"
                    />
                    <g
                      className="tf-stress"
                      stroke="var(--tp-ink)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M70 30 l-8 -10" />
                      <path d="M100 18 v-12" />
                      <path d="M130 30 l8 -10" />
                    </g>
                  </g>
                  <g className="tf-arm tf-arm--wobbly" transform="rotate(0 100 158)">
                    <line
                      x1="100"
                      y1="158"
                      x2="100"
                      y2="52"
                      stroke="var(--tp-ink)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <rect
                      x="91"
                      y="84"
                      width="18"
                      height="14"
                      rx="3"
                      fill="var(--tp-accent)"
                      stroke="var(--tp-ink)"
                      strokeWidth="2.5"
                    />
                  </g>
                  <circle
                    cx="100"
                    cy="158"
                    r="5"
                    fill="var(--tp-seal)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                  />
                </g>
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader Opsz',Newsreader,serif",
                fontWeight: "500",
                fontSize: "22px",
                color: "var(--tp-ink)",
                margin: "8px 0 0",
                position: "relative",
              }}
            >
              Then the day piles up.
            </h3>
            <p
              style={{
                fontFamily: "'Source Sans 3',sans-serif",
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--tp-ink-muted)",
                margin: "0",
                position: "relative",
              }}
            >
              Pings, plans, a wave of “I should”. The beat races.
            </p>
            <div
              aria-hidden="true"
              style={{
                marginTop: "auto",
                marginInline: "-20px",
                marginBottom: "-24px",
                lineHeight: "0",
                paddingTop: "8px",
              }}
            >
              <svg
                viewBox="0 0 600 260"
                aria-hidden="true"
                style={{ display: "block", width: "100%", height: "auto" }}
              >
                <g className="tf-wv tf-wv-body" style={{ "--d": "0s" } as CSSProperties}>
                  <path
                    d="M0 260 L0 168 C26 150 52 132 82 128 C108 125 124 140 118 156 C114 166 100 166 98 156 C96 148 104 142 112 146 C130 162 162 160 196 150 C236 138 268 140 300 154 C340 172 430 190 600 204 L600 260 Z"
                    fill="var(--tp-wave-light)"
                    opacity=".9"
                  />
                  <path
                    className="tf-wv tf-wv-crest"
                    style={{ "--d": ".7s" } as CSSProperties}
                    pathLength="1"
                    d="M0 168 C26 150 52 132 82 128 C108 125 124 140 118 156"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    opacity=".85"
                  />
                </g>
                <g className="tf-wv tf-wv-body tf-wv-l2" style={{ "--d": ".25s" } as CSSProperties}>
                  <path
                    d="M0 260 L0 214 C34 206 70 186 104 160 C132 138 162 116 196 114 C226 112 248 132 242 154 C238 168 222 172 214 162 C206 152 214 140 226 144 C206 132 186 150 188 176 C190 204 232 216 300 218 C380 222 480 226 600 230 L600 260 Z"
                    fill="var(--tp-wave-wash)"
                    opacity=".95"
                  />
                  <path
                    className="tf-wv tf-wv-crest"
                    style={{ "--d": ".95s" } as CSSProperties}
                    pathLength="1"
                    d="M104 160 C132 138 162 116 196 114 C226 112 248 132 242 154"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "1" } as CSSProperties}
                    d="M164 122 q8.1 -9.9 17.1 -1.8 q-4.5 1.8 -5.4 8.1"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="2.7"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "2" } as CSSProperties}
                    d="M192 114 q9.0 -11.0 19.0 -2.0 q-5.0 2.0 -6.0 9.0"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.0"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "3" } as CSSProperties}
                    d="M220 118 q8.1 -9.9 17.1 -1.8 q-4.5 1.8 -5.4 8.1"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="2.7"
                    strokeLinecap="round"
                  />
                </g>
                <g className="tf-wv tf-wv-body tf-wv-l3" style={{ "--d": ".5s" } as CSSProperties}>
                  <path
                    d="M90 260 C150 256 212 238 252 212 C266 202 278 188 290 170 C330 132 352 82 396 52 C436 26 492 26 528 58 C556 84 558 122 534 136 C514 148 492 136 498 116 C504 98 524 96 532 108 C522 84 494 78 474 90 C446 108 440 150 458 182 C476 214 536 232 600 230 L600 260 Z"
                    fill="var(--tp-accent)"
                  />
                  <path
                    className="tf-wv tf-wv-crest"
                    style={{ "--d": "1.2s" } as CSSProperties}
                    pathLength="1"
                    d="M290 170 C330 132 352 82 396 52 C436 26 492 26 528 58 C556 84 558 122 534 136"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "4" } as CSSProperties}
                    d="M388 62 q10.8 -13.2 22.8 -2.4 q-6.0 2.4 -7.2 10.8"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "5" } as CSSProperties}
                    d="M412 46 q11.7 -14.3 24.7 -2.6 q-6.5 2.6 -7.8 11.7"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.9"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "6" } as CSSProperties}
                    d="M440 35 q11.7 -14.3 24.7 -2.6 q-6.5 2.6 -7.8 11.7"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.9"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "7" } as CSSProperties}
                    d="M468 31 q11.7 -14.3 24.7 -2.6 q-6.5 2.6 -7.8 11.7"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.9"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "8" } as CSSProperties}
                    d="M496 35 q10.8 -13.2 22.8 -2.4 q-6.0 2.4 -7.2 10.8"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "9" } as CSSProperties}
                    d="M518 48 q9.9 -12.1 20.9 -2.2 q-5.5 2.2 -6.6 9.9"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.3"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "10" } as CSSProperties}
                    d="M538 66 q9.0 -11.0 19.0 -2.0 q-5.0 2.0 -6.0 9.0"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="3.0"
                    strokeLinecap="round"
                  />
                  <path
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "11" } as CSSProperties}
                    d="M548 88 q7.2 -8.8 15.2 -1.6 q-4.0 1.6 -4.8 7.2"
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <g
                    fill="none"
                    stroke="var(--tp-ground)"
                    strokeWidth="2"
                    opacity=".55"
                    strokeLinecap="round"
                  >
                    <path
                      className="tf-wv tf-wv-line"
                      style={{ "--i": "1" } as CSSProperties}
                      pathLength="1"
                      d="M300 196 C350 168 380 120 420 92"
                    />
                    <path
                      className="tf-wv tf-wv-line"
                      style={{ "--i": "2" } as CSSProperties}
                      pathLength="1"
                      d="M330 214 C380 190 410 150 446 122"
                    />
                    <path
                      className="tf-wv tf-wv-line"
                      style={{ "--i": "3" } as CSSProperties}
                      pathLength="1"
                      d="M372 228 C420 210 448 180 474 156"
                    />
                  </g>
                </g>
                <g fill="var(--tp-ground)" stroke="var(--tp-accent)" strokeWidth=".8">
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "12" } as CSSProperties}
                    cx="404"
                    cy="30"
                    r="4"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "13" } as CSSProperties}
                    cx="426"
                    cy="18"
                    r="3.5"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "14" } as CSSProperties}
                    cx="452"
                    cy="12"
                    r="4"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "15" } as CSSProperties}
                    cx="478"
                    cy="10"
                    r="3"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "16" } as CSSProperties}
                    cx="502"
                    cy="16"
                    r="3.5"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "17" } as CSSProperties}
                    cx="524"
                    cy="28"
                    r="3"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "18" } as CSSProperties}
                    cx="544"
                    cy="44"
                    r="2.6"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "19" } as CSSProperties}
                    cx="386"
                    cy="40"
                    r="3"
                  />
                  <circle
                    className="tf-wv tf-wv-foam"
                    style={{ "--i": "20" } as CSSProperties}
                    cx="560"
                    cy="64"
                    r="2.2"
                  />
                </g>
                <path
                  className="tf-wv tf-wv-drift"
                  d="M0 244 C100 236 200 242 300 236 C400 230 500 242 600 248"
                  fill="none"
                  stroke="var(--tp-wave-wash)"
                  strokeWidth="3"
                  opacity=".5"
                />
              </svg>
            </div>
          </div>
          <div
            className="tf-glass tf-tilt tf-stag tf-play"
            style={
              {
                "--i": "2",
                background: "rgba(251,249,244,.66)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
                backdropFilter: "blur(14px) saturate(140%)",
                border: "1px solid rgba(255,255,255,.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                borderRadius: "18px",
                padding: "24px 20px",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "8px",
                height: "100%",
                boxSizing: "border-box",
              } as CSSProperties
            }
          >
            <div style={{ width: "150px", position: "relative" }}>
              <svg
                className="tf-char"
                viewBox="0 0 200 240"
                role="img"
                aria-label="Tempo metronome mascot: Running low — arm leans and stops"
                data-state="leaning"
              >
                <title>Tempo metronome — Running low — arm leans and stops</title>
                <g className="tf-body tf-body--leaning" transform="rotate(-5 100 222)">
                  <rect
                    x="52"
                    y="200"
                    width="96"
                    height="22"
                    rx="6"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M62 200 L138 200 L114 38 L86 38 Z"
                    fill="var(--tp-wood)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="88"
                    y="30"
                    width="24"
                    height="10"
                    rx="3"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M90 60 L110 60 L118 150 L82 150 Z"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    opacity=".9"
                  />
                  <g stroke="var(--tp-ink)" strokeWidth="1.5" opacity=".45">
                    <path d="M92 75h4" />
                    <path d="M93 90h4" />
                    <path d="M94 105h4" />
                    <path d="M95 120h4" />
                    <path d="M96 135h4" />
                    <path d="M104 75h4" />
                    <path d="M103 90h4" />
                    <path d="M102 105h4" />
                    <path d="M101 120h4" />
                    <path d="M100 135h4" />
                  </g>
                  <ellipse cx="78" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <ellipse cx="122" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <path
                    d="M83 179 h10"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M107 179 h10"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M85 175 h8"
                    stroke="var(--tp-ink)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity=".5"
                  />
                  <path
                    d="M107 175 h8"
                    stroke="var(--tp-ink)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity=".5"
                  />
                  <path
                    d="M94 191 h12"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <g className="tf-arm tf-arm--leaning" transform="rotate(24 100 158)">
                    <line
                      x1="100"
                      y1="158"
                      x2="100"
                      y2="52"
                      stroke="var(--tp-ink)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <rect
                      x="91"
                      y="84"
                      width="18"
                      height="14"
                      rx="3"
                      fill="var(--tp-accent)"
                      stroke="var(--tp-ink)"
                      strokeWidth="2.5"
                    />
                  </g>
                  <circle
                    cx="100"
                    cy="158"
                    r="5"
                    fill="var(--tp-seal)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                  />
                </g>
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader Opsz',Newsreader,serif",
                fontWeight: "500",
                fontSize: "22px",
                color: "var(--tp-ink)",
                margin: "8px 0 0",
                position: "relative",
              }}
            >
              You run low.
            </h3>
            <p
              style={{
                fontFamily: "'Source Sans 3',sans-serif",
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--tp-ink-muted)",
                margin: "0",
                position: "relative",
              }}
            >
              Not failing. Just out of fuel. The beat slows.
            </p>
            <div style={{ marginTop: "auto" }}></div>
          </div>
          <div
            className="tf-glass tf-tilt tf-stag tf-play"
            style={
              {
                "--i": "3",
                background: "rgba(251,249,244,.66)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
                backdropFilter: "blur(14px) saturate(140%)",
                border: "1px solid rgba(255,255,255,.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                borderRadius: "18px",
                padding: "24px 20px",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "8px",
                height: "100%",
                boxSizing: "border-box",
              } as CSSProperties
            }
          >
            <div style={{ width: "150px", position: "relative" }}>
              <svg
                className="tf-char"
                viewBox="0 0 200 240"
                role="img"
                aria-label="Tempo metronome mascot: On a break — arm at rest, tea in hand"
                data-state="resting"
              >
                <title>Tempo metronome — On a break — arm at rest, tea in hand</title>
                <g className="tf-body tf-body--resting" transform="rotate(0 100 222)">
                  <rect
                    x="52"
                    y="200"
                    width="96"
                    height="22"
                    rx="6"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M62 200 L138 200 L114 38 L86 38 Z"
                    fill="var(--tp-wood)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="88"
                    y="30"
                    width="24"
                    height="10"
                    rx="3"
                    fill="var(--tp-wood-dark)"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                  />
                  <path
                    d="M90 60 L110 60 L118 150 L82 150 Z"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    opacity=".9"
                  />
                  <g stroke="var(--tp-ink)" strokeWidth="1.5" opacity=".45">
                    <path d="M92 75h4" />
                    <path d="M93 90h4" />
                    <path d="M94 105h4" />
                    <path d="M95 120h4" />
                    <path d="M96 135h4" />
                    <path d="M104 75h4" />
                    <path d="M103 90h4" />
                    <path d="M102 105h4" />
                    <path d="M101 120h4" />
                    <path d="M100 135h4" />
                  </g>
                  <ellipse cx="78" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <ellipse cx="122" cy="186" rx="6" ry="3.5" fill="var(--tp-sakura-wash)" />
                  <path
                    d="M83 179 q5 -5 10 0"
                    fill="none"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M107 179 q5 -5 10 0"
                    fill="none"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M93 189 Q100 194 107 189"
                    fill="none"
                    stroke="var(--tp-ink)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <g className="tf-arm tf-arm--resting" transform="rotate(0 100 158)">
                    <line
                      x1="100"
                      y1="158"
                      x2="100"
                      y2="52"
                      stroke="var(--tp-ink)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <rect
                      x="91"
                      y="84"
                      width="18"
                      height="14"
                      rx="3"
                      fill="var(--tp-accent)"
                      stroke="var(--tp-ink)"
                      strokeWidth="2.5"
                    />
                  </g>
                  <circle
                    cx="100"
                    cy="158"
                    r="5"
                    fill="var(--tp-seal)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2"
                  />
                </g>
                <g transform="translate(150 196)">
                  <path
                    d="M0 0 h26 l-3 16 q-10 4 -20 0z"
                    fill="var(--tp-ground)"
                    stroke="var(--tp-ink)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M26 4 q8 1 5 8 q-2 3 -7 2"
                    fill="none"
                    stroke="var(--tp-ink)"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M8 -6 q-4 -6 1 -11"
                    fill="none"
                    stroke="var(--tp-ink)"
                    className="tf-steam"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity=".55"
                  />
                  <path
                    d="M16 -6 q-4 -6 1 -11"
                    fill="none"
                    stroke="var(--tp-ink)"
                    className="tf-steam st2"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity=".55"
                  />
                </g>
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader Opsz',Newsreader,serif",
                fontWeight: "500",
                fontSize: "22px",
                color: "var(--tp-ink)",
                margin: "8px 0 0",
                position: "relative",
              }}
            >
              Tempo brings the beat back.
            </h3>
            <p
              style={{
                fontFamily: "'Source Sans 3',sans-serif",
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--tp-ink-muted)",
                margin: "0",
                position: "relative",
              }}
            >
              Small steps, a pause, and a cup of tea.
            </p>
            <div
              className="tf-ripple"
              aria-hidden="true"
              style={{ marginTop: "auto", width: "72%", paddingTop: "10px", opacity: ".6" }}
            >
              <svg
                viewBox="0 0 300 40"
                aria-hidden="true"
                style={{ display: "block", width: "100%", height: "auto" }}
              >
                <g fill="none" stroke="var(--tp-wave-wash)" strokeLinecap="round">
                  <path
                    d="M10 14 C60 8 110 20 160 14 C210 8 250 18 290 13"
                    strokeWidth="2"
                    opacity=".55"
                  />
                  <path
                    d="M40 24 C90 19 140 29 190 24 C230 20 260 27 280 24"
                    strokeWidth="1.6"
                    opacity=".4"
                  />
                  <path d="M70 33 C110 29 150 36 200 33" strokeWidth="1.3" opacity=".3" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
