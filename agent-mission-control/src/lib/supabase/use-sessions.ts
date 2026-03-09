// src/lib/supabase/use-sessions.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "./client";
import { useUIStore } from "@/stores/ui-store";
import { SESSION_STALE_MS, SESSION_POLL_MS, STALE_SESSIONS_LIMIT } from "@/lib/constants";
import type { Session } from "@/lib/types";

/** Only fetch sessions updated within the staleness window */
function staleCutoff(): string {
  return new Date(Date.now() - SESSION_STALE_MS).toISOString();
}

/** Returns true if a session's updated_at is within the staleness window */
function isActive(session: Session): boolean {
  if (!session.updated_at) return false;
  return new Date(session.updated_at).getTime() > Date.now() - SESSION_STALE_MS;
}

/**
 * Fetch active sessions on mount, subscribe to Realtime changes,
 * and periodically prune stale sessions.
 */
export function useSessionSync() {
  const setSessions = useUIStore((s) => s.setSessions);
  const upsertSession = useUIStore((s) => s.upsertSession);
  const removeSession = useUIStore((s) => s.removeSession);
  const setStaleSessions = useUIStore((s) => s.setStaleSessions);
  const demoteToStale = useUIStore((s) => s.demoteToStale);
  const promoteFromStale = useUIStore((s) => s.promoteFromStale);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchActive = useCallback(async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .gte("updated_at", staleCutoff())
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setSessions(data as Session[]);
    }
  }, [setSessions]);

  const fetchStale = useCallback(async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .lt("updated_at", staleCutoff())
      .order("updated_at", { ascending: false })
      .limit(STALE_SESSIONS_LIMIT);

    if (!error && data) {
      setStaleSessions(data as Session[]);
    }
  }, [setStaleSessions]);

  useEffect(() => {
    // Initial fetch — active then stale sessions
    fetchActive();
    fetchStale();

    // Realtime subscription — add new/updated, ignore stale
    const channel = supabase
      .channel("sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const session = payload.new as Session;
            if (isActive(session)) {
              // If this session is currently in stale list, promote it first
              const { staleSessions } = useUIStore.getState();
              if (staleSessions[session.id]) {
                promoteFromStale(session.id);
              }
              upsertSession(session);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Periodic prune: demote sessions that have gone stale
    const pruneInterval = setInterval(() => {
      const { sessions, order } = useUIStore.getState();
      for (const sid of order) {
        const s = sessions[sid];
        if (s && !isActive(s)) {
          demoteToStale(sid);
        }
      }
    }, SESSION_POLL_MS);

    return () => {
      channel.unsubscribe();
      clearInterval(pruneInterval);
    };
  }, [fetchActive, fetchStale, upsertSession, removeSession, demoteToStale, promoteFromStale]);
}
