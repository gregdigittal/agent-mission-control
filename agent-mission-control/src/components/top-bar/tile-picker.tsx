"use client";

import { useUIStore } from "@/stores/ui-store";
import { MAX_PANES } from "@/lib/constants";

const TILE_ICONS = ["|", "||", "|||", "||||"];

export function TilePicker() {
  const screen = useUIStore((s) => s.screen);
  const tiles = useUIStore((s) => s.tiles);
  const setTiles = useUIStore((s) => s.setTiles);
  const max = MAX_PANES[screen] || 3;

  return (
    <div className="flex gap-1">
      {TILE_ICONS.slice(0, max).map((icon, i) => (
        <button
          key={i}
          onClick={() => setTiles(i + 1)}
          className={`px-2 py-1 rounded text-xxs font-mono border transition-all cursor-pointer ${
            tiles === i + 1
              ? "text-cyan border-border-2 bg-bg-3"
              : "text-text-4 border-transparent hover:text-text-3"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
