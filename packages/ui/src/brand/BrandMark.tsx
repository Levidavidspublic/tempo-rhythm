type Props = {
  size?: number;
  className?: string;
};

/**
 * BrandMark — Tempo Flow logo mark.
 * @source docs/design/claude-export/design-system/components.jsx:L94-L105
 */
export function BrandMark({ size = 28, className }: Props) {
  const id = `bm${size}`;
  return (
    <svg
      role="img"
      aria-labelledby={`${id}-title`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={{ display: "block" }}
    >
      <title id={`${id}-title`}>Tempo Flow</title>
      <defs>
        {/* userSpaceOnUse: the bar and the stem are straight lines with a zero-height or
            zero-width box, and a box-relative gradient doesn't paint those (only the dot showed). */}
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="#D97757" />
          <stop offset="100%" stopColor="#E8A87C" />
        </linearGradient>
      </defs>
      <path
        d="M14 16 H50"
        stroke={`url(#${id})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 16 V46"
        stroke={`url(#${id})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="42" cy="44" r="6" fill={`url(#${id})`} />
    </svg>
  );
}
