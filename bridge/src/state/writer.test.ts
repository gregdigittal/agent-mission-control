import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFile, rename } from 'node:fs/promises';
import type { DashboardState } from './aggregator.js';

// Mock fs/promises to verify call order and arguments
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}));

// Mock config so we don't need real paths
vi.mock('../config.js', () => ({
  DASHBOARD_STATE_PATH: '/tmp/test-state/dashboard_state.json',
  HEARTBEAT_PATH: '/tmp/test-state/heartbeat.json',
  AGENTS_STATE_DIR: '/tmp/test-state/agents',
}));

const mockWriteFile = vi.mocked(writeFile);
const mockRename = vi.mocked(rename);

describe('writer — atomic write pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writeDashboardState writes to .tmp then renames to final path', async () => {
    const { writeDashboardState } = await import('./writer.js');
    const state: DashboardState = {
      sessions: [],
      timestamp: '2026-03-15T00:00:00.000Z',
      bridgeUptime: 0,
    };

    await writeDashboardState(state);

    // Verify atomic pattern: writeFile to .tmp, then rename to final
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);

    const [writePath] = mockWriteFile.mock.calls[0] as [string, string];
    const [tmpPath, finalPath] = mockRename.mock.calls[0] as [string, string];

    expect(writePath).toBe(tmpPath);
    expect(writePath).toMatch(/\.tmp$/);
    expect(finalPath).toBe('/tmp/test-state/dashboard_state.json');
    expect(finalPath).not.toMatch(/\.tmp$/);
  });

  it('writeDashboardState serialises state as JSON', async () => {
    const { writeDashboardState } = await import('./writer.js');
    const state: DashboardState = {
      sessions: [{ id: 'sess-1', name: 'Test', status: 'active', agents: [], totalCost: 0, currentStage: 0 }],
      timestamp: '2026-03-15T00:00:00.000Z',
      bridgeUptime: 3600,
    };

    await writeDashboardState(state);

    const [, content] = mockWriteFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].id).toBe('sess-1');
    expect(parsed.bridgeUptime).toBe(3600);
  });

  it('writeHeartbeat writes to .tmp then renames to heartbeat path', async () => {
    const { writeHeartbeat } = await import('./writer.js');

    await writeHeartbeat();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);

    const [writePath] = mockWriteFile.mock.calls[0] as [string, string];
    const [, finalPath] = mockRename.mock.calls[0] as [string, string];

    expect(writePath).toMatch(/\.tmp$/);
    expect(finalPath).toBe('/tmp/test-state/heartbeat.json');
  });

  it('writeHeartbeat includes required heartbeat fields', async () => {
    const { writeHeartbeat } = await import('./writer.js');

    await writeHeartbeat();

    const [, content] = mockWriteFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('pid');
    expect(parsed).toHaveProperty('uptime');
    expect(parsed).toHaveProperty('memory');
    expect(typeof parsed.pid).toBe('number');
  });

  it('writeAgentState writes to correct agent path atomically', async () => {
    const { writeAgentState } = await import('./writer.js');

    await writeAgentState('backend-1', { status: 'working', task: 'implement feature' });

    const [writePath] = mockWriteFile.mock.calls[0] as [string, string];
    const [, finalPath] = mockRename.mock.calls[0] as [string, string];

    expect(writePath).toMatch(/\.tmp$/);
    expect(finalPath).toBe('/tmp/test-state/agents/backend-1.json');
  });
});
