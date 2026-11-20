// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties, ReactNode } from "react";

export function Closing({ trial }: { trial: ReactNode }) {
  return (
    <section
      id="signin"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--tp-accent)",
        color: "var(--tp-ground)",
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
          height: "48px",
          top: "-2px",
          pointerEvents: "none",
          zIndex: "1",
        }}
      >
        <path
          d="M0 0.0 L0 65.7 L25 70.4 L50 57.5 L75 49.8 L100 39.9 L125 73.5 L150 65.4 L175 79.4 L200 60.1 L225 77.5 L250 51.3 L275 73.8 L300 67.1 L325 48.6 L350 51.5 L375 55.6 L400 30.0 L425 46.0 L450 57.6 L475 32.2 L500 59.4 L525 55.9 L550 66.2 L575 45.0 L600 36.7 L625 73.8 L650 76.9 L675 62.0 L700 46.7 L725 52.4 L750 73.2 L775 55.7 L800 85.4 L825 65.4 L850 43.8 L875 62.3 L900 44.8 L925 69.3 L950 65.7 L975 44.9 L1000 50.1 L1000 0.0 Z"
          fill="var(--tp-ground)"
          filter="url(#tf-tear)"
        />
      </svg>
      <div
        className="tf-wc-layer tf-depth "
        aria-hidden="true"
        style={{ "--dx": "12px", inset: "0" } as CSSProperties}
      >
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <path
            d="M422.9 140.0 L417.2 159.8 L402.0 177.5 L380.2 192.1 L357.5 203.8 L339.1 214.7 L326.8 227.0 L318.1 241.2 L308.3 255.7 L294.3 267.7 L276.6 276.1 L258.1 283.2 L241.6 293.7 L226.8 311.8 L210.3 337.4 L188.3 364.2 L160.0 382.7 L129.1 384.5 L101.9 367.7 L82.9 338.2 L71.4 306.8 L61.8 283.4 L47.1 271.8 L24.6 268.6 L-2.0 266.3 L-24.9 258.3 L-37.5 242.9 L-40.1 223.4 L-40.1 204.6 L-47.7 189.1 L-68.4 175.4 L-98.2 159.8 L-124.4 140.0 L-132.7 117.5 L-116.1 97.2 L-79.9 83.2 L-38.7 75.8 L-8.9 69.6 L1.2 57.2 L-5.0 34.4 L-14.8 3.6 L-14.5 -25.9 L2.9 -43.4 L34.4 -43.2 L70.6 -28.3 L101.9 -9.4 L124.6 1.3 L141.9 -3.5 L160.0 -22.1 L183.4 -45.3 L211.6 -62.1 L239.9 -65.5 L263.7 -55.3 L281.4 -37.2 L295.5 -18.2 L310.2 -2.8 L328.2 8.8 L348.5 19.3 L368.1 31.5 L384.1 46.6 L395.8 63.8 L405.0 82.0 L413.4 100.7 L420.4 120.0 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.55"
            filter="url(#tf-wc)"
          />
          <path
            d="M422.9 140.0 L417.2 159.8 L402.0 177.5 L380.2 192.1 L357.5 203.8 L339.1 214.7 L326.8 227.0 L318.1 241.2 L308.3 255.7 L294.3 267.7 L276.6 276.1 L258.1 283.2 L241.6 293.7 L226.8 311.8 L210.3 337.4 L188.3 364.2 L160.0 382.7 L129.1 384.5 L101.9 367.7 L82.9 338.2 L71.4 306.8 L61.8 283.4 L47.1 271.8 L24.6 268.6 L-2.0 266.3 L-24.9 258.3 L-37.5 242.9 L-40.1 223.4 L-40.1 204.6 L-47.7 189.1 L-68.4 175.4 L-98.2 159.8 L-124.4 140.0 L-132.7 117.5 L-116.1 97.2 L-79.9 83.2 L-38.7 75.8 L-8.9 69.6 L1.2 57.2 L-5.0 34.4 L-14.8 3.6 L-14.5 -25.9 L2.9 -43.4 L34.4 -43.2 L70.6 -28.3 L101.9 -9.4 L124.6 1.3 L141.9 -3.5 L160.0 -22.1 L183.4 -45.3 L211.6 -62.1 L239.9 -65.5 L263.7 -55.3 L281.4 -37.2 L295.5 -18.2 L310.2 -2.8 L328.2 8.8 L348.5 19.3 L368.1 31.5 L384.1 46.6 L395.8 63.8 L405.0 82.0 L413.4 100.7 L420.4 120.0 Z"
            fill="none"
            stroke="var(--tp-wave-wash)"
            strokeWidth="2"
            opacity="0.44"
            filter="url(#tf-wce)"
          />
          <path
            d="M306.9 116.0 L308.3 124.1 L319.8 134.1 L335.0 147.2 L345.0 161.8 L343.4 174.5 L329.8 182.0 L309.5 184.1 L290.3 184.0 L277.6 186.7 L271.4 195.6 L267.6 210.0 L260.8 224.5 L248.5 232.6 L232.3 230.0 L216.1 218.0 L203.2 202.7 L193.6 191.7 L184.4 189.9 L171.9 196.6 L155.2 206.3 L137.2 212.3 L122.4 210.4 L114.1 200.7 L111.7 187.4 L110.8 175.2 L105.8 166.7 L93.9 161.6 L76.4 157.0 L58.7 150.2 L46.3 140.3 L42.2 128.4 L45.6 116.0 L53.1 104.5 L61.6 94.0 L70.0 84.5 L79.8 76.1 L92.4 69.8 L107.6 66.1 L122.8 64.5 L134.5 62.4 L140.7 56.6 L142.4 45.1 L143.4 28.7 L147.8 11.6 L157.6 -1.2 L172.2 -5.8 L188.3 -1.9 L203.2 7.4 L215.6 17.5 L226.5 24.8 L237.2 28.5 L248.9 29.9 L261.2 31.4 L273.2 34.3 L284.9 38.3 L297.2 42.7 L311.1 46.9 L325.9 52.0 L338.5 59.6 L344.6 70.3 L341.3 83.3 L329.8 96.4 L315.8 107.4 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.39"
            filter="url(#tf-wc)"
          />
          <path
            d="M1051.8 420.0 L1069.1 442.2 L1078.8 466.4 L1074.0 489.6 L1053.7 508.4 L1023.5 521.5 L991.8 530.4 L965.0 538.5 L944.6 548.4 L927.7 560.4 L910.1 571.9 L889.7 580.1 L867.4 584.6 L845.3 587.9 L824.3 593.8 L803.3 604.6 L780.0 618.3 L753.6 629.2 L726.2 631.1 L701.8 621.1 L683.3 602.0 L670.0 580.6 L656.7 563.9 L637.5 555.4 L609.2 553.2 L574.2 551.8 L539.1 545.5 L511.1 532.1 L493.4 512.6 L483.9 490.1 L478.0 466.9 L472.7 443.6 L469.9 420.0 L475.5 396.6 L495.0 375.8 L528.0 360.4 L567.1 351.2 L600.5 345.2 L618.8 336.0 L620.6 318.0 L613.6 290.2 L610.0 258.4 L619.6 232.8 L644.6 222.4 L679.0 229.7 L713.2 248.2 L740.7 265.9 L761.3 271.6 L780.0 261.0 L802.9 239.1 L831.9 216.5 L864.1 203.7 L893.8 205.7 L917.0 220.1 L934.2 240.0 L949.6 258.8 L967.3 273.9 L987.6 287.1 L1007.1 301.7 L1020.6 319.7 L1026.0 340.5 L1026.1 361.8 L1027.6 381.6 L1036.0 400.3 Z"
            fill="var(--tp-wave-light)"
            opacity="0.28"
            filter="url(#tf-wc)"
          />
          <path
            d="M1051.8 420.0 L1069.1 442.2 L1078.8 466.4 L1074.0 489.6 L1053.7 508.4 L1023.5 521.5 L991.8 530.4 L965.0 538.5 L944.6 548.4 L927.7 560.4 L910.1 571.9 L889.7 580.1 L867.4 584.6 L845.3 587.9 L824.3 593.8 L803.3 604.6 L780.0 618.3 L753.6 629.2 L726.2 631.1 L701.8 621.1 L683.3 602.0 L670.0 580.6 L656.7 563.9 L637.5 555.4 L609.2 553.2 L574.2 551.8 L539.1 545.5 L511.1 532.1 L493.4 512.6 L483.9 490.1 L478.0 466.9 L472.7 443.6 L469.9 420.0 L475.5 396.6 L495.0 375.8 L528.0 360.4 L567.1 351.2 L600.5 345.2 L618.8 336.0 L620.6 318.0 L613.6 290.2 L610.0 258.4 L619.6 232.8 L644.6 222.4 L679.0 229.7 L713.2 248.2 L740.7 265.9 L761.3 271.6 L780.0 261.0 L802.9 239.1 L831.9 216.5 L864.1 203.7 L893.8 205.7 L917.0 220.1 L934.2 240.0 L949.6 258.8 L967.3 273.9 L987.6 287.1 L1007.1 301.7 L1020.6 319.7 L1026.0 340.5 L1026.1 361.8 L1027.6 381.6 L1036.0 400.3 Z"
            fill="none"
            stroke="var(--tp-wave-light)"
            strokeWidth="2"
            opacity="0.22"
            filter="url(#tf-wce)"
          />
          <path
            d="M954.1 394.0 L953.0 403.7 L952.9 413.6 L953.2 423.9 L952.2 434.5 L948.3 444.7 L941.8 454.0 L934.4 462.9 L927.8 472.7 L922.5 484.9 L917.1 499.4 L908.9 513.9 L896.2 524.6 L879.0 528.3 L860.0 524.0 L842.0 514.2 L826.8 503.5 L813.9 496.5 L801.1 494.7 L787.1 496.1 L772.5 496.2 L760.2 491.2 L752.6 480.6 L749.7 467.2 L747.8 455.6 L740.8 449.1 L724.4 447.4 L699.5 447.1 L672.6 443.8 L653.9 434.9 L651.2 421.3 L665.8 406.4 L691.4 394.0 L716.7 385.5 L731.1 379.2 L730.1 371.1 L716.8 358.5 L700.0 341.1 L689.0 322.2 L689.7 306.2 L702.0 296.6 L721.5 294.0 L742.7 295.9 L761.5 298.7 L776.7 299.6 L789.3 297.7 L801.2 293.7 L813.5 289.0 L826.8 284.6 L841.1 280.7 L856.5 277.5 L872.9 275.5 L889.4 276.1 L904.6 280.5 L916.6 289.2 L924.4 301.2 L928.9 314.4 L931.7 326.8 L935.3 337.5 L940.6 346.6 L946.9 355.2 L952.4 364.3 L955.3 374.1 L955.5 384.1 Z"
            fill="var(--tp-wave-light)"
            opacity="0.20"
            filter="url(#tf-wc)"
          />
          <path
            d="M1120.6 90.0 L1120.4 103.9 L1108.9 116.2 L1089.0 125.2 L1067.2 131.1 L1050.6 136.1 L1042.6 143.5 L1041.6 155.0 L1042.2 169.7 L1038.7 183.8 L1028.2 193.0 L1011.9 194.9 L993.6 190.8 L976.8 184.7 L963.2 181.0 L951.6 182.2 L940.0 187.2 L927.0 192.7 L913.3 194.8 L900.4 191.9 L889.7 184.8 L880.9 176.3 L872.2 169.1 L861.6 164.5 L848.0 161.8 L832.2 159.0 L816.4 154.4 L802.8 147.2 L792.8 137.5 L787.1 126.2 L785.9 113.9 L789.2 101.6 L797.1 90.0 L808.3 79.9 L820.1 71.4 L828.9 63.7 L831.6 55.0 L827.9 43.3 L820.8 27.9 L815.6 10.4 L817.2 -5.8 L827.8 -16.7 L845.5 -20.4 L865.9 -18.1 L884.8 -14.0 L900.2 -12.3 L913.2 -15.2 L925.9 -21.3 L940.0 -26.2 L954.5 -25.1 L967.1 -16.3 L975.6 -1.6 L980.4 14.0 L984.3 25.4 L991.2 30.3 L1003.4 29.8 L1020.1 27.5 L1038.0 27.2 L1053.5 30.8 L1065.2 37.8 L1074.8 46.5 L1085.1 55.7 L1097.9 65.5 L1111.4 76.8 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.22"
            filter="url(#tf-wc)"
          />
          <path
            d="M1120.6 90.0 L1120.4 103.9 L1108.9 116.2 L1089.0 125.2 L1067.2 131.1 L1050.6 136.1 L1042.6 143.5 L1041.6 155.0 L1042.2 169.7 L1038.7 183.8 L1028.2 193.0 L1011.9 194.9 L993.6 190.8 L976.8 184.7 L963.2 181.0 L951.6 182.2 L940.0 187.2 L927.0 192.7 L913.3 194.8 L900.4 191.9 L889.7 184.8 L880.9 176.3 L872.2 169.1 L861.6 164.5 L848.0 161.8 L832.2 159.0 L816.4 154.4 L802.8 147.2 L792.8 137.5 L787.1 126.2 L785.9 113.9 L789.2 101.6 L797.1 90.0 L808.3 79.9 L820.1 71.4 L828.9 63.7 L831.6 55.0 L827.9 43.3 L820.8 27.9 L815.6 10.4 L817.2 -5.8 L827.8 -16.7 L845.5 -20.4 L865.9 -18.1 L884.8 -14.0 L900.2 -12.3 L913.2 -15.2 L925.9 -21.3 L940.0 -26.2 L954.5 -25.1 L967.1 -16.3 L975.6 -1.6 L980.4 14.0 L984.3 25.4 L991.2 30.3 L1003.4 29.8 L1020.1 27.5 L1038.0 27.2 L1053.5 30.8 L1065.2 37.8 L1074.8 46.5 L1085.1 55.7 L1097.9 65.5 L1111.4 76.8 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.18"
            filter="url(#tf-wce)"
          />
          <path
            d="M1057.3 76.0 L1056.8 83.0 L1050.5 89.2 L1040.1 93.7 L1029.1 96.7 L1021.3 99.4 L1018.4 103.8 L1019.5 110.8 L1021.3 119.8 L1020.4 128.4 L1014.9 134.0 L1005.6 134.9 L994.8 131.7 L985.1 127.1 L977.5 124.3 L971.4 125.3 L965.2 129.9 L957.7 135.6 L949.0 139.4 L940.6 139.3 L933.7 135.3 L928.8 129.1 L924.9 123.1 L920.5 118.5 L914.6 115.4 L907.7 112.8 L900.9 109.5 L895.5 105.1 L891.8 99.7 L889.0 94.0 L886.0 88.3 L882.2 82.4 L878.6 76.0 L877.2 69.2 L879.4 62.7 L885.5 57.1 L894.0 53.0 L902.3 49.8 L908.4 46.4 L912.1 42.0 L914.4 36.4 L917.6 30.7 L922.8 26.5 L930.1 24.8 L938.2 25.2 L945.8 26.1 L952.3 25.6 L958.4 22.4 L965.2 17.0 L973.4 11.4 L982.6 7.9 L991.6 8.1 L999.2 11.9 L1004.8 18.1 L1008.8 25.1 L1011.9 31.6 L1015.0 37.2 L1018.3 42.0 L1021.8 46.5 L1025.8 50.7 L1030.7 54.8 L1037.2 59.0 L1044.9 63.6 L1052.5 69.3 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.15"
            filter="url(#tf-wc)"
          />
        </svg>
      </div>
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "0", right: "0", bottom: "0", opacity: ".5" }}
      >
        <svg
          viewBox="0 0 600 90"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ display: "block", width: "100%", height: "80px" }}
        >
          <path
            className="tf-wv-swell sw1"
            d="M0 90 L0 46 C60 34 110 28 170 38 C220 46 250 30 300 26 C360 22 400 40 460 36 C520 32 560 24 600 30 L600 90 Z"
            fill="var(--tp-wave-light)"
            opacity="0.55"
          />
          <path
            className="tf-wv-swell sw2"
            d="M0 90 L0 60 C50 52 90 44 150 52 C210 60 250 46 310 44 C370 42 420 58 480 54 C530 50 570 44 600 48 L600 90 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.45"
          />
          <path
            className="tf-wv-swell sw3"
            d="M0 90 L0 74 C70 66 120 62 190 70 C260 78 310 64 380 64 C450 64 510 76 600 70 L600 90 Z"
            fill="var(--tp-accent)"
            opacity="0.55"
          />
          <path
            d="M0 46 C60 34 110 28 170 38 C220 46 250 30 300 26 C360 22 400 40 460 36 C520 32 560 24 600 30"
            fill="none"
            stroke="var(--tp-ground)"
            strokeWidth="1.6"
            opacity=".7"
          />
        </svg>
      </div>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "100px 24px 80px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px 24px",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div style={{ flex: "999 1 480px", minWidth: "0" }}>
          <h2
            className="tf-tex tf-reveal"
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontWeight: "500",
              fontSize: "clamp(32px,4.4vw,52px)",
              lineHeight: "1.1",
              margin: "0",
              color: "var(--tp-ground)",
            }}
          >
            Your brain deserves better than another to-do list.
          </h2>
          <p
            style={{
              fontSize: "18px",
              lineHeight: "1.6",
              color: "var(--tp-accent-wash)",
              margin: "14px 0 0",
              maxWidth: "52ch",
            }}
          >
            We're letting people in slowly, so the coach gets to know each of you. Pour the tea and
            save your spot.
          </p>
          <div style={{ marginTop: "26px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <a
              href="#top"
              className="tf-shine"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: "48px",
                padding: "0 22px",
                borderRadius: "999px",
                background: "var(--tp-ground)",
                color: "var(--tp-accent)",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Join the waitlist
            </a>
            {trial}
          </div>
        </div>
        <div
          className="tf-depth"
          style={
            {
              "--dx": "-12px",
              flex: "0 1 380px",
              display: "flex",
              justifyContent: "center",
            } as CSSProperties
          }
        >
          <div
            className="tf-fade-close tf-play"
            style={{ position: "relative", width: "min(320px,72vw)", aspectRatio: "200/240" }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "-28% -32%",
                borderRadius: "50%",
                background:
                  "radial-gradient(closest-side,rgba(247,243,234,.97) 0%,rgba(247,243,234,.97) 40%,rgba(247,243,234,0) 100%)",
                opacity: ".96",
              }}
            ></div>
            <div style={{ position: "relative" }}>
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
          </div>
        </div>
      </div>
    </section>
  );
}
