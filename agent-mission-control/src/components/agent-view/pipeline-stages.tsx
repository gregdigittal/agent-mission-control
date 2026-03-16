import type { Stage } from "@/lib/types";

interface PipelineStagesProps {
  stages: Stage[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "border-green/20 text-green bg-green/[.06]",
  active: "border-cyan/30 text-cyan bg-cyan/[.08] glow-cyan",
  pending: "border-border-1 text-text-4 bg-bg-3",
};

const DOT_COLORS: Record<string, string> = {
  completed: "bg-green",
  active: "bg-cyan",
  pending: "bg-text-4",
};

export function PipelineStages({ stages }: PipelineStagesProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-[var(--density-gap)] mb-[var(--density-gap)]">
      {stages.map((stage) => (
        <span
          key={stage.name}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[20px] text-xxs font-mono border whitespace-nowrap shrink-0 transition-all ${
            STATUS_COLORS[stage.status] || STATUS_COLORS.pending
          } ${stage.status === "active" ? "animate-pulse" : ""}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              DOT_COLORS[stage.status] || DOT_COLORS.pending
            } ${stage.status === "active" ? "animate-pulse-dot" : ""}`}
          />
          {stage.name}
        </span>
      ))}
    </div>
  );
}
