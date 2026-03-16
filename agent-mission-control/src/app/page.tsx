"use client";

import { TopBar } from "@/components/top-bar";
import { TilingManager } from "@/components/tiling";
import { useSessionSync } from "@/lib/supabase/use-sessions";

export default function Home() {
  useSessionSync();

  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <TilingManager />
    </div>
  );
}
