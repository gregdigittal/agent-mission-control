"use client";

import { useUIStore } from "@/stores/ui-store";
import type { ScreenProfile } from "@/lib/types";

const PROFILES: { label: string; value: ScreenProfile }[] = [
  { label: '14"', value: "laptop" },
  { label: '27"', value: "desktop" },
  { label: '49"', value: "ultrawide" },
];

export function ScreenPicker() {
  const screen = useUIStore((s) => s.screen);
  const setScreen = useUIStore((s) => s.setScreen);

  return (
    <div className="flex gap-1">
      {PROFILES.map((p) => (
        <button
          key={p.value}
          onClick={() => setScreen(p.value)}
          className={`px-2 py-1 rounded text-xxs font-mono border transition-all cursor-pointer ${
            screen === p.value
              ? "text-cyan border-border-2 bg-bg-3"
              : "text-text-4 border-transparent hover:text-text-3"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
