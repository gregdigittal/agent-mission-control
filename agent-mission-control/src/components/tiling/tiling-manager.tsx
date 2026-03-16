"use client";

import { useUIStore } from "@/stores/ui-store";
import { Pane } from "./pane";

export function TilingManager() {
  const tiles = useUIStore((s) => s.tiles);

  return (
    <main className="flex flex-1 overflow-hidden">
      {Array.from({ length: tiles }, (_, i) => (
        <Pane key={i} index={i} />
      ))}
    </main>
  );
}
