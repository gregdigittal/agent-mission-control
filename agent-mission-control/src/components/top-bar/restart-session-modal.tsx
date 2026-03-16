"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";

interface RestartSessionModalProps {
  session: Session;
  onClose: () => void;
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remainMins}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function RestartSessionModal({ session, onClose }: RestartSessionModalProps) {
  const [copied, setCopied] = useState(false);

  const projectSlug = session.project.toLowerCase().replace(/\s+/g, "-");
  const command = `cd ~/projects/${projectSlug} && claude`;

  const completedTasks = session.state?.completedTasks ?? 0;
  const totalTasks = session.state?.totalTasks ?? 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = command;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-2 border border-border-2 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-1 text-sm font-mono font-semibold">
            Restart Session
          </h2>
          <button
            onClick={onClose}
            className="text-text-4 hover:text-text-2 text-lg leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Session info */}
        <div className="space-y-3 mb-5">
          <div>
            <div className="text-text-4 text-xxs font-mono uppercase tracking-wider mb-1">
              Project
            </div>
            <div className="text-text-1 text-xs font-mono">
              {session.project}
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <div className="text-text-4 text-xxs font-mono uppercase tracking-wider mb-1">
                Inactive for
              </div>
              <div className="text-amber text-xs font-mono">
                {session.updated_at ? timeSince(session.updated_at) : "unknown"}
              </div>
            </div>
            <div>
              <div className="text-text-4 text-xxs font-mono uppercase tracking-wider mb-1">
                Progress
              </div>
              <div className="text-text-2 text-xs font-mono">
                {completedTasks}/{totalTasks} tasks
              </div>
            </div>
          </div>
        </div>

        {/* CLI command */}
        <div className="mb-4">
          <div className="text-text-4 text-xxs font-mono uppercase tracking-wider mb-2">
            Run in Terminal
          </div>
          <div className="bg-bg-0 border border-border-1 rounded px-3 py-2 font-mono text-xs text-cyan select-all">
            {command}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-mono text-text-3 hover:text-text-1 bg-bg-3 hover:bg-bg-4 border border-border-2 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 text-xs font-mono text-bg-0 bg-cyan hover:bg-cyan/90 rounded font-semibold transition-colors cursor-pointer"
          >
            {copied ? "Copied!" : "Copy Command"}
          </button>
        </div>
      </div>
    </div>
  );
}
