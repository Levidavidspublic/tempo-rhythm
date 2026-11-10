// Ported from the design export (public-coming-soon.html). Markup is the export's, converted to JSX;
// colours are the export's tokens (--tp-*). Change the design in the export first, then here.
export function Defs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <filter id="tf-wc" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011"
            numOctaves="4"
            seed="17"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="46" result="d" />
          <feGaussianBlur in="d" stdDeviation="9" />
        </filter>
        <filter id="tf-wce" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011"
            numOctaves="4"
            seed="17"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="46" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.6" />
        </filter>
        <filter id="tf-wb" x="-10%" y="-40%" width="120%" height="180%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.08"
            numOctaves="3"
            seed="23"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" result="d" />
          <feGaussianBlur in="d" stdDeviation="6" />
        </filter>
        <filter id="tf-tear" x="-2%" y="-50%" width="104%" height="200%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="3"
            seed="29"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="16" />
        </filter>
        <filter id="tf-fibre">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="31"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.36  0 0 0 0 0.32  0 0 0 0 0.27  0 0 0 0.075 0"
          />
        </filter>
        <filter id="tf-char" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="6"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0.22  0 0 0 0 0.18  0 0 0 0 0.14  0 0 0 0.32 0"
            result="g2"
          />
          <feComposite in="g2" in2="SourceAlpha" operator="in" result="grain" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="3"
            seed="14"
            result="w"
          />
          <feColorMatrix
            in="w"
            type="matrix"
            values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.5 -0.12"
            result="w2"
          />
          <feComposite in="w2" in2="SourceAlpha" operator="in" result="wash" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="3"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="wash" />
            <feMergeNode in="grain" />
          </feMerge>
        </filter>
        <filter id="tf-char-ink" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="6"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0.38 0"
            result="g2"
          />
          <feComposite in="g2" in2="SourceAlpha" operator="in" result="grain" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="3"
            seed="14"
            result="w"
          />
          <feColorMatrix
            in="w"
            type="matrix"
            values="0 0 0 0 0.3  0 0 0 0 0.28  0 0 0 0 0.26  0 0 0 0.55 -0.12"
            result="w2"
          />
          <feComposite in="w2" in2="SourceAlpha" operator="in" result="wash" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="2"
            seed="4"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="wash" />
            <feMergeNode in="grain" />
          </feMerge>
        </filter>
        <filter id="tf-text-a" x="-2%" y="-10%" width="104%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.35"
            numOctaves="3"
            seed="7"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0.97  0 0 0 0 0.95  0 0 0 0 0.91  0 0 0 0.55 -0.3"
            result="g2"
          />
          <feComposite in="g2" in2="SourceAlpha" operator="in" result="speck" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.07"
            numOctaves="2"
            seed="5"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="speck" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
