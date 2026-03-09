import type { Agent } from "@/lib/types";

interface AgentCardProps {
  agent: Agent;
  taskTitle?: string;
}

const STATUS_BORDER: Record<string, string> = {
  working: "border-l-cyan",
  thinking: "border-l-violet",
  idle: "border-l-text-4",
  error: "border-l-red",
  leader: "border-l-amber",
};

const STATUS_BG: Record<string, string> = {
  working: "text-cyan bg-cyan/10",
  thinking: "text-violet bg-violet/10",
  idle: "text-text-4 bg-bg-3",
  error: "text-red bg-red/10",
  leader: "text-amber bg-amber/10",
};

export function AgentCard({ agent, taskTitle }: AgentCardProps) {
  const m = agent.metrics;

  return (
    <div
      className={`bg-bg-2 rounded-lg p-[var(--card-pad,12px)] border border-border-1 border-l-2 transition-all hover:border-border-2 ${
        STATUS_BORDER[agent.status] || "border-l-text-4"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{agent.icon}</span>
          <div>
            <div className="text-xs font-mono text-text-1 font-semibold">
              {agent.name}
            </div>
            <div className="text-xxs text-text-3">{agent.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`text-xxs font-mono px-1.5 py-0.5 rounded border border-current/20 ${
              STATUS_BG[agent.status] || "text-text-4 bg-bg-3"
            }`}
          >
            {agent.status}
          </span>
          {(agent.status === "working" || agent.status === "thinking") && (
            <span className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-current animate-typing-dot"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-text-2 mb-2 truncate">
        {taskTitle || agent.task}
      </div>

      <div className="flex gap-3 text-xxs text-text-3 font-mono">
        <span>CTX {m.ctx}</span>
        <span>{m.cost}</span>
        <span>{m.msgs} msgs</span>
      </div>
    </div>
  );
}
