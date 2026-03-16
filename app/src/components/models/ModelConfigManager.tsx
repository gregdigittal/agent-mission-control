import { useEffect, useState } from 'react';
import { useModelConfigStore } from '../../stores/modelConfigStore';
import type { ModelConfig, ModelProvider } from '../../types';

const PROVIDERS: ModelProvider[] = ['anthropic', 'openai', 'google', 'ollama', 'custom'];

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  anthropic: 'var(--cyan)', openai: 'var(--green)', google: 'var(--blue)',
  ollama: 'var(--violet)', custom: 'var(--amber)',
};

type FormData = {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  inputCostPer1k: string;
  outputCostPer1k: string;
  apiEndpoint: string;
  isDefault: boolean;
};

const emptyForm = (): FormData => ({
  provider: 'anthropic',
  modelId: '',
  displayName: '',
  inputCostPer1k: '',
  outputCostPer1k: '',
  apiEndpoint: '',
  isDefault: false,
});

function configToForm(c: ModelConfig): FormData {
  return {
    provider: c.provider,
    modelId: c.modelId,
    displayName: c.displayName,
    inputCostPer1k: String(c.inputCostPer1k),
    outputCostPer1k: String(c.outputCostPer1k),
    apiEndpoint: c.apiEndpoint ?? '',
    isDefault: c.isDefault,
  };
}

function validateForm(f: FormData): string | null {
  if (!f.modelId.trim()) return 'Model ID is required';
  if (!f.displayName.trim()) return 'Display name is required';
  if (isNaN(Number(f.inputCostPer1k)) || Number(f.inputCostPer1k) < 0) return 'Input cost must be a non-negative number';
  if (isNaN(Number(f.outputCostPer1k)) || Number(f.outputCostPer1k) < 0) return 'Output cost must be a non-negative number';
  return null;
}

export function ModelConfigManager() {
  const { configs, loading, error, fetchConfigs, addConfig, updateConfig, deleteConfig, setDefault } = useModelConfigStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  function startEdit(config: ModelConfig) {
    setEditingId(config.id);
    setForm(configToForm(config));
    setShowAdd(false);
    setFormError(null);
  }

  function startAdd() {
    setShowAdd(true);
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function cancelForm() {
    setEditingId(null);
    setShowAdd(false);
    setFormError(null);
  }

  async function handleSave() {
    const validationError = validateForm(form);
    if (validationError) { setFormError(validationError); return; }
    setSaving(true);
    setFormError(null);
    const patch = {
      provider: form.provider,
      modelId: form.modelId.trim(),
      displayName: form.displayName.trim(),
      inputCostPer1k: Number(form.inputCostPer1k),
      outputCostPer1k: Number(form.outputCostPer1k),
      apiEndpoint: form.apiEndpoint.trim() || undefined,
      isDefault: form.isDefault,
    };
    try {
      if (editingId) {
        await updateConfig(editingId, patch);
      } else {
        await addConfig(patch);
      }
      cancelForm();
    } catch {
      setFormError('Save failed — check the error above');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteConfig(id);
    } catch {
      // error shown via store
    }
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-0)' }}>
          Model Configurations
        </span>
        <button
          onClick={startAdd}
          style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 'var(--font-xs)',
            background: 'var(--cyan)', color: '#000', fontWeight: 600,
          }}
        >
          + Add Model
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--rose)', marginBottom: 8 }}>{error}</div>
      )}

      {loading && configs.length === 0 && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>Loading…</div>
      )}

      {/* Model list */}
      {configs.map((config) => (
        <div key={config.id}>
          {editingId === config.id ? (
            <ConfigForm
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={cancelForm}
              saving={saving}
              error={formError}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6, marginBottom: 4,
              background: 'var(--bg-3)', border: '1px solid var(--border-1)',
            }}>
              <span style={{ color: PROVIDER_COLORS[config.provider], fontSize: 10 }}>●</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-0)', fontWeight: 500 }}>
                  {config.displayName}
                  {config.isDefault && (
                    <span style={{ marginLeft: 6, fontSize: 'var(--font-xxs)', color: 'var(--cyan)' }}>default</span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
                  {config.modelId} · ${config.inputCostPer1k}/1k in · ${config.outputCostPer1k}/1k out
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {!config.isDefault && (
                  <button
                    onClick={() => setDefault(config.id)}
                    style={{ padding: '2px 6px', fontSize: 'var(--font-xxs)', borderRadius: 3, background: 'var(--bg-4)', color: 'var(--text-2)' }}
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => startEdit(config)}
                  style={{ padding: '2px 6px', fontSize: 'var(--font-xxs)', borderRadius: 3, background: 'var(--bg-4)', color: 'var(--text-1)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(config.id, config.displayName)}
                  style={{ padding: '2px 6px', fontSize: 'var(--font-xxs)', borderRadius: 3, background: 'var(--bg-4)', color: 'var(--rose)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {showAdd && (
        <ConfigForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          error={formError}
        />
      )}

      {!loading && configs.length === 0 && !showAdd && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)', padding: '8px 0' }}>
          No models configured. Add one to get started.
        </div>
      )}
    </div>
  );
}

interface ConfigFormProps {
  form: FormData;
  setForm: (f: FormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function ConfigForm({ form, setForm, onSave, onCancel, saving, error }: ConfigFormProps) {
  function field(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });
  }

  const inputStyle = {
    width: '100%', padding: '4px 8px', borderRadius: 4,
    fontSize: 'var(--font-xs)', background: 'var(--bg-4)',
    border: '1px solid var(--border-2)', color: 'var(--text-0)',
  };
  const labelStyle = { fontSize: 'var(--font-xxs)', color: 'var(--text-3)', marginBottom: 2, display: 'block' as const };

  return (
    <div style={{
      padding: 12, borderRadius: 6, background: 'var(--bg-3)',
      border: '1px solid var(--border-2)', marginBottom: 8,
    }}>
      {error && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--rose)', marginBottom: 8 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Provider</label>
          <select value={form.provider} onChange={field('provider')} style={inputStyle}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model ID</label>
          <input value={form.modelId} onChange={field('modelId')} placeholder="claude-sonnet-4-20250514" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Display Name</label>
          <input value={form.displayName} onChange={field('displayName')} placeholder="Claude Sonnet" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>API Endpoint (optional)</label>
          <input value={form.apiEndpoint} onChange={field('apiEndpoint')} placeholder="http://localhost:11434" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Input cost per 1k tokens (USD)</label>
          <input type="number" step="0.001" min="0" value={form.inputCostPer1k} onChange={field('inputCostPer1k')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Output cost per 1k tokens (USD)</label>
          <input type="number" step="0.001" min="0" value={form.outputCostPer1k} onChange={field('outputCostPer1k')} style={inputStyle} />
        </div>
      </div>

      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
        />
        Set as default model
      </label>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '5px 14px', borderRadius: 4, fontSize: 'var(--font-xs)',
            background: saving ? 'var(--bg-4)' : 'var(--cyan)', color: '#000', fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '5px 10px', borderRadius: 4, fontSize: 'var(--font-xs)', background: 'var(--bg-4)', color: 'var(--text-2)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
