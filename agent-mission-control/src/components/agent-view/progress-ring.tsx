"use client";

interface ProgressRingProps {
  percent: number;
  size?: number;
}

export function ProgressRing({ percent, size }: ProgressRingProps) {
  // Use CSS variable --bb-ring-size for density-aware sizing, fallback to prop or 56
  const resolvedSize = size ?? 56;
  const r = resolvedSize / 2 - 4;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  const fontSize = Math.max(10, resolvedSize * 0.22);

  return (
    <svg
      width={resolvedSize}
      height={resolvedSize}
      className="shrink-0 -rotate-90"
      style={{ width: `var(--bb-ring-size, ${resolvedSize}px)`, height: `var(--bb-ring-size, ${resolvedSize}px)` }}
    >
      <circle
        cx="50%"
        cy="50%"
        r={r}
        fill="none"
        stroke="var(--border-2, #1a2030)"
        strokeWidth={4}
      />
      <circle
        cx="50%"
        cy="50%"
        r={r}
        fill="none"
        stroke="var(--cyan, #22d3ee)"
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-1, #edf0f7)"
        fontSize={fontSize}
        fontFamily="var(--font-geist-mono)"
        className="rotate-90 origin-center"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}
