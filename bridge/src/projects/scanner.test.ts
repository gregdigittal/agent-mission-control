/**
 * Unit tests — scanner.ts
 *
 * Tests cover:
 * - Returns [] when projects_root is not configured
 * - Skips directories without .git/
 * - Detects node/typescript stack from package.json
 * - Detects python stack from requirements.txt
 * - Sets backlog_path when BACKLOG.md exists, null when it does not
 * - Calls upsert with correct local_path conflict key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../config.js', () => ({
  loadConfig: vi.fn(),
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
}));

vi.mock('../supabase/client.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
}));

import { loadConfig } from '../config.js';
import { getSupabaseAdminClient } from '../supabase/client.js';
import { readdir, stat, access } from 'node:fs/promises';

const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;
const mockGetAdminClient = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const mockReaddir = readdir as ReturnType<typeof vi.fn>;
const mockStat = stat as ReturnType<typeof vi.fn>;
const mockAccess = access as ReturnType<typeof vi.fn>;

function makeAdminClient(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ upsert });
  return { from, upsert };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Default config with projects_root set */
function baseConfig(override: Record<string, unknown> = {}) {
  return {
    projects_root: '/home/user/Development',
    supabase: { url: 'https://project.supabase.co', anon_key: '', enabled: false },
    ...override,
  };
}

/** Make stat() return an is-directory result for paths matching `dirs` */
function setupStat(dirs: string[]) {
  mockStat.mockImplementation(async (p: string) => ({
    isDirectory: () => dirs.some((d) => p === d || p.startsWith(d)),
  }));
}

/** Make access() resolve (file exists) for exact paths in `files`, throw otherwise */
function setupAccess(files: string[]) {
  mockAccess.mockImplementation(async (p: string) => {
    if (files.includes(p)) return;
    throw new Error('ENOENT');
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scanProjects — projects_root not set', () => {
  it('returns empty array when projects_root is undefined', async () => {
    mockLoadConfig.mockResolvedValue({ projects_root: undefined, supabase: {} });
    const { scanProjects } = await import('./scanner.js');
    const result = await scanProjects();
    expect(result).toEqual([]);
    expect(mockGetAdminClient).not.toHaveBeenCalled();
  });
});

describe('scanProjects — skips non-git directories', () => {
  it('skips directories that have no .git/', async () => {
    mockLoadConfig.mockResolvedValue(baseConfig());
    mockReaddir.mockResolvedValue(['no-git-project']);
    setupStat(['/home/user/Development', '/home/user/Development/no-git-project']);
    // access() always throws — no .git/, no BACKLOG.md
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockGetAdminClient.mockResolvedValue(makeAdminClient());

    const { scanProjects } = await import('./scanner.js');
    const result = await scanProjects();
    expect(result).toEqual([]);
  });
});

describe('scanProjects — stack detection', () => {
  it('detects node and typescript stack from package.json', async () => {
    mockLoadConfig.mockResolvedValue(baseConfig());
    mockReaddir.mockResolvedValue(['my-ts-app']);
    setupStat(['/home/user/Development', '/home/user/Development/my-ts-app']);
    setupAccess([
      '/home/user/Development/my-ts-app/.git',
      '/home/user/Development/my-ts-app/package.json',
    ]);
    const upsertChain = makeAdminClient();
    mockGetAdminClient.mockResolvedValue(upsertChain);

    const { scanProjects } = await import('./scanner.js');
    const result = await scanProjects();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('my-ts-app');
    expect(result[0].detected_stack).toContain('node');
    expect(result[0].detected_stack).toContain('typescript');
  });

  it('detects python stack from requirements.txt', async () => {
    mockLoadConfig.mockResolvedValue(baseConfig());
    mockReaddir.mockResolvedValue(['my-python-app']);
    setupStat(['/home/user/Development', '/home/user/Development/my-python-app']);
    setupAccess([
      '/home/user/Development/my-python-app/.git',
      '/home/user/Development/my-python-app/requirements.txt',
    ]);
    const upsertChain = makeAdminClient();
    mockGetAdminClient.mockResolvedValue(upsertChain);

    const { scanProjects } = await import('./scanner.js');
    const result = await scanProjects();

    expect(result).toHaveLength(1);
    expect(result[0].detected_stack).toContain('python');
  });
});

describe('scanProjects — backlog_path', () => {
  it('sets backlog_path when BACKLOG.md exists', async () => {
    mockLoadConfig.mockResolvedValue(baseConfig());
    mockReaddir.mockResolvedValue(['project-with-backlog']);
    setupStat(['/home/user/Development', '/home/user/Development/project-with-backlog']);
    setupAccess([
      '/home/user/Development/project-with-backlog/.git',
      '/home/user/Development/project-with-backlog/BACKLOG.md',
    ]);
    mockGetAdminClient.mockResolvedValue(makeAdminClient());

    const { scanProjects } = await import('./scanner.js');
    const result = await scanProjects();

    expect(result[0].backlog_path).toBe('/home/user/Development/project-with-backlog/BACKLOG.md');
  });

  it('sets backlog_path to null when BACKLOG.md does not exist', async () => {
    mockLoadConfig.mockResolvedValue(baseConfig());
    mockReaddir.mockResolvedValue(['project-no-backlog']);
    setupStat(['/home/user/Development', '/home/user/Development/project-no-backlog']);
    setupAccess([
      '/home/user/Development/project-no-backlog/.git',
      // No BACKLOG.md
    ]);
    mockGetAdminClient.mockResolvedValue(makeAdminClient());

    const { scanProjects } = await import('./scanner.js');
    const result = await scanProjects();

    expect(result[0].backlog_path).toBeNull();
  });
});

describe('scanProjects — upsert', () => {
  it('calls upsert with local_path as the conflict key', async () => {
    mockLoadConfig.mockResolvedValue(baseConfig());
    mockReaddir.mockResolvedValue(['my-project']);
    setupStat(['/home/user/Development', '/home/user/Development/my-project']);
    setupAccess(['/home/user/Development/my-project/.git']);
    const upsertChain = makeAdminClient();
    mockGetAdminClient.mockResolvedValue(upsertChain);

    const { scanProjects } = await import('./scanner.js');
    await scanProjects();

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ local_path: '/home/user/Development/my-project' }),
      ]),
      expect.objectContaining({ onConflict: 'local_path' }),
    );
  });
});
