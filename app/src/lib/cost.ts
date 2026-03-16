import type { ModelProvider } from '../types';

// Default cost rates (USD per 1k tokens) — updated March 2026
const DEFAULT_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6':    { input: 0.015,  output: 0.075 },
  'claude-sonnet-4-6':  { input: 0.003,  output: 0.015 },
  'claude-haiku-4-5':   { input: 0.00025, output: 0.00125 },
  'gpt-4o':             { input: 0.005,  output: 0.015 },
  'gpt-4o-mini':        { input: 0.00015, output: 0.0006 },
  'gemini-2.0-flash':   { input: 0.00010, output: 0.00040 },
  'gemini-2.5-pro':     { input: 0.00125, output: 0.01000 },
};

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  customRates?: { inputCostPer1k: number; outputCostPer1k: number },
): number {
  const rates = customRates
    ? { input: customRates.inputCostPer1k, output: customRates.outputCostPer1k }
    : (DEFAULT_RATES[model] ?? { input: 0.001, output: 0.003 });

  return (tokensIn / 1000) * rates.input + (tokensOut / 1000) * rates.output;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function getBudgetColor(spent: number, limit: number): 'green' | 'amber' | 'red' {
  const pct = spent / limit;
  if (pct >= 0.95) return 'red';
  if (pct >= 0.80) return 'amber';
  return 'green';
}

export function getProviderLabel(provider: ModelProvider): string {
  const labels: Record<ModelProvider, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    ollama: 'Ollama',
    custom: 'Custom',
  };
  return labels[provider];
}
