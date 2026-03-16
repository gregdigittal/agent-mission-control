import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// We test the processor using real temp directories to avoid over-mocking.
// Mocks are only applied to external side-effectful modules.

vi.mock('../commands/spawn.js', () => ({
  spawnAgent: vi.fn().mockResolvedValue(undefined),
  agentProcesses: new Map(),
}));
vi.mock('../commands/terminate.js', () => ({
  terminateAgent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../commands/approve.js', () => ({
  handleApproval: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../config.js', async () => {
  // Use a fresh temp dir per test run
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const base = join(tmpdir(), `bridge-test-${Date.now()}`);
  return {
    COMMANDS_DIR: join(base, 'commands'),
    PROCESSED_DIR: join(base, 'commands', '.processed'),
    reloadConfig: vi.fn(),
  };
});
vi.mock('../security/token.js', () => ({
  validateToken: vi.fn().mockResolvedValue(true),
}));

async function setupTestDirs(): Promise<{ commandsDir: string; processedDir: string }> {
  const { COMMANDS_DIR, PROCESSED_DIR } = await import('../config.js');
  await mkdir(PROCESSED_DIR, { recursive: true });
  return { commandsDir: COMMANDS_DIR, processedDir: PROCESSED_DIR };
}

function makeCommand(type: string, payload: Record<string, unknown> = {}, token = 'valid-token') {
  return {
    id: randomBytes(8).toString('hex'),
    type,
    timestamp: new Date().toISOString(),
    session_token: token,
    payload,
  };
}

describe('command processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when command directory has no cmd_ files', async () => {
    await setupTestDirs();
    const { processCommands } = await import('./processor.js');
    const count = await processCommands();
    expect(count).toBe(0);
  });

  it('processes a valid spawn_agent command and archives it', async () => {
    const { commandsDir, processedDir } = await setupTestDirs();
    const { spawnAgent } = await import('./spawn.js');
    const { processCommands } = await import('./processor.js');

    const cmd = makeCommand('spawn_agent', {
      session_id: 'sess-1',
      agent_key: 'backend',
      role: 'backend',
    });
    const fileName = `cmd_${Date.now()}.json`;
    await writeFile(join(commandsDir, fileName), JSON.stringify(cmd));

    const count = await processCommands();

    expect(count).toBe(1);
    expect(spawnAgent).toHaveBeenCalledOnce();

    // File should be archived
    const remaining = await readdir(commandsDir);
    expect(remaining.filter((f) => f.startsWith('cmd_'))).toHaveLength(0);

    const archived = await readdir(processedDir);
    expect(archived).toContain(fileName);
  });

  it('rejects a command with an invalid token and does not execute it', async () => {
    const { commandsDir } = await setupTestDirs();
    const { validateToken } = await import('../security/token.js');
    const { spawnAgent } = await import('./spawn.js');
    const { audit } = await import('../audit/logger.js');
    const { processCommands } = await import('./processor.js');

    vi.mocked(validateToken).mockResolvedValueOnce(false);

    const cmd = makeCommand('spawn_agent', {
      session_id: 'sess-1',
      agent_key: 'backend',
      role: 'backend',
    }, 'bad-token');
    await writeFile(join(commandsDir, 'cmd_bad.json'), JSON.stringify(cmd));

    await processCommands();

    expect(spawnAgent).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith('command_rejected', expect.objectContaining({ reason: 'invalid_token' }));
  });

  it('moves malformed JSON command files to processed without crashing', async () => {
    const { commandsDir, processedDir } = await setupTestDirs();
    const { processCommands } = await import('./processor.js');

    await writeFile(join(commandsDir, 'cmd_malformed.json'), '{invalid json}}}');

    // Must not throw
    await expect(processCommands()).resolves.toBeDefined();

    // File should be archived despite the parse error
    const archived = await readdir(processedDir);
    expect(archived).toContain('cmd_malformed.json');
  });

  it('handles update_config command by calling reloadConfig', async () => {
    const { commandsDir } = await setupTestDirs();
    const { reloadConfig } = await import('../config.js');
    const { processCommands } = await import('./processor.js');

    const cmd = makeCommand('update_config', {});
    await writeFile(join(commandsDir, 'cmd_reload.json'), JSON.stringify(cmd));

    await processCommands();

    expect(reloadConfig).toHaveBeenCalledOnce();
  });
});
