/**
 * backlogParser.ts — Pure markdown backlog table parser.
 *
 * Parses task rows from BACKLOG.md files that use the table format:
 *   | ID | Title | Priority | Effort | ... | Status |
 *
 * Rules:
 * - Tolerant: malformed rows are skipped, never throw
 * - Does NOT touch Supabase — pure parsing only
 * - Rows with ❌ Removed status are skipped entirely
 */

import { readFile } from 'node:fs/promises';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ParsedTask {
  readonly external_id: string;
  readonly title: string;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
  readonly status: 'backlog' | 'in_progress' | 'done';
  readonly effort: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Status mapping
// ──────────────────────────────────────────────────────────────────────────────

/** Returns null to signal "skip this row". */
function mapStatus(raw: string): ParsedTask['status'] | null {
  const s = raw.trim();
  if (s.includes('❌') || /removed/i.test(s)) return null;
  if (s.includes('✅') || /done/i.test(s)) return 'done';
  if (s.includes('🚧') || /in.?progress/i.test(s)) return 'in_progress';
  // 🔲 or any unrecognised status → backlog
  return 'backlog';
}

function mapPriority(raw: string): ParsedTask['priority'] {
  const s = raw.trim();
  if (s === 'P0') return 'P0';
  if (s === 'P1') return 'P1';
  if (s === 'P2') return 'P2';
  if (s === 'P3') return 'P3';
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Row parsing
// ──────────────────────────────────────────────────────────────────────────────

/** Split a markdown table row into trimmed cells. Returns [] for separator rows. */
function splitRow(line: string): string[] {
  // Separator rows look like |---|---|---| — skip them
  if (/^\s*\|[\s\-|:]+\|\s*$/.test(line)) return [];
  return line
    .split('|')
    .filter((_, i, arr) => i > 0 && i < arr.length - 1) // drop leading/trailing empties
    .map((c) => c.trim());
}

/**
 * Parses a header row to build a column-index map.
 * Returns a map of lowercase column name → zero-based index.
 */
function parseHeader(cells: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < cells.length; i++) {
    map.set(cells[i].toLowerCase(), i);
  }
  return map;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

export function parseBacklogContent(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = content.split('\n');

  let headerMap: Map<string, number> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = splitRow(trimmed);
    if (cells.length === 0) continue; // separator row

    // Detect header row — must contain 'id' and 'title'
    const lower = cells.map((c) => c.toLowerCase());
    if (lower.includes('id') && lower.includes('title')) {
      headerMap = parseHeader(cells);
      continue;
    }

    if (!headerMap) continue;

    const idIdx = headerMap.get('id');
    const titleIdx = headerMap.get('title');
    const priorityIdx = headerMap.get('priority');
    const effortIdx = headerMap.get('effort');

    // Find the last column (likely status) — the rightmost column we can map
    // Status is usually the last column in BACKLOG.md tables
    const statusIdx = cells.length - 1;

    // Require at minimum: id and title
    if (idIdx === undefined || titleIdx === undefined) continue;
    if (idIdx >= cells.length || titleIdx >= cells.length) continue;

    const rawId = cells[idIdx];
    const rawTitle = cells[titleIdx];

    // Skip if id doesn't look like a task ID (e.g. M3-001, F-001, TD-001)
    if (!rawId || !/^[A-Z][\w-]*\d+$/.test(rawId)) continue;
    if (!rawTitle) continue;

    const rawStatus = cells[statusIdx] ?? '';
    const mappedStatus = mapStatus(rawStatus);
    if (mappedStatus === null) continue; // ❌ Removed — skip

    const task: ParsedTask = {
      external_id: rawId,
      title: rawTitle,
      priority: priorityIdx !== undefined && priorityIdx < cells.length
        ? mapPriority(cells[priorityIdx])
        : null,
      status: mappedStatus,
      effort: effortIdx !== undefined && effortIdx < cells.length
        ? (cells[effortIdx] || null)
        : null,
    };

    tasks.push(task);
  }

  return tasks;
}

/**
 * Reads a BACKLOG.md file at `filePath` and returns parsed tasks.
 * Returns [] on read errors or if the file is empty/unparseable.
 */
export async function parseBacklogFile(filePath: string): Promise<ParsedTask[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return parseBacklogContent(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[backlogParser] Could not read ${filePath}: ${message}`);
    return [];
  }
}
