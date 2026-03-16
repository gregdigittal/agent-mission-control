// src/lib/supabase/use-sessions.ts
"use client";

import { useEffect, useRef } from "react";
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Initial fetch — active sessions
    const fetchActive = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .gte("updated_at", staleCutoff())
        .order("updated_at", { ascending: false });

      if (!error && data) {
        useUIStore.getState().setSessions(data as Session[]);
      }
    };

    // Initial fetch — stale sessions
    const fetchStale = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .lt("updated_at", staleCutoff())
        .order("updated_at", { ascending: false })
        .limit(STALE_SESSIONS_LIMIT);

      if (!error && data) {
        useUIStore.getState().setStaleSessions(data as Session[]);
      }
    };

    fetchActive();
    fetchStale();

    // Realtime subscription — handle INSERT, UPDATE, and DELETE
    const channel = supabase
      .channel("sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const session = payload.new as Session;
            const store = useUIStore.getState();

            // Any UPDATE means the session is alive — always promote if stale
            if (store.staleSessions[session.id]) {
              store.promoteFromStale(session.id);
            }

            // Always upsert into active sessions on INSERT/UPDATE
            store.upsertSession(session);
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old?.id) {
              const store = useUIStore.getState();
              // Remove from whichever list it's in
              if (store.sessions[old.id]) {
                store.removeSession(old.id);
              }
              if (store.staleSessions[old.id]) {
                const newStaleSessions = { ...store.staleSessions };
                delete newStaleSessions[old.id];
                const newStaleOrder = store.staleOrder.filter(
                  (sid) => sid !== old.id
                );
                useUIStore.setState({
                  staleSessions: newStaleSessions,
                  staleOrder: newStaleOrder,
                });
              }
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Periodic prune: demote sessions that have gone stale
    const pruneInterval = setInterval(() => {
      const { sessions, order, demoteToStale } = useUIStore.getState();
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
  }, []);
}
