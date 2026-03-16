import { useEffect } from 'react';
import { subscribeToTable } from '../lib/realtime';
import { useCostStore } from '../stores/costStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface RawCostRow {
  agent_id: string;
  session_id: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  ts: string;
}

export function useCostTracking(sessionId: string): void {
  const { setRecords, addRecord } = useCostStore();

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    supabase
      .from('events')
      .select('agent_id,session_id,model,tokens_in,tokens_out,cost_usd,ts')
      .eq('session_id', sessionId)
      .not('cost_usd', 'is', null)
      .then(({ data, error }) => {
        if (error) { console.error('[cost] load error:', error); return; }
        if (data) {
          setRecords((data as RawCostRow[]).map(mapRow));
        }
      });

    const unsub = subscribeToTable('events', (payload) => {
      const p = payload as { eventType: string; new: RawCostRow };
      if (p.eventType === 'INSERT' && p.new?.session_id === sessionId && p.new?.cost_usd) {
        addRecord(mapRow(p.new));
      }
    });

    return unsub;
  }, [sessionId, setRecords, addRecord]);
}

function mapRow(r: RawCostRow) {
  return {
    agentId: r.agent_id,
    sessionId: r.session_id,
    model: r.model,
    provider: 'anthropic' as const,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    costUsd: r.cost_usd,
    ts: r.ts,
  };
}
