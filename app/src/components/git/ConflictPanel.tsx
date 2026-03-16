/**
 * ConflictPanel — shows merge conflicts detected between agent worktrees.
 *
 * Reads conflictFiles from the session object (set by the bridge when it detects
 * files touched by multiple concurrent agents). For each conflicting file, the
 * user can choose a resolution strategy and send a resolve_conflict command.
 *
 * TODO[agent-bridge-2]: implement resolve_conflict command handler in
 *   bridge/src/commands/resolveConflict.ts
 */
import { useState, useCallback } from 'react';
import { useCommand } from '../../hooks/useCommand';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ConflictStrategy = 'ours' | 'theirs' | 'manual';

export interface ResolveConflictPayload {
  sessionId: string;
  filePath: string;
  strategy: ConflictStrategy;
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  /** Conflicting file paths (from session.conflictFiles). */
  conflictFiles: string[];
  /**
   * Optional: map from filePath to the two agent names that last touched it.
   * When not provided, agent names are not shown.
   */
  agentsByFile?: Record<string, [string, string]>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Strategy selector sub-component
// ──────────────────────────────────────────────────────────────────────────────

interface StrategySelectorProps {
  value: ConflictStrategy;
  onChange: (s: ConflictStrategy) => void;
}

function StrategySelector({ value, onChange }: StrategySelectorProps) {
  const options: { value: ConflictStrategy; label: string }[] = [
    { value: 'ours',   label: 'Keep Ours'       },
    { value: 'theirs', label: 'Keep Theirs'      },
    { value: 'manual', label: 'Resolve Manually' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Resolution strategy"
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 'var(--font-xxs)', cursor: 'pointer',
            color: value === opt.value ? 'var(--text-0)' : 'var(--text-2)',
          }}
        >
          <input
            type="radio"
            name={`strategy-${opt.value}`}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: 'var(--amber, #f59e0b)', cursor: 'pointer' }}
            aria-label={opt.label}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// File conflict row
// ──────────────────────────────────────────────────────────────────────────────

interface ConflictRowProps {
  sessionId: string;
  filePath: string;
  agents?: [string, string];
}

function ConflictRow({ sessionId, filePath, agents }: ConflictRowProps) {
  const { send } = useCommand();
  const [strategy, setStrategy]   = useState<ConflictStrategy>('ours');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleResolve = useCallback(async () => {
    setResolving(true);
    setError(null);
    try {
      await send({
        type: 'resolve_conflict',
        payload: {
          sessionId,
          filePath,
          strategy,
        } satisfies ResolveConflictPayload,
      });
      setResolved(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setResolving(false);
    }
  }, [send, sessionId, filePath, strategy]);

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-0)',
        display: 'flex', flexDirection: 'column', gap: 6,
        opacity: resolved ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
      data-testid={`conflict-row-${filePath}`}
    >
      {/* File path + agent names */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'var(--font-xxs)',
            color: resolved ? 'var(--text-3)' : 'var(--text-0)',
            wordBreak: 'break-all',
          }}
          title={filePath}
        >
          {filePath}
        </span>

        {resolved && (
          <span style={{
            flexShrink: 0,
            fontSize: 'var(--font-xxs)',
            color: 'var(--green, #10b981)',
            fontWeight: 700,
          }}>
            Resolved
          </span>
        )}
      </div>

      {agents && (
        <div style={{ display: 'flex', gap: 6, fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
          <span style={{ color: 'var(--cyan, #22d3ee)' }}>{agents[0]}</span>
          <span>vs</span>
          <span style={{ color: 'var(--violet, #8b5cf6)' }}>{agents[1]}</span>
        </div>
      )}

      {!resolved && (
        <>
          <StrategySelector value={strategy} onChange={setStrategy} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleResolve}
              disabled={resolving}
              aria-label={`Resolve conflict in ${filePath} using strategy ${strategy}`}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 'var(--font-xxs)',
                fontWeight: 600,
                background: resolving ? 'var(--bg-4)' : 'var(--amber, #f59e0b)',
                color: resolving ? 'var(--text-2)' : '#06080c',
                cursor: resolving ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                border: 'none',
              }}
            >
              {resolving ? 'Resolving…' : 'Resolve'}
            </button>

            {error && (
              <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--rose, #ef4444)' }}>
                {error}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ConflictPanel
// ──────────────────────────────────────────────────────────────────────────────

export function ConflictPanel({ sessionId, conflictFiles, agentsByFile }: Props) {
  if (conflictFiles.length === 0) {
    // Render nothing — consumer guards on conflictFiles.length
    return null;
  }

  return (
    <div
      data-testid="conflict-panel"
      style={{
        border: '1px solid var(--amber, #f59e0b)44',
        borderRadius: 6,
        background: 'var(--amber, #f59e0b)08',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Warning banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'var(--amber, #f59e0b)18',
        borderBottom: '1px solid var(--amber, #f59e0b)33',
      }}>
        <span style={{ fontSize: 14, color: 'var(--amber, #f59e0b)' }} aria-hidden="true">⚠</span>
        <span style={{
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          color: 'var(--amber, #f59e0b)',
        }}>
          {conflictFiles.length} merge conflict{conflictFiles.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* File list */}
      <div role="list" aria-label="Conflicting files">
        {conflictFiles.map((filePath) => (
          <div key={filePath} role="listitem">
            <ConflictRow
              sessionId={sessionId}
              filePath={filePath}
              agents={agentsByFile?.[filePath]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
