import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useNotifications } from '../../hooks/useNotifications';
import type { ApprovalRequest, RiskLevel } from '../../types';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'var(--green)',
  medium: 'var(--amber)',
  high: 'var(--red)',
  critical: 'var(--rose)',
};

const RISK_ICONS: Record<RiskLevel, string> = {
  low: '🟢', medium: '🟡', high: '🔴', critical: '🚨',
};

interface Props {
  sessionId: string;
}

export function ApprovalQueue({ sessionId }: Props) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { notify } = useNotifications();
  // Track IDs already seen so we only notify on genuinely new arrivals
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    supabase
      .from('approval_queue')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setApprovals(data as ApprovalRequest[]); });

    const channel = supabase
      .channel(`approvals:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_queue' }, () => {
        supabase!
          .from('approval_queue')
          .select('*')
          .eq('session_id', sessionId)
          .eq('status', 'pending')
          .then(({ data }) => {
            if (!data) return;
            const fresh = data as ApprovalRequest[];
            // Fire a notification for any approval that hasn't been seen yet
            for (const req of fresh) {
              if (!seenIds.current.has(req.id)) {
                seenIds.current.add(req.id);
                notify(`Approval required — ${req.action}`, {
                  body: req.description,
                  icon: '/icon-192.png',
                  tag: `approval-${req.id}`,
                });
              }
            }
            setApprovals(fresh);
          });
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIPTION_ERROR') console.error('[approvals] subscription error');
      });

    return () => { supabase?.removeChannel(channel); };
  }, [sessionId]);

  async function resolve(id: string, approved: boolean, reason?: string) {
    if (!supabase) return;
    const now = new Date().toISOString();
    await supabase.from('approval_queue').update({
      status: approved ? 'approved' : 'rejected',
      resolved_at: now,
      rejection_reason: reason ?? null,
    }).eq('id', id);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    setRejecting(null);
    setRejectReason('');
  }

  if (approvals.length === 0) {
    return (
      <div style={{ padding: 'var(--density-pad)', color: 'var(--text-3)', fontSize: 'var(--font-xs)', textAlign: 'center', marginTop: 24 }}>
        No pending approvals
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--density-pad)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 4 }}>
        {approvals.length} pending action{approvals.length > 1 ? 's' : ''}
      </div>

      {approvals.map((a) => (
        <div key={a.id} style={{
          background: 'var(--bg-2)', borderRadius: 6, padding: '10px 12px',
          border: `1px solid ${RISK_COLORS[a.riskLevel]}44`,
          boxShadow: `0 0 6px ${RISK_COLORS[a.riskLevel]}22`,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>{RISK_ICONS[a.riskLevel]}</span>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-0)', flex: 1 }}>
              {a.action}
            </span>
            <span style={{
              fontSize: 'var(--font-xxs)', color: RISK_COLORS[a.riskLevel],
              background: RISK_COLORS[a.riskLevel] + '22', padding: '1px 5px', borderRadius: 3,
              textTransform: 'uppercase',
            }}>
              {a.riskLevel}
            </span>
          </div>

          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-1)', marginBottom: 6 }}>
            {a.description}
          </div>

          {a.files && a.files.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {a.files.map((f) => (
                <div key={f} className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)', padding: '1px 0' }}>
                  {f}
                </div>
              ))}
            </div>
          )}

          {/* Reject input */}
          {rejecting === a.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                autoFocus
                placeholder="Reason for rejection…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && resolve(a.id, false, rejectReason)}
                style={{ width: '100%', fontSize: 'var(--font-xs)', padding: '5px 8px' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => resolve(a.id, false, rejectReason)} style={{ flex: 1, padding: '4px 0', borderRadius: 3, fontSize: 'var(--font-xxs)', background: 'var(--red)', color: '#fff' }}>
                  Reject
                </button>
                <button onClick={() => setRejecting(null)} style={{ flex: 1, padding: '4px 0', borderRadius: 3, fontSize: 'var(--font-xxs)', background: 'var(--bg-4)', color: 'var(--text-2)', border: '1px solid var(--border-1)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => resolve(a.id, true)} style={{ flex: 2, padding: '5px 0', borderRadius: 3, fontSize: 'var(--font-xxs)', background: 'var(--green)', color: '#06080c', fontWeight: 600 }}>
                Approve
              </button>
              <button onClick={() => setRejecting(a.id)} style={{ flex: 1, padding: '5px 0', borderRadius: 3, fontSize: 'var(--font-xxs)', background: 'var(--bg-4)', color: 'var(--red)', border: '1px solid var(--red)44' }}>
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
