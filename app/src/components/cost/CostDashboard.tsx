import { useCostStore } from '../../stores/costStore';
import { useAgentStore } from '../../stores/agentStore';
import { formatCost, getBudgetColor } from '../../lib/cost';
import { useCostTracking } from '../../hooks/useCostTracking';

interface Props {
  sessionId: string;
}

export function CostDashboard({ sessionId }: Props) {
  useCostTracking(sessionId);

  const agents = useAgentStore((s) => s.agentsBySession(sessionId));
  const { totalByAgent, budgets } = useCostStore();
  const budget = budgets[sessionId];

  const totalSpent = agents.reduce((sum, a) => sum + a.costUsd, 0);
  const budgetColor = budget ? getBudgetColor(budget.spentUsd, budget.limitUsd) : 'green';

  return (
    <div style={{ padding: 'var(--density-pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session total */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 6, padding: '12px 14px' }}>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 4 }}>Session Spend</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0)', fontFamily: "'JetBrains Mono', monospace" }}>
          {formatCost(totalSpent)}
        </div>

        {budget && (
          <>
            <div style={{ margin: '10px 0 4px', height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (budget.spentUsd / budget.limitUsd) * 100)}%`,
                background: `var(--${budgetColor})`,
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
              <span>{formatCost(budget.spentUsd)} spent</span>
              <span>limit {formatCost(budget.limitUsd)}</span>
            </div>
            {budget.burnRatePerHour > 0 && (
              <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--amber)', marginTop: 4 }}>
                Burn rate: {formatCost(budget.burnRatePerHour)}/hr
              </div>
            )}
            {budgetColor === 'red' && (
              <div style={{
                marginTop: 8, padding: '6px 8px', background: 'var(--red)22',
                border: '1px solid var(--red)', borderRadius: 4,
                fontSize: 'var(--font-xs)', color: 'var(--red)',
              }}>
                ⚠ Budget critical — consider pausing agents
              </div>
            )}
            {budgetColor === 'amber' && (
              <div style={{
                marginTop: 8, padding: '6px 8px', background: 'var(--amber)22',
                border: '1px solid var(--amber)', borderRadius: 4,
                fontSize: 'var(--font-xs)', color: 'var(--amber)',
              }}>
                Budget 80%+ used
              </div>
            )}
          </>
        )}
      </div>

      {/* Per-agent breakdown */}
      <div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 8 }}>Per Agent</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map((agent) => {
            const cost = totalByAgent(agent.id);
            const pct = totalSpent > 0 ? (cost / totalSpent) * 100 : 0;
            return (
              <div key={agent.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 'var(--font-xs)' }}>
                  <span style={{ color: 'var(--text-1)' }}>{agent.name}</span>
                  <span className="mono" style={{ color: 'var(--amber)' }}>{formatCost(cost)}</span>
                </div>
                <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--amber)', transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
