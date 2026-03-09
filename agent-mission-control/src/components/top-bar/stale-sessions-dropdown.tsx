"use client";

import { useState, useRef, useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";
import type { Session } from "@/lib/types";
import { RestartSessionModal } from "./restart-session-modal";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function StaleSessionsDropdown() {
  const staleOrder = useUIStore((s) => s.staleOrder);
  const staleSessions = useUIStore((s) => s.staleSessions);
  const upsertSession = useUIStore((s) => s.upsertSession);
  const [open, setOpen] = useState(false);
  const [restartTarget, setRestartTarget] = useState<Session | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (staleOrder.length === 0) return null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-2 py-1 rounded text-text-4 text-xxs font-mono hover:text-text-2 hover:bg-bg-3 transition-colors cursor-pointer"
        >
          <span>⏱</span>
          <span>{staleOrder.length} stale</span>
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-bg-2 border border-border-2 rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border-1 text-text-4 text-xxs font-mono uppercase tracking-wider">
              Stale Sessions
            </div>
            <div className="max-h-60 overflow-y-auto">
              {staleOrder.map((sid) => {
                const sess = staleSessions[sid];
                if (!sess) return null;
                return (
                  <div
                    key={sid}
                    className="flex items-center justify-between px-3 py-2 border-b border-border-1 last:border-b-0 hover:bg-bg-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-text-3 text-xs font-mono truncate opacity-60">
                        {sess.project}
                      </div>
                      <div className="text-text-4 text-xxs font-mono">
                        {sess.updated_at ? relativeTime(sess.updated_at) : "unknown"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => {
                          upsertSession(sess);
                          setOpen(false);
                        }}
                        className="px-2 py-0.5 text-xxs font-mono text-cyan hover:bg-cyan/10 rounded cursor-pointer"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setRestartTarget(sess);
                          setOpen(false);
                        }}
                        className="px-2 py-0.5 text-xxs font-mono text-green hover:bg-green/10 rounded cursor-pointer"
                      >
                        Restart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {restartTarget && (
        <RestartSessionModal
          session={restartTarget}
          onClose={() => setRestartTarget(null)}
        />
      )}
    </>
  );
}
