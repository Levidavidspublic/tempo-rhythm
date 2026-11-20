// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
import type { CSSProperties, ReactNode } from "react";

export function Hero({ waitlist }: { waitlist: ReactNode }) {
  return (
    <section id="top" style={{ position: "relative", overflow: "hidden", paddingTop: "24px" }}>
      <div
        className="tf-wc-layer tf-depth "
        aria-hidden="true"
        style={{ "--dx": "14px", inset: "-12% -6% -4% -6%" } as CSSProperties}
      >
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <path
            d="M378.3 430.0 L401.4 449.3 L418.5 471.7 L422.6 494.5 L412.6 514.9 L393.1 531.3 L370.0 544.7 L347.5 556.5 L326.0 567.3 L303.5 575.8 L278.4 579.9 L251.8 578.5 L226.6 574.2 L205.2 571.9 L187.5 576.9 L170.4 591.3 L150.0 612.2 L124.4 632.6 L95.1 645.3 L65.9 646.2 L40.8 635.6 L21.2 618.0 L5.9 598.2 L-7.3 579.5 L-19.6 562.3 L-30.4 545.5 L-38.7 528.4 L-44.8 511.2 L-51.2 495.0 L-61.4 480.0 L-76.5 465.1 L-92.9 448.7 L-103.7 430.0 L-101.5 410.7 L-84.3 393.6 L-57.3 381.0 L-30.9 371.5 L-15.4 361.0 L-14.7 344.1 L-23.9 318.7 L-31.9 288.1 L-28.3 260.5 L-9.0 244.4 L22.2 243.4 L56.2 253.3 L85.4 263.8 L107.8 264.4 L127.4 250.8 L150.0 227.5 L178.3 205.7 L209.4 197.3 L236.5 207.7 L254.3 233.7 L262.6 265.6 L267.2 293.1 L275.6 310.6 L292.0 319.3 L314.1 324.9 L335.1 333.5 L347.9 347.5 L350.5 365.2 L347.9 383.2 L348.4 399.2 L358.5 414.0 Z"
            fill="var(--tp-wave-light)"
            opacity="0.42"
            filter="url(#tf-wc)"
          />
          <path
            d="M378.3 430.0 L401.4 449.3 L418.5 471.7 L422.6 494.5 L412.6 514.9 L393.1 531.3 L370.0 544.7 L347.5 556.5 L326.0 567.3 L303.5 575.8 L278.4 579.9 L251.8 578.5 L226.6 574.2 L205.2 571.9 L187.5 576.9 L170.4 591.3 L150.0 612.2 L124.4 632.6 L95.1 645.3 L65.9 646.2 L40.8 635.6 L21.2 618.0 L5.9 598.2 L-7.3 579.5 L-19.6 562.3 L-30.4 545.5 L-38.7 528.4 L-44.8 511.2 L-51.2 495.0 L-61.4 480.0 L-76.5 465.1 L-92.9 448.7 L-103.7 430.0 L-101.5 410.7 L-84.3 393.6 L-57.3 381.0 L-30.9 371.5 L-15.4 361.0 L-14.7 344.1 L-23.9 318.7 L-31.9 288.1 L-28.3 260.5 L-9.0 244.4 L22.2 243.4 L56.2 253.3 L85.4 263.8 L107.8 264.4 L127.4 250.8 L150.0 227.5 L178.3 205.7 L209.4 197.3 L236.5 207.7 L254.3 233.7 L262.6 265.6 L267.2 293.1 L275.6 310.6 L292.0 319.3 L314.1 324.9 L335.1 333.5 L347.9 347.5 L350.5 365.2 L347.9 383.2 L348.4 399.2 L358.5 414.0 Z"
            fill="none"
            stroke="var(--tp-wave-light)"
            strokeWidth="2"
            opacity="0.34"
            filter="url(#tf-wce)"
          />
          <path
            d="M348.5 406.0 L355.7 418.5 L351.3 430.5 L336.9 440.0 L317.7 446.2 L300.3 450.6 L288.6 455.7 L283.1 463.6 L281.0 474.5 L278.2 486.8 L271.9 497.9 L261.4 505.6 L247.8 508.8 L232.9 508.0 L218.3 504.4 L205.0 499.5 L193.2 494.2 L182.7 489.4 L172.8 485.9 L162.6 484.6 L150.8 485.8 L136.3 489.0 L119.1 492.5 L100.5 494.1 L82.8 492.1 L68.9 485.5 L60.7 475.1 L58.4 462.2 L61.0 448.7 L66.5 436.0 L72.8 424.7 L78.4 414.8 L82.1 406.0 L82.8 397.5 L79.9 388.4 L73.7 377.7 L65.8 364.8 L59.5 350.2 L58.3 335.7 L64.6 323.7 L78.6 316.6 L97.4 314.9 L117.1 317.2 L134.4 320.2 L148.0 320.9 L159.0 318.1 L169.6 313.3 L181.0 309.8 L193.2 310.3 L204.6 315.6 L214.3 323.3 L222.9 329.6 L233.0 331.1 L247.0 327.4 L265.7 321.4 L286.2 317.7 L303.6 319.9 L313.3 329.1 L314.0 343.0 L308.9 357.8 L304.3 370.1 L306.2 379.3 L316.8 386.8 L333.2 395.2 Z"
            fill="var(--tp-wave-light)"
            opacity="0.29"
            filter="url(#tf-wc)"
          />
          <path
            d="M1124.3 110.0 L1089.5 127.6 L1053.2 140.0 L1029.3 150.1 L1024.0 163.0 L1032.7 182.0 L1044.1 205.9 L1047.0 229.7 L1036.6 247.7 L1015.2 257.5 L989.8 261.5 L966.1 264.8 L945.8 271.6 L926.8 281.8 L906.1 290.9 L883.1 293.1 L860.0 285.9 L839.6 271.7 L822.4 257.5 L805.6 249.8 L785.0 251.2 L758.4 258.3 L728.1 263.9 L700.5 261.6 L682.1 248.7 L675.3 228.2 L676.2 205.8 L676.5 186.5 L668.5 171.9 L649.0 159.9 L621.7 147.0 L594.6 130.4 L576.2 110.0 L571.3 87.8 L579.7 66.5 L598.0 48.0 L621.6 33.0 L647.1 21.2 L672.3 12.2 L695.7 4.8 L715.8 -2.5 L732.0 -11.6 L745.2 -24.0 L758.0 -38.8 L773.9 -52.2 L794.3 -59.0 L817.9 -55.2 L840.9 -41.3 L860.0 -23.4 L875.2 -10.7 L890.8 -10.9 L912.7 -25.6 L944.2 -48.6 L982.6 -68.9 L1019.6 -76.3 L1045.8 -66.6 L1056.7 -43.4 L1056.2 -15.6 L1054.8 8.5 L1063.2 25.3 L1085.3 37.2 L1114.8 49.7 L1138.2 66.8 L1142.8 88.3 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.5"
            filter="url(#tf-wc)"
          />
          <path
            d="M1124.3 110.0 L1089.5 127.6 L1053.2 140.0 L1029.3 150.1 L1024.0 163.0 L1032.7 182.0 L1044.1 205.9 L1047.0 229.7 L1036.6 247.7 L1015.2 257.5 L989.8 261.5 L966.1 264.8 L945.8 271.6 L926.8 281.8 L906.1 290.9 L883.1 293.1 L860.0 285.9 L839.6 271.7 L822.4 257.5 L805.6 249.8 L785.0 251.2 L758.4 258.3 L728.1 263.9 L700.5 261.6 L682.1 248.7 L675.3 228.2 L676.2 205.8 L676.5 186.5 L668.5 171.9 L649.0 159.9 L621.7 147.0 L594.6 130.4 L576.2 110.0 L571.3 87.8 L579.7 66.5 L598.0 48.0 L621.6 33.0 L647.1 21.2 L672.3 12.2 L695.7 4.8 L715.8 -2.5 L732.0 -11.6 L745.2 -24.0 L758.0 -38.8 L773.9 -52.2 L794.3 -59.0 L817.9 -55.2 L840.9 -41.3 L860.0 -23.4 L875.2 -10.7 L890.8 -10.9 L912.7 -25.6 L944.2 -48.6 L982.6 -68.9 L1019.6 -76.3 L1045.8 -66.6 L1056.7 -43.4 L1056.2 -15.6 L1054.8 8.5 L1063.2 25.3 L1085.3 37.2 L1114.8 49.7 L1138.2 66.8 L1142.8 88.3 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.40"
            filter="url(#tf-wce)"
          />
          <path
            d="M1005.2 87.0 L1003.3 94.8 L1009.2 103.7 L1017.7 114.5 L1023.0 126.3 L1021.8 137.2 L1014.3 145.8 L1003.8 152.6 L993.4 158.8 L984.3 165.8 L975.2 173.2 L964.3 178.9 L950.9 180.2 L936.2 176.4 L922.4 169.4 L911.1 163.7 L901.4 163.4 L890.9 170.1 L877.3 181.5 L860.6 192.0 L843.3 196.5 L829.3 192.3 L821.0 180.9 L817.5 166.7 L815.1 154.3 L809.1 146.1 L797.5 141.2 L781.9 136.8 L767.2 130.4 L758.8 120.7 L759.3 109.0 L767.4 97.3 L778.9 87.0 L789.3 78.4 L795.9 70.6 L799.2 62.8 L801.1 54.6 L803.9 46.4 L808.4 38.5 L814.1 31.1 L819.9 23.4 L825.7 15.0 L832.0 6.0 L839.9 -2.7 L850.0 -9.8 L861.8 -14.8 L874.6 -18.0 L887.8 -20.5 L901.4 -23.0 L915.5 -24.5 L929.5 -23.2 L942.0 -17.3 L951.1 -6.6 L956.5 6.6 L959.8 18.8 L965.1 26.5 L976.1 28.8 L993.9 27.8 L1015.4 27.6 L1034.4 31.5 L1044.4 40.8 L1042.3 53.7 L1030.5 67.0 L1015.6 78.2 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.35"
            filter="url(#tf-wc)"
          />
          <path
            d="M763.4 560.0 L759.8 575.3 L755.3 590.3 L750.8 605.1 L744.8 619.7 L735.3 633.1 L720.8 643.8 L702.4 651.1 L682.5 655.6 L664.4 659.2 L649.8 664.8 L638.3 674.3 L627.7 687.4 L615.3 702.1 L599.6 715.4 L580.8 724.9 L560.0 729.6 L538.5 730.2 L517.3 727.5 L497.0 721.9 L478.8 712.9 L464.1 700.0 L454.1 683.6 L448.7 665.7 L445.4 649.4 L439.7 637.0 L427.6 629.0 L408.0 623.4 L384.2 616.8 L362.9 606.6 L351.7 592.3 L354.6 575.8 L370.4 560.0 L392.2 547.1 L411.2 536.9 L420.6 527.0 L418.7 514.4 L409.4 497.2 L399.4 476.3 L395.6 454.8 L401.5 436.4 L416.7 423.8 L437.8 417.3 L460.9 415.4 L483.2 415.3 L503.6 414.9 L522.5 413.1 L541.1 410.4 L560.0 407.7 L579.4 406.2 L599.0 407.2 L617.8 411.3 L634.8 419.1 L648.9 430.3 L659.5 443.8 L667.4 457.9 L674.4 470.8 L683.1 481.2 L695.5 489.4 L712.0 496.6 L730.3 505.0 L747.0 515.7 L758.7 529.2 L763.9 544.3 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.16"
            filter="url(#tf-wc)"
          />
          <path
            d="M763.4 560.0 L759.8 575.3 L755.3 590.3 L750.8 605.1 L744.8 619.7 L735.3 633.1 L720.8 643.8 L702.4 651.1 L682.5 655.6 L664.4 659.2 L649.8 664.8 L638.3 674.3 L627.7 687.4 L615.3 702.1 L599.6 715.4 L580.8 724.9 L560.0 729.6 L538.5 730.2 L517.3 727.5 L497.0 721.9 L478.8 712.9 L464.1 700.0 L454.1 683.6 L448.7 665.7 L445.4 649.4 L439.7 637.0 L427.6 629.0 L408.0 623.4 L384.2 616.8 L362.9 606.6 L351.7 592.3 L354.6 575.8 L370.4 560.0 L392.2 547.1 L411.2 536.9 L420.6 527.0 L418.7 514.4 L409.4 497.2 L399.4 476.3 L395.6 454.8 L401.5 436.4 L416.7 423.8 L437.8 417.3 L460.9 415.4 L483.2 415.3 L503.6 414.9 L522.5 413.1 L541.1 410.4 L560.0 407.7 L579.4 406.2 L599.0 407.2 L617.8 411.3 L634.8 419.1 L648.9 430.3 L659.5 443.8 L667.4 457.9 L674.4 470.8 L683.1 481.2 L695.5 489.4 L712.0 496.6 L730.3 505.0 L747.0 515.7 L758.7 529.2 L763.9 544.3 Z"
            fill="none"
            stroke="var(--tp-wave-wash)"
            strokeWidth="2"
            opacity="0.13"
            filter="url(#tf-wce)"
          />
          <path
            d="M711.1 541.0 L718.4 550.5 L718.2 560.2 L712.1 568.9 L703.8 576.4 L696.1 583.5 L689.7 590.8 L683.2 598.0 L674.8 603.9 L663.7 607.0 L650.8 607.1 L638.3 605.4 L627.8 604.2 L619.3 605.6 L611.8 610.1 L603.7 616.3 L594.2 621.9 L583.6 624.6 L573.0 624.1 L563.0 621.2 L553.6 617.4 L544.5 613.5 L535.7 609.3 L528.0 603.9 L522.8 596.7 L520.6 588.1 L520.3 579.5 L519.3 572.2 L515.1 566.6 L506.3 561.8 L494.7 556.4 L483.8 549.5 L477.4 541.0 L477.2 532.0 L482.0 523.6 L488.4 516.0 L493.1 508.3 L494.9 499.6 L495.3 489.5 L497.2 478.9 L503.3 470.1 L514.0 464.8 L527.7 463.4 L541.9 464.6 L554.6 466.5 L565.6 467.5 L575.5 467.7 L585.1 468.7 L594.2 471.8 L602.3 476.9 L609.2 482.3 L616.0 485.0 L624.8 483.3 L637.5 477.8 L653.8 471.5 L670.5 468.5 L683.1 471.7 L688.1 480.9 L685.4 493.5 L678.5 505.8 L673.5 515.4 L675.0 521.9 L684.2 527.0 L698.1 533.0 Z"
            fill="var(--tp-wave-wash)"
            opacity="0.11"
            filter="url(#tf-wc)"
          />
        </svg>
      </div>
      <div
        className="tf-wc-layer tf-depth "
        aria-hidden="true"
        style={{ "--dx": "34px", inset: "0" } as CSSProperties}
      >
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <path
            d="M1029.9 330.0 L1031.2 337.8 L1023.9 344.6 L1010.9 349.1 L998.3 352.1 L991.2 355.5 L991.4 362.0 L996.1 372.3 L1000.1 384.7 L998.9 395.5 L991.1 401.4 L978.8 401.3 L965.8 397.3 L954.7 393.5 L946.1 393.3 L938.5 397.5 L930.0 404.0 L920.0 409.1 L909.7 409.6 L900.8 405.0 L894.4 397.1 L889.6 388.9 L884.8 382.7 L878.6 378.8 L871.2 375.8 L864.1 372.2 L859.1 367.0 L856.4 360.7 L854.8 354.3 L851.7 348.5 L845.9 343.0 L838.1 337.1 L831.0 330.0 L828.0 322.2 L830.8 314.6 L838.5 308.3 L848.2 303.6 L856.8 299.5 L862.7 294.9 L866.5 289.4 L870.1 283.3 L875.2 277.9 L882.1 274.0 L889.8 271.4 L897.3 268.5 L904.3 263.9 L911.5 257.4 L920.0 250.5 L930.0 246.1 L940.6 246.3 L950.0 251.4 L957.5 259.4 L963.3 267.2 L969.5 272.4 L977.4 274.6 L987.0 275.8 L996.1 278.4 L1002.0 283.9 L1003.1 291.9 L1001.0 300.4 L999.4 307.6 L1002.1 312.9 L1010.3 317.5 L1021.3 323.0 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.42"
            filter="url(#tf-wc)"
          />
          <path
            d="M1029.9 330.0 L1031.2 337.8 L1023.9 344.6 L1010.9 349.1 L998.3 352.1 L991.2 355.5 L991.4 362.0 L996.1 372.3 L1000.1 384.7 L998.9 395.5 L991.1 401.4 L978.8 401.3 L965.8 397.3 L954.7 393.5 L946.1 393.3 L938.5 397.5 L930.0 404.0 L920.0 409.1 L909.7 409.6 L900.8 405.0 L894.4 397.1 L889.6 388.9 L884.8 382.7 L878.6 378.8 L871.2 375.8 L864.1 372.2 L859.1 367.0 L856.4 360.7 L854.8 354.3 L851.7 348.5 L845.9 343.0 L838.1 337.1 L831.0 330.0 L828.0 322.2 L830.8 314.6 L838.5 308.3 L848.2 303.6 L856.8 299.5 L862.7 294.9 L866.5 289.4 L870.1 283.3 L875.2 277.9 L882.1 274.0 L889.8 271.4 L897.3 268.5 L904.3 263.9 L911.5 257.4 L920.0 250.5 L930.0 246.1 L940.6 246.3 L950.0 251.4 L957.5 259.4 L963.3 267.2 L969.5 272.4 L977.4 274.6 L987.0 275.8 L996.1 278.4 L1002.0 283.9 L1003.1 291.9 L1001.0 300.4 L999.4 307.6 L1002.1 312.9 L1010.3 317.5 L1021.3 323.0 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.34"
            filter="url(#tf-wce)"
          />
          <path
            d="M997.1 321.0 L997.0 324.9 L998.2 329.1 L1000.6 333.9 L1002.5 339.2 L1002.2 344.3 L998.8 348.4 L992.7 350.7 L985.2 351.4 L978.0 351.2 L971.9 351.0 L967.0 351.3 L962.8 352.3 L958.8 353.5 L954.8 354.7 L950.6 356.0 L946.2 357.4 L941.4 358.9 L936.2 360.0 L931.0 360.1 L926.3 358.5 L922.6 355.5 L919.9 351.7 L917.5 348.3 L914.1 346.1 L909.0 344.8 L903.0 343.5 L897.9 341.1 L895.9 337.3 L898.1 332.4 L903.7 327.6 L909.9 323.8 L913.1 321.0 L911.4 318.3 L905.1 314.6 L897.1 309.4 L891.1 303.2 L889.8 297.5 L893.5 293.5 L900.4 291.7 L907.7 291.0 L913.4 289.8 L917.3 287.2 L920.5 283.5 L924.4 280.0 L929.7 278.5 L935.7 279.8 L941.4 283.2 L946.2 286.7 L950.3 288.4 L954.7 287.7 L960.0 285.5 L965.9 283.8 L971.2 284.6 L974.3 288.2 L974.8 293.8 L973.9 299.4 L973.5 303.5 L975.5 305.7 L980.4 306.7 L986.9 307.8 L992.9 310.0 L996.5 313.2 L997.5 317.1 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.29"
            filter="url(#tf-wc)"
          />
          <path
            d="M137.6 120.0 L136.7 125.1 L134.9 130.1 L133.7 135.1 L133.7 140.6 L134.2 146.8 L133.8 153.3 L130.8 158.9 L124.7 162.7 L116.3 164.0 L107.3 163.5 L99.3 162.8 L93.1 163.4 L87.9 166.0 L82.7 169.8 L76.7 173.0 L70.0 173.9 L63.4 172.0 L57.7 168.1 L52.8 164.2 L47.5 162.3 L40.5 163.0 L31.1 165.4 L20.0 167.5 L9.3 167.4 L1.3 164.0 L-2.7 157.9 L-3.2 150.5 L-2.0 143.3 L-1.5 136.9 L-2.8 131.3 L-5.3 125.8 L-6.9 120.0 L-5.5 114.2 L0.2 109.2 L9.3 105.6 L19.4 103.6 L27.4 102.3 L31.6 100.0 L31.5 95.4 L29.0 88.0 L26.5 78.6 L26.5 69.2 L30.2 62.0 L37.4 58.7 L46.6 59.9 L55.9 64.7 L63.8 71.0 L70.0 76.3 L75.2 78.5 L81.0 76.9 L88.6 72.2 L98.5 66.4 L109.7 62.1 L120.2 61.4 L127.9 65.0 L131.5 72.0 L131.3 80.7 L129.1 89.2 L127.2 96.2 L127.3 101.5 L129.8 105.9 L133.4 110.2 L136.5 114.9 Z"
            fill="var(--tp-wave-light)"
            opacity="0.35"
            filter="url(#tf-wc)"
          />
          <path
            d="M137.6 120.0 L136.7 125.1 L134.9 130.1 L133.7 135.1 L133.7 140.6 L134.2 146.8 L133.8 153.3 L130.8 158.9 L124.7 162.7 L116.3 164.0 L107.3 163.5 L99.3 162.8 L93.1 163.4 L87.9 166.0 L82.7 169.8 L76.7 173.0 L70.0 173.9 L63.4 172.0 L57.7 168.1 L52.8 164.2 L47.5 162.3 L40.5 163.0 L31.1 165.4 L20.0 167.5 L9.3 167.4 L1.3 164.0 L-2.7 157.9 L-3.2 150.5 L-2.0 143.3 L-1.5 136.9 L-2.8 131.3 L-5.3 125.8 L-6.9 120.0 L-5.5 114.2 L0.2 109.2 L9.3 105.6 L19.4 103.6 L27.4 102.3 L31.6 100.0 L31.5 95.4 L29.0 88.0 L26.5 78.6 L26.5 69.2 L30.2 62.0 L37.4 58.7 L46.6 59.9 L55.9 64.7 L63.8 71.0 L70.0 76.3 L75.2 78.5 L81.0 76.9 L88.6 72.2 L98.5 66.4 L109.7 62.1 L120.2 61.4 L127.9 65.0 L131.5 72.0 L131.3 80.7 L129.1 89.2 L127.2 96.2 L127.3 101.5 L129.8 105.9 L133.4 110.2 L136.5 114.9 Z"
            fill="none"
            stroke="var(--tp-wave-light)"
            strokeWidth="2"
            opacity="0.28"
            filter="url(#tf-wce)"
          />
          <path
            d="M128.2 113.0 L126.9 116.4 L123.7 119.4 L120.1 121.9 L117.6 124.3 L116.6 127.2 L116.5 130.7 L115.9 134.3 L113.7 137.2 L109.5 138.5 L104.1 138.1 L98.9 136.8 L94.8 136.0 L91.8 136.7 L89.3 139.2 L86.3 142.6 L82.6 145.0 L78.5 145.2 L75.0 142.8 L72.5 138.9 L70.9 135.0 L69.0 132.8 L65.7 132.8 L60.3 134.2 L53.6 135.7 L47.1 135.7 L42.7 133.8 L41.5 130.1 L43.3 125.7 L46.6 121.5 L49.9 118.1 L51.7 115.4 L51.5 113.0 L49.7 110.5 L47.1 107.5 L44.6 104.0 L42.7 100.1 L41.8 96.0 L42.3 92.0 L44.3 88.5 L47.9 86.0 L52.8 84.7 L58.4 84.7 L63.9 85.7 L68.9 87.1 L73.0 88.4 L76.5 89.2 L79.6 89.4 L82.6 89.4 L85.6 89.1 L88.8 88.7 L92.2 88.2 L96.1 87.6 L100.3 87.2 L104.6 87.3 L108.4 88.5 L111.1 90.8 L112.6 93.8 L113.3 97.0 L114.2 99.8 L116.2 102.1 L119.6 104.2 L123.7 106.6 L127.0 109.6 Z"
            fill="var(--tp-wave-light)"
            opacity="0.24"
            filter="url(#tf-wc)"
          />
          <path
            d="M483.4 40.0 L480.4 43.9 L479.6 47.7 L480.9 52.0 L482.9 57.1 L483.6 62.3 L481.3 66.8 L476.1 69.5 L469.4 70.7 L463.2 71.6 L458.9 73.7 L456.3 78.4 L453.9 85.1 L450.2 92.0 L444.4 96.6 L437.2 97.1 L430.0 93.7 L423.9 88.3 L418.8 83.9 L413.6 82.2 L406.9 83.5 L398.4 86.1 L389.5 87.2 L382.4 85.2 L379.1 79.7 L379.8 72.2 L383.0 64.5 L386.3 58.2 L387.5 53.7 L386.2 50.4 L383.5 47.2 L381.3 43.7 L380.8 40.0 L381.5 36.3 L382.1 32.6 L381.1 28.4 L378.1 23.2 L374.2 16.7 L371.7 9.6 L372.3 3.1 L376.8 -1.5 L384.2 -3.6 L392.7 -3.5 L400.8 -2.7 L407.5 -2.3 L413.2 -3.1 L418.6 -4.8 L424.1 -6.6 L430.0 -7.7 L436.0 -7.6 L441.9 -6.6 L447.6 -5.1 L453.0 -3.4 L458.4 -1.5 L463.5 0.9 L468.2 3.7 L472.4 6.9 L476.5 10.3 L480.6 13.6 L484.7 17.2 L488.3 21.2 L490.2 25.8 L489.8 30.7 L487.1 35.6 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.3"
            filter="url(#tf-wc)"
          />
          <path
            d="M483.4 40.0 L480.4 43.9 L479.6 47.7 L480.9 52.0 L482.9 57.1 L483.6 62.3 L481.3 66.8 L476.1 69.5 L469.4 70.7 L463.2 71.6 L458.9 73.7 L456.3 78.4 L453.9 85.1 L450.2 92.0 L444.4 96.6 L437.2 97.1 L430.0 93.7 L423.9 88.3 L418.8 83.9 L413.6 82.2 L406.9 83.5 L398.4 86.1 L389.5 87.2 L382.4 85.2 L379.1 79.7 L379.8 72.2 L383.0 64.5 L386.3 58.2 L387.5 53.7 L386.2 50.4 L383.5 47.2 L381.3 43.7 L380.8 40.0 L381.5 36.3 L382.1 32.6 L381.1 28.4 L378.1 23.2 L374.2 16.7 L371.7 9.6 L372.3 3.1 L376.8 -1.5 L384.2 -3.6 L392.7 -3.5 L400.8 -2.7 L407.5 -2.3 L413.2 -3.1 L418.6 -4.8 L424.1 -6.6 L430.0 -7.7 L436.0 -7.6 L441.9 -6.6 L447.6 -5.1 L453.0 -3.4 L458.4 -1.5 L463.5 0.9 L468.2 3.7 L472.4 6.9 L476.5 10.3 L480.6 13.6 L484.7 17.2 L488.3 21.2 L490.2 25.8 L489.8 30.7 L487.1 35.6 Z"
            fill="none"
            stroke="var(--tp-sakura-wash)"
            strokeWidth="2"
            opacity="0.24"
            filter="url(#tf-wce)"
          />
          <path
            d="M473.7 34.0 L471.3 36.3 L470.4 38.6 L470.7 41.1 L471.2 43.8 L470.7 46.5 L469.0 48.7 L466.4 50.4 L463.8 52.0 L461.6 53.8 L459.6 55.9 L457.3 58.1 L454.3 59.5 L450.8 59.7 L447.1 58.7 L443.7 57.4 L440.8 56.7 L437.8 57.5 L434.3 59.5 L430.0 61.8 L425.4 63.0 L421.4 62.3 L418.7 59.8 L417.3 56.3 L416.8 52.8 L416.0 49.9 L414.7 47.6 L413.0 45.6 L411.7 43.4 L411.7 40.9 L413.1 38.3 L415.1 36.0 L416.5 34.0 L416.5 32.1 L414.7 30.0 L412.3 27.3 L410.3 24.1 L409.7 21.0 L410.8 18.4 L412.9 16.2 L415.5 14.3 L418.1 12.4 L420.7 10.5 L423.6 9.0 L427.0 8.1 L430.7 8.0 L434.2 8.3 L437.5 8.2 L440.8 7.2 L444.4 5.3 L448.6 3.4 L452.9 2.9 L456.3 4.8 L457.9 9.1 L457.4 14.7 L455.7 19.8 L454.8 23.1 L456.3 24.1 L460.8 23.6 L467.4 22.9 L473.8 23.3 L477.9 25.2 L478.7 28.1 L476.7 31.2 Z"
            fill="var(--tp-sakura-wash)"
            opacity="0.21"
            filter="url(#tf-wc)"
          />
        </svg>
      </div>
      <div className="tf-par d3">
        <svg
          viewBox="0 0 420 260"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "0",
            right: "0",
            width: "min(420px,48vw)",
            height: "auto",
            pointerEvents: "none",
          }}
        >
          <path
            d="M430 -10 C360 40 300 60 230 70 C170 78 120 110 80 150"
            fill="none"
            stroke="var(--tp-ink)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M300 58 C290 90 270 115 240 130"
            fill="none"
            stroke="var(--tp-ink)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M180 85 C170 60 150 45 120 40"
            fill="none"
            stroke="var(--tp-ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse
            cx="232"
            cy="57.9"
            rx="9.24"
            ry="13.2"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 232 70)"
          />
          <ellipse
            cx="232"
            cy="57.9"
            rx="9.24"
            ry="13.2"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 232 70)"
          />
          <ellipse
            cx="232"
            cy="57.9"
            rx="9.24"
            ry="13.2"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 232 70)"
          />
          <ellipse
            cx="232"
            cy="57.9"
            rx="9.24"
            ry="13.2"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 232 70)"
          />
          <ellipse
            cx="232"
            cy="57.9"
            rx="9.24"
            ry="13.2"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 232 70)"
          />
          <circle cx="232" cy="70" r="3.96" fill="var(--tp-sakura)" />
          <ellipse
            cx="150"
            cy="90.1"
            rx="7.56"
            ry="10.799999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 150 100)"
          />
          <ellipse
            cx="150"
            cy="90.1"
            rx="7.56"
            ry="10.799999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 150 100)"
          />
          <ellipse
            cx="150"
            cy="90.1"
            rx="7.56"
            ry="10.799999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 150 100)"
          />
          <ellipse
            cx="150"
            cy="90.1"
            rx="7.56"
            ry="10.799999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 150 100)"
          />
          <ellipse
            cx="150"
            cy="90.1"
            rx="7.56"
            ry="10.799999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 150 100)"
          />
          <circle cx="150" cy="100" r="3.2399999999999998" fill="var(--tp-sakura)" />
          <ellipse
            cx="240"
            cy="123.2"
            rx="6.72"
            ry="9.6"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 240 132)"
          />
          <ellipse
            cx="240"
            cy="123.2"
            rx="6.72"
            ry="9.6"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 240 132)"
          />
          <ellipse
            cx="240"
            cy="123.2"
            rx="6.72"
            ry="9.6"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 240 132)"
          />
          <ellipse
            cx="240"
            cy="123.2"
            rx="6.72"
            ry="9.6"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 240 132)"
          />
          <ellipse
            cx="240"
            cy="123.2"
            rx="6.72"
            ry="9.6"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 240 132)"
          />
          <circle cx="240" cy="132" r="2.88" fill="var(--tp-sakura)" />
          <ellipse
            cx="120"
            cy="31.75"
            rx="6.3"
            ry="9.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 120 40)"
          />
          <ellipse
            cx="120"
            cy="31.75"
            rx="6.3"
            ry="9.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 120 40)"
          />
          <ellipse
            cx="120"
            cy="31.75"
            rx="6.3"
            ry="9.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 120 40)"
          />
          <ellipse
            cx="120"
            cy="31.75"
            rx="6.3"
            ry="9.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 120 40)"
          />
          <ellipse
            cx="120"
            cy="31.75"
            rx="6.3"
            ry="9.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 120 40)"
          />
          <circle cx="120" cy="40" r="2.6999999999999997" fill="var(--tp-sakura)" />
          <ellipse
            cx="330"
            cy="29.0"
            rx="8.4"
            ry="12.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 330 40)"
          />
          <ellipse
            cx="330"
            cy="29.0"
            rx="8.4"
            ry="12.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 330 40)"
          />
          <ellipse
            cx="330"
            cy="29.0"
            rx="8.4"
            ry="12.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 330 40)"
          />
          <ellipse
            cx="330"
            cy="29.0"
            rx="8.4"
            ry="12.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 330 40)"
          />
          <ellipse
            cx="330"
            cy="29.0"
            rx="8.4"
            ry="12.0"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 330 40)"
          />
          <circle cx="330" cy="40" r="3.5999999999999996" fill="var(--tp-sakura)" />
          <ellipse
            cx="90"
            cy="140.3"
            rx="5.88"
            ry="8.4"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 90 148)"
          />
          <ellipse
            cx="90"
            cy="140.3"
            rx="5.88"
            ry="8.4"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 90 148)"
          />
          <ellipse
            cx="90"
            cy="140.3"
            rx="5.88"
            ry="8.4"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 90 148)"
          />
          <ellipse
            cx="90"
            cy="140.3"
            rx="5.88"
            ry="8.4"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 90 148)"
          />
          <ellipse
            cx="90"
            cy="140.3"
            rx="5.88"
            ry="8.4"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 90 148)"
          />
          <circle cx="90" cy="148" r="2.52" fill="var(--tp-sakura)" />
          <ellipse
            cx="195"
            cy="73.4"
            rx="5.04"
            ry="7.199999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(0 195 80)"
          />
          <ellipse
            cx="195"
            cy="73.4"
            rx="5.04"
            ry="7.199999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(72 195 80)"
          />
          <ellipse
            cx="195"
            cy="73.4"
            rx="5.04"
            ry="7.199999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(144 195 80)"
          />
          <ellipse
            cx="195"
            cy="73.4"
            rx="5.04"
            ry="7.199999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(216 195 80)"
          />
          <ellipse
            cx="195"
            cy="73.4"
            rx="5.04"
            ry="7.199999999999999"
            fill="var(--tp-sakura-wash)"
            stroke="var(--tp-sakura)"
            strokeWidth="0.8"
            transform="rotate(288 195 80)"
          />
          <circle cx="195" cy="80" r="2.16" fill="var(--tp-sakura)" />
        </svg>
      </div>
      <svg
        className="tf-petal p1"
        viewBox="0 0 20 20"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "70%",
          top: "10%",
          width: "16px",
          height: "16px",
          pointerEvents: "none",
        }}
      >
        <path
          d="M10 1 C15 5 16 12 10 19 C4 12 5 5 10 1 Z"
          fill="var(--tp-sakura-wash)"
          stroke="var(--tp-sakura)"
          strokeWidth=".8"
        />
      </svg>
      <svg
        className="tf-petal p2"
        viewBox="0 0 20 20"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "55%",
          top: "4%",
          width: "16px",
          height: "16px",
          pointerEvents: "none",
        }}
      >
        <path
          d="M10 1 C15 5 16 12 10 19 C4 12 5 5 10 1 Z"
          fill="var(--tp-sakura-wash)"
          stroke="var(--tp-sakura)"
          strokeWidth=".8"
        />
      </svg>
      <svg
        className="tf-petal p3"
        viewBox="0 0 20 20"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "82%",
          top: "0%",
          width: "16px",
          height: "16px",
          pointerEvents: "none",
        }}
      >
        <path
          d="M10 1 C15 5 16 12 10 19 C4 12 5 5 10 1 Z"
          fill="var(--tp-sakura-wash)"
          stroke="var(--tp-sakura)"
          strokeWidth=".8"
        />
      </svg>
      <svg
        className="tf-petal p4"
        viewBox="0 0 20 20"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "64%",
          top: "16%",
          width: "16px",
          height: "16px",
          pointerEvents: "none",
        }}
      >
        <path
          d="M10 1 C15 5 16 12 10 19 C4 12 5 5 10 1 Z"
          fill="var(--tp-sakura-wash)"
          stroke="var(--tp-sakura)"
          strokeWidth=".8"
        />
      </svg>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "56px 24px 0",
          display: "flex",
          flexWrap: "wrap",
          gap: "48px",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div className="tf-hero-exit" style={{ flex: "999 1 520px", minWidth: "0" }}>
          <p
            className="tf-glass tf-in"
            style={
              {
                "--i": "0",
                background: "rgba(251,249,244,.66)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
                backdropFilter: "blur(14px) saturate(140%)",
                border: "1px solid rgba(255,255,255,.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                borderRadius: "999px",
                padding: "6px 14px",
                margin: "0",
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "13px",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--tp-accent)",
              } as CSSProperties
            }
          >
            <span
              aria-hidden="true"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "99px",
                background: "var(--tp-seal)",
              }}
            ></span>
            Coming soon · Private beta
          </p>
          <h1
            className="tf-in tf-tex"
            style={
              {
                "--i": "1",
                fontFamily: "'Newsreader Opsz',Newsreader,serif",
                fontWeight: "500",
                fontSize: "clamp(44px,6.4vw,76px)",
                lineHeight: "1.04",
                letterSpacing: "-.02em",
                margin: "18px 0 0",
                color: "var(--tp-ink)",
              } as CSSProperties
            }
          >
            Find your rhythm.
            <br />
            <span style={{ color: "var(--tp-ink-subtle)" }}>Get things done. Don't burn out.</span>
          </h1>
          <p
            className="tf-in"
            style={
              {
                "--i": "2",
                fontSize: "19px",
                lineHeight: "1.6",
                color: "var(--tp-ink-muted)",
                maxWidth: "54ch",
                margin: "20px 0 28px",
              } as CSSProperties
            }
          >
            Brain-dump everything. Tempo turns it into one next step, plans the day around your
            energy, and nudges you in your own words. Kind by default. Built for ADHD brains.
          </p>
          <div className="tf-in" style={{ "--i": "3" } as CSSProperties}>
            {waitlist}
          </div>
        </div>
        <div
          className="tf-depth"
          style={
            {
              "--dx": "-16px",
              flex: "1 1 340px",
              display: "flex",
              justifyContent: "center",
            } as CSSProperties
          }
        >
          <div className="tf-fade-close-t">
            <div
              style={{
                position: "relative",
                width: "min(420px,86vw)",
                aspectRatio: "1/1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                className="tf-blob"
                style={{
                  width: "340px",
                  height: "340px",
                  background: "var(--tp-sakura-wash)",
                  opacity: ".55",
                  top: "10%",
                  left: "8%",
                }}
              ></div>
              <div
                className="tf-blob"
                style={{
                  width: "300px",
                  height: "300px",
                  background: "var(--tp-wave-light)",
                  opacity: ".55",
                  bottom: "6%",
                  right: "4%",
                }}
              ></div>
              <div
                className="tf-glass"
                style={{
                  background: "rgba(251,249,244,.58)",
                  WebkitBackdropFilter: "blur(18px) saturate(150%)",
                  backdropFilter: "blur(18px) saturate(150%)",
                  border: "1px solid rgba(255,255,255,.75)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
                  position: "absolute",
                  inset: "8%",
                  borderRadius: "50%",
                  zIndex: "2",
                }}
              ></div>
              <div style={{ position: "relative", zIndex: "2", width: "78%" }}>
                <div
                  style={{
                    position: "relative",
                    width: "330px",
                    maxWidth: "80vw",
                    aspectRatio: "1/1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    viewBox="0 0 200 200"
                    aria-hidden="true"
                    style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}
                  >
                    <path
                      d="M168 64 C186 104 170 158 120 176 C68 194 22 160 18 108 C14 58 56 22 104 22 C132 22 150 32 160 44"
                      fill="none"
                      stroke="var(--tp-ink)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      opacity=".85"
                    />
                  </svg>
                  <div style={{ width: "58%" }}>
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
                </div>
              </div>
              <div
                className="tf-glass tf-float"
                style={{
                  background: "rgba(251,249,244,.58)",
                  WebkitBackdropFilter: "blur(18px) saturate(150%)",
                  backdropFilter: "blur(18px) saturate(150%)",
                  border: "1px solid rgba(255,255,255,.75)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
                  position: "absolute",
                  top: "4%",
                  left: "-6%",
                  width: "200px",
                  borderRadius: "16px",
                  padding: "14px 16px",
                  zIndex: "3",
                }}
              >
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: "13px",
                    letterSpacing: ".06em",
                    color: "var(--tp-accent)",
                    textTransform: "uppercase",
                  }}
                >
                  Next up
                </div>
                <div
                  style={{
                    fontFamily: "'Newsreader Opsz',Newsreader,serif",
                    fontSize: "19px",
                    color: "var(--tp-ink)",
                    marginTop: "4px",
                  }}
                >
                  Email Dana
                </div>
                <div style={{ fontSize: "14px", color: "var(--tp-ink-muted)", marginTop: "2px" }}>
                  10 min · draft ready
                </div>
              </div>
              <div
                className="tf-glass tf-float f2"
                style={{
                  background: "rgba(251,249,244,.58)",
                  WebkitBackdropFilter: "blur(18px) saturate(150%)",
                  backdropFilter: "blur(18px) saturate(150%)",
                  border: "1px solid rgba(255,255,255,.75)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.85),0 24px 48px -24px rgba(31,58,95,.38),0 2px 6px -2px rgba(28,27,25,.08)",
                  position: "absolute",
                  bottom: "-9%",
                  right: "-4%",
                  width: "220px",
                  borderRadius: "16px",
                  padding: "14px 16px",
                  zIndex: "3",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg
                    role="img"
                    aria-label="Tempo Flow"
                    viewBox="0 0 32 32"
                    style={{
                      width: "22px",
                      height: "22px",
                      flex: "none",
                      display: "inline-block",
                      verticalAlign: "middle",
                    }}
                  >
                    <rect width="32" height="32" rx="7" fill="var(--tp-seal)" />
                    <path d="M11.6 6.5h8.8l4.6 19.2H7z" fill="var(--tp-ground)" />
                    <rect
                      x="5.8"
                      y="25"
                      width="20.4"
                      height="2.6"
                      rx="1.2"
                      fill="var(--tp-ground)"
                    />
                    <path d="M11.1 9.4h9.8v3.3h-3.3v9.2h-3.2v-9.2h-3.3z" fill="var(--tp-seal)" />
                    <circle cx="16" cy="22.4" r="1.9" fill="var(--tp-seal)" />
                  </svg>
                  <span style={{ fontSize: "13px", color: "var(--tp-ink-muted)" }}>
                    Tempo · now
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    color: "var(--tp-ink)",
                    marginTop: "6px",
                    lineHeight: "1.4",
                  }}
                >
                  "Teapot on? Then Dana. Ten minutes, tops."
                </div>
                <div style={{ fontSize: "13px", color: "var(--tp-ink-subtle)", marginTop: "4px" }}>
                  Your words. Tempo just sends them.
                </div>
              </div>
              <div
                className="tf-glass tf-float f3 tf-chip"
                style={{
                  background: "rgba(251,249,244,.66)",
                  WebkitBackdropFilter: "blur(14px) saturate(140%)",
                  backdropFilter: "blur(14px) saturate(140%)",
                  border: "1px solid rgba(255,255,255,.7)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
                  position: "absolute",
                  top: "58%",
                  left: "-14%",
                  borderRadius: "999px",
                  padding: "8px 14px",
                  zIndex: "4",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--tp-ink)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "99px",
                    background: "var(--tp-done)",
                  }}
                ></span>
                <span
                  dir="ltr"
                  style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: "500" }}
                >
                  16:00
                </span>
                Walk + groceries
              </div>
            </div>
          </div>
        </div>
      </div>
      <ul
        style={{
          listStyle: "none",
          maxWidth: "1200px",
          margin: "40px auto 0",
          padding: "0 24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          position: "relative",
        }}
      >
        <li
          className="tf-glass tf-in"
          style={
            {
              "--i": "4",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "999px",
              padding: "10px 16px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
              fontSize: "16px",
              fontWeight: "600",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "999px",
              background: "var(--tp-sakura)",
              flex: "none",
            }}
          ></span>
          One next step, not fifty.
        </li>
        <li
          className="tf-glass tf-in"
          style={
            {
              "--i": "5",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "999px",
              padding: "10px 16px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
              fontSize: "16px",
              fontWeight: "600",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "999px",
              background: "var(--tp-sakura)",
              flex: "none",
            }}
          ></span>
          A coach that remembers you.
        </li>
        <li
          className="tf-glass tf-in"
          style={
            {
              "--i": "6",
              background: "rgba(251,249,244,.66)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              backdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,.7)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),0 14px 30px -18px rgba(31,58,95,.32)",
              borderRadius: "999px",
              padding: "10px 16px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
              fontSize: "16px",
              fontWeight: "600",
              color: "var(--tp-ink)",
            } as CSSProperties
          }
        >
          <span
            aria-hidden="true"
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "999px",
              background: "var(--tp-sakura)",
              flex: "none",
            }}
          ></span>
          Nudges that sound like a friend.
        </li>
      </ul>
      <div aria-hidden="true" style={{ position: "relative", height: "260px", marginTop: "-40px" }}>
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
          <defs>
            <filter id="tf-wash2" x="-5%" y="-20%" width="110%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012"
                numOctaves="3"
                seed="7"
                result="n"
              />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="18" />
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
        </svg>
        <svg
          className="tf-par d1"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "0",
            right: "0",
            bottom: "0px",
            width: "100%",
            height: "260px",
          }}
        >
          <g filter="url(#tf-wash2)">
            <path
              d="M0 260 L0 150 C120 110 200 70 300 95 C390 118 450 60 560 70 C680 80 720 140 840 120 C960 100 1020 40 1140 60 C1260 80 1340 130 1440 110 L1440 260 Z"
              fill="var(--tp-wave-wash)"
              opacity=".18"
            />
          </g>
        </svg>
        <svg
          className="tf-par d0"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "0",
            right: "0",
            bottom: "0px",
            width: "100%",
            height: "260px",
          }}
        >
          <g filter="url(#tf-wash2)">
            <path
              d="M0 260 L0 190 C140 160 230 120 340 150 C460 182 520 120 640 130 C760 140 820 190 960 175 C1080 162 1160 120 1280 140 C1360 152 1400 170 1440 165 L1440 260 Z"
              fill="var(--tp-accent)"
              opacity=".22"
            />
          </g>
        </svg>
        <svg
          className="tf-par d0"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "0",
            right: "0",
            bottom: "0px",
            width: "100%",
            height: "260px",
          }}
        >
          <g filter="url(#tf-wash2)">
            <path
              d="M0 260 L0 230 C160 215 260 190 400 205 C560 222 640 200 780 210 C920 220 1040 198 1180 212 C1300 224 1380 215 1440 220 L1440 260 Z"
              fill="var(--tp-accent)"
              opacity=".34"
            />
          </g>
        </svg>
        <svg
          className="tf-par d2"
          viewBox="0 0 200 60"
          aria-hidden="true"
          style={{ position: "absolute", right: "22%", bottom: "200px", width: "120px" }}
        >
          <g
            stroke="var(--tp-ink)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            opacity=".6"
          >
            <path d="M10 40 q10 -9 20 0 q10 -9 20 0" />
            <path d="M70 20 q8 -7 16 0 q8 -7 16 0" />
          </g>
        </svg>
      </div>
    </section>
  );
}
