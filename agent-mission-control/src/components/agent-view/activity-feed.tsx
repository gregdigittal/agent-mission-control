"use client";

import { useUIStore } from "@/stores/ui-store";
import type { AgentEvent } from "@/lib/types";

interface ActivityFeedProps {
  events: AgentEvent[];
}

const FILTERS = ["all", "tool", "file", "task", "message", "error"] as const;

const TYPE_COLORS: Record<string, string> = {
  tool: "text-cyan",
  file: "text-green",
  task: "text-amber",
  message: "text-blue",
  thinking: "text-violet",
  error: "text-red",
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  const feedFilter = useUIStore((s) => s.feedFilter);
  const setFeedFilter = useUIStore((s) => s.setFeedFilter);

  const filtered =
    feedFilter === "all"
      ? events
      : events.filter((e) => e.type === feedFilter);

  const display = filtered.slice(-30).reverse();

  return (
    <div className="mt-[var(--density-gap)]">
      <div className="flex items-center justify-between mb-2 font-mono text-xs text-text-3">
        <span>ACTIVITY</span>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFeedFilter(f)}
              className={`px-2 py-0.5 rounded text-xxs font-mono cursor-pointer transition-colors ${
                feedFilter === f
                  ? "text-cyan bg-cyan/10"
                  : "text-text-4 hover:text-text-3"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto bg-bg-2 rounded-lg border border-border-1 p-1">
        {display.map((ev, i) => (
          <div
            key={`${ev.timestamp}-${i}`}
            className="flex gap-2 px-2 py-1 rounded text-xs animate-feed-in hover:bg-bg-3/50 transition-colors"
          >
            <span className="font-mono text-xxs text-text-4 whitespace-nowrap min-w-[55px]">
              {ev.timestamp}
            </span>
            <span
              className={`font-mono text-xxs whitespace-nowrap min-w-[80px] overflow-hidden text-ellipsis ${
                TYPE_COLORS[ev.type] || "text-cyan"
              }`}
            >
              {ev.agent}
            </span>
            <span className="text-text-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {ev.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
