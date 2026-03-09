"use client";

import { SessionTabs } from "./session-tabs";
import { ScreenPicker } from "./screen-picker";
import { TilePicker } from "./tile-picker";
import { Clock } from "./clock";

export function TopBar() {
  return (
    <header
      className="h-[var(--topbar-h)] bg-bg-1 border-b border-border-1 flex items-center px-[var(--density-pad)] gap-[var(--density-gap)] sticky top-0 z-50"
    >
      <div className="flex items-center gap-2 font-mono font-bold text-sm text-cyan tracking-wider whitespace-nowrap">
        <span className="text-[1.2em]">◊</span>
        <span>MISSION CONTROL</span>
      </div>
      <SessionTabs />
      <ScreenPicker />
      <TilePicker />
      <Clock />
    </header>
  );
}
