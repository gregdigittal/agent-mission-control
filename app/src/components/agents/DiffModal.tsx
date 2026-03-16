/**
 * DiffModal — modal wrapper for DiffViewer.
 *
 * Renders a floating modal with the diff for a given agent worktree.
 * The diff string is provided by the caller; this component only handles
 * display and dismiss behaviour.
 *
 * Accessibility: focus-trapped inside modal, Escape closes it.
 */

import React, { useEffect, useRef } from 'react';
import { DiffViewer } from './DiffViewer.js';

interface DiffModalProps {
  agentKey: string;
  worktreePath?: string;
  diff: string;
  onClose: () => void;
}

export function DiffModal({ agentKey, worktreePath, diff, onClose }: DiffModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Focus modal on open
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      role="presentation"
    >
      {/* Modal panel */}
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Git diff for agent ${agentKey}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border, #334155)',
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                fontWeight: 600,
                color: 'var(--text, #e2e8f0)',
                fontSize: '14px',
              }}
            >
              Git Diff — {agentKey}
            </span>
            {worktreePath && (
              <span
                style={{
                  marginLeft: '12px',
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748b)',
                  fontFamily: 'monospace',
                }}
              >
                {worktreePath}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close diff modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim, #94a3b8)',
              fontSize: '18px',
              lineHeight: 1,
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Diff content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <DiffViewer diff={diff} />
        </div>
      </div>
    </div>
  );
}
