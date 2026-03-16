import { create } from 'zustand';
import type { CostRecord, SessionBudget } from '../types';

interface CostState {
  records: CostRecord[];
  budgets: Record<string, SessionBudget>;

  setRecords: (records: CostRecord[]) => void;
  addRecord: (record: CostRecord) => void;
  setBudget: (sessionId: string, budget: SessionBudget) => void;
  setBudgets: (budgets: SessionBudget[]) => void;

  totalByAgent: (agentId: string) => number;
  totalBySession: (sessionId: string) => number;
  budgetStatus: (sessionId: string) => 'ok' | 'warning' | 'critical' | 'unknown';
}

export const useCostStore = create<CostState>((set, get) => ({
  records: [],
  budgets: {},

  setRecords: (records) => set({ records }),

  addRecord: (record) =>
    set((s) => ({ records: [...s.records, record] })),

  setBudget: (sessionId, budget) =>
    set((s) => ({ budgets: { ...s.budgets, [sessionId]: budget } })),

  setBudgets: (budgets) =>
    set({ budgets: Object.fromEntries(budgets.map((b) => [b.sessionId, b])) }),

  totalByAgent: (agentId) =>
    get().records
      .filter((r) => r.agentId === agentId)
      .reduce((sum, r) => sum + r.costUsd, 0),

  totalBySession: (sessionId) =>
    get().records
      .filter((r) => r.sessionId === sessionId)
      .reduce((sum, r) => sum + r.costUsd, 0),

  budgetStatus: (sessionId) => {
    const budget = get().budgets[sessionId];
    if (!budget || budget.limitUsd === 0) return 'unknown';
    const pct = budget.spentUsd / budget.limitUsd;
    if (pct >= 0.95) return 'critical';
    if (pct >= 0.80) return 'warning';
    return 'ok';
  },
}));
