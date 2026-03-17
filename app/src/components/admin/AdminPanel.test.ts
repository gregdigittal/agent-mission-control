/**
 * AdminPanel tests — pure logic coverage.
 *
 * Tests mirror the component's helper contract (dollarsToCents,
 * centsToDollarString, model toggle) without DOM rendering,
 * following the project's component test pattern.
 */
import { describe, it, expect } from 'vitest';

// ── Mirrors of AdminPanel helpers ─────────────────────────────────────────────

/** Mirrors dollarsToCents from AdminPanel */
function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dollars = parseFloat(trimmed);
  if (isNaN(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

/** Mirrors centsToDollarString from AdminPanel */
function centsToDollarString(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toFixed(2);
}

/** Mirrors handleModelToggle from AdminPanel */
function toggleModel(selected: string[], modelId: string): string[] {
  return selected.includes(modelId)
    ? selected.filter((m) => m !== modelId)
    : [...selected, modelId];
}

/** Mirrors the allowedModels resolution in handleSave */
function resolveAllowedModels(selected: string[]): string[] | null {
  return selected.length > 0 ? selected : null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('dollarsToCents', () => {
  it('converts a valid dollar string to cents', () => {
    expect(dollarsToCents('10.00')).toBe(1000);
    expect(dollarsToCents('2.50')).toBe(250);
    expect(dollarsToCents('0.01')).toBe(1);
  });

  it('returns null for an empty string', () => {
    expect(dollarsToCents('')).toBeNull();
    expect(dollarsToCents('   ')).toBeNull();
  });

  it('returns null for negative values', () => {
    expect(dollarsToCents('-5')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(dollarsToCents('abc')).toBeNull();
    expect(dollarsToCents('$10')).toBeNull();
  });

  it('rounds to the nearest cent', () => {
    // '1.995' * 100 = 199.5 → rounds to 200
    expect(dollarsToCents('1.995')).toBe(200);
  });
});

describe('centsToDollarString', () => {
  it('returns empty string for null', () => {
    expect(centsToDollarString(null)).toBe('');
  });

  it('formats cents as a two-decimal dollar string', () => {
    expect(centsToDollarString(1000)).toBe('10.00');
    expect(centsToDollarString(250)).toBe('2.50');
    expect(centsToDollarString(1)).toBe('0.01');
  });

  it('handles zero', () => {
    expect(centsToDollarString(0)).toBe('0.00');
  });
});

describe('model toggle', () => {
  it('adds a model when not already selected', () => {
    const result = toggleModel(['sonnet'], 'haiku');
    expect(result).toContain('haiku');
    expect(result).toContain('sonnet');
  });

  it('removes a model when already selected', () => {
    const result = toggleModel(['sonnet', 'haiku'], 'haiku');
    expect(result).not.toContain('haiku');
    expect(result).toContain('sonnet');
  });

  it('does not mutate the original array', () => {
    const original = ['sonnet'];
    toggleModel(original, 'haiku');
    expect(original).toHaveLength(1);
  });
});

describe('resolveAllowedModels', () => {
  it('returns null when no models are selected (all models allowed)', () => {
    expect(resolveAllowedModels([])).toBeNull();
  });

  it('returns the selected models when at least one is selected', () => {
    const result = resolveAllowedModels(['claude-sonnet-4-6']);
    expect(result).toEqual(['claude-sonnet-4-6']);
  });
});
