// src/lib/supabase/use-sessions.ts
"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./client";
import { useUIStore } from "@/stores/ui-store";
import type { Session } from "@/lib/types";

/** Fetch all sessions on mount, then subscribe to Realtime changes */
export function useSessionSync() {
  const setSessions = useUIStore((s) => s.setSessions);
  const upsertSession = useUIStore((s) => s.upsertSession);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Initial fetch
    async function load() {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setSessions(data as Session[]);
      }
    }
    load();

    // Realtime subscription
    const channel = supabase
      .channel("sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            upsertSession(payload.new as Session);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [setSessions, upsertSession]);
}
