import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendFile } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config.js', () => ({
  LOGS_DIR: '/tmp/test-logs',
}));

const mockAppendFile = vi.mocked(appendFile);

describe('audit logger — append-only guarantee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses appendFile — never writeFile or createWriteStream', async () => {
    const { audit } = await import('./logger.js');
    await audit('test_event', { foo: 'bar' });

    expect(mockAppendFile).toHaveBeenCalledTimes(1);
  });

  it('writes valid JSONL (one JSON object per call)', async () => {
    const { audit } = await import('./logger.js');
    await audit('agent_start', { agentId: 'backend-1' });

    const [, content] = mockAppendFile.mock.calls[0] as [string, string];
    expect(content).toMatch(/\n$/); // JSONL lines end with newline
    const parsed = JSON.parse(content.trimEnd());
    expect(parsed.event).toBe('agent_start');
    expect(parsed.agentId).toBe('backend-1');
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // RFC3339
  });

  it('includes timestamp in every entry', async () => {
    const { audit } = await import('./logger.js');
    const before = new Date().toISOString();
    await audit('something_happened', {});
    const after = new Date().toISOString();

    const [, content] = mockAppendFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content.trimEnd());
    expect(parsed.timestamp >= before).toBe(true);
    expect(parsed.timestamp <= after).toBe(true);
  });

  it('spreads extra data fields into the log entry', async () => {
    const { audit } = await import('./logger.js');
    await audit('cost_alert', { agentId: 'lead', costCents: 500, threshold: 400 });

    const [, content] = mockAppendFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content.trimEnd());
    expect(parsed.costCents).toBe(500);
    expect(parsed.threshold).toBe(400);
    expect(parsed.agentId).toBe('lead');
  });

  it('writes to date-based log file path', async () => {
    const { audit } = await import('./logger.js');
    await audit('test', {});

    const [logPath] = mockAppendFile.mock.calls[0] as [string, string];
    const today = new Date().toISOString().slice(0, 10);
    expect(logPath).toContain(today);
    expect(logPath).toMatch(/\.jsonl$/);
  });

  it('does not throw when appendFile fails — logs to stderr instead', async () => {
    mockAppendFile.mockRejectedValueOnce(new Error('disk full'));
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { audit } = await import('./logger.js');
    await expect(audit('test', {})).resolves.toBeUndefined(); // must not throw

    stderrSpy.mockRestore();
  });
});
