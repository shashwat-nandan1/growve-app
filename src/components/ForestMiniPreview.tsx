type Props = {
  count: number;
  seed?: number;
  height?: number;
  emptyLabel?: string;
  className?: string;
};

/**
 * Lightweight SVG grove preview used on Today and friend cards.
 * Deterministic layout from `seed` so the same forest always looks the same.
 */
export function ForestMiniPreview({
  count,
  seed = 1,
  height = 144,
  emptyLabel = "Your forest will appear here.",
  className,
}: Props) {
  const trees = Math.min(count, 22);
  // simple LCG for stable per-tree positions
  let s = (seed || 1) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const items = Array.from({ length: trees }).map((_, i) => ({
    i,
    x: 12 + rand() * 296,
    y: 60 + rand() * 60,
    scale: 0.7 + rand() * 0.55,
    tone: rand() > 0.55 ? "#54745B" : rand() > 0.4 ? "#3E5A48" : "#6E8B6C",
  }));
  items.sort((a, b) => a.y - b.y);

  return (
    <div
      className={
        className ??
        "overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-mist to-parchment shadow-soft"
      }
    >
      <svg viewBox="0 0 320 144" className="block h-full w-full" style={{ height }} aria-hidden>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.94 0.02 140)" />
            <stop offset="100%" stopColor="oklch(0.97 0.02 90)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="320" height="144" fill="url(#sky)" />
        <ellipse cx="160" cy="138" rx="180" ry="16" fill="oklch(0.88 0.02 140)" />
        {items.map((t) => (
          <g key={t.i} transform={`translate(${t.x} ${t.y}) scale(${t.scale})`}>
            <rect x="-2" y="14" width="4" height="14" fill="#755B45" rx="1" />
            <path
              d="M0 -14 C-12 0 -14 10 -8 14 L8 14 C14 10 12 0 0 -14 Z"
              fill={t.tone}
            />
          </g>
        ))}
        {trees === 0 && (
          <text
            x="160"
            y="80"
            textAnchor="middle"
            fill="oklch(0.46 0.02 150)"
            fontSize="11"
            fontFamily="Inter"
          >
            {emptyLabel}
          </text>
        )}
      </svg>
    </div>
  );
}
