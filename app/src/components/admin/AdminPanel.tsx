/**
 * AdminPanel — org-level budget caps and model restrictions for workspace owners.
 *
 * Only rendered when the current user is the workspace owner (isOwner === true).
 * Wrapped in a collapsible "Admin" section for use inside settings UI.
 */
import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useAdminConfig } from '../../hooks/useAdminConfig';
import type { AdminConfigUpdate } from '../../hooks/useAdminConfig';

// ──────────────────────────────────────────────────────────────────────────────
// Known model IDs
// ──────────────────────────────────────────────────────────────────────────────

const KNOWN_MODELS: { id: string; label: string }[] = [
  { id: 'claude-opus-4-6',            label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Convert dollar string to cents integer, or null if empty/invalid. */
function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dollars = parseFloat(trimmed);
  if (isNaN(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

/** Convert cents integer to a dollar string for display (e.g. 1050 → "10.50"). */
function centsToDollarString(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toFixed(2);
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function AdminPanel() {
  const { config, updateConfig, isOwner, loading, error } = useAdminConfig();

  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  // Form state — dollar strings so the user can type freely
  const [sessionBudget, setSessionBudget] = useState('');
  const [agentBudget, setAgentBudget]     = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  // Populate form from fetched config
  useEffect(() => {
    if (config) {
      setSessionBudget(centsToDollarString(config.maxSessionBudgetCents));
      setAgentBudget(centsToDollarString(config.maxAgentBudgetCents));
      setSelectedModels(config.allowedModels ?? []);
    }
  }, [config]);

  // Not the owner — nothing to render
  if (!isOwner) return null;

  function handleModelToggle(modelId: string) {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((m) => m !== modelId)
        : [...prev, modelId],
    );
  }

  async function handleSave() {
    setSaveError(null);
    setSaved(false);
    setSaving(true);

    const update: AdminConfigUpdate = {
      maxSessionBudgetCents: dollarsToCents(sessionBudget),
      maxAgentBudgetCents:   dollarsToCents(agentBudget),
      // Empty selection = no restriction (all models allowed)
      allowedModels: selectedModels.length > 0 ? selectedModels : null,
    };

    try {
      await updateConfig(update);
      setSaved(true);
      // Clear saved indicator after 3 s
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 'var(--font-xs)',
    background: 'var(--bg-2)', border: '1px solid var(--border-1)',
    borderRadius: 4, color: 'var(--text-0)',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 4,
  };

  return (
    <div style={{
      border: '1px solid var(--border-1)', borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 14px',
          background: 'var(--bg-2)', fontSize: 'var(--font-xs)',
          color: 'var(--text-1)', fontWeight: 600,
          borderBottom: open ? '1px solid var(--border-0)' : 'none',
        }}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ fontSize: 11, color: 'var(--amber)' }}>⚙</span>
          Admin
        </span>
        <span aria-hidden="true" style={{
          fontSize: 9, color: 'var(--text-3)',
          transform: open ? 'rotate(180deg)' : undefined,
          display: 'inline-block', transition: 'transform 0.15s',
        }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: '16px 14px', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>Loading…</div>
          )}

          {error && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--red)' }}>{error}</div>
          )}

          {/* Budget caps */}
          <section>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
              Budget Caps (USD)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label htmlFor="admin-session-budget" style={labelStyle}>
                  Max session budget — leave blank for no limit
                </label>
                <input
                  id="admin-session-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 10.00"
                  value={sessionBudget}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionBudget(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="admin-agent-budget" style={labelStyle}>
                  Max agent budget — leave blank for no limit
                </label>
                <input
                  id="admin-agent-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2.00"
                  value={agentBudget}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAgentBudget(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* Model restrictions */}
          <section>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
              Allowed Models
            </div>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 8 }}>
              Select the models workspace members are permitted to use.
              Leave all unchecked to allow all models.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {KNOWN_MODELS.map(({ id, label }) => {
                const checked = selectedModels.includes(id);
                return (
                  <label
                    key={id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 'var(--font-xs)', color: 'var(--text-1)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleModelToggle(id)}
                      style={{ accentColor: 'var(--cyan)', width: 14, height: 14 }}
                    />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                      {id}
                    </span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                      — {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Save controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                padding: '7px 18px', borderRadius: 4, fontSize: 'var(--font-xs)',
                fontWeight: 600, background: 'var(--cyan)', color: '#06080c',
                opacity: (saving || loading) ? 0.5 : 1,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            {saved && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--green)' }}>
                Saved
              </span>
            )}

            {saveError && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--red)' }}>
                {saveError}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
