import { useMemo } from 'react';
import { useCostStore } from '../../stores/costStore';
import { useSessionStore } from '../../stores/sessionStore';
import { formatCost, getBudgetColor, getProviderLabel } from '../../lib/cost';
import type { ModelProvider } from '../../types';

/** Centralized billing view: all-time totals, per-session breakdown, model mix. */
export function BillingDashboard() {
  const records = useCostStore((s) => s.records);
  const budgets = useCostStore((s) => s.budgets);
  const sessions = useSessionStore((s) => s.sessions);

  const totals = useMemo(() => {
    const totalUsd = records.reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokensIn = records.reduce((sum, r) => sum + r.tokensIn, 0);
    const totalTokensOut = records.reduce((sum, r) => sum + r.tokensOut, 0);
    return { totalUsd, totalTokensIn, totalTokensOut };
  }, [records]);

  const bySession = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.sessionId, (map.get(r.sessionId) ?? 0) + r.costUsd);
    }
    return Array.from(map.entries())
      .map(([sessionId, cost]) => {
        const session = sessions.find((s) => s.id === sessionId);
        return { sessionId, cost, label: session?.name ?? sessionId.slice(0, 8) };
      })
      .sort((a, b) => b.cost - a.cost);
  }, [records, sessions]);

  const byProvider = useMemo(() => {
    const map = new Map<ModelProvider, number>();
    for (const r of records) {
      map.set(r.provider, (map.get(r.provider) ?? 0) + r.costUsd);
    }
    return Array.from(map.entries())
      .map(([provider, cost]) => ({ provider, cost }))
      .sort((a, b) => b.cost - a.cost);
  }, [records]);

  const byModel = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.model, (map.get(r.model) ?? 0) + r.costUsd);
    }
    return Array.from(map.entries())
      .map(([model, cost]) => ({ model, cost }))
      .sort((a, b) => b.cost - a.cost);
  }, [records]);

  const totalBudget = useMemo(() => {
    const allBudgets = Object.values(budgets);
    return {
      totalLimit: allBudgets.reduce((sum, b) => sum + b.limitUsd, 0),
      totalSpent: allBudgets.reduce((sum, b) => sum + b.spentUsd, 0),
    };
  }, [budgets]);

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-1)',
    borderRadius: 6,
    padding: '12px 14px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-xs)',
    color: 'var(--text-2)',
    marginBottom: 8,
  };

  return (
    <div style={{ padding: 'var(--density-pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* All-time totals */}
      <div style={sectionStyle}>
        <div style={labelStyle}>All-Time Spend</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0)', fontFamily: "'JetBrains Mono', monospace" }}>
              {formatCost(totals.totalUsd)}
            </div>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>Total USD</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', fontFamily: "'JetBrains Mono', monospace" }}>
              {totals.totalTokensIn.toLocaleString()}
            </div>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>Tokens In</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', fontFamily: "'JetBrains Mono', monospace" }}>
              {totals.totalTokensOut.toLocaleString()}
            </div>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>Tokens Out</div>
          </div>
        </div>

        {/* Aggregate budget bar */}
        {totalBudget.totalLimit > 0 && (() => {
          const budgetColor = getBudgetColor(totalBudget.totalSpent, totalBudget.totalLimit);
          return (
            <div style={{ marginTop: 12 }}>
              <div style={{ margin: '0 0 4px', height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (totalBudget.totalSpent / totalBudget.totalLimit) * 100)}%`,
                  background: `var(--${budgetColor})`,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
                <span>{formatCost(totalBudget.totalSpent)} across {Object.keys(budgets).length} sessions</span>
                <span>total limit {formatCost(totalBudget.totalLimit)}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Per-session breakdown */}
      {bySession.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>By Session</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bySession.map(({ sessionId, cost, label }) => {
              const pct = totals.totalUsd > 0 ? (cost / totals.totalUsd) * 100 : 0;
              const budget = budgets[sessionId];
              const budgetColor = budget ? getBudgetColor(budget.spentUsd, budget.limitUsd) : undefined;
              return (
                <div key={sessionId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 'var(--font-xs)' }}>
                    <span style={{ color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      {label}
                    </span>
                    <span className="mono" style={{ color: budgetColor ? `var(--${budgetColor})` : 'var(--amber)' }}>
                      {formatCost(cost)}
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--amber)', transition: 'width 0.3s' }} />
                  </div>
                  {budget && budget.burnRatePerHour > 0 && (
                    <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)', marginTop: 2 }}>
                      {formatCost(budget.burnRatePerHour)}/hr
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider mix */}
      {byProvider.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>By Provider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {byProvider.map(({ provider, cost }) => {
              const pct = totals.totalUsd > 0 ? (cost / totals.totalUsd) * 100 : 0;
              return (
                <div key={provider} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-xs)' }}>
                  <span style={{ color: 'var(--text-1)', width: 80, flexShrink: 0 }}>{getProviderLabel(provider)}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', transition: 'width 0.3s' }} />
                  </div>
                  <span className="mono" style={{ color: 'var(--text-1)', width: 56, textAlign: 'right', flexShrink: 0 }}>
                    {formatCost(cost)}
                  </span>
                  <span style={{ color: 'var(--text-2)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Model breakdown */}
      {byModel.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>By Model</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {byModel.map(({ model, cost }) => {
              const pct = totals.totalUsd > 0 ? (cost / totals.totalUsd) * 100 : 0;
              return (
                <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-xs)' }}>
                  <span
                    style={{ color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={model}
                  >
                    {model}
                  </span>
                  <span className="mono" style={{ color: 'var(--text-1)', width: 56, textAlign: 'right', flexShrink: 0 }}>
                    {formatCost(cost)}
                  </span>
                  <span style={{ color: 'var(--text-2)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 'var(--font-xs)', padding: '24px 0' }}>
          No cost records yet. Run agents to see billing data.
        </div>
      )}
    </div>
  );
}
