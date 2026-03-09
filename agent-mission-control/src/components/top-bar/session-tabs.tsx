"use client";

import { useUIStore } from "@/stores/ui-store";
import { ACCENT_CYCLE } from "@/lib/constants";

export function SessionTabs() {
  const order = useUIStore((s) => s.order);
  const active = useUIStore((s) => s.active);
  const sessions = useUIStore((s) => s.sessions);
  const setActive = useUIStore((s) => s.setActive);
  const removeSession = useUIStore((s) => s.removeSession);

  return (
    <div className="flex gap-1 flex-1 overflow-x-auto min-w-0">
      {order.map((sid, i) => {
        const sess = sessions[sid];
        if (!sess) return null;
        const isActive = sid === active;
        const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];

        return (
          <button
            key={sid}
            onClick={() => setActive(sid)}
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all border cursor-pointer ${
              isActive
                ? `text-cyan bg-bg-3 border-border-2 shadow-[0_0_8px_rgba(34,211,238,.1)]`
                : "text-text-3 bg-transparent border-transparent hover:text-text-2 hover:bg-bg-3"
            }`}
          >
            <span className={`text-${accent}`}>●</span>
            <span>{sess.project}</span>
            {order.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(sid);
                }}
                className="hidden group-hover:inline-flex ml-1 text-[10px] text-text-4 hover:text-red hover:bg-red/15 px-0.5 rounded cursor-pointer"
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
