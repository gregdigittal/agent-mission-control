import { useState, useEffect } from 'react';
import { useModelConfigStore } from '../../stores/modelConfigStore';
import { getProviderLabel } from '../../lib/cost';
import type { ModelProvider } from '../../types';

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  anthropic: 'var(--cyan)', openai: 'var(--green)', google: 'var(--blue)',
  ollama: 'var(--violet)', custom: 'var(--amber)',
};

interface Props {
  value: string;
  onChange: (modelId: string, provider: ModelProvider) => void;
}

export function ModelSelector({ value, onChange }: Props) {
  const { configs: models, fetchConfigs } = useModelConfigStore();
  const [open, setOpen] = useState(false);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const selected = models.find((m) => m.modelId === value);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px', borderRadius: 4, fontSize: 'var(--font-xs)',
          background: 'var(--bg-4)', border: '1px solid var(--border-2)',
          color: 'var(--text-0)',
        }}
      >
        {selected ? (
          <>
            <span style={{ color: PROVIDER_COLORS[selected.provider], fontSize: 8 }}>●</span>
            {selected.displayName}
          </>
        ) : (
          <span style={{ color: 'var(--text-2)' }}>Select model</span>
        )}
        <span style={{ color: 'var(--text-3)', fontSize: 8 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'var(--bg-3)', border: '1px solid var(--border-2)',
          borderRadius: 6, minWidth: 220, zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {models.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>
              No models configured
            </div>
          ) : (
            models.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.modelId, m.provider); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '7px 12px', textAlign: 'left',
                  fontSize: 'var(--font-xs)',
                  background: m.modelId === value ? 'var(--bg-4)' : 'transparent',
                  color: 'var(--text-0)',
                  borderBottom: '1px solid var(--border-0)',
                }}
              >
                <span style={{ color: PROVIDER_COLORS[m.provider], fontSize: 8 }}>●</span>
                <div>
                  <div>{m.displayName}</div>
                  <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
                    {getProviderLabel(m.provider)} · ${m.inputCostPer1k}/1k in
                  </div>
                </div>
                {m.isDefault && (
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--font-xxs)', color: 'var(--cyan)' }}>default</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
