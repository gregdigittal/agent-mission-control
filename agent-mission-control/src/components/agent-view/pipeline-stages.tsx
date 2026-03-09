import type { Stage } from "@/lib/types";

interface PipelineStagesProps {
  stages: Stage[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "border-green text-green bg-green/10",
  active: "border-cyan text-cyan bg-cyan/10",
  pending: "border-border-2 text-text-4 bg-transparent",
};

export function PipelineStages({ stages }: PipelineStagesProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {stages.map((stage) => (
        <span
          key={stage.name}
          className={`px-3 py-1 rounded-full text-xxs font-mono border whitespace-nowrap shrink-0 ${
            STATUS_COLORS[stage.status] || STATUS_COLORS.pending
          } ${stage.status === "active" ? "animate-pulse" : ""}`}
        >
          {stage.name}
        </span>
      ))}
    </div>
  );
}
