import { useEffect, useState } from 'react';
import { useVpsStore } from '../../stores/vpsStore';
import type { VpsNode } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  online: 'var(--green)',
  degraded: 'var(--amber)',
  offline: 'var(--rose)',
};

interface ManualForm {
  name: string;
  hostname: string;
  region: string;
  maxAgents: string;
}

const emptyForm = (): ManualForm => ({ name: '', hostname: '', region: '', maxAgents: '5' });

function validateForm(f: ManualForm): string | null {
  if (!f.name.trim()) return 'Label is required';
  if (!f.hostname.trim()) return 'Hostname or IP is required';
  const cap = Number(f.maxAgents);
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) return 'Max agents must be 1–100';
  return null;
}

export function VPSManager() {
  const { nodes, loading, error, fetchNodes, addNode, removeNode } = useVpsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  async function handleAdd() {
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError(null);
    try {
      await addNode({
        name: form.name.trim(),
        hostname: form.hostname.trim(),
        region: form.region.trim() || 'unknown',
        maxAgents: Number(form.maxAgents),
      });
      setShowAdd(false);
      setForm(emptyForm());
    } catch {
      setFormError('Registration failed — see error above');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(node: VpsNode) {
    if (!window.confirm(`Remove "${node.name}"? The bridge will re-register itself on next start.`)) return;
    try { await removeNode(node.id); } catch { /* error shown via store */ }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px 8px', borderRadius: 4,
    fontSize: 'var(--font-xs)', background: 'var(--bg-4)',
    border: '1px solid var(--border-2)', color: 'var(--text-0)',
  };

  const onlineCount = nodes.filter((n) => n.status === 'online').length;

  return (
    <div style={{ padding: 'var(--density-pad)', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-0)' }}>
            Infrastructure
          </span>
          {nodes.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
              {onlineCount}/{nodes.length} online
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowAdd((v) => !v); setFormError(null); setForm(emptyForm()); }}
          style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 'var(--font-xs)',
            background: showAdd ? 'var(--bg-4)' : 'var(--cyan)',
            color: showAdd ? 'var(--text-2)' : '#000',
            border: showAdd ? '1px solid var(--border-1)' : 'none',
            fontWeight: 600,
          }}
        >
          {showAdd ? 'Cancel' : '+ Add manually'}
        </button>
      </div>

      {/* How it works callout */}
      {nodes.length === 0 && !showAdd && (
        <div style={{
          padding: '12px 14px', borderRadius: 6,
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          fontSize: 'var(--font-xs)', color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--cyan)', marginBottom: 6 }}>
            How to connect your VPS
          </div>
          <div>
            The bridge running on your VPS registers itself automatically. Set these env vars in your bridge
            <code style={{ background: 'var(--bg-4)', padding: '0 4px', borderRadius: 3, margin: '0 2px' }}>.env</code>
            and restart it:
          </div>
          <pre style={{
            marginTop: 10, padding: '8px 10px', borderRadius: 5,
            background: 'var(--bg-4)', fontSize: 'var(--font-xxs)',
            color: 'var(--green)', overflowX: 'auto', lineHeight: 1.7,
          }}>{`SUPABASE_URL=<your project URL>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
VPS_OWNER_USER_ID=<your user ID from Supabase Auth>
VPS_NODE_ID=prod-vps-1
VPS_REGION=eu-west-1`}</pre>
          <div style={{ marginTop: 8, color: 'var(--text-3)' }}>
            Your VPS will appear here within 30 seconds of the bridge starting.
            Use <em>+ Add manually</em> only if the bridge can't reach Supabase.
          </div>
        </div>
      )}

      {/* Store-level error */}
      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 5,
          background: 'var(--rose)18', border: '1px solid var(--rose)',
          fontSize: 'var(--font-xs)', color: 'var(--rose)',
        }}>
          {error}
        </div>
      )}

      {/* Manual registration form */}
      {showAdd && (
        <div style={{ padding: 12, borderRadius: 6, background: 'var(--bg-3)', border: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
            Add node manually
          </div>
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 10 }}>
            Use this only if the bridge can't self-register. The bridge will update the record when it connects.
          </div>
          {formError && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--rose)', marginBottom: 8 }}>{formError}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Label</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="prod-vps-1" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Hostname / IP</label>
              <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="192.168.1.10" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Region</label>
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="eu-west-1" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Max agents</label>
              <input type="number" min="1" max="100" value={form.maxAgents} onChange={(e) => setForm({ ...form, maxAgents: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 'var(--font-xs)',
              background: saving ? 'var(--bg-4)' : 'var(--cyan)',
              color: saving ? 'var(--text-3)' : '#000',
              fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save node'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && nodes.length === 0 && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>Loading…</div>
      )}

      {/* Node cards */}
      {nodes.map((node) => {
        const color = STATUS_COLOR[node.status] ?? 'var(--text-3)';
        const agentPct = node.max_concurrent_agents > 0
          ? (node.current_agent_count / node.max_concurrent_agents) * 100
          : 0;
        const heartbeatAgo = node.last_heartbeat
          ? Math.round((Date.now() - new Date(node.last_heartbeat).getTime()) / 1000)
          : null;
        const region = node.system_info?.region;
        const cpu = node.system_info?.cpu_percent;
        const mem = node.system_info?.mem_percent;
        const disk = node.system_info?.disk_percent;

        return (
          <div key={node.id} style={{
            background: 'var(--bg-2)', border: `1px solid ${color}44`,
            borderRadius: 6, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-0)', flex: 1 }}>
                {node.name}
              </span>
              <span style={{
                fontSize: 'var(--font-xxs)', color,
                background: `${color}22`, borderRadius: 3, padding: '1px 5px',
              }}>
                {node.status}
              </span>
              {region && (
                <span className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
                  {region}
                </span>
              )}
              {node.agent_bridge_version && (
                <span className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
                  v{node.agent_bridge_version}
                </span>
              )}
              <button
                onClick={() => handleRemove(node)}
                style={{ marginLeft: 4, padding: '1px 6px', fontSize: 'var(--font-xxs)', borderRadius: 3, background: 'var(--bg-4)', color: 'var(--rose)', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>

            <div className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 8 }}>
              {node.hostname}
              {heartbeatAgo !== null && (
                <span style={{ marginLeft: 8 }}>
                  · last seen {heartbeatAgo < 60 ? `${heartbeatAgo}s` : `${Math.round(heartbeatAgo / 60)}m`} ago
                </span>
              )}
              {heartbeatAgo === null && (
                <span style={{ marginLeft: 8, color: 'var(--rose)' }}>· never connected</span>
              )}
            </div>

            {/* Agent capacity bar */}
            <div style={{ marginBottom: cpu != null ? 6 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xxs)', color: 'var(--text-2)', marginBottom: 3 }}>
                <span>Agents</span>
                <span>{node.current_agent_count}/{node.max_concurrent_agents}</span>
              </div>
              <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${agentPct}%`,
                  background: agentPct > 80 ? 'var(--amber)' : 'var(--cyan)',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>

            {/* System metrics */}
            {cpu != null && (
              <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
                <span>CPU {cpu}%</span>
                {mem != null && <span>MEM {mem}%</span>}
                {disk != null && <span>DISK {disk}%</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
