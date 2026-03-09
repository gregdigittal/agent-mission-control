import type { Session } from "@/lib/types";
import { ProgressRing } from "./progress-ring";
import { PipelineStages } from "./pipeline-stages";
import { AgentCard } from "./agent-card";
import { ActivityFeed } from "./activity-feed";

interface AgentViewProps {
  session: Session;
}

export function AgentView({ session }: AgentViewProps) {
  const s = session.state;
  const pct = s.totalTasks > 0 ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;

  const taskMap = new Map(s.tasks.map((t) => [t.id, t.title]));

  return (
    <div>
      {/* Build banner */}
      <div className="flex items-center gap-4 mb-4 bg-bg-2 rounded-lg p-4 border border-border-1">
        <ProgressRing percent={pct} />
        <div>
          <div className="text-sm font-mono text-text-1 font-semibold">
            {s.project}
          </div>
          <div className="text-xs text-text-3">
            Stage {s.currentStageIdx + 1}/{s.stages.length} • {s.completedTasks}/
            {s.totalTasks} tasks
          </div>
        </div>
      </div>

      {/* Pipeline stages */}
      <PipelineStages stages={s.stages} />

      {/* Agent cards grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[var(--density-gap)] mt-[var(--density-gap)]">
        {s.agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            taskTitle={agent.taskId ? taskMap.get(agent.taskId) : undefined}
          />
        ))}
      </div>

      {/* Activity feed */}
      <ActivityFeed events={s.events} />
    </div>
  );
}
