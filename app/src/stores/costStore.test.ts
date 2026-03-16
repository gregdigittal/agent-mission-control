import { describe, it, expect, beforeEach } from 'vitest';
import { useCostStore } from './costStore';
import type { CostRecord, SessionBudget } from '../types';

function makeRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    agentId: 'agent-1',
    sessionId: 'sess-1',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    tokensIn: 500,
    tokensOut: 300,
    costUsd: 0.1,
    ts: new Date().toISOString(),
    ...overrides,
  };
}

function makeBudget(overrides: Partial<SessionBudget> = {}): SessionBudget {
  return {
    sessionId: 'sess-1',
    limitUsd: 10,
    spentUsd: 0,
    burnRatePerHour: 0.5,
    ...overrides,
  };
}

describe('costStore', () => {
  beforeEach(() => {
    useCostStore.setState({ records: [], budgets: {} });
  });

  it('totalByAgent — sums cost records for a given agent', () => {
    useCostStore.getState().setRecords([
      makeRecord({ agentId: 'agent-1', costUsd: 0.1 }),
      makeRecord({ agentId: 'agent-1', costUsd: 0.2 }),
      makeRecord({ agentId: 'agent-2', costUsd: 0.5 }),
    ]);
    expect(useCostStore.getState().totalByAgent('agent-1')).toBeCloseTo(0.3);
    expect(useCostStore.getState().totalByAgent('agent-2')).toBeCloseTo(0.5);
  });

  it('totalBySession — sums cost records for a session across agents', () => {
    useCostStore.getState().setRecords([
      makeRecord({ sessionId: 'sess-1', costUsd: 0.1 }),
      makeRecord({ sessionId: 'sess-1', costUsd: 0.3 }),
      makeRecord({ sessionId: 'sess-2', costUsd: 1.0 }),
    ]);
    expect(useCostStore.getState().totalBySession('sess-1')).toBeCloseTo(0.4);
  });

  it('budgetStatus — returns "ok" when well under limit', () => {
    useCostStore.getState().setBudget('sess-1', makeBudget({ limitUsd: 10, spentUsd: 0.5 }));
    expect(useCostStore.getState().budgetStatus('sess-1')).toBe('ok');
  });

  it('budgetStatus — returns "warning" at 80% of limit', () => {
    useCostStore.getState().setBudget('sess-1', makeBudget({ limitUsd: 10, spentUsd: 8.0 }));
    expect(useCostStore.getState().budgetStatus('sess-1')).toBe('warning');
  });

  it('budgetStatus — returns "critical" at 95% of limit', () => {
    useCostStore.getState().setBudget('sess-1', makeBudget({ limitUsd: 10, spentUsd: 9.5 }));
    expect(useCostStore.getState().budgetStatus('sess-1')).toBe('critical');
  });

  it('budgetStatus — returns "unknown" when no budget is configured', () => {
    expect(useCostStore.getState().budgetStatus('sess-no-budget')).toBe('unknown');
  });

  it('addRecord — appends to records without replacing existing', () => {
    useCostStore.getState().setRecords([makeRecord()]);
    useCostStore.getState().addRecord(makeRecord({ costUsd: 0.9 }));
    expect(useCostStore.getState().records).toHaveLength(2);
  });

  it('setBudgets — indexes budgets by sessionId', () => {
    useCostStore.getState().setBudgets([
      makeBudget({ sessionId: 's1', spentUsd: 1 }),
      makeBudget({ sessionId: 's2', spentUsd: 2 }),
    ]);
    expect(useCostStore.getState().budgets['s1'].spentUsd).toBe(1);
    expect(useCostStore.getState().budgets['s2'].spentUsd).toBe(2);
  });
});
