"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-2 font-mono text-xs text-text-3 whitespace-nowrap">
      <span className="text-green animate-pulse">•</span>
      <span className="text-green">LIVE</span>
      <span>{time}</span>
    </div>
  );
}
