/**
 * CreatePrModal — modal for creating a pull request from a session worktree.
 *
 * Sends a `create_pr` command via the existing IPC command pattern.
 * The bridge-side handler is out of scope for this agent.
 *
 * TODO[agent-bridge]: implement create_pr command handler in bridge/src/commands/
 */
import { useState, useCallback } from 'react';
import { useCommand } from '../../hooks/useCommand';
import type { Session } from '../../types';

// ──────────────────────────────────────────────────────────────────────────────
// Command type
// ──────────────────────────────────────────────────────────────────────────────

export interface CreatePrCommandPayload {
  sessionId: string;
  title: string;
  body: string;
  baseBranch: string;  // default: 'main'
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  session: Session;
  /** Branch name for the session worktree (read-only display) */
  branchName?: string;
  /** Commits in the session worktree — for display only */
  commits?: string[];
  /** Diff summary — line count or N commits string */
  diffSummary?: string;
  onClose: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function CreatePrModal({ session, branchName, commits, diffSummary, onClose }: Props) {
  const { send } = useCommand();

  const [title, setTitle]           = useState(session.name);
  const [body, setBody]             = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [submitted, setSubmitted]   = useState(false);

  const resolvedBranch = branchName ?? `session/${session.id}`;
  const commitCount    = commits?.length ?? 0;
  const diffLabel      = diffSummary ?? (commitCount > 0 ? `${commitCount} commit${commitCount !== 1 ? 's' : ''}` : 'No commits');

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('PR title is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await send({
        type: 'create_pr',
        payload: {
          sessionId: session.id,
          title: title.trim(),
          body: body.trim(),
          baseBranch: baseBranch.trim() || 'main',
        } satisfies CreatePrCommandPayload,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [send, session.id, title, body, baseBranch]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-pr-title"
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-1)',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-0)',
        }}>
          <h2
            id="create-pr-title"
            style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-0)', margin: 0 }}
          >
            Create Pull Request
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {submitted ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              color: 'var(--green)', fontSize: 'var(--font-sm)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div>PR command sent to bridge</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 4 }}>
                The bridge will create the PR in your git host.
              </div>
            </div>
          ) : (
            <>
              {/* Branch (read-only) */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Branch
                </label>
                <div style={{
                  padding: '6px 10px',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border-0)',
                  borderRadius: 5,
                  fontSize: 'var(--font-xs)',
                  color: 'var(--cyan)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}>
                  {resolvedBranch}
                </div>
              </div>

              {/* Diff summary */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 'var(--font-xs)', color: 'var(--text-2)',
              }}>
                <span style={{ color: 'var(--text-3)' }}>Changes:</span>
                <span>{diffLabel}</span>
              </div>

              {/* Commits list */}
              {commits && commits.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Commits ({commits.length})
                  </label>
                  <ul style={{
                    listStyle: 'none', padding: '6px 10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border-0)',
                    borderRadius: 5,
                    maxHeight: 120, overflowY: 'auto',
                    margin: 0,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {commits.map((msg, i) => (
                      <li key={i} style={{ fontSize: 'var(--font-xs)', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ color: 'var(--text-3)', marginRight: 6 }}>•</span>
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Base branch */}
              <div>
                <label htmlFor="pr-base-branch" style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Base Branch
                </label>
                <input
                  id="pr-base-branch"
                  type="text"
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '6px 10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border-1)',
                    borderRadius: 5,
                    color: 'var(--text-0)',
                    fontSize: 'var(--font-xs)',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                  placeholder="main"
                />
              </div>

              {/* PR title */}
              <div>
                <label htmlFor="pr-title" style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PR Title <span style={{ color: 'var(--rose)' }}>*</span>
                </label>
                <input
                  id="pr-title"
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError(null); }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '6px 10px',
                    background: 'var(--bg-3)',
                    border: `1px solid ${error && !title.trim() ? 'var(--rose)' : 'var(--border-1)'}`,
                    borderRadius: 5,
                    color: 'var(--text-0)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                  }}
                  placeholder="Describe your changes"
                />
              </div>

              {/* PR body */}
              <div>
                <label htmlFor="pr-body" style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Description
                </label>
                <textarea
                  id="pr-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '6px 10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border-1)',
                    borderRadius: 5,
                    color: 'var(--text-0)',
                    fontSize: 'var(--font-xs)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Describe what this PR changes and why…"
                />
              </div>

              {/* Error message */}
              {error && (
                <div style={{
                  padding: '8px 10px',
                  background: 'var(--rose)22',
                  border: '1px solid var(--rose)',
                  borderRadius: 5,
                  color: 'var(--rose)',
                  fontSize: 'var(--font-xs)',
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--border-0)',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px', borderRadius: 5, fontSize: 'var(--font-xs)',
                color: 'var(--text-2)', border: '1px solid var(--border-1)',
                background: 'transparent',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '6px 16px', borderRadius: 5, fontSize: 'var(--font-xs)',
                background: submitting ? 'var(--bg-4)' : 'var(--cyan)',
                color: submitting ? 'var(--text-2)' : '#06080c',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Sending…' : 'Create PR'}
            </button>
          </div>
        )}

        {submitted && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '10px 16px',
            borderTop: '1px solid var(--border-0)',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 16px', borderRadius: 5, fontSize: 'var(--font-xs)',
                background: 'var(--bg-3)', color: 'var(--text-1)',
                border: '1px solid var(--border-1)',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CreatePrButton — convenience trigger for session cards / detail panels
// ──────────────────────────────────────────────────────────────────────────────

interface ButtonProps {
  session: Session;
  branchName?: string;
  commits?: string[];
  diffSummary?: string;
}

export function CreatePrButton({ session, branchName, commits, diffSummary }: ButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Create pull request for session ${session.name}`}
        title="Create Pull Request"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 4, fontSize: 'var(--font-xxs)',
          color: 'var(--cyan)', border: '1px solid var(--cyan)44',
          background: 'var(--cyan)11',
          cursor: 'pointer',
          transition: 'background 0.15s',
          fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}
      >
        <span aria-hidden="true">⤷</span>
        PR
      </button>

      {open && (
        <CreatePrModal
          session={session}
          branchName={branchName}
          commits={commits}
          diffSummary={diffSummary}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
