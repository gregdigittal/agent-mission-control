import { useEffect, useState } from 'react';
import { useVpsStore } from '../../stores/vpsStore';
import type { VpsHealth, VpsNode } from '../../types';

const HEALTH_COLORS: Record<VpsHealth, string> = {
  healthy: 'var(--green)', degraded: 'var(--amber)', offline: 'var(--rose)',
};

const HEALTH_LABEL: Record<VpsHealth, string> = {
  healthy: 'healthy', degraded: 'degraded', offline: 'offline',
};

interface RegisterForm {
  name: string;
  host: string;
  region: string;
  agentCapacity: string;
}

const emptyForm = (): RegisterForm => ({ name: '', host: '', region: '', agentCapacity: '5' });

function validateForm(f: RegisterForm): string | null {
  if (!f.name.trim()) return 'Name is required';
  if (!f.host.trim()) return 'Hostname or IP is required';
  const cap = Number(f.agentCapacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) return 'Capacity must be between 1 and 100';
  return null;
}

export function VPSManager() {
  const { nodes, loading, error, fetchNodes, addNode, removeNode } = useVpsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RegisterForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  async function handleAdd() {
    const validationError = validateForm(form);
    if (validationError) { setFormError(validationError); return; }
    setSaving(true);
    setFormError(null);
    try {
      await addNode({
        name: form.name.trim(),
        host: form.host.trim(),
        region: form.region.trim() || 'unknown',
        agentCapacity: Number(form.agentCapacity),
      });
      setShowAdd(false);
      setForm(emptyForm());
    } catch {
      setFormError('Registration failed — check the error above');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(node: VpsNode) {
    if (!window.confirm(`Remove "${node.name}" (${node.host})? The bridge will stop monitoring it.`)) return;
    try { await removeNode(node.id); } catch { /* error shown via store */ }
  }

  const inputStyle = {
    width: '100%', padding: '4px 8px', borderRadius: 4,
    fontSize: 'var(--font-xs)', background: 'var(--bg-4)',
    border: '1px solid var(--border-2)', color: 'var(--text-0)',
  };

  return (
    <div style={{ padding: 'var(--density-pad)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-0)' }}>
          VPS Nodes
          {nodes.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
              {nodes.filter((n) => n.health === 'healthy').length}/{nodes.length} healthy
            </span>
          )}
        </span>
        <button
          onClick={() => { setShowAdd((v) => !v); setFormError(null); }}
          style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 'var(--font-xs)',
            background: 'var(--cyan)', color: '#000', fontWeight: 600,
          }}
        >
          {showAdd ? 'Cancel' : '+ Register'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--rose)' }}>{error}</div>
      )}

      {/* Registration form */}
      {showAdd && (
        <div style={{ padding: 12, borderRadius: 6, background: 'var(--bg-3)', border: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
            Register new VPS node
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
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Host / IP</label>
              <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.10 or hostname" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Region</label>
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="eu-west-1" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Max agents</label>
              <input type="number" min="1" max="100" value={form.agentCapacity} onChange={(e) => setForm({ ...form, agentCapacity: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 10 }}>
            SSH credentials are configured in the bridge's <code>vps-registry.json</code>. The dashboard stores only the host metadata.
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 'var(--font-xs)',
              background: saving ? 'var(--bg-4)' : 'var(--cyan)', color: '#000', fontWeight: 600,
            }}
          >
            {saving ? 'Registering…' : 'Register VPS'}
          </button>
        </div>
      )}

      {/* Node list */}
      {loading && nodes.length === 0 && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>Loading…</div>
      )}

      {!loading && nodes.length === 0 && !showAdd && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)', textAlign: 'center', marginTop: 12 }}>
          No VPS nodes registered. Click + Register to add one.
        </div>
      )}

      {nodes.map((node) => {
        const color = HEALTH_COLORS[node.health];
        const agentPct = node.agentCapacity > 0 ? (node.agentCount / node.agentCapacity) * 100 : 0;
        const heartbeatAgo = node.lastHeartbeat
          ? Math.round((Date.now() - new Date(node.lastHeartbeat).getTime()) / 1000)
          : null;

        return (
          <div key={node.id} style={{
            background: 'var(--bg-2)', border: `1px solid ${color}44`,
            borderRadius: 6, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-0)', flex: 1 }}>
                {node.name}
              </span>
              <span style={{
                fontSize: 'var(--font-xxs)', color,
                background: `${color}22`, borderRadius: 3, padding: '1px 5px',
              }}>
                {HEALTH_LABEL[node.health]}
              </span>
              <span className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
                {node.region}
              </span>
              <button
                onClick={() => handleRemove(node)}
                style={{ marginLeft: 4, padding: '1px 6px', fontSize: 'var(--font-xxs)', borderRadius: 3, background: 'var(--bg-4)', color: 'var(--rose)' }}
              >
                Remove
              </button>
            </div>

            <div className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 8 }}>
              {node.host}
              {heartbeatAgo !== null && (
                <span style={{ marginLeft: 8 }}>
                  · last seen {heartbeatAgo < 60 ? `${heartbeatAgo}s` : `${Math.round(heartbeatAgo / 60)}m`} ago
                </span>
              )}
            </div>

            {/* Agent capacity bar */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xxs)', color: 'var(--text-2)', marginBottom: 3 }}>
                <span>Agents</span>
                <span>{node.agentCount}/{node.agentCapacity}</span>
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
            {node.cpuPercent != null && (
              <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
                <span>CPU {node.cpuPercent}%</span>
                {node.memPercent != null && <span>MEM {node.memPercent}%</span>}
                {node.diskPercent != null && <span>DISK {node.diskPercent}%</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
