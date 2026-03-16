import { useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useCommand } from '../../hooks/useCommand';
import { useNotifications } from '../../hooks/useNotifications';
import { isSupabaseConfigured } from '../../lib/supabase';

interface Props {
  sessionId: string;
}

type MergeStrategy = 'merge' | 'squash' | 'rebase';

export function BranchManager({ sessionId }: Props) {
  const agents = useAgentStore((s) => s.agentsBySession(sessionId));
  const { send } = useCommand();
  const { notify } = useNotifications();

  const [newBranch, setNewBranch] = useState('');
  const [fromRef, setFromRef] = useState('HEAD');
  const [switchTarget, setSwitchTarget] = useState('');
  const [mergeSrc, setMergeSrc] = useState('');
  const [mergeDst, setMergeDst] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('merge');
  const [mergeMsg, setMergeMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div style={{ padding: 'var(--density-pad)', color: 'var(--text-2)', fontSize: 'var(--font-xs)' }}>
        Branch management requires Supabase to be configured.
      </div>
    );
  }

  const agentBranches = agents
    .filter((a) => a.worktree)
    .map((a) => ({
      agentName: a.name,
      agentKey: a.id,
      branch: a.worktree?.split('/').pop() ?? a.worktree ?? '—',
      worktree: a.worktree,
    }));

  async function doCreate() {
    if (!newBranch.trim()) return;
    setBusy(true);
    try {
      await send({ type: 'create_branch', payload: { branch_name: newBranch.trim(), from_ref: fromRef || 'HEAD' } });
      notify({ message: `Branch "${newBranch}" creation queued`, type: 'success' });
      setNewBranch('');
      setFromRef('HEAD');
    } catch (err) {
      notify({ message: `Failed to queue branch: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doSwitch() {
    if (!switchTarget.trim()) return;
    setBusy(true);
    try {
      await send({ type: 'switch_branch', payload: { branch_name: switchTarget.trim() } });
      notify({ message: `Switch to "${switchTarget}" queued`, type: 'success' });
      setSwitchTarget('');
    } catch (err) {
      notify({ message: `Failed: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doMerge() {
    if (!mergeSrc.trim()) return;
    setBusy(true);
    try {
      await send({
        type: 'merge_branch',
        payload: {
          source_branch: mergeSrc.trim(),
          ...(mergeDst.trim() ? { target_branch: mergeDst.trim() } : {}),
          strategy: mergeStrategy,
          ...(mergeMsg.trim() ? { message: mergeMsg.trim() } : {}),
        },
      });
      notify({ message: `Merge of "${mergeSrc}" queued`, type: 'success' });
      setMergeSrc('');
      setMergeDst('');
      setMergeMsg('');
    } catch (err) {
      notify({ message: `Failed: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-1)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-xs)',
    color: 'var(--text-2)',
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-3)',
    border: '1px solid var(--border-1)',
    borderRadius: 4,
    padding: '4px 8px',
    color: 'var(--text-0)',
    fontSize: 'var(--font-xs)',
    width: '100%',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    background: 'var(--blue)22',
    border: '1px solid var(--blue)',
    borderRadius: 4,
    color: 'var(--blue)',
    fontSize: 'var(--font-xs)',
    padding: '4px 12px',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
  };

  return (
    <div style={{ padding: 'var(--density-pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Active agent branches */}
      {agentBranches.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Active Agent Branches</div>
          {agentBranches.map((ab) => (
            <div key={ab.agentKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', gap: 8 }}>
              <span style={{ color: 'var(--text-1)' }}>{ab.agentName}</span>
              <span className="mono" style={{ color: 'var(--cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ab.branch}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Create branch */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Create Branch</div>
        <input
          style={inputStyle}
          placeholder="branch-name"
          value={newBranch}
          onChange={(e) => setNewBranch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doCreate()}
        />
        <input
          style={inputStyle}
          placeholder="from ref (default: HEAD)"
          value={fromRef}
          onChange={(e) => setFromRef(e.target.value)}
        />
        <button style={btnStyle} onClick={doCreate} disabled={busy || !newBranch.trim()}>
          Create
        </button>
      </div>

      {/* Switch branch */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Switch Branch</div>
        <input
          style={inputStyle}
          placeholder="target-branch"
          value={switchTarget}
          onChange={(e) => setSwitchTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSwitch()}
        />
        <button style={btnStyle} onClick={doSwitch} disabled={busy || !switchTarget.trim()}>
          Switch
        </button>
      </div>

      {/* Merge branch */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Merge Branch</div>
        <input
          style={inputStyle}
          placeholder="source branch"
          value={mergeSrc}
          onChange={(e) => setMergeSrc(e.target.value)}
        />
        <input
          style={inputStyle}
          placeholder="into branch (default: current)"
          value={mergeDst}
          onChange={(e) => setMergeDst(e.target.value)}
        />
        <select
          style={{ ...inputStyle, appearance: 'none' }}
          value={mergeStrategy}
          onChange={(e) => setMergeStrategy(e.target.value as MergeStrategy)}
        >
          <option value="merge">Merge commit</option>
          <option value="squash">Squash</option>
          <option value="rebase">Rebase</option>
        </select>
        {mergeStrategy === 'merge' && (
          <input
            style={inputStyle}
            placeholder="commit message (optional)"
            value={mergeMsg}
            onChange={(e) => setMergeMsg(e.target.value)}
          />
        )}
        <button style={btnStyle} onClick={doMerge} disabled={busy || !mergeSrc.trim()}>
          Merge
        </button>
      </div>
    </div>
  );
}
