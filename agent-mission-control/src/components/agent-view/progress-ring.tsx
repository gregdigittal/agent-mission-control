interface ProgressRingProps {
  percent: number;
  size?: number;
}

export function ProgressRing({ percent, size = 56 }: ProgressRingProps) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-2, #1a2030)"
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--cyan, #22d3ee)"
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-1, #edf0f7)"
        fontSize="12"
        fontFamily="var(--font-geist-mono)"
        className="rotate-90 origin-center"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}
