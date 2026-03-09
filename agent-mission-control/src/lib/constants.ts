// src/lib/constants.ts
import type { TaskStatus } from "./types";

export const STAGES = [
  "Planning", "Scaffolding", "Core Logic", "API Layer",
  "Frontend", "Testing", "Integration", "Review",
] as const;

export const KANBAN_COLUMNS: TaskStatus[] = [
  "backlog", "in-progress", "review", "done",
];

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: "BACKLOG",
  "in-progress": "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

export const ACCENT_CYCLE = [
  "cyan", "green", "amber", "violet", "blue", "rose",
] as const;

export const MAX_PANES: Record<string, number> = {
  laptop: 2,
  desktop: 3,
  ultrawide: 4,
};

/** Sessions not updated within this window (ms) are considered stale */
export const SESSION_STALE_MS = 5 * 60 * 1000; // 5 minutes

/** How often to re-check for stale sessions (ms) */
export const SESSION_POLL_MS = 30 * 1000; // 30 seconds
