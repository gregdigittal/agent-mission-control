/**
 * Session data export — JSON and CSV formats.
 *
 * Pulls from Zustand stores and triggers a browser download.
 * No external dependencies — uses Blob + URL.createObjectURL.
 */

import { useAgentStore } from '../stores/agentStore';
import { useCostStore } from '../stores/costStore';
import { useSessionStore } from '../stores/sessionStore';
import type { Agent, AgentEvent, CostRecord, Session } from '../types';

export type ExportFormat = 'json' | 'csv';

interface SessionExport {
  session: Session;
  agents: Agent[];
  events: AgentEvent[];
  costRecords: CostRecord[];
  exportedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugDate(): string {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildSessionExport(sessionId: string): SessionExport | null {
  const agentState = useAgentStore.getState();
  const costState = useCostStore.getState();
  const sessionState = useSessionStore.getState();

  const session = sessionState.sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  return {
    session,
    agents: agentState.agentsBySession(sessionId),
    events: agentState.eventsBySession(sessionId),
    costRecords: costState.records.filter((r) => r.sessionId === sessionId),
    exportedAt: new Date().toISOString(),
  };
}

function exportAsJson(data: SessionExport, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function exportAsCsv(data: SessionExport, filename: string): void {
  const sections: string[] = [];

  // Agents
  sections.push('# Agents');
  sections.push(toCsvRow(['id', 'name', 'role', 'status', 'model', 'costUsd', 'tokensIn', 'tokensOut', 'contextUsagePct', 'startedAt']));
  for (const a of data.agents) {
    sections.push(toCsvRow([a.id, a.name, a.role, a.status, a.model, a.costUsd, a.tokensIn, a.tokensOut, a.contextUsagePct ?? '', a.startedAt]));
  }

  sections.push('');
  sections.push('# Events');
  sections.push(toCsvRow(['id', 'agentId', 'type', 'message', 'costUsd', 'ts']));
  for (const e of data.events) {
    sections.push(toCsvRow([e.id, e.agentId, e.type, e.message, e.costUsd ?? '', e.ts]));
  }

  sections.push('');
  sections.push('# Cost Records');
  sections.push(toCsvRow(['agentId', 'model', 'provider', 'tokensIn', 'tokensOut', 'costUsd', 'ts']));
  for (const r of data.costRecords) {
    sections.push(toCsvRow([r.agentId, r.model, r.provider, r.tokensIn, r.tokensOut, r.costUsd, r.ts]));
  }

  const blob = new Blob([sections.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Export a single session's data to a file download.
 * Returns false if the session is not found.
 */
export function exportSession(sessionId: string, format: ExportFormat): boolean {
  const data = buildSessionExport(sessionId);
  if (!data) return false;

  const slug = data.session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const date = slugDate();
  const filename = `amc_session_${slug}_${date}.${format}`;

  if (format === 'json') {
    exportAsJson(data, filename);
  } else {
    exportAsCsv(data, filename);
  }
  return true;
}

/**
 * Export all sessions' data as a single JSON bundle.
 */
export function exportAllSessions(format: ExportFormat): void {
  const sessions = useSessionStore.getState().sessions;
  const allData = sessions.map((s) => buildSessionExport(s.id)).filter(Boolean) as SessionExport[];
  const date = slugDate();
  const filename = `amc_all_sessions_${date}.${format}`;

  if (format === 'json') {
    const blob = new Blob(
      [JSON.stringify({ sessions: allData, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    );
    downloadBlob(blob, filename);
  } else {
    const rows: string[] = [];
    for (const data of allData) {
      rows.push(`# Session: ${data.session.name} (${data.session.id})`);
      rows.push(`# Exported at: ${data.exportedAt}`);
      rows.push('');
      // Re-use CSV builder by calling exportAsCsv via a temp structure
      // (write to rows instead of blob — inline the logic here)
      rows.push('Agents');
      rows.push(toCsvRow(['id', 'name', 'role', 'status', 'model', 'costUsd', 'tokensIn', 'tokensOut', 'startedAt']));
      for (const a of data.agents) {
        rows.push(toCsvRow([a.id, a.name, a.role, a.status, a.model, a.costUsd, a.tokensIn, a.tokensOut, a.startedAt]));
      }
      rows.push('Events');
      rows.push(toCsvRow(['agentId', 'type', 'message', 'ts']));
      for (const e of data.events) {
        rows.push(toCsvRow([e.agentId, e.type, e.message, e.ts]));
      }
      rows.push('');
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    downloadBlob(blob, filename);
  }
}
