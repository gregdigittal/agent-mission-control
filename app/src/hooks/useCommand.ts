/**
 * Sends a bridge command via the Supabase `commands` table.
 * Returns { send } — a function that inserts the command record.
 * When Supabase is unavailable, the command is rejected with a descriptive error.
 */
import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { captureException } from '../lib/errorTracking';
import { useAuthStore } from '../stores/authStore';

export type CommandType =
  | 'spawn_agent'
  | 'terminate_agent'
  | 'approve_task'
  | 'update_config'
  | 'pause_agent'
  | 'resume_agent'
  | 'review_loop_agent'
  | 'create_branch'
  | 'switch_branch'
  | 'merge_branch';

export interface BridgeCommand {
  type: CommandType;
  payload: Record<string, unknown>;
}

export function useCommand() {
  const session = useAuthStore((s) => s.session);

  const send = useCallback(async (cmd: BridgeCommand): Promise<string> => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured — commands require Supabase to be set up');
    }

    const id = crypto.randomUUID();

    const { error } = await supabase.from('commands').insert({
      id,
      type: cmd.type,
      payload: cmd.payload,
      session_token: session?.access_token ?? '',
      created_by: session?.user.id ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (error) {
      captureException(new Error(error.message), { tags: { source: 'useCommand', commandType: cmd.type } });
      throw new Error(`Failed to send command: ${error.message}`);
    }

    return id;
  }, [session]);

  return { send };
}
