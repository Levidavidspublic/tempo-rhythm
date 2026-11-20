// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties } from "react";

export function Demo() {
  return (
    <section id="demo" style={{ position: "relative", overflow: "hidden", padding: "88px 0" }}>
      <div
        className="tf-wc-layer tf-depth "
        aria-hidden="true"
        style={{ "--dx": "16px", inset: "0" } as CSSProperties}
      >
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <path
            d="M1126.7 160.0 L1136.7 179.7 L1136.4 199.8 L1123.2 217.6 L1100.6 231.3 L1076.4 241.9 L1058.8 253.2 L1051.7 269.9 L1052.2 294.3 L1052.3 323.8 L1043.8 351.2 L1022.7 368.2 L991.5 370.0 L957.2 358.5 L926.4 342.0 L901.6 331.0 L880.0 332.6 L856.5 346.3 L827.8 364.9 L795.3 377.8 L764.6 377.4 L741.2 362.5 L727.0 338.6 L718.0 313.9 L707.1 294.9 L688.3 282.7 L661.3 274.0 L632.3 263.3 L610.5 247.1 L603.1 225.5 L610.8 201.8 L627.9 179.4 L645.2 160.0 L654.9 142.7 L654.5 125.0 L647.3 104.9 L639.7 82.4 L637.6 58.9 L644.1 37.1 L659.0 18.6 L680.3 4.3 L705.8 -5.5 L733.9 -10.6 L763.1 -10.6 L791.9 -5.9 L818.4 1.6 L841.3 8.2 L861.0 9.8 L880.0 3.5 L901.6 -10.9 L928.5 -30.0 L961.1 -48.6 L997.5 -61.3 L1033.9 -64.5 L1066.2 -57.4 L1091.6 -41.1 L1108.3 -18.1 L1116.2 8.8 L1116.2 36.9 L1110.8 63.8 L1103.8 87.7 L1100.0 107.9 L1103.0 125.4 L1113.2 142.1 Z"
            fill="var(--tp-wave-light)"
            opacity="0.42"
            filter="url(#tf-wc)"
          />
          <path
            d="M1126.7 160.0 L1136.7 179.7 L1136.4 199.8 L1123.2 217.6 L1100.6 231.3 L1076.4 241.9 L1058.8 253.2 L1051.7 269.9 L1052.2 294.3 L1052.3 323.8 L1043.8 351.2 L1022.7 368.2 L991.5 370.0 L957.2 358.5 L926.4 342.0 L901.6 331.0 L880.0 332.6 L856.5 346.3 L827.8 364.9 L795.3 377.8 L764.6 377.4 L741.2 362.5 L727.0 338.6 L718.0 313.9 L707.1 294.9 L688.3 282.7 L661.3 274.0 L632.3 263.3 L610.5 247.1 L603.1 225.5 L610.8 201.8 L627.9 179.4 L645.2 160.0 L654.9 142.7 L654.5 125.0 L647.3 104.9 L639.7 82.4 L637.6 58.9 L644.1 37.1 L659.0 18.6 L680.3 4.3 L705.8 -5.5 L733.9 -10.6 L763.1 -10.6 L791.9 -5.9 L818.4 1.6 L841.3 8.2 L861.0 9.8 L880.0 3.5 L901.6 -10.9 L928.5 -30.0 L961.1 -48.6 L997.5 -61.3 L1033.9 -64.5 L1066.2 -57.4 L1091.6 -41.1 L1108.3 -18.1 L1116.2 8.8 L1116.2 36.9 L1110.8 63.8 L1103.8 87.7 L1100.0 107.9 L1103.0 125.4 L1113.2 142.1 Z"
            fill="none"
            stroke="var(--tp-wave-light)"
            strokeWidth="2"
            opacity="0.34"
            filter="url(#tf-wce)"
          />
          <path
            d="M1107.2 134.0 L1090.1 146.5 L1069.3 156.1 L1052.7 163.8 L1044.8 172.1 L1045.3 183.4 L1048.7 197.5 L1048.4 211.8 L1039.9 222.2 L1023.5 225.9 L1003.1 223.1 L984.1 217.6 L969.5 214.5 L959.5 218.0 L950.9 228.5 L940.5 242.7 L926.8 255.3 L910.7 261.6 L894.7 259.7 L881.3 250.9 L871.3 238.5 L863.7 226.1 L856.9 215.6 L849.7 207.3 L842.0 200.1 L834.0 193.4 L825.7 186.7 L816.2 180.1 L804.3 173.6 L789.7 166.4 L773.8 157.7 L759.5 146.8 L750.3 134.0 L748.6 120.3 L754.7 107.3 L766.8 96.2 L781.9 87.2 L797.2 79.9 L810.8 73.5 L822.3 67.1 L832.3 60.3 L841.5 52.9 L850.7 45.1 L860.5 37.3 L871.6 30.0 L884.2 24.5 L898.2 21.9 L912.8 22.8 L926.8 26.7 L939.7 32.2 L951.4 37.4 L962.9 41.1 L974.9 43.4 L987.4 45.5 L999.3 49.3 L1009.3 55.6 L1017.1 63.6 L1024.1 71.7 L1033.6 78.4 L1048.1 83.4 L1068.0 88.4 L1089.7 95.5 L1107.0 106.0 L1113.7 119.6 Z"
            fill="var(--tp-wave-light)"
            opacity="0.29"
            filter="url(#tf-wc)"
          />
          <path
            d="M284.9 500.0 L268.8 513.7 L256.3 525.8 L252.4 538.4 L258.3 554.4 L270.3 575.2 L281.9 600.0 L286.7 625.9 L281.4 649.3 L266.5 667.7 L244.6 680.5 L219.2 688.5 L192.4 692.8 L165.5 694.2 L139.1 692.6 L113.8 688.2 L90.0 681.8 L67.9 675.0 L46.9 669.1 L26.2 664.2 L5.5 659.1 L-14.2 652.1 L-31.6 642.0 L-46.1 629.3 L-58.8 616.1 L-72.4 604.0 L-89.3 593.5 L-109.4 583.1 L-129.1 570.8 L-142.7 555.1 L-145.6 536.5 L-137.5 517.5 L-123.5 500.0 L-111.6 484.5 L-108.3 469.2 L-114.5 451.6 L-125.0 430.5 L-130.9 407.9 L-124.9 388.0 L-105.5 374.8 L-77.4 369.4 L-48.5 368.3 L-25.3 365.4 L-9.1 355.4 L3.8 337.6 L18.7 316.6 L39.0 300.2 L64.1 294.9 L90.0 302.4 L112.9 318.4 L132.1 335.1 L150.0 345.8 L170.7 348.0 L196.3 344.9 L225.2 342.2 L252.8 345.3 L274.3 356.2 L287.7 373.4 L294.7 393.3 L298.7 413.0 L302.5 431.4 L305.6 449.0 L305.2 466.6 L298.3 484.0 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.48"
            filter="url(#tf-wc)"
          />
          <path
            d="M284.9 500.0 L268.8 513.7 L256.3 525.8 L252.4 538.4 L258.3 554.4 L270.3 575.2 L281.9 600.0 L286.7 625.9 L281.4 649.3 L266.5 667.7 L244.6 680.5 L219.2 688.5 L192.4 692.8 L165.5 694.2 L139.1 692.6 L113.8 688.2 L90.0 681.8 L67.9 675.0 L46.9 669.1 L26.2 664.2 L5.5 659.1 L-14.2 652.1 L-31.6 642.0 L-46.1 629.3 L-58.8 616.1 L-72.4 604.0 L-89.3 593.5 L-109.4 583.1 L-129.1 570.8 L-142.7 555.1 L-145.6 536.5 L-137.5 517.5 L-123.5 500.0 L-111.6 484.5 L-108.3 469.2 L-114.5 451.6 L-125.0 430.5 L-130.9 407.9 L-124.9 388.0 L-105.5 374.8 L-77.4 369.4 L-48.5 368.3 L-25.3 365.4 L-9.1 355.4 L3.8 337.6 L18.7 316.6 L39.0 300.2 L64.1 294.9 L90.0 302.4 L112.9 318.4 L132.1 335.1 L150.0 345.8 L170.7 348.0 L196.3 344.9 L225.2 342.2 L252.8 345.3 L274.3 356.2 L287.7 373.4 L294.7 393.3 L298.7 413.0 L302.5 431.4 L305.6 449.0 L305.2 466.6 L298.3 484.0 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.38"
            filter="url(#tf-wce)"
          />
          <path
            d="M266.7 477.0 L255.8 486.6 L247.8 495.1 L245.3 504.0 L247.2 514.4 L249.2 526.1 L246.2 536.8 L235.4 543.6 L218.3 544.8 L199.2 541.5 L183.6 537.9 L174.2 539.4 L169.8 549.4 L166.4 567.1 L159.6 587.7 L147.4 603.8 L131.4 609.3 L115.6 602.1 L103.9 585.0 L97.4 564.4 L94.2 547.1 L90.3 537.0 L82.0 534.7 L68.2 537.1 L50.6 540.1 L32.6 540.3 L17.7 536.3 L7.6 528.6 L2.2 518.7 L0.2 508.0 L-0.1 497.4 L0.3 487.1 L1.0 477.0 L2.1 467.1 L3.7 457.2 L5.9 447.3 L9.1 437.5 L13.5 427.9 L19.8 418.8 L27.9 410.7 L37.4 403.7 L47.9 397.6 L58.7 392.1 L69.8 387.1 L81.4 382.9 L93.9 380.5 L106.9 381.0 L119.7 384.6 L131.4 390.3 L141.6 396.3 L150.9 400.5 L160.6 401.9 L171.8 401.0 L184.6 399.3 L198.2 399.0 L211.1 401.2 L222.7 405.8 L233.3 411.8 L244.0 418.3 L255.6 425.2 L267.2 433.1 L276.2 442.7 L279.6 454.0 L276.0 465.9 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.34"
            filter="url(#tf-wc)"
          />
          <path
            d="M653.5 330.0 L644.2 339.5 L632.7 347.5 L623.5 354.5 L619.2 362.1 L619.3 371.4 L620.8 382.5 L620.1 394.1 L615.2 404.2 L605.7 411.4 L593.1 415.3 L579.4 416.6 L566.0 416.6 L553.5 416.2 L541.9 416.0 L530.8 415.8 L520.0 415.9 L509.1 416.1 L497.9 416.7 L486.0 417.3 L473.8 417.0 L462.0 414.6 L452.0 409.3 L445.1 401.2 L441.2 391.5 L439.0 381.9 L436.2 373.7 L430.6 367.3 L421.1 362.0 L408.5 356.4 L394.9 349.4 L382.9 340.5 L374.4 330.0 L370.2 318.5 L370.7 306.8 L375.9 295.9 L385.9 286.7 L400.3 280.1 L417.9 276.8 L436.3 276.4 L452.6 277.5 L464.6 277.4 L471.8 273.8 L476.0 265.7 L479.8 254.4 L486.0 242.7 L495.5 234.0 L507.4 230.4 L520.0 231.6 L532.0 235.3 L543.3 238.7 L554.9 240.3 L567.5 240.6 L580.6 241.6 L592.2 245.7 L600.4 253.6 L604.5 264.1 L605.9 275.0 L608.2 284.0 L614.4 290.7 L625.4 295.9 L639.1 301.8 L650.8 309.7 L656.3 319.5 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.12"
            filter="url(#tf-wc)"
          />
          <path
            d="M653.5 330.0 L644.2 339.5 L632.7 347.5 L623.5 354.5 L619.2 362.1 L619.3 371.4 L620.8 382.5 L620.1 394.1 L615.2 404.2 L605.7 411.4 L593.1 415.3 L579.4 416.6 L566.0 416.6 L553.5 416.2 L541.9 416.0 L530.8 415.8 L520.0 415.9 L509.1 416.1 L497.9 416.7 L486.0 417.3 L473.8 417.0 L462.0 414.6 L452.0 409.3 L445.1 401.2 L441.2 391.5 L439.0 381.9 L436.2 373.7 L430.6 367.3 L421.1 362.0 L408.5 356.4 L394.9 349.4 L382.9 340.5 L374.4 330.0 L370.2 318.5 L370.7 306.8 L375.9 295.9 L385.9 286.7 L400.3 280.1 L417.9 276.8 L436.3 276.4 L452.6 277.5 L464.6 277.4 L471.8 273.8 L476.0 265.7 L479.8 254.4 L486.0 242.7 L495.5 234.0 L507.4 230.4 L520.0 231.6 L532.0 235.3 L543.3 238.7 L554.9 240.3 L567.5 240.6 L580.6 241.6 L592.2 245.7 L600.4 253.6 L604.5 264.1 L605.9 275.0 L608.2 284.0 L614.4 290.7 L625.4 295.9 L639.1 301.8 L650.8 309.7 L656.3 319.5 Z"
            fill="none"
            stroke="var(--tp-wave-wash)"
            strokeWidth="2"
            opacity="0.10"
            filter="url(#tf-wce)"
          />
          <path
            d="M618.0 318.0 L607.0 323.0 L595.8 326.4 L588.9 329.2 L587.9 333.0 L591.4 338.7 L595.5 346.1 L596.9 353.4 L593.9 358.8 L587.4 361.5 L579.6 362.3 L572.3 362.9 L566.3 364.5 L560.7 367.2 L554.8 369.9 L548.3 371.0 L541.6 369.9 L535.4 367.3 L529.6 365.0 L523.5 364.5 L516.1 366.0 L507.4 368.0 L498.4 368.4 L491.4 365.7 L487.9 359.9 L488.0 352.3 L489.9 344.9 L491.1 339.1 L489.6 334.8 L485.7 331.2 L481.2 327.4 L478.6 322.8 L479.2 318.0 L482.5 313.5 L486.4 309.4 L488.6 305.5 L488.3 300.8 L486.4 295.0 L484.7 288.3 L484.9 281.7 L487.8 276.1 L492.8 271.6 L498.7 268.0 L505.1 264.7 L511.8 261.8 L519.1 260.2 L527.1 261.0 L534.9 264.6 L541.6 270.2 L546.9 275.8 L551.5 279.1 L556.7 279.1 L563.6 276.6 L571.8 274.0 L579.7 273.6 L585.3 276.5 L587.8 281.9 L588.5 288.0 L590.0 292.8 L595.1 295.7 L604.2 297.8 L614.8 300.7 L622.7 305.4 L624.1 311.7 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.08"
            filter="url(#tf-wc)"
          />
        </svg>
      </div>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "40px",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          className="tf-reveal"
          style={{ flex: "1 1 400px", minWidth: "0", position: "relative", isolation: "isolate" }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              pointerEvents: "none",
              left: "-40px",
              top: "22px",
              width: "min(560px,100%)",
              height: "120px",
              zIndex: "-1",
            }}
          >
            <path
              d="M10.0 54.1 L34.5 34.3 L59.0 27.8 L83.5 14.2 L108.0 21.5 L132.5 15.8 L157.0 11.1 L181.5 19.0 L206.0 13.7 L230.5 12.5 L255.0 17.8 L279.5 14.0 L304.0 10.4 L328.5 12.4 L353.0 9.5 L377.5 14.6 L402.0 13.6 L426.5 14.6 L451.0 10.7 L475.5 6.8 L500.0 9.9 L524.5 8.3 L549.0 11.9 L573.5 8.9 L598.0 14.8 L622.5 13.5 L647.0 10.7 L671.5 10.8 L696.0 13.9 L720.5 17.2 L745.0 16.6 L769.5 17.9 L794.0 18.3 L818.5 15.6 L843.0 21.2 L867.5 18.0 L892.0 19.8 L916.5 26.7 L941.0 27.0 L965.5 29.6 L990.0 44.0 L990.0 47.0 L965.5 60.0 L941.0 61.3 L916.5 60.5 L892.0 66.2 L867.5 66.9 L843.0 62.8 L818.5 67.4 L794.0 64.0 L769.5 63.7 L745.0 64.5 L720.5 63.4 L696.0 66.4 L671.5 69.3 L647.0 69.3 L622.5 66.5 L598.0 65.4 L573.5 71.5 L549.0 68.9 L524.5 73.1 L500.0 72.1 L475.5 75.9 L451.0 72.8 L426.5 69.9 L402.0 71.9 L377.5 71.9 L353.0 78.3 L328.5 76.5 L304.0 80.0 L279.5 77.7 L255.0 75.3 L230.5 82.1 L206.0 82.5 L181.5 78.6 L157.0 88.0 L132.5 85.0 L108.0 80.8 L83.5 89.6 L59.0 77.5 L34.5 72.5 L10.0 54.1 Z"
              fill="var(--tp-sakura-wash)"
              opacity="0.3"
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
            See it work
          </p>
          <h2
            className="tf-tex"
            style={{
              fontFamily: "'Newsreader Opsz',Newsreader,serif",
              fontWeight: "500",
              fontSize: "clamp(30px,3.4vw,42px)",
              lineHeight: "1.15",
              letterSpacing: "-.01em",
              color: "var(--tp-ink)",
              margin: "12px 0 0",
            }}
          >
            One brain dump in.
            <br />
            One calm day out.
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: "20px 0 24px",
              padding: "0",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <li
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                fontSize: "17px",
                color: "var(--tp-ink)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  marginTop: "8px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "99px",
                  background: "var(--tp-sakura)",
                  flex: "none",
                }}
              ></span>
              Talk or type. Messy is fine.
            </li>
            <li
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                fontSize: "17px",
                color: "var(--tp-ink)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  marginTop: "8px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "99px",
                  background: "var(--tp-sakura)",
                  flex: "none",
                }}
              ></span>
              Steps sized to today's energy, not an ideal day.
            </li>
            <li
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                fontSize: "17px",
                color: "var(--tp-ink)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  marginTop: "8px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "99px",
                  background: "var(--tp-sakura)",
                  flex: "none",
                }}
              ></span>
              Undo anything for five minutes.
            </li>
            <li
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                fontSize: "17px",
                color: "var(--tp-ink)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  marginTop: "8px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "99px",
                  background: "var(--tp-sakura)",
                  flex: "none",
                }}
              ></span>
              Works in English and Hebrew.
            </li>
          </ul>
          <div
            role="tablist"
            aria-label="Product demo"
            style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
          >
            <button type="button" role="tab" className="tf-tab" aria-selected="true" data-go="1">
              1 · Pour it out
            </button>
            <button type="button" role="tab" className="tf-tab" aria-selected="false" data-go="2">
              2 · Tempo finds the beat
            </button>
            <button type="button" role="tab" className="tf-tab" aria-selected="false" data-go="3">
              3 · Stay in rhythm
            </button>
          </div>
        </div>
        <div
          className="tf-glass tf-tilt"
          style={{
            background: "rgba(251,249,244,.58)",
            WebkitBackdropFilter: "blur(18px) saturate(150%)",
            backdropFilter: "blur(18px) saturate(150%)",
            border: "1px solid rgba(255,255,255,.75)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
            flex: "999 1 560px",
            minWidth: "0",
            borderRadius: "20px",
            overflow: "hidden",
            minHeight: "420px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(28,27,25,.08)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "99px",
                background: "var(--tp-line)",
              }}
            ></span>
            <span
              aria-hidden="true"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "99px",
                background: "var(--tp-line)",
              }}
            ></span>
            <span
              aria-hidden="true"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "99px",
                background: "var(--tp-line)",
              }}
            ></span>
            <span
              style={{
                marginInlineStart: "12px",
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "13px",
                color: "var(--tp-ink-muted)",
              }}
            >
              tempoflow.dev · Today
            </span>
          </div>
          <div data-step="1">
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                className="tf-step-in"
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "440px",
                  background: "var(--tp-accent)",
                  color: "var(--tp-on-accent)",
                  borderRadius: "18px 18px 4px 18px",
                  padding: "14px 16px",
                  fontSize: "16px",
                  lineHeight: "1.5",
                }}
              >
                ugh. dentist call, Dana's email, groceries, the tax form thing, I promised mum I'd
                call… also gym?
              </div>
              <div
                className="tf-step-in s2"
                style={{
                  alignSelf: "flex-end",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: "var(--tp-ink-muted)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "flex-end",
                    gap: "3px",
                    height: "22px",
                  }}
                  aria-hidden="true"
                >
                  <span className="tf-bar"></span>
                  <span className="tf-bar b2"></span>
                  <span className="tf-bar b3"></span>
                  <span className="tf-bar b4"></span>
                  <span className="tf-bar b5"></span>
                </span>
                Voice note · 0:14
              </div>
              <div
                className="tf-step-in s3"
                style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
              >
                <div style={{ width: "44px", flex: "none" }}>
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
                <div
                  style={{
                    background: "rgba(251,249,244,.66)",
                    WebkitBackdropFilter: "blur(14px) saturate(140%)",
                    backdropFilter: "blur(14px) saturate(140%)",
                    border: "1px solid rgba(255,255,255,.7)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                    borderRadius: "18px 18px 18px 4px",
                    padding: "12px 14px",
                    fontSize: "16px",
                    color: "var(--tp-ink)",
                  }}
                >
                  That's a lot for one head. Let's put it all down here first.
                </div>
              </div>
            </div>
          </div>
          <div data-step="2" hidden>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                className="tf-step-in"
                style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
              >
                <div style={{ width: "44px", flex: "none" }}>
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
                <div
                  style={{
                    background: "rgba(251,249,244,.66)",
                    WebkitBackdropFilter: "blur(14px) saturate(140%)",
                    backdropFilter: "blur(14px) saturate(140%)",
                    border: "1px solid rgba(255,255,255,.7)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                    borderRadius: "18px 18px 18px 4px",
                    padding: "12px 14px",
                    fontSize: "16px",
                    color: "var(--tp-ink)",
                  }}
                >
                  Six things. Let's not do six at once. Here's a medium-energy day:
                </div>
              </div>
              <div
                className="tf-step-in s2"
                style={{
                  background: "var(--tp-paper)",
                  border: "1px solid var(--tp-line)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(27,25,22,.05),0 4px 10px -8px rgba(27,25,22,.16)",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: "14px",
                    color: "var(--tp-accent)",
                    width: "52px",
                  }}
                >
                  10:00
                </span>
                <span style={{ flex: "1" }}>Call the dentist</span>
                <span style={{ fontSize: "13px", color: "var(--tp-ink-muted)" }}>5 min</span>
              </div>
              <div
                className="tf-step-in s3"
                style={{
                  background: "var(--tp-paper)",
                  border: "1px solid var(--tp-line)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(27,25,22,.05),0 4px 10px -8px rgba(27,25,22,.16)",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: "14px",
                    color: "var(--tp-accent)",
                    width: "52px",
                  }}
                >
                  11:30
                </span>
                <span style={{ flex: "1" }}>
                  {"Email Dana "}
                  <span style={{ fontSize: "13px", color: "var(--tp-done)" }}>· I drafted it</span>
                </span>
                <span style={{ fontSize: "13px", color: "var(--tp-ink-muted)" }}>10 min</span>
              </div>
              <div
                className="tf-step-in s4"
                style={{
                  background: "var(--tp-paper)",
                  border: "1px solid var(--tp-line)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(27,25,22,.05),0 4px 10px -8px rgba(27,25,22,.16)",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: "14px",
                    color: "var(--tp-accent)",
                    width: "52px",
                  }}
                >
                  16:00
                </span>
                <span style={{ flex: "1" }}>Groceries on the walk home</span>
                <span style={{ fontSize: "13px", color: "var(--tp-ink-muted)" }}>20 min</span>
              </div>
              <div
                className="tf-step-in s4"
                style={{ fontSize: "14px", color: "var(--tp-ink-muted)" }}
              >
                {"Parked for tomorrow: tax form, gym, call mum (Sunday, like you said). "}
                <button
                  type="button"
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--tp-accent)",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  Undo
                </button>
              </div>
            </div>
          </div>
          <div data-step="3" hidden>
            <div
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                position: "relative",
              }}
            >
              <div
                className="tf-step-in"
                style={{
                  background: "var(--tp-paper)",
                  border: "1px solid var(--tp-line)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(27,25,22,.05),0 4px 10px -8px rgba(27,25,22,.16)",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  opacity: ".75",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    background: "var(--tp-done)",
                    color: "var(--tp-on-accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                  }}
                >
                  ✓
                </span>
                <span style={{ flex: "1", textDecoration: "line-through" }}>Call the dentist</span>
                <span style={{ fontSize: "13px", color: "var(--tp-done)" }}>Done</span>
              </div>
              <div
                className="tf-step-in s2"
                style={{
                  background: "var(--tp-paper)",
                  border: "1px solid var(--tp-line)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(27,25,22,.05),0 4px 10px -8px rgba(27,25,22,.16)",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  borderColor: "var(--tp-accent)",
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: "14px",
                    color: "var(--tp-accent)",
                    width: "52px",
                  }}
                >
                  11:30
                </span>
                <span style={{ flex: "1", fontWeight: "600" }}>Email Dana</span>
                <span style={{ fontSize: "13px", color: "var(--tp-ink-muted)" }}>Next up</span>
              </div>
              <div
                className="tf-step-in s3 tf-glass"
                style={{
                  background: "rgba(251,249,244,.58)",
                  WebkitBackdropFilter: "blur(18px) saturate(150%)",
                  backdropFilter: "blur(18px) saturate(150%)",
                  border: "1px solid rgba(255,255,255,.75)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
                  borderRadius: "16px",
                  padding: "14px 16px",
                  maxWidth: "360px",
                  alignSelf: "flex-end",
                }}
              >
                <div style={{ fontSize: "13px", color: "var(--tp-ink-muted)" }}>Tempo · 11:28</div>
                <div style={{ fontSize: "16px", color: "var(--tp-ink)", marginTop: "4px" }}>
                  "Teapot on? Then Dana. Ten minutes, tops."
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button
                    type="button"
                    style={{
                      minHeight: "44px",
                      padding: "0 16px",
                      border: "none",
                      borderRadius: "999px",
                      background: "var(--tp-accent)",
                      color: "var(--tp-on-accent)",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    style={{
                      minHeight: "44px",
                      padding: "0 16px",
                      border: "1.5px solid var(--tp-ink)",
                      borderRadius: "999px",
                      background: "transparent",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Not now
                  </button>
                </div>
              </div>
              <div
                className="tf-step-in s4"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "14px",
                  color: "var(--tp-ink-muted)",
                }}
              >
                <div style={{ width: "40px" }}>
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
                "Not now" moves it gently. No red, no streaks, no guilt.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
