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
