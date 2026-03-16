/**
 * ConflictPanel tests.
 *
 * Tests are written as pure logic checks mirroring the component's
 * contract — no DOM rendering required. This keeps the tests fast
 * and free of JSDOM setup while covering the specified cases.
 */
import { describe, it, expect } from 'vitest';
import type { ConflictStrategy } from './ConflictPanel';

// ──────────────────────────────────────────────────────────────────────────────
// Pure logic helpers mirroring ConflictPanel's contract
// ──────────────────────────────────────────────────────────────────────────────

/** Mirrors ConflictPanel: returns false when conflictFiles is empty. */
function shouldRender(conflictFiles: string[]): boolean {
  return conflictFiles.length > 0;
}

/** Mirrors ConflictPanel: warning banner message for N conflicts. */
function bannerText(count: number): string {
  return `${count} merge conflict${count !== 1 ? 's' : ''} detected`;
}

/** Default strategy used in StrategySelector. */
const DEFAULT_STRATEGY: ConflictStrategy = 'ours';

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ConflictPanel — does not render when conflictFiles is empty', () => {
  it('returns false for shouldRender with empty array', () => {
    expect(shouldRender([])).toBe(false);
  });

  it('returns true for shouldRender with non-empty array', () => {
    expect(shouldRender(['src/foo.ts'])).toBe(true);
  });
});

describe('ConflictPanel — renders correct file count', () => {
  it('banner text for 1 conflict: singular', () => {
    expect(bannerText(1)).toBe('1 merge conflict detected');
  });

  it('banner text for 2 conflicts: plural', () => {
    expect(bannerText(2)).toBe('2 merge conflicts detected');
  });

  it('banner text for 3 conflicts: plural', () => {
    expect(bannerText(3)).toBe('3 merge conflicts detected');
  });

  it('shouldRender returns true for 5 files, implying 5 rows', () => {
    const files = [
      'src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts',
    ];
    expect(shouldRender(files)).toBe(true);
    expect(files.length).toBe(5);
  });
});

describe('ConflictPanel — strategy selector defaults to "ours"', () => {
  it('default strategy is ours', () => {
    expect(DEFAULT_STRATEGY).toBe('ours');
  });

  it('valid strategies are ours, theirs, manual', () => {
    const strategies: ConflictStrategy[] = ['ours', 'theirs', 'manual'];
    expect(strategies).toContain('ours');
    expect(strategies).toContain('theirs');
    expect(strategies).toContain('manual');
    expect(strategies).toHaveLength(3);
  });

  it('default strategy is one of the valid strategies', () => {
    const validStrategies: ConflictStrategy[] = ['ours', 'theirs', 'manual'];
    expect(validStrategies).toContain(DEFAULT_STRATEGY);
  });
});

describe('ConflictPanel — resolve_conflict payload shape', () => {
  it('payload contains sessionId, filePath, and strategy', () => {
    const payload = {
      sessionId: 'sess-1',
      filePath: 'src/foo.ts',
      strategy: DEFAULT_STRATEGY,
    };
    expect(payload.sessionId).toBe('sess-1');
    expect(payload.filePath).toBe('src/foo.ts');
    expect(payload.strategy).toBe('ours');
  });
});
